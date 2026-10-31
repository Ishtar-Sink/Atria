//! Handlers da API de lembretes: validação na borda e conversão de `RemindersError`
//! em `problem+json` ([project/api-03]).

use std::sync::Arc;

use axum::Json;
use axum::extract::rejection::{JsonRejection, QueryRejection};
use axum::extract::{Extension, Path, Query, State};
use axum::http::StatusCode;
use uuid::Uuid;

use crate::http::{AppState, CurrentUser};
use crate::reminders::application::ports::{EntityDeletedHook, ReminderFilter, WebPushPolicy};
use crate::reminders::application::reminders::{ReminderPatch, ReminderService};
use crate::reminders::application::subscriptions::SubscriptionService;
use crate::reminders::domain::error::RemindersError;
use crate::reminders::domain::push_subscription::NewPushSubscription;
use crate::reminders::domain::reminder::ReminderDraft;
use crate::reminders::infrastructure::pg_reminders::{
    PgReminderRepository, PgSubscriptionRepository,
};
use crate::reminders::infrastructure::web_push_sender::vapid_key;
use crate::reminders::interface::dto::{
    CreateReminderBody, CreateSubscriptionBody, ListRemindersQuery, PatchReminderBody,
    PublicKeyResponse, ReminderPageResponse, ReminderResponse, SubscriptionResponse,
    UpcomingFireResponse, UpcomingQuery, UpcomingResponse,
};
use crate::shared::error::{ApiError, FieldError, ProblemDetails};
use crate::shared::pagination::PageParams;
use crate::shared::visibility::Visibility;

/// Tipo da entidade no gancho de exclusão (CB-06).
pub const REMINDER_ENTITY: &str = "reminder";

type Policy = Option<Extension<Arc<dyn WebPushPolicy>>>;

pub fn api_error(error: RemindersError) -> ApiError {
    match error {
        RemindersError::NotFound => ApiError::not_found("not_found"),
        RemindersError::WebPushDisabled => ApiError::not_found("web_push_disabled"),
        RemindersError::Validation(issues) => ApiError::unprocessable(
            "validation_failed",
            issues
                .iter()
                .map(|issue| FieldError::new(issue.field, issue.code))
                .collect(),
        ),
        RemindersError::Storage(cause) => ApiError::internal_from(cause.as_ref()),
    }
}

fn invalid(field: &str, code: &str) -> ApiError {
    ApiError::unprocessable("validation_failed", vec![FieldError::new(field, code)])
}

fn body<T>(payload: Result<Json<T>, JsonRejection>) -> Result<T, ApiError> {
    payload
        .map(|Json(body)| body)
        .map_err(|_| invalid("body", "invalid_body"))
}

fn query<T>(params: Result<Query<T>, QueryRejection>) -> Result<T, ApiError> {
    params
        .map(|Query(params)| params)
        .map_err(|_| invalid("query", "invalid_query"))
}

fn service<'a>(repository: &'a PgReminderRepository, state: &'a AppState) -> ReminderService<'a> {
    ReminderService {
        repository,
        clock: state.clock.as_ref(),
        ids: state.ids.as_ref(),
    }
}

/// Web Push disponível: ligado pelo admin e com a chave VAPID configurada.
async fn web_push_available(state: &AppState, policy: &Policy) -> bool {
    let enabled = match policy {
        Some(Extension(policy)) => policy.is_enabled().await,
        None => false,
    };
    enabled && state.config.web_push_vapid_key_file.is_some()
}

