//! Handlers de `/articles`: cadastro, PDF, notas, posição e destaques.

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::Response;
use axum::{Extension, Json};

use super::dto::{
    ArticleListQuery, ArticlePage, ArticleResponse, CreateArticleRequest, CreateHighlightRequest,
    CreateItemNoteRequest, HighlightList, HighlightResponse, ItemNoteList, ItemNoteResponse,
    ReadingPositionRequest, ReadingPositionResponse, UpdateArticleRequest, UpdateItemNoteRequest,
};
use super::{
    Upload, ValidJson, ValidQuery, article_service, child_extractor, create_highlight_of,
    create_note_of, delete_note_of, file_response, get_position_of, id_extractor,
    list_highlights_of, list_notes_of, list_query, put_position_of, update_note_of,
};
use crate::http::AppState;
use crate::http::session::CurrentUser;
use crate::library::application::articles::CreateArticle;
use crate::library::application::ports::EntityDeletedHook;
use crate::library::domain::ItemRef;
use crate::library::domain::article::ArticleChanges;
use crate::shared::error::{ApiError, ProblemDetails};

/// Tipo de entidade passado ao gancho de exclusão (CB-06).
pub const ENTITY_TYPE: &str = "article";

id_extractor!(ArticleId, "article_not_found");
child_extractor!(ArticleChild, "article_not_found");

#[utoipa::path(
    get, path = "/api/v1/articles", tag = "library", params(ArticleListQuery),
    responses(
        (status = 200, body = ArticlePage),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn list_articles(
    State(state): State<AppState>,
    user: CurrentUser,
    ValidQuery(query): ValidQuery<ArticleListQuery>,
) -> Result<Json<ArticlePage>, ApiError> {
    let query = list_query(
        query.cursor.as_deref(),
        query.limit,
        query.q,
        query.tag,
        query.visibility,
        query.reading_status,
    )?;
    let page = article_service(&state).list(user.user_id, query).await?;
    Ok(Json(ArticlePage {
        items: page.items.into_iter().map(ArticleResponse::from).collect(),
        next_cursor: page.next_cursor.map(|cursor| cursor.encode()),
    }))
}

#[utoipa::path(
    post, path = "/api/v1/articles", tag = "library", request_body = CreateArticleRequest,
    responses(
        (status = 201, body = ArticleResponse),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn create_article(
    State(state): State<AppState>,
    user: CurrentUser,
    ValidJson(body): ValidJson<CreateArticleRequest>,
) -> Result<(StatusCode, Json<ArticleResponse>), ApiError> {
    let input = CreateArticle {
        visibility: body.visibility.unwrap_or_default(),
        title: body.title,
        url: body.url,
        author: body.author,
        source: body.source,
        tags: body.tags.unwrap_or_default(),
        reading_status: body.reading_status.unwrap_or_default(),
    };
    let article = article_service(&state).create(user.user_id, input).await?;
    Ok((StatusCode::CREATED, Json(article.into())))
}

#[utoipa::path(
    get, path = "/api/v1/articles/{id}", tag = "library",
    params(("id" = Uuid, Path, description = "Id do artigo")),
    responses(
        (status = 200, body = ArticleResponse),
        (status = 404, body = ProblemDetails, description = "article_not_found"),
    )
)]
pub async fn get_article(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleId(id): ArticleId,
) -> Result<Json<ArticleResponse>, ApiError> {
    let article = article_service(&state).get(user.user_id, id).await?;
    Ok(Json(article.into()))
}

