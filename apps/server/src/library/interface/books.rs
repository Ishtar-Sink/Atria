//! Handlers de `/books`: cadastro, sessões de leitura, notas, capa, PDF, posição e destaques.

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::Response;
use axum::{Extension, Json};

use super::dto::{
    BookListQuery, BookPage, BookResponse, CreateBookRequest, CreateHighlightRequest,
    CreateItemNoteRequest, CreateReadingSessionRequest, HighlightList, HighlightResponse,
    ItemNoteList, ItemNoteResponse, ReadingPositionRequest, ReadingPositionResponse,
    ReadingSessionList, ReadingSessionResponse, UpdateBookRequest, UpdateItemNoteRequest,
    UpdateReadingSessionRequest,
};
use super::{
    Upload, ValidJson, ValidQuery, book_service, child_extractor, create_highlight_of,
    create_note_of, delete_note_of, file_response, get_position_of, id_extractor,
    list_highlights_of, list_notes_of, list_query, put_position_of, update_note_of,
};
use crate::http::AppState;
use crate::http::session::CurrentUser;
use crate::library::application::ListQuery;
use crate::library::application::books::{CreateBook, CreateSession};
use crate::library::application::ports::EntityDeletedHook;
use crate::library::domain::ItemRef;
use crate::library::domain::book::BookChanges;
use crate::library::domain::reading_session::SessionChanges;
use crate::shared::error::{ApiError, ProblemDetails};

/// Tipo de entidade passado ao gancho de exclusão (CB-06).
pub const ENTITY_TYPE: &str = "book";

id_extractor!(BookId, "book_not_found");
child_extractor!(BookChild, "book_not_found");

#[utoipa::path(
    get, path = "/api/v1/books", tag = "library", params(BookListQuery),
    responses(
        (status = 200, body = BookPage),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn list_books(
    State(state): State<AppState>,
    user: CurrentUser,
    ValidQuery(query): ValidQuery<BookListQuery>,
) -> Result<Json<BookPage>, ApiError> {
    let reading_status = query.reading_status;
    let query = list_query(
        query.cursor.as_deref(),
        query.limit,
        query.q,
        query.tag,
        query.visibility,
        None,
    )?;
    let query = ListQuery {
        book_status: reading_status,
        ..query
    };
    let page = book_service(&state).list(user.user_id, query).await?;
    Ok(Json(BookPage {
        items: page.items.into_iter().map(BookResponse::from).collect(),
        next_cursor: page.next_cursor.map(|cursor| cursor.encode()),
    }))
}

#[utoipa::path(
    post, path = "/api/v1/books", tag = "library", request_body = CreateBookRequest,
    responses(
        (status = 201, body = BookResponse),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn create_book(
    State(state): State<AppState>,
    user: CurrentUser,
    ValidJson(body): ValidJson<CreateBookRequest>,
) -> Result<(StatusCode, Json<BookResponse>), ApiError> {
    let input = CreateBook {
        visibility: body.visibility.unwrap_or_default(),
        title: body.title,
        author: body.author,
        publisher: body.publisher,
        page_count: body.page_count,
        tags: body.tags.unwrap_or_default(),
        reading_status: body.reading_status.unwrap_or_default(),
    };
    let book = book_service(&state).create(user.user_id, input).await?;
    Ok((StatusCode::CREATED, Json(book.into())))
}

#[utoipa::path(
    get, path = "/api/v1/books/{id}", tag = "library",
    params(("id" = Uuid, Path, description = "Id do livro")),
    responses(
        (status = 200, body = BookResponse),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
    )
)]
pub async fn get_book(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
) -> Result<Json<BookResponse>, ApiError> {
    let book = book_service(&state).get(user.user_id, id).await?;
    Ok(Json(book.into()))
}

