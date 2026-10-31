//! Handlers HTTP do Diário: validação na borda e conversão de `JournalError` em
//! `problem+json` ([project/code-style-03]). Nenhum log leva o texto das entradas
//! nem o nome das emoções, só ids ([project/security-13]).

use axum::extract::{FromRequest, FromRequestParts, Path, Query, Request, State};
use axum::http::StatusCode;
use axum::http::request::Parts;
use axum::{Extension, Json};
use serde::de::DeserializeOwned;
use uuid::Uuid;

use super::dto::{
    CreateEmotionRequest, CreateJournalEntryRequest, EmotionList, EmotionResponse,
    EntryEmotionRequest, JournalEntryListQuery, JournalEntryPage, JournalEntryResponse,
    UpdateEmotionRequest, UpdateJournalEntryRequest,
};
use crate::http::AppState;
use crate::http::session::CurrentUser;
use crate::journal::application::emotions::EmotionService;
use crate::journal::application::entries::{
    CreateJournalEntry, EditJournalEntry, EntryEmotionInput, JournalEntryService,
    ListJournalEntries,
};
use crate::journal::application::ports::EntityDeletedHook;
use crate::journal::domain::error::JournalError;
use crate::journal::infrastructure::pg_emotion_repository::PgEmotionRepository;
use crate::journal::infrastructure::pg_journal_entry_repository::PgJournalEntryRepository;
use crate::shared::error::{ApiError, FieldError, ProblemDetails};
use crate::shared::pagination::{Cursor, DEFAULT_LIMIT, MAX_LIMIT};

/// Tipo de entidade passado ao gancho de exclusão (CB-06).
pub const ENTITY_TYPE: &str = "journal_entry";

const ENTRY_NOT_FOUND: &str = "journal_entry_not_found";
const EMOTION_NOT_FOUND: &str = "emotion_not_found";

fn validation(field: &str, code: &str) -> ApiError {
    ApiError::unprocessable("validation_failed", vec![FieldError::new(field, code)])
}