#[utoipa::path(
    patch, path = "/api/v1/articles/{id}", tag = "library", request_body = UpdateArticleRequest,
    params(("id" = Uuid, Path, description = "Id do artigo")),
    responses(
        (status = 200, body = ArticleResponse),
        (status = 404, body = ProblemDetails, description = "article_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_article(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleId(id): ArticleId,
    ValidJson(body): ValidJson<UpdateArticleRequest>,
) -> Result<Json<ArticleResponse>, ApiError> {
    let changes = ArticleChanges {
        title: body.title,
        url: body.url,
        author: body.author,
        source: body.source,
        tags: body.tags,
        reading_status: body.reading_status,
        visibility: body.visibility,
    };
    let article = article_service(&state)
        .update(user.user_id, id, changes)
        .await?;
    Ok(Json(article.into()))
}

#[utoipa::path(
    delete, path = "/api/v1/articles/{id}", tag = "library",
    params(("id" = Uuid, Path, description = "Id do artigo")),
    responses(
        (status = 204, description = "Artigo excluído"),
        (status = 404, body = ProblemDetails, description = "article_not_found"),
    )
)]
pub async fn delete_article(
    State(state): State<AppState>,
    user: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    ArticleId(id): ArticleId,
) -> Result<StatusCode, ApiError> {
    article_service(&state).delete(user.user_id, id).await?;
    // Depois do commit: a exclusão do artigo não depende das ligações (CB-06).
    if let Some(Extension(hook)) = hook {
        hook(user.user_id, ENTITY_TYPE, id).await;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get, path = "/api/v1/articles/{id}/cover", tag = "library",
    params(("id" = Uuid, Path, description = "Id do artigo")),
    responses(
        (status = 200, content_type = "image/png", description = "Imagem da capa, no tipo gravado (PNG, JPEG ou WebP); exibição sugerida 16:9 (paisagem)"),
        (status = 404, body = ProblemDetails, description = "article_not_found ou cover_not_found"),
    )
)]
pub async fn get_article_cover(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleId(id): ArticleId,
) -> Result<Response, ApiError> {
    let (file, bytes) = article_service(&state).cover(user.user_id, id).await?;
    file_response(&file, bytes, false)
}

#[utoipa::path(
    delete, path = "/api/v1/articles/{id}/cover", tag = "library",
    params(("id" = Uuid, Path, description = "Id do artigo")),
    responses(
        (status = 204, description = "Capa removida; sem capa, também 204"),
        (status = 404, body = ProblemDetails, description = "article_not_found"),
    )
)]
pub async fn delete_article_cover(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleId(id): ArticleId,
) -> Result<StatusCode, ApiError> {
    article_service(&state)
        .remove_cover(user.user_id, id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    put, path = "/api/v1/articles/{id}/cover", tag = "library",
    params(("id" = Uuid, Path, description = "Id do artigo")),
    request_body(content = Vec<u8>, content_type = "application/octet-stream", description = "Imagem PNG, JPEG ou WebP de até 5 MiB; a tela a exibe em 16:9 (o servidor não recorta)"),
    responses(
        (status = 200, body = ArticleResponse),
        (status = 404, body = ProblemDetails, description = "article_not_found"),
        (status = 413, body = ProblemDetails, description = "file_too_large"),
        (status = 415, body = ProblemDetails, description = "unsupported_file_type"),
    )
)]
pub async fn put_article_cover(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleId(id): ArticleId,
    Upload(bytes): Upload,
) -> Result<Json<ArticleResponse>, ApiError> {
    let article = article_service(&state)
        .set_cover(user.user_id, id, bytes)
        .await?;
    Ok(Json(article.into()))
}

#[utoipa::path(
    put, path = "/api/v1/articles/{id}/pdf", tag = "library",
    params(("id" = Uuid, Path, description = "Id do artigo")),
    request_body(content = Vec<u8>, content_type = "application/octet-stream", description = "PDF de até 50 MiB"),
    responses(
        (status = 200, body = ArticleResponse),
        (status = 404, body = ProblemDetails, description = "article_not_found"),
        (status = 413, body = ProblemDetails, description = "file_too_large"),
        (status = 415, body = ProblemDetails, description = "unsupported_file_type"),
    )
)]
pub async fn put_article_pdf(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleId(id): ArticleId,
    Upload(bytes): Upload,
) -> Result<Json<ArticleResponse>, ApiError> {
    let article = article_service(&state)
        .set_pdf(user.user_id, id, bytes)
        .await?;
    Ok(Json(article.into()))
}

#[utoipa::path(
    get, path = "/api/v1/articles/{id}/article-notes", tag = "library",
    params(("id" = Uuid, Path, description = "Id do artigo")),
    responses(
        (status = 200, body = ItemNoteList),
        (status = 404, body = ProblemDetails, description = "article_not_found"),
    )
)]
pub async fn list_article_notes(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleId(id): ArticleId,
) -> Result<Json<ItemNoteList>, ApiError> {
    list_notes_of(&state, user.user_id, ItemRef::Article(id)).await
}