#[utoipa::path(
    get,
    path = "/reminders",
    tag = "reminders",
    params(ListRemindersQuery),
    responses(
        (status = 200, body = ReminderPageResponse),
        (status = 401, body = ProblemDetails),
        (status = 422, body = ProblemDetails),
    )
)]
pub async fn list_reminders(
    State(state): State<AppState>,
    user: CurrentUser,
    params: Result<Query<ListRemindersQuery>, QueryRejection>,
) -> Result<Json<ReminderPageResponse>, ApiError> {
    let params = query(params)?;
    let page = PageParams {
        cursor: params.cursor,
        limit: params.limit,
    };
    let cursor = page
        .cursor()
        .map_err(|_| invalid("cursor", "invalid_cursor"))?;
    let filter = ReminderFilter {
        kind: params.kind.map(Into::into),
        visibility: params.visibility,
        query: params.q.filter(|q| !q.trim().is_empty()),
        cursor,
        limit: page.limit(),
    };
    let repository = PgReminderRepository::new(state.pool.clone());
    let page = service(&repository, &state)
        .list(user.user_id, filter)
        .await
        .map_err(api_error)?;
    Ok(Json(ReminderPageResponse {
        items: page.items.into_iter().map(Into::into).collect(),
        next_cursor: page.next_cursor,
    }))
}

#[utoipa::path(
    post,
    path = "/reminders",
    tag = "reminders",
    request_body = CreateReminderBody,
    responses(
        (status = 201, body = ReminderResponse),
        (status = 401, body = ProblemDetails),
        (status = 403, body = ProblemDetails),
        (status = 422, body = ProblemDetails),
    )
)]
pub async fn create_reminder(
    State(state): State<AppState>,
    user: CurrentUser,
    payload: Result<Json<CreateReminderBody>, JsonRejection>,
) -> Result<(StatusCode, Json<ReminderResponse>), ApiError> {
    let payload = body(payload)?;
    let draft = ReminderDraft {
        title: payload.title,
        notes: payload.notes,
        visibility: payload.visibility.unwrap_or(Visibility::Personal),
        timezone: payload.timezone,
        remind_at: payload.remind_at,
        rule: payload.rule,
    };
    let repository = PgReminderRepository::new(state.pool.clone());
    let record = service(&repository, &state)
        .create(user.user_id, draft)
        .await
        .map_err(api_error)?;
    Ok((StatusCode::CREATED, Json(record.into())))
}

#[utoipa::path(
    get,
    path = "/reminders/upcoming",
    tag = "reminders",
    params(UpcomingQuery),
    responses(
        (status = 200, body = UpcomingResponse),
        (status = 401, body = ProblemDetails),
        (status = 422, body = ProblemDetails),
    )
)]
pub async fn upcoming_fires(
    State(state): State<AppState>,
    user: CurrentUser,
    params: Result<Query<UpcomingQuery>, QueryRejection>,
) -> Result<Json<UpcomingResponse>, ApiError> {
    let params = query(params)?;
    let repository = PgReminderRepository::new(state.pool.clone());
    let fires = service(&repository, &state)
        .upcoming(user.user_id, params.from, params.to)
        .await
        .map_err(api_error)?;
    Ok(Json(UpcomingResponse {
        items: fires.into_iter().map(UpcomingFireResponse::from).collect(),
    }))
}

#[utoipa::path(
    get,
    path = "/reminders/{id}",
    tag = "reminders",
    params(("id" = Uuid, Path)),
    responses(
        (status = 200, body = ReminderResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails),
    )
)]
pub async fn get_reminder(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
) -> Result<Json<ReminderResponse>, ApiError> {
    let repository = PgReminderRepository::new(state.pool.clone());
    let record = service(&repository, &state)
        .get(user.user_id, id)
        .await
        .map_err(api_error)?;
    Ok(Json(record.into()))
}

#[utoipa::path(
    patch,
    path = "/reminders/{id}",
    tag = "reminders",
    params(("id" = Uuid, Path)),
    request_body = PatchReminderBody,
    responses(
        (status = 200, body = ReminderResponse),
        (status = 401, body = ProblemDetails),
        (status = 403, body = ProblemDetails),
        (status = 404, body = ProblemDetails),
        (status = 422, body = ProblemDetails),
    )
)]
pub async fn patch_reminder(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
    payload: Result<Json<PatchReminderBody>, JsonRejection>,
) -> Result<Json<ReminderResponse>, ApiError> {
    let payload = body(payload)?;
    let patch = ReminderPatch {
        title: payload.title,
        notes: payload.notes,
        visibility: payload.visibility,
        timezone: payload.timezone,
        remind_at: payload.remind_at,
        rule: payload.rule,
    };
    let repository = PgReminderRepository::new(state.pool.clone());
    let record = service(&repository, &state)
        .update(user.user_id, id, patch)
        .await
        .map_err(api_error)?;
    Ok(Json(record.into()))
}