impl From<JournalError> for ApiError {
    fn from(error: JournalError) -> Self {
        match error {
            // Dado de outro usuário também é 404: não revela que ele existe (RNF-02).
            JournalError::EntryNotFound => Self::not_found(ENTRY_NOT_FOUND),
            JournalError::EmotionNotFound => Self::not_found(EMOTION_NOT_FOUND),
            JournalError::UnknownEmotion => Self::unprocessable(
                "unknown_emotion",
                vec![FieldError::new("emotions", "unknown")],
            ),
            JournalError::EmotionNameTaken => {
                Self::unprocessable("emotion_name_taken", vec![FieldError::new("name", "taken")])
            }
            JournalError::TextRequired => validation("text", "required"),
            JournalError::TextTooLong => validation("text", "too_long"),
            JournalError::InvalidIntensity => validation("emotions", "intensity_out_of_range"),
            JournalError::DuplicateEmotion => validation("emotions", "duplicate"),
            JournalError::InvalidEmotionName => validation("name", "invalid_length"),
            JournalError::InvalidCursor => validation("cursor", "invalid"),
            JournalError::Infrastructure(cause) => Self::internal_from(cause.as_ref()),
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

/// Id malformado no caminho é tratado como entidade inexistente.
async fn path_id<S: Send + Sync>(
    parts: &mut Parts,
    state: &S,
    code: &'static str,
) -> Result<Uuid, ApiError> {
    Path::<Uuid>::from_request_parts(parts, state)
        .await
        .map(|Path(id)| id)
        .map_err(|_| ApiError::not_found(code))
}

pub struct EntryId(pub Uuid);

impl<S: Send + Sync> FromRequestParts<S> for EntryId {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        path_id(parts, state, ENTRY_NOT_FOUND).await.map(Self)
    }
}

pub struct EmotionId(pub Uuid);

impl<S: Send + Sync> FromRequestParts<S> for EmotionId {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        path_id(parts, state, EMOTION_NOT_FOUND).await.map(Self)
    }
}

fn entries(state: &AppState) -> JournalEntryService<PgJournalEntryRepository, PgEmotionRepository> {
    JournalEntryService::new(
        PgJournalEntryRepository::from_state(state),
        PgEmotionRepository::from_state(state),
        state.clock.clone(),
        state.ids.clone(),
    )
}

fn emotions(state: &AppState) -> EmotionService<PgEmotionRepository> {
    EmotionService::new(
        PgEmotionRepository::from_state(state),
        state.clock.clone(),
        state.ids.clone(),
    )
}

fn emotion_inputs(emotions: Vec<EntryEmotionRequest>) -> Vec<EntryEmotionInput> {
    emotions
        .into_iter()
        .map(|emotion| EntryEmotionInput {
            emotion_id: emotion.emotion_id,
            intensity: emotion.intensity,
        })
        .collect()
}

fn list_query(query: JournalEntryListQuery) -> Result<ListJournalEntries, ApiError> {
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
    Ok(ListJournalEntries {
        from: query.from,
        to: query.to,
        emotion_id: query.emotion_id,
        visibility: query.visibility,
        after,
        limit,
    })
}

#[utoipa::path(
    post, path = "/api/v1/journal-entries", tag = "journal",
    request_body = CreateJournalEntryRequest,
    responses(
        (status = 201, body = JournalEntryResponse),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
        (status = 422, body = ProblemDetails, description = "validation_failed, unknown_emotion"),
    )
)]
pub async fn create_entry(
    State(state): State<AppState>,
    user: CurrentUser,
    ValidJson(body): ValidJson<CreateJournalEntryRequest>,
) -> Result<(StatusCode, Json<JournalEntryResponse>), ApiError> {
    let input = CreateJournalEntry {
        occurred_at: body.occurred_at,
        text: body.text,
        emotions: emotion_inputs(body.emotions),
        visibility: body.visibility.unwrap_or_default(),
    };
    let view = entries(&state).create(user.user_id, input).await?;
    Ok((StatusCode::CREATED, Json(view.into())))
}

#[utoipa::path(
    get, path = "/api/v1/journal-entries", tag = "journal", params(JournalEntryListQuery),
    responses(
        (status = 200, body = JournalEntryPage),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn list_entries(
    State(state): State<AppState>,
    user: CurrentUser,
    ValidQuery(query): ValidQuery<JournalEntryListQuery>,
) -> Result<Json<JournalEntryPage>, ApiError> {
    let page = entries(&state)
        .list(user.user_id, list_query(query)?)
        .await?;
    Ok(Json(JournalEntryPage {
        items: page
            .items
            .into_iter()
            .map(JournalEntryResponse::from)
            .collect(),
        next_cursor: page.next_cursor.map(|cursor| cursor.encode()),
    }))
}

#[utoipa::path(
    get, path = "/api/v1/journal-entries/{id}", tag = "journal",
    params(("id" = Uuid, Path, description = "Id da entrada")),
    responses(
        (status = 200, body = JournalEntryResponse),
        (status = 404, body = ProblemDetails, description = "journal_entry_not_found"),
    )
)]
pub async fn get_entry(
    State(state): State<AppState>,
    user: CurrentUser,
    EntryId(id): EntryId,
) -> Result<Json<JournalEntryResponse>, ApiError> {
    let view = entries(&state).get(user.user_id, id).await?;
    Ok(Json(view.into()))
}

