//! Camada de interface HTTP do Acervo: rotas, extratores, conversão de `LibraryError`
//! em `problem+json` ([project/code-style-03]) e montagem dos casos de uso.

pub mod articles;
pub mod books;
pub mod dto;
pub mod files;
pub mod openapi;
pub mod videos;

use std::sync::Arc;

use axum::Json;
use axum::Router;
use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, FromRequest, FromRequestParts, Query, Request};
use axum::http::request::Parts;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, patch, put};
use serde::de::DeserializeOwned;
use uuid::Uuid;

use self::dto::{
    CreateHighlightRequest, CreateItemNoteRequest, HighlightList, HighlightResponse, ItemNoteList,
    ItemNoteResponse, ReadingPositionRequest, ReadingPositionResponse, UpdateHighlightRequest,
    UpdateItemNoteRequest,
};
use super::application::articles::ArticleService;
use super::application::books::BookService;
use super::application::files::FileService;
use super::application::ports::ThumbnailFetcher;
use super::application::videos::VideoService;
use super::application::{Env, HighlightInput, ItemOps, ListQuery, NoteInput};
use super::domain::ItemRef;
use super::domain::article::ReadingStatus;
use super::domain::error::LibraryError;
use super::domain::item_note::ItemNoteChanges;
use super::domain::library_file::{IMAGE_MAX_BYTES, LibraryFile, PDF_MAX_BYTES};
use super::infrastructure::oembed_thumbnail_fetcher::OembedThumbnailFetcher;
use super::infrastructure::pg_articles::PgArticleRepository;
use super::infrastructure::pg_books::PgBookRepository;
use super::infrastructure::pg_files::PgFileStore;
use super::infrastructure::pg_item_notes::PgItemRepository;
use super::infrastructure::pg_videos::PgVideoRepository;
use crate::http::AppState;
use crate::shared::error::{ApiError, FieldError};
use crate::shared::pagination::{Cursor, DEFAULT_LIMIT, MAX_LIMIT};
use crate::shared::visibility::Visibility;

pub(crate) fn validation(field: &str, code: &str) -> ApiError {
    ApiError::unprocessable("validation_failed", vec![FieldError::new(field, code)])
}

impl From<LibraryError> for ApiError {
    fn from(error: LibraryError) -> Self {
        match error {
            // Dado de outro usuário também é 404: não revela que ele existe (RNF-02).
            LibraryError::BookNotFound => Self::not_found("book_not_found"),
            LibraryError::ArticleNotFound => Self::not_found("article_not_found"),
            LibraryError::VideoNotFound => Self::not_found("video_not_found"),
            LibraryError::FileNotFound => Self::not_found("file_not_found"),
            LibraryError::CoverNotFound => Self::not_found("cover_not_found"),
            LibraryError::ReadingSessionNotFound => Self::not_found("reading_session_not_found"),
            LibraryError::ItemNoteNotFound => Self::not_found("item_note_not_found"),
            LibraryError::HighlightNotFound => Self::not_found("highlight_not_found"),
            LibraryError::PdfRequired => Self::unprocessable(
                "pdf_required",
                vec![FieldError::new("file_id", "pdf_required")],
            ),
            LibraryError::HighlightFileMismatch => Self::unprocessable(
                "highlight_file_mismatch",
                vec![FieldError::new("file_id", "mismatch")],
            ),
            LibraryError::UnsupportedFileType => Self::new(
                StatusCode::UNSUPPORTED_MEDIA_TYPE,
                "unsupported_file_type",
                "Unsupported Media Type",
            ),
            LibraryError::FileTooLarge => Self::new(
                StatusCode::PAYLOAD_TOO_LARGE,
                "file_too_large",
                "Content Too Large",
            ),
            LibraryError::Validation { field, code } => validation(field, code),
            LibraryError::InvalidCursor => validation("cursor", "invalid"),
            LibraryError::Infrastructure(cause) => Self::internal_from(cause.as_ref()),
        }
    }
}