#[utoipa::path(
    patch, path = "/api/v1/books/{id}", tag = "library", request_body = UpdateBookRequest,
    params(("id" = Uuid, Path, description = "Id do livro")),
    responses(
        (status = 200, body = BookResponse),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_book(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
    ValidJson(body): ValidJson<UpdateBookRequest>,
) -> Result<Json<BookResponse>, ApiError> {
    let changes = BookChanges {
        title: body.title,
        author: body.author,
        publisher: body.publisher,
        page_count: body.page_count,
        tags: body.tags,
        reading_status: body.reading_status,
        visibility: body.visibility,
    };
    let book = book_service(&state)
        .update(user.user_id, id, changes)
        .await?;
    Ok(Json(book.into()))
}

#[utoipa::path(
    delete, path = "/api/v1/books/{id}", tag = "library",
    params(("id" = Uuid, Path, description = "Id do livro")),
    responses(
        (status = 204, description = "Livro excluído"),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
    )
)]
pub async fn delete_book(
    State(state): State<AppState>,
    user: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    BookId(id): BookId,
) -> Result<StatusCode, ApiError> {
    book_service(&state).delete(user.user_id, id).await?;
    // Depois do commit: a exclusão do livro não depende das ligações (CB-06).
    if let Some(Extension(hook)) = hook {
        hook(user.user_id, ENTITY_TYPE, id).await;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get, path = "/api/v1/books/{id}/cover", tag = "library",
    params(("id" = Uuid, Path, description = "Id do livro")),
    responses(
        (status = 200, content_type = "image/png", description = "Imagem da capa, no tipo gravado (PNG, JPEG ou WebP); exibição sugerida 2:3 (retrato)"),
        (status = 404, body = ProblemDetails, description = "book_not_found ou cover_not_found"),
    )
)]
pub async fn get_book_cover(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
) -> Result<Response, ApiError> {
    let (file, bytes) = book_service(&state).cover(user.user_id, id).await?;
    file_response(&file, bytes, false)
}

#[utoipa::path(
    delete, path = "/api/v1/books/{id}/cover", tag = "library",
    params(("id" = Uuid, Path, description = "Id do livro")),
    responses(
        (status = 204, description = "Capa removida; sem capa, também 204"),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
    )
)]
pub async fn delete_book_cover(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
) -> Result<StatusCode, ApiError> {
    book_service(&state).remove_cover(user.user_id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    put, path = "/api/v1/books/{id}/cover", tag = "library",
    params(("id" = Uuid, Path, description = "Id do livro")),
    request_body(content = Vec<u8>, content_type = "application/octet-stream", description = "Imagem PNG, JPEG ou WebP de até 5 MiB; a tela a exibe em 2:3 (o servidor não recorta)"),
    responses(
        (status = 200, body = BookResponse),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
        (status = 413, body = ProblemDetails, description = "file_too_large"),
        (status = 415, body = ProblemDetails, description = "unsupported_file_type"),
    )
)]
pub async fn put_book_cover(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
    Upload(bytes): Upload,
) -> Result<Json<BookResponse>, ApiError> {
    let book = book_service(&state)
        .set_cover(user.user_id, id, bytes)
        .await?;
    Ok(Json(book.into()))
}

#[utoipa::path(
    put, path = "/api/v1/books/{id}/pdf", tag = "library",
    params(("id" = Uuid, Path, description = "Id do livro")),
    request_body(content = Vec<u8>, content_type = "application/octet-stream", description = "PDF de até 50 MiB"),
    responses(
        (status = 200, body = BookResponse),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
        (status = 413, body = ProblemDetails, description = "file_too_large"),
        (status = 415, body = ProblemDetails, description = "unsupported_file_type"),
    )
)]
pub async fn put_book_pdf(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
    Upload(bytes): Upload,
) -> Result<Json<BookResponse>, ApiError> {
    let book = book_service(&state)
        .set_pdf(user.user_id, id, bytes)
        .await?;
    Ok(Json(book.into()))
}