#[utoipa::path(
    delete,
    path = "/reminders/{id}",
    tag = "reminders",
    params(("id" = Uuid, Path)),
    responses(
        (status = 204),
        (status = 401, body = ProblemDetails),
        (status = 403, body = ProblemDetails),
        (status = 404, body = ProblemDetails),
    )
)]
pub async fn delete_reminder(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
    hook: Option<Extension<EntityDeletedHook>>,
) -> Result<StatusCode, ApiError> {
    let repository = PgReminderRepository::new(state.pool.clone());
    service(&repository, &state)
        .delete(user.user_id, id)
        .await
        .map_err(api_error)?;
    // Só depois do commit: uma exclusão desfeita não pode apagar as ligações.
    if let Some(Extension(hook)) = hook {
        hook(user.user_id, REMINDER_ENTITY, id).await;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/web-push/public-key",
    tag = "reminders",
    responses(
        (status = 200, body = PublicKeyResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "Web Push desligado (`web_push_disabled`)"),
    )
)]
pub async fn web_push_public_key(
    State(state): State<AppState>,
    _user: CurrentUser,
    policy: Policy,
) -> Result<Json<PublicKeyResponse>, ApiError> {
    if !web_push_available(&state, &policy).await {
        return Err(api_error(RemindersError::WebPushDisabled));
    }
    match vapid_key(&state.config) {
        Ok(Some(key)) => Ok(Json(PublicKeyResponse {
            public_key: key.public_key(),
        })),
        Ok(None) => Err(api_error(RemindersError::WebPushDisabled)),
        Err(error) => {
            // Chave ilegível: o Web Push fica fora, e o lembrete segue no app.
            tracing::warn!(error = %error, "chave VAPID indisponível");
            Err(api_error(RemindersError::WebPushDisabled))
        }
    }
}

#[utoipa::path(
    post,
    path = "/push-subscriptions",
    tag = "reminders",
    request_body = CreateSubscriptionBody,
    responses(
        (status = 201, body = SubscriptionResponse),
        (status = 401, body = ProblemDetails),
        (status = 403, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "Web Push desligado (`web_push_disabled`)"),
        (status = 422, body = ProblemDetails),
    )
)]
pub async fn create_subscription(
    State(state): State<AppState>,
    user: CurrentUser,
    policy: Policy,
    payload: Result<Json<CreateSubscriptionBody>, JsonRejection>,
) -> Result<(StatusCode, Json<SubscriptionResponse>), ApiError> {
    let payload = body(payload)?;
    let subscription =
        NewPushSubscription::new(&payload.endpoint, &payload.keys.p256dh, &payload.keys.auth)
            .map_err(api_error)?;
    let available = web_push_available(&state, &policy).await;
    let repository = PgSubscriptionRepository::new(state.pool.clone());
    let subscriptions = SubscriptionService {
        repository: &repository,
        clock: state.clock.as_ref(),
        ids: state.ids.as_ref(),
    };
    let created = subscriptions
        .subscribe(user.user_id, available, subscription)
        .await
        .map_err(api_error)?;
    Ok((StatusCode::CREATED, Json(created.into())))
}

#[utoipa::path(
    delete,
    path = "/push-subscriptions/{id}",
    tag = "reminders",
    params(("id" = Uuid, Path)),
    responses(
        (status = 204),
        (status = 401, body = ProblemDetails),
        (status = 403, body = ProblemDetails),
        (status = 404, body = ProblemDetails),
    )
)]
pub async fn delete_subscription(
    State(state): State<AppState>,
    user: CurrentUser,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let repository = PgSubscriptionRepository::new(state.pool.clone());
    let subscriptions = SubscriptionService {
        repository: &repository,
        clock: state.clock.as_ref(),
        ids: state.ids.as_ref(),
    };
    subscriptions
        .unsubscribe(user.user_id, id)
        .await
        .map_err(api_error)?;
    Ok(StatusCode::NO_CONTENT)
}