/// Resposta de um arquivo do Acervo: tipo gravado no envio, nome gerado a partir do id,
/// `nosniff` e sem cache; `attachment` só quando o download é pedido (RF-70).
pub(crate) fn file_response(
    file: &LibraryFile,
    bytes: Bytes,
    download: bool,
) -> Result<Response, ApiError> {
    let disposition = if download { "attachment" } else { "inline" };
    let content_type =
        HeaderValue::from_str(&file.content_type).map_err(|_| ApiError::internal())?;
    let content_disposition = HeaderValue::from_str(&format!(
        "{disposition}; filename=\"{}\"",
        file.download_name()
    ))
    .map_err(|_| ApiError::internal())?;
    let headers = [
        (header::CONTENT_TYPE, content_type),
        (header::CONTENT_DISPOSITION, content_disposition),
        (
            header::X_CONTENT_TYPE_OPTIONS,
            HeaderValue::from_static("nosniff"),
        ),
        (
            header::CACHE_CONTROL,
            HeaderValue::from_static("private, no-store"),
        ),
    ];
    Ok((StatusCode::OK, headers, bytes).into_response())
}

/// Resposta de um arquivo enviado: os cabeçalhos de `file_response`, com cache privado
/// porque o conteúdo de um id nunca muda (um envio novo gera outro id), `ETag` pelo
/// hash e, num trecho, 206 com `Content-Range` (RF-27).
pub(crate) fn stored_file_response(
    file: &LibraryFile,
    bytes: Bytes,
    download: bool,
    part: Option<(u64, u64)>,
) -> Result<Response, ApiError> {
    let mut response = file_response(file, bytes, download)?;
    let etag =
        HeaderValue::from_str(&format!("\"{}\"", file.sha256)).map_err(|_| ApiError::internal())?;
    let headers = response.headers_mut();
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=3600"),
    );
    headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    headers.insert(header::ETAG, etag);
    let Some((start, end)) = part else {
        return Ok(response);
    };
    let content_range = HeaderValue::from_str(&format!("bytes {start}-{end}/{}", file.size_bytes))
        .map_err(|_| ApiError::internal())?;
    response
        .headers_mut()
        .insert(header::CONTENT_RANGE, content_range);
    *response.status_mut() = StatusCode::PARTIAL_CONTENT;
    Ok(response)
}

/// 416 com o tamanho em `Content-Range`, para o cliente refazer o pedido (CB-10).
pub(crate) fn range_not_satisfiable(size: u64) -> Response {
    let mut response = ApiError::new(
        StatusCode::RANGE_NOT_SATISFIABLE,
        "range_not_satisfiable",
        "Range Not Satisfiable",
    )
    .into_response();
    let headers = response.headers_mut();
    if let Ok(content_range) = HeaderValue::from_str(&format!("bytes */{size}")) {
        headers.insert(header::CONTENT_RANGE, content_range);
    }
    headers.insert(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    response
}

/// Corpo JSON cuja falha de leitura vira `problem+json` com código estável.
pub struct ValidJson<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned> FromRequest<S> for ValidJson<T> {
    type Rejection = ApiError;

    async fn from_request(request: Request, state: &S) -> Result<Self, Self::Rejection> {
        axum::Json::<T>::from_request(request, state)
            .await
            .map(|axum::Json(value)| Self(value))
            .map_err(|_| validation("body", "invalid"))
    }
}

/// Query string cuja falha de leitura vira `problem+json`.
pub struct ValidQuery<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned> FromRequestParts<S> for ValidQuery<T> {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        Query::<T>::from_request_parts(parts, state)
            .await
            .map(|Query(value)| Self(value))
            .map_err(|_| validation("query", "invalid"))
    }
}

/// Corpo cru de um envio de arquivo; passar do limite da rota vira 413 `file_too_large`.
pub struct Upload(pub Bytes);

impl<S: Send + Sync> FromRequest<S> for Upload {
    type Rejection = ApiError;

