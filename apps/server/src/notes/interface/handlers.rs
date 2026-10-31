//! Handlers HTTP de notas: validação na borda e conversão de `NoteError` em
//! `problem+json` ([project/code-style-03]). Nenhum log leva título ou corpo
//! ([project/security-13]).

use axum::extract::{FromRequest, FromRequestParts, Path, Query, Request, State};
use axum::http::StatusCode;
use axum::http::request::Parts;
use axum::{Extension, Json};
use serde::de::DeserializeOwned;
use uuid::Uuid;

use super::dto::{
    CreateNoteRequest, NoteListQuery, NotePage, NoteResponse, NoteSortParam, UpdateNoteRequest,
};
use crate::http::AppState;
use crate::http::session::CurrentUser;
use crate::notes::application::ports::{EntityDeletedHook, NoteSort};
use crate::notes::application::service::{CreateNote, ListNotes, NoteService};
use crate::notes::domain::error::NoteError;
use crate::notes::domain::note::NoteChanges;
use crate::notes::infrastructure::pg_note_repository::PgNoteRepository;
use crate::shared::error::{ApiError, FieldError, ProblemDetails};
use crate::shared::pagination::{Cursor, DEFAULT_LIMIT, MAX_LIMIT};

/// Tipo de entidade passado ao gancho de exclusão (CB-06).
pub const ENTITY_TYPE: &str = "note";

fn validation(field: &str, code: &str) -> ApiError {
    ApiError::unprocessable("validation_failed", vec![FieldError::new(field, code)])
}

impl From<NoteError> for ApiError {
    fn from(error: NoteError) -> Self {
        match error {
            // Nota de outro usuário também é 404: não revela que ela existe (RNF-02).
            NoteError::NotFound | NoteError::Deleted => Self::not_found("note_not_found"),
            NoteError::TitleRequired => validation("title", "required"),
            NoteError::TitleTooLong => validation("title", "too_long"),
            NoteError::BodyTooLong => validation("body", "too_long"),
            NoteError::InvalidCursor => validation("cursor", "invalid"),
            NoteError::Infrastructure(cause) => Self::internal_from(cause.as_ref()),
        }
    }
}

/// Corpo JSON cuja falha de leitura vira `problem+json` com código estável.
pub struct ValidJson<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned> FromRequest<S> for ValidJson<T> {
    type Rejection = ApiError;

    async fn from_request(request: Request, state: &S) -> Result<Self, Self::Rejection> {
        Json::<T>::from_request(request, state)
            .await
            .map(|Json(value)| Self(value))
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

/// Id da nota no caminho; um id malformado é tratado como nota inexistente.
pub struct NoteId(pub Uuid);

impl<S: Send + Sync> FromRequestParts<S> for NoteId {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        Path::<Uuid>::from_request_parts(parts, state)
            .await
            .map(|Path(id)| Self(id))
            .map_err(|_| ApiError::not_found("note_not_found"))
    }
}

fn service(state: &AppState) -> NoteService<PgNoteRepository> {
    NoteService::new(
        PgNoteRepository::from_state(state),
        state.clock.clone(),
        state.ids.clone(),
    )
}

fn list_query(query: NoteListQuery) -> Result<ListNotes, ApiError> {
    let limit = query.limit.unwrap_or(DEFAULT_LIMIT);
    if !(1..=MAX_LIMIT).contains(&limit) {
        return Err(validation("limit", "out_of_range"));
    }
    let after = query
        .cursor
        .as_deref()
        .map(Cursor::decode)
        .transpose()
        .map_err(|_| validation("cursor", "invalid"))?;
    let sort = match query.sort.unwrap_or_default() {
        NoteSortParam::UpdatedAt => NoteSort::UpdatedAt,
        NoteSortParam::CreatedAt => NoteSort::CreatedAt,
    };
    Ok(ListNotes {
        visibility: query.visibility,
        sort,
        after,
        limit,
    })
}

#[utoipa::path(
    post, path = "/api/v1/notes", tag = "notes", request_body = CreateNoteRequest,
    responses(
        (status = 201, body = NoteResponse),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn create_note(
    State(state): State<AppState>,
    user: CurrentUser,
    ValidJson(body): ValidJson<CreateNoteRequest>,
) -> Result<(StatusCode, Json<NoteResponse>), ApiError> {
    let input = CreateNote {
        title: body.title,
        body: body.body,
        visibility: body.visibility.unwrap_or_default(),
    };
    let note = service(&state).create(user.user_id, input).await?;
    Ok((StatusCode::CREATED, Json(note.into())))
}

#[utoipa::path(
    get, path = "/api/v1/notes", tag = "notes", params(NoteListQuery),
    responses(
        (status = 200, body = NotePage),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn list_notes(
    State(state): State<AppState>,
    user: CurrentUser,
    ValidQuery(query): ValidQuery<NoteListQuery>,
) -> Result<Json<NotePage>, ApiError> {
    let page = service(&state)
        .list(user.user_id, list_query(query)?)
        .await?;
    Ok(Json(NotePage {
        items: page.items.into_iter().map(NoteResponse::from).collect(),
        next_cursor: page.next_cursor.map(|cursor| cursor.encode()),
    }))
}

#[utoipa::path(
    get, path = "/api/v1/notes/{id}", tag = "notes",
    params(("id" = Uuid, Path, description = "Id da nota")),
    responses(
        (status = 200, body = NoteResponse),
        (status = 404, body = ProblemDetails, description = "note_not_found"),
    )
)]
pub async fn get_note(
    State(state): State<AppState>,
    user: CurrentUser,
    NoteId(id): NoteId,
) -> Result<Json<NoteResponse>, ApiError> {
    let note = service(&state).get(user.user_id, id).await?;
    Ok(Json(note.into()))
}

#[utoipa::path(
    patch, path = "/api/v1/notes/{id}", tag = "notes", request_body = UpdateNoteRequest,
    params(("id" = Uuid, Path, description = "Id da nota")),
    responses(
        (status = 200, body = NoteResponse),
        (status = 404, body = ProblemDetails, description = "note_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_note(
    State(state): State<AppState>,
    user: CurrentUser,
    NoteId(id): NoteId,
    ValidJson(body): ValidJson<UpdateNoteRequest>,
) -> Result<Json<NoteResponse>, ApiError> {
    let changes = NoteChanges {
        title: body.title,
        body: body.body,
        visibility: body.visibility,
    };
    let note = service(&state).edit(user.user_id, id, changes).await?;
    Ok(Json(note.into()))
}

#[utoipa::path(
    delete, path = "/api/v1/notes/{id}", tag = "notes",
    params(("id" = Uuid, Path, description = "Id da nota")),
    responses(
        (status = 204, description = "Nota excluída"),
        (status = 404, body = ProblemDetails, description = "note_not_found"),
    )
)]
pub async fn delete_note(
    State(state): State<AppState>,
    user: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    NoteId(id): NoteId,
) -> Result<StatusCode, ApiError> {
    service(&state).delete(user.user_id, id).await?;
    // Depois do commit: a exclusão da nota não depende das ligações (CB-06).
    if let Some(Extension(hook)) = hook {
        hook(user.user_id, ENTITY_TYPE, id).await;
    }
    Ok(StatusCode::NO_CONTENT)
}