#[utoipa::path(
    get, path = "/api/v1/books/{id}/reading-sessions", tag = "library",
    params(("id" = Uuid, Path, description = "Id do livro")),
    responses(
        (status = 200, body = ReadingSessionList),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
    )
)]
pub async fn list_reading_sessions(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
) -> Result<Json<ReadingSessionList>, ApiError> {
    let sessions = book_service(&state).list_sessions(user.user_id, id).await?;
    Ok(Json(ReadingSessionList {
        items: sessions
            .into_iter()
            .map(ReadingSessionResponse::from)
            .collect(),
    }))
}

#[utoipa::path(
    post, path = "/api/v1/books/{id}/reading-sessions", tag = "library",
    request_body = CreateReadingSessionRequest,
    params(("id" = Uuid, Path, description = "Id do livro")),
    responses(
        (status = 201, body = ReadingSessionResponse),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn create_reading_session(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
    ValidJson(body): ValidJson<CreateReadingSessionRequest>,
) -> Result<(StatusCode, Json<ReadingSessionResponse>), ApiError> {
    let input = CreateSession {
        read_on: body.read_on,
        pages_read: body.pages_read,
        from_page: body.from_page,
        to_page: body.to_page,
        observation: body.observation,
    };
    let session = book_service(&state)
        .create_session(user.user_id, id, input)
        .await?;
    Ok((StatusCode::CREATED, Json(session.into())))
}

#[utoipa::path(
    patch, path = "/api/v1/books/{id}/reading-sessions/{session_id}", tag = "library",
    request_body = UpdateReadingSessionRequest,
    params(
        ("id" = Uuid, Path, description = "Id do livro"),
        ("session_id" = Uuid, Path, description = "Id da sessão de leitura"),
    ),
    responses(
        (status = 200, body = ReadingSessionResponse),
        (status = 404, body = ProblemDetails, description = "book_not_found ou reading_session_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_reading_session(
    State(state): State<AppState>,
    user: CurrentUser,
    BookChild(id, session_id): BookChild,
    ValidJson(body): ValidJson<UpdateReadingSessionRequest>,
) -> Result<Json<ReadingSessionResponse>, ApiError> {
    let changes = SessionChanges {
        read_on: body.read_on,
        pages_read: body.pages_read,
        from_page: body.from_page,
        to_page: body.to_page,
        observation: body.observation,
    };
    let session = book_service(&state)
        .update_session(user.user_id, id, session_id, changes)
        .await?;
    Ok(Json(session.into()))
}

#[utoipa::path(
    delete, path = "/api/v1/books/{id}/reading-sessions/{session_id}", tag = "library",
    params(
        ("id" = Uuid, Path, description = "Id do livro"),
        ("session_id" = Uuid, Path, description = "Id da sessão de leitura"),
    ),
    responses(
        (status = 204, description = "Sessão excluída"),
        (status = 404, body = ProblemDetails, description = "book_not_found ou reading_session_not_found"),
    )
)]
pub async fn delete_reading_session(
    State(state): State<AppState>,
    user: CurrentUser,
    BookChild(id, session_id): BookChild,
) -> Result<StatusCode, ApiError> {
    book_service(&state)
        .delete_session(user.user_id, id, session_id)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get, path = "/api/v1/books/{id}/book-notes", tag = "library",
    params(("id" = Uuid, Path, description = "Id do livro")),
    responses(
        (status = 200, body = ItemNoteList),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
    )
)]
pub async fn list_book_notes(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
) -> Result<Json<ItemNoteList>, ApiError> {
    list_notes_of(&state, user.user_id, ItemRef::Book(id)).await
}