    async fn from_request(request: Request, state: &S) -> Result<Self, Self::Rejection> {
        Bytes::from_request(request, state)
            .await
            .map(Self)
            .map_err(|rejection| match rejection.status() {
                StatusCode::PAYLOAD_TOO_LARGE => LibraryError::FileTooLarge.into(),
                _ => validation("body", "invalid"),
            })
    }
}

/// Extrator do id do recurso no caminho: um id malformado é tratado como inexistente.
/// Os caminhos são completos porque a macro expande no arquivo de quem a chama.
macro_rules! id_extractor {
    ($name:ident, $code:literal) => {
        pub struct $name(pub uuid::Uuid);

        impl<S: Send + Sync> axum::extract::FromRequestParts<S> for $name {
            type Rejection = crate::shared::error::ApiError;

            async fn from_request_parts(
                parts: &mut axum::http::request::Parts,
                state: &S,
            ) -> Result<Self, Self::Rejection> {
                axum::extract::Path::<uuid::Uuid>::from_request_parts(parts, state)
                    .await
                    .map(|axum::extract::Path(id)| Self(id))
                    .map_err(|_| crate::shared::error::ApiError::not_found($code))
            }
        }
    };
}

/// Extrator do id do item e do id do registro filho (sessão ou nota) no caminho.
macro_rules! child_extractor {
    ($name:ident, $code:literal) => {
        pub struct $name(pub uuid::Uuid, pub uuid::Uuid);

        impl<S: Send + Sync> axum::extract::FromRequestParts<S> for $name {
            type Rejection = crate::shared::error::ApiError;

            async fn from_request_parts(
                parts: &mut axum::http::request::Parts,
                state: &S,
            ) -> Result<Self, Self::Rejection> {
                axum::extract::Path::<(uuid::Uuid, uuid::Uuid)>::from_request_parts(parts, state)
                    .await
                    .map(|axum::extract::Path((item, child))| Self(item, child))
                    .map_err(|_| crate::shared::error::ApiError::not_found($code))
            }
        }
    };
}

pub(crate) use child_extractor;
pub(crate) use id_extractor;

fn env(state: &AppState) -> Env {
    Env {
        clock: state.clock.clone(),
        ids: state.ids.clone(),
    }
}

pub(crate) fn file_service(state: &AppState) -> FileService<PgFileStore> {
    FileService::new(PgFileStore::from_state(state), env(state))
}

pub(crate) fn book_service(state: &AppState) -> BookService<PgBookRepository, PgFileStore> {
    BookService::new(
        PgBookRepository::from_state(state),
        file_service(state),
        env(state),
    )
}

pub(crate) fn article_service(
    state: &AppState,
) -> ArticleService<PgArticleRepository, PgFileStore> {
    ArticleService::new(
        PgArticleRepository::from_state(state),
        file_service(state),
        env(state),
    )
}

/// Sem `ThumbnailFetcher` na `Extension`, vale o oEmbed real, com o cliente HTTP do servidor.
pub(crate) fn video_service(
    state: &AppState,
    fetcher: Option<Arc<dyn ThumbnailFetcher>>,
) -> VideoService<PgVideoRepository, PgFileStore> {
    let fetcher =
        fetcher.unwrap_or_else(|| Arc::new(OembedThumbnailFetcher::new(state.http_client.clone())));
    VideoService::new(
        PgVideoRepository::from_state(state),
        file_service(state),
        fetcher,
        env(state),
    )
}

pub(crate) fn item_ops(state: &AppState) -> ItemOps<PgItemRepository> {
    ItemOps::new(PgItemRepository::from_state(state), env(state))
}

/// Valida o limite (1 a 100) e o cursor de uma listagem.
pub(crate) fn list_query(
    cursor: Option<&str>,
    limit: Option<u32>,
    text: Option<String>,
    tag: Option<String>,
    visibility: Option<Visibility>,
    reading_status: Option<ReadingStatus>,
) -> Result<ListQuery, ApiError> {
    let limit = limit.unwrap_or(DEFAULT_LIMIT);
    if !(1..=MAX_LIMIT).contains(&limit) {
        return Err(validation("limit", "out_of_range"));
    }
    let cursor = cursor
        .map(Cursor::decode)
        .transpose()
        .map_err(|_| validation("cursor", "invalid"))?;
    Ok(ListQuery {
        text,
        tag,
        visibility,
        reading_status,
        book_status: None,
        video_status: None,
        cursor,
        limit,
    })
}