#[utoipa::path(
    post, path = "/api/v1/articles/{id}/article-notes", tag = "library",
    request_body = CreateItemNoteRequest,
    params(("id" = Uuid, Path, description = "Id do artigo")),
    responses(
        (status = 201, body = ItemNoteResponse),
        (status = 404, body = ProblemDetails, description = "article_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn create_article_note(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleId(id): ArticleId,
    ValidJson(body): ValidJson<CreateItemNoteRequest>,
) -> Result<(StatusCode, Json<ItemNoteResponse>), ApiError> {
    create_note_of(&state, user.user_id, ItemRef::Article(id), body).await
}

#[utoipa::path(
    patch, path = "/api/v1/articles/{id}/article-notes/{note_id}", tag = "library",
    request_body = UpdateItemNoteRequest,
    params(
        ("id" = Uuid, Path, description = "Id do artigo"),
        ("note_id" = Uuid, Path, description = "Id da nota"),
    ),
    responses(
        (status = 200, body = ItemNoteResponse),
        (status = 404, body = ProblemDetails, description = "article_not_found ou item_note_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_article_note(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleChild(id, note_id): ArticleChild,
    ValidJson(body): ValidJson<UpdateItemNoteRequest>,
) -> Result<Json<ItemNoteResponse>, ApiError> {
    update_note_of(&state, user.user_id, ItemRef::Article(id), note_id, body).await
}

#[utoipa::path(
    delete, path = "/api/v1/articles/{id}/article-notes/{note_id}", tag = "library",
    params(
        ("id" = Uuid, Path, description = "Id do artigo"),
        ("note_id" = Uuid, Path, description = "Id da nota"),
    ),
    responses(
        (status = 204, description = "Nota excluída"),
        (status = 404, body = ProblemDetails, description = "article_not_found ou item_note_not_found"),
    )
)]
pub async fn delete_article_note(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleChild(id, note_id): ArticleChild,
) -> Result<StatusCode, ApiError> {
    delete_note_of(&state, user.user_id, ItemRef::Article(id), note_id).await
}

#[utoipa::path(
    get, path = "/api/v1/articles/{id}/reading-position", tag = "library",
    params(("id" = Uuid, Path, description = "Id do artigo")),
    responses(
        (status = 200, body = ReadingPositionResponse),
        (status = 404, body = ProblemDetails, description = "article_not_found"),
    )
)]
pub async fn get_article_position(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleId(id): ArticleId,
) -> Result<Json<ReadingPositionResponse>, ApiError> {
    get_position_of(&state, user.user_id, ItemRef::Article(id)).await
}

#[utoipa::path(
    put, path = "/api/v1/articles/{id}/reading-position", tag = "library",
    request_body = ReadingPositionRequest,
    params(("id" = Uuid, Path, description = "Id do artigo")),
    responses(
        (status = 200, body = ReadingPositionResponse),
        (status = 404, body = ProblemDetails, description = "article_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn put_article_position(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleId(id): ArticleId,
    ValidJson(body): ValidJson<ReadingPositionRequest>,
) -> Result<Json<ReadingPositionResponse>, ApiError> {
    put_position_of(&state, user.user_id, ItemRef::Article(id), body).await
}

#[utoipa::path(
    get, path = "/api/v1/articles/{id}/highlights", tag = "library",
    params(("id" = Uuid, Path, description = "Id do artigo")),
    responses(
        (status = 200, body = HighlightList),
        (status = 404, body = ProblemDetails, description = "article_not_found"),
    )
)]
pub async fn list_article_highlights(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleId(id): ArticleId,
) -> Result<Json<HighlightList>, ApiError> {
    list_highlights_of(&state, user.user_id, ItemRef::Article(id)).await
}

#[utoipa::path(
    post, path = "/api/v1/articles/{id}/highlights", tag = "library",
    request_body = CreateHighlightRequest,
    params(("id" = Uuid, Path, description = "Id do artigo")),
    responses(
        (status = 201, body = HighlightResponse),
        (status = 404, body = ProblemDetails, description = "article_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed, pdf_required ou highlight_file_mismatch"),
    )
)]
pub async fn create_article_highlight(
    State(state): State<AppState>,
    user: CurrentUser,
    ArticleId(id): ArticleId,
    ValidJson(body): ValidJson<CreateHighlightRequest>,
) -> Result<(StatusCode, Json<HighlightResponse>), ApiError> {
    create_highlight_of(&state, user.user_id, ItemRef::Article(id), body).await
}