#[utoipa::path(
    post, path = "/api/v1/books/{id}/book-notes", tag = "library",
    request_body = CreateItemNoteRequest,
    params(("id" = Uuid, Path, description = "Id do livro")),
    responses(
        (status = 201, body = ItemNoteResponse),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn create_book_note(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
    ValidJson(body): ValidJson<CreateItemNoteRequest>,
) -> Result<(StatusCode, Json<ItemNoteResponse>), ApiError> {
    create_note_of(&state, user.user_id, ItemRef::Book(id), body).await
}

#[utoipa::path(
    patch, path = "/api/v1/books/{id}/book-notes/{note_id}", tag = "library",
    request_body = UpdateItemNoteRequest,
    params(
        ("id" = Uuid, Path, description = "Id do livro"),
        ("note_id" = Uuid, Path, description = "Id da nota"),
    ),
    responses(
        (status = 200, body = ItemNoteResponse),
        (status = 404, body = ProblemDetails, description = "book_not_found ou item_note_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_book_note(
    State(state): State<AppState>,
    user: CurrentUser,
    BookChild(id, note_id): BookChild,
    ValidJson(body): ValidJson<UpdateItemNoteRequest>,
) -> Result<Json<ItemNoteResponse>, ApiError> {
    update_note_of(&state, user.user_id, ItemRef::Book(id), note_id, body).await
}

#[utoipa::path(
    delete, path = "/api/v1/books/{id}/book-notes/{note_id}", tag = "library",
    params(
        ("id" = Uuid, Path, description = "Id do livro"),
        ("note_id" = Uuid, Path, description = "Id da nota"),
    ),
    responses(
        (status = 204, description = "Nota excluída"),
        (status = 404, body = ProblemDetails, description = "book_not_found ou item_note_not_found"),
    )
)]
pub async fn delete_book_note(
    State(state): State<AppState>,
    user: CurrentUser,
    BookChild(id, note_id): BookChild,
) -> Result<StatusCode, ApiError> {
    delete_note_of(&state, user.user_id, ItemRef::Book(id), note_id).await
}

#[utoipa::path(
    get, path = "/api/v1/books/{id}/reading-position", tag = "library",
    params(("id" = Uuid, Path, description = "Id do livro")),
    responses(
        (status = 200, body = ReadingPositionResponse),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
    )
)]
pub async fn get_book_position(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
) -> Result<Json<ReadingPositionResponse>, ApiError> {
    get_position_of(&state, user.user_id, ItemRef::Book(id)).await
}

#[utoipa::path(
    put, path = "/api/v1/books/{id}/reading-position", tag = "library",
    request_body = ReadingPositionRequest,
    params(("id" = Uuid, Path, description = "Id do livro")),
    responses(
        (status = 200, body = ReadingPositionResponse),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn put_book_position(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
    ValidJson(body): ValidJson<ReadingPositionRequest>,
) -> Result<Json<ReadingPositionResponse>, ApiError> {
    put_position_of(&state, user.user_id, ItemRef::Book(id), body).await
}

#[utoipa::path(
    get, path = "/api/v1/books/{id}/highlights", tag = "library",
    params(("id" = Uuid, Path, description = "Id do livro")),
    responses(
        (status = 200, body = HighlightList),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
    )
)]
pub async fn list_book_highlights(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
) -> Result<Json<HighlightList>, ApiError> {
    list_highlights_of(&state, user.user_id, ItemRef::Book(id)).await
}

#[utoipa::path(
    post, path = "/api/v1/books/{id}/highlights", tag = "library",
    request_body = CreateHighlightRequest,
    params(("id" = Uuid, Path, description = "Id do livro")),
    responses(
        (status = 201, body = HighlightResponse),
        (status = 404, body = ProblemDetails, description = "book_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed, pdf_required ou highlight_file_mismatch"),
    )
)]
pub async fn create_book_highlight(
    State(state): State<AppState>,
    user: CurrentUser,
    BookId(id): BookId,
    ValidJson(body): ValidJson<CreateHighlightRequest>,
) -> Result<(StatusCode, Json<HighlightResponse>), ApiError> {
    create_highlight_of(&state, user.user_id, ItemRef::Book(id), body).await
}