/// Rotas relativas: a TASK-18 as monta sob `/api/v1`.
pub fn router() -> Router<AppState> {
    let pdf_limit = DefaultBodyLimit::max(PDF_MAX_BYTES);
    let image_limit = DefaultBodyLimit::max(IMAGE_MAX_BYTES);
    Router::new()
        .route("/books", get(books::list_books).post(books::create_book))
        .route(
            "/books/{id}",
            get(books::get_book)
                .patch(books::update_book)
                .delete(books::delete_book),
        )
        .route(
            "/books/{id}/cover",
            get(books::get_book_cover)
                .put(books::put_book_cover)
                .delete(books::delete_book_cover)
                .layer(image_limit),
        )
        .route("/books/{id}/pdf", put(books::put_book_pdf).layer(pdf_limit))
        .route(
            "/books/{id}/reading-sessions",
            get(books::list_reading_sessions).post(books::create_reading_session),
        )
        .route(
            "/books/{id}/reading-sessions/{session_id}",
            patch(books::update_reading_session).delete(books::delete_reading_session),
        )
        .route(
            "/books/{id}/book-notes",
            get(books::list_book_notes).post(books::create_book_note),
        )
        .route(
            "/books/{id}/book-notes/{note_id}",
            patch(books::update_book_note).delete(books::delete_book_note),
        )
        .route(
            "/books/{id}/reading-position",
            get(books::get_book_position).put(books::put_book_position),
        )
        .route(
            "/books/{id}/highlights",
            get(books::list_book_highlights).post(books::create_book_highlight),
        )
        .route(
            "/books/{id}/highlights/{highlight_id}",
            patch(books::update_book_highlight).delete(books::delete_book_highlight),
        )
        .route(
            "/articles",
            get(articles::list_articles).post(articles::create_article),
        )
        .route(
            "/articles/{id}",
            get(articles::get_article)
                .patch(articles::update_article)
                .delete(articles::delete_article),
        )
        .route(
            "/articles/{id}/cover",
            get(articles::get_article_cover)
                .put(articles::put_article_cover)
                .delete(articles::delete_article_cover)
                .layer(image_limit),
        )
        .route(
            "/articles/{id}/pdf",
            put(articles::put_article_pdf).layer(pdf_limit),
        )
        .route(
            "/articles/{id}/article-notes",
            get(articles::list_article_notes).post(articles::create_article_note),
        )
        .route(
            "/articles/{id}/article-notes/{note_id}",
            patch(articles::update_article_note).delete(articles::delete_article_note),
        )
        .route(
            "/articles/{id}/reading-position",
            get(articles::get_article_position).put(articles::put_article_position),
        )
        .route(
            "/articles/{id}/highlights",
            get(articles::list_article_highlights).post(articles::create_article_highlight),
        )
        .route(
            "/articles/{id}/highlights/{highlight_id}",
            patch(articles::update_article_highlight).delete(articles::delete_article_highlight),
        )
        .route(
            "/videos",
            get(videos::list_videos).post(videos::create_video),
        )
        .route(
            "/videos/{id}",
            get(videos::get_video)
                .patch(videos::update_video)
                .delete(videos::delete_video),
        )
        .route(
            "/videos/{id}/thumbnail",
            put(videos::put_video_thumbnail).layer(image_limit),
        )
        .route(
            "/videos/{id}/video-notes",
            get(videos::list_video_notes).post(videos::create_video_note),
        )
        .route(
            "/videos/{id}/video-notes/{note_id}",
            patch(videos::update_video_note).delete(videos::delete_video_note),
        )
        .route("/files/{id}", get(files::get_file))
}

// ---- Lógica comum de notas, posição e destaques ------------------------------
// Os handlers de livro, artigo e vídeo só diferem no caminho e na documentação.