#[utoipa::path(
    patch, path = "/api/v1/journal-entries/{id}", tag = "journal",
    request_body = UpdateJournalEntryRequest,
    params(("id" = Uuid, Path, description = "Id da entrada")),
    responses(
        (status = 200, body = JournalEntryResponse),
        (status = 404, body = ProblemDetails, description = "journal_entry_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed, unknown_emotion"),
    )
)]
pub async fn update_entry(
    State(state): State<AppState>,
    user: CurrentUser,
    EntryId(id): EntryId,
    ValidJson(body): ValidJson<UpdateJournalEntryRequest>,
) -> Result<Json<JournalEntryResponse>, ApiError> {
    let input = EditJournalEntry {
        occurred_at: body.occurred_at,
        text: body.text,
        emotions: body.emotions.map(emotion_inputs),
        visibility: body.visibility,
    };
    let view = entries(&state).edit(user.user_id, id, input).await?;
    Ok(Json(view.into()))
}

#[utoipa::path(
    delete, path = "/api/v1/journal-entries/{id}", tag = "journal",
    params(("id" = Uuid, Path, description = "Id da entrada")),
    responses(
        (status = 204, description = "Entrada excluída"),
        (status = 404, body = ProblemDetails, description = "journal_entry_not_found"),
    )
)]
pub async fn delete_entry(
    State(state): State<AppState>,
    user: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    EntryId(id): EntryId,
) -> Result<StatusCode, ApiError> {
    entries(&state).delete(user.user_id, id).await?;
    // Depois do commit: a exclusão da entrada não depende das ligações (CB-06).
    if let Some(Extension(hook)) = hook {
        hook(user.user_id, ENTITY_TYPE, id).await;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get, path = "/api/v1/emotions", tag = "journal",
    responses(
        (status = 200, body = EmotionList, description = "Na primeira vez, semeia as sete emoções padrão"),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
    )
)]
pub async fn list_emotions(
    State(state): State<AppState>,
    user: CurrentUser,
) -> Result<Json<EmotionList>, ApiError> {
    let list = emotions(&state).list(user.user_id).await?;
    Ok(Json(EmotionList {
        items: list.into_iter().map(EmotionResponse::from).collect(),
    }))
}

#[utoipa::path(
    post, path = "/api/v1/emotions", tag = "journal", request_body = CreateEmotionRequest,
    responses(
        (status = 201, body = EmotionResponse),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
        (status = 422, body = ProblemDetails, description = "validation_failed, emotion_name_taken"),
    )
)]
pub async fn create_emotion(
    State(state): State<AppState>,
    user: CurrentUser,
    ValidJson(body): ValidJson<CreateEmotionRequest>,
) -> Result<(StatusCode, Json<EmotionResponse>), ApiError> {
    let visibility = body.visibility.unwrap_or_default();
    let emotion = emotions(&state)
        .create(user.user_id, &body.name, visibility)
        .await?;
    Ok((StatusCode::CREATED, Json(emotion.into())))
}

#[utoipa::path(
    patch, path = "/api/v1/emotions/{id}", tag = "journal", request_body = UpdateEmotionRequest,
    params(("id" = Uuid, Path, description = "Id da emoção")),
    responses(
        (status = 200, body = EmotionResponse),
        (status = 404, body = ProblemDetails, description = "emotion_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed, emotion_name_taken"),
    )
)]
pub async fn update_emotion(
    State(state): State<AppState>,
    user: CurrentUser,
    EmotionId(id): EmotionId,
    ValidJson(body): ValidJson<UpdateEmotionRequest>,
) -> Result<Json<EmotionResponse>, ApiError> {
    let emotion = emotions(&state)
        .rename(user.user_id, id, &body.name)
        .await?;
    Ok(Json(emotion.into()))
}

#[utoipa::path(
    delete, path = "/api/v1/emotions/{id}", tag = "journal",
    params(("id" = Uuid, Path, description = "Id da emoção")),
    responses(
        (status = 204, description = "Emoção excluída da lista; continua nas entradas antigas"),
        (status = 404, body = ProblemDetails, description = "emotion_not_found"),
    )
)]
pub async fn delete_emotion(
    State(state): State<AppState>,
    user: CurrentUser,
    EmotionId(id): EmotionId,
) -> Result<StatusCode, ApiError> {
    emotions(&state).delete(user.user_id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