pub(crate) async fn list_notes_of(
    state: &AppState,
    owner_id: Uuid,
    item: ItemRef,
) -> Result<Json<ItemNoteList>, ApiError> {
    let notes = item_ops(state).list_notes(owner_id, item).await?;
    Ok(Json(ItemNoteList {
        items: notes.into_iter().map(ItemNoteResponse::from).collect(),
    }))
}

pub(crate) async fn create_note_of(
    state: &AppState,
    owner_id: Uuid,
    item: ItemRef,
    body: CreateItemNoteRequest,
) -> Result<(StatusCode, Json<ItemNoteResponse>), ApiError> {
    let input = NoteInput {
        quote: body.quote,
        page: body.page,
        comment: body.comment,
    };
    let note = item_ops(state).create_note(owner_id, item, input).await?;
    Ok((StatusCode::CREATED, Json(note.into())))
}

pub(crate) async fn update_note_of(
    state: &AppState,
    owner_id: Uuid,
    item: ItemRef,
    note_id: Uuid,
    body: UpdateItemNoteRequest,
) -> Result<Json<ItemNoteResponse>, ApiError> {
    let changes = ItemNoteChanges {
        quote: body.quote,
        page: body.page,
        comment: body.comment,
    };
    let note = item_ops(state)
        .update_note(owner_id, item, note_id, changes)
        .await?;
    Ok(Json(note.into()))
}

pub(crate) async fn delete_note_of(
    state: &AppState,
    owner_id: Uuid,
    item: ItemRef,
    note_id: Uuid,
) -> Result<StatusCode, ApiError> {
    item_ops(state).delete_note(owner_id, item, note_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub(crate) async fn get_position_of(
    state: &AppState,
    owner_id: Uuid,
    item: ItemRef,
) -> Result<Json<ReadingPositionResponse>, ApiError> {
    let page = item_ops(state).get_position(owner_id, item).await?;
    Ok(Json(ReadingPositionResponse { page }))
}

pub(crate) async fn put_position_of(
    state: &AppState,
    owner_id: Uuid,
    item: ItemRef,
    body: ReadingPositionRequest,
) -> Result<Json<ReadingPositionResponse>, ApiError> {
    let page = item_ops(state)
        .set_position(owner_id, item, body.page)
        .await?;
    Ok(Json(ReadingPositionResponse { page: Some(page) }))
}

pub(crate) async fn list_highlights_of(
    state: &AppState,
    owner_id: Uuid,
    item: ItemRef,
) -> Result<Json<HighlightList>, ApiError> {
    let views = item_ops(state).list_highlights(owner_id, item).await?;
    Ok(Json(HighlightList {
        items: views.into_iter().map(HighlightResponse::from).collect(),
    }))
}

pub(crate) async fn create_highlight_of(
    state: &AppState,
    owner_id: Uuid,
    item: ItemRef,
    body: CreateHighlightRequest,
) -> Result<(StatusCode, Json<HighlightResponse>), ApiError> {
    let input = HighlightInput {
        file_id: body.file_id,
        page: body.page,
        color: body.color,
        text: body.text,
        rects: body.rects,
    };
    let view = item_ops(state)
        .create_highlight(owner_id, item, input)
        .await?;
    Ok((StatusCode::CREATED, Json(view.into())))
}

pub(crate) async fn update_highlight_of(
    state: &AppState,
    owner_id: Uuid,
    item: ItemRef,
    highlight_id: Uuid,
    body: UpdateHighlightRequest,
) -> Result<Json<HighlightResponse>, ApiError> {
    let view = item_ops(state)
        .update_highlight(owner_id, item, highlight_id, body.color)
        .await?;
    Ok(Json(view.into()))
}

pub(crate) async fn delete_highlight_of(
    state: &AppState,
    owner_id: Uuid,
    item: ItemRef,
    highlight_id: Uuid,
) -> Result<StatusCode, ApiError> {
    item_ops(state)
        .delete_highlight(owner_id, item, highlight_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}
