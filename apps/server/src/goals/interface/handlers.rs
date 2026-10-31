//! Handlers HTTP: validação na borda e conversão de `GoalsError` em `problem+json`
//! ([project/code-style-03]).

use axum::extract::{FromRequest, FromRequestParts, Path, Query, Request, State};
use axum::http::StatusCode;
use axum::http::request::Parts;
use axum::{Extension, Json};
use serde::de::DeserializeOwned;
use uuid::Uuid;

use super::dto::{
    CreateGoalRequest, CreateMilestoneRequest, GoalListQuery, GoalPage, GoalResponse,
    MilestonePage, MilestoneResponse, SortParam, UpdateGoalRequest, UpdateMilestoneRequest,
};
use crate::goals::application::goals::{GoalFilter, GoalsService, NewGoal, NewMilestone};
use crate::goals::application::ports::{EntityDeletedHook, GoalSort};
use crate::goals::domain::error::GoalsError;
use crate::goals::domain::goal::GoalPatch;
use crate::goals::domain::milestone::MilestonePatch;
use crate::goals::infrastructure::pg_goals::PgGoalRepository;
use crate::http::AppState;
use crate::http::session::CurrentUser;
use crate::shared::error::{ApiError, FieldError, ProblemDetails};
use crate::shared::pagination::{Cursor, DEFAULT_LIMIT, MAX_LIMIT};

impl From<GoalsError> for ApiError {
    fn from(error: GoalsError) -> Self {
        match error {
            GoalsError::NotFound => Self::not_found("not_found"),
            GoalsError::Validation(errors) => Self::unprocessable("validation_failed", errors),
            GoalsError::Internal(message) => {
                tracing::error!(error = %message, "erro interno do contexto goals");
                Self::internal()
            }
        }
    }
}

fn invalid_body(field: &str) -> ApiError {
    ApiError::unprocessable("validation_failed", vec![FieldError::new(field, "invalid")])
}

/// Corpo JSON cuja falha de leitura vira `problem+json` com código estável.
pub struct ValidJson<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned> FromRequest<S> for ValidJson<T> {
    type Rejection = ApiError;

    async fn from_request(request: Request, state: &S) -> Result<Self, Self::Rejection> {
        Json::<T>::from_request(request, state)
            .await
            .map(|Json(value)| Self(value))
            .map_err(|_| invalid_body("body"))
    }
}

/// Query string cuja falha de leitura vira `problem+json` com código estável.
pub struct ValidQuery<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned> FromRequestParts<S> for ValidQuery<T> {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        Query::<T>::from_request_parts(parts, state)
            .await
            .map(|Query(value)| Self(value))
            .map_err(|_| invalid_body("query"))
    }
}

/// Id de caminho malformado não existe: 404 `not_found`.
pub struct ValidPath<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned + Send> FromRequestParts<S> for ValidPath<T> {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        Path::<T>::from_request_parts(parts, state)
            .await
            .map(|Path(value)| Self(value))
            .map_err(|_| ApiError::not_found("not_found"))
    }
}

fn service(state: &AppState) -> GoalsService<PgGoalRepository> {
    GoalsService {
        repo: PgGoalRepository::new(state.pool.clone()),
        clock: state.clock.clone(),
        ids: state.ids.clone(),
    }
}

/// Chama o gancho de exclusão, se instalado, depois do commit (CB-06).
async fn notify_deleted(
    hook: Option<Extension<EntityDeletedHook>>,
    owner: Uuid,
    entity_type: &'static str,
    entity_id: Uuid,
) {
    if let Some(Extension(hook)) = hook {
        hook(owner, entity_type, entity_id).await;
    }
}

#[utoipa::path(
    get, path = "/api/v1/goals", tag = "goals", params(GoalListQuery),
    responses(
        (status = 200, body = GoalPage),
        (status = 401, body = ProblemDetails),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn list_goals(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidQuery(query): ValidQuery<GoalListQuery>,
) -> Result<Json<GoalPage>, ApiError> {
    let sort = match query.sort.unwrap_or_default() {
        SortParam::Deadline => GoalSort::Deadline,
        SortParam::CreatedAt => GoalSort::CreatedAt,
    };
    let cursor = query
        .cursor
        .as_deref()
        .map(Cursor::decode)
        .transpose()
        .map_err(|_| invalid_body("cursor"))?;
    let filter = GoalFilter {
        status: query.status,
        text: query.q.filter(|text| !text.trim().is_empty()),
        label: query.label,
        has_deadline: query.has_deadline,
        sort,
        cursor,
        limit: query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT),
    };
    let page = service(&state).list_goals(current.user_id, filter).await?;
    Ok(Json(GoalPage {
        items: page.items.into_iter().map(GoalResponse::from).collect(),
        next_cursor: page.next_cursor,
    }))
}

#[utoipa::path(
    post, path = "/api/v1/goals", tag = "goals", request_body = CreateGoalRequest,
    responses(
        (status = 201, body = GoalResponse),
        (status = 401, body = ProblemDetails),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn create_goal(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidJson(body): ValidJson<CreateGoalRequest>,
) -> Result<(StatusCode, Json<GoalResponse>), ApiError> {
    let new = NewGoal {
        title: body.title,
        description: body.description,
        deadline: body.deadline,
        status: body.status.unwrap_or_default(),
        labels: body.labels.unwrap_or_default(),
        visibility: body.visibility.unwrap_or_default(),
    };
    let view = service(&state).create_goal(current.user_id, new).await?;
    Ok((StatusCode::CREATED, Json(view.into())))
}

#[utoipa::path(
    get, path = "/api/v1/goals/{id}", tag = "goals",
    params(("id" = Uuid, Path, description = "Id da meta")),
    responses(
        (status = 200, body = GoalResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "not_found"),
    )
)]
pub async fn get_goal(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath(id): ValidPath<Uuid>,
) -> Result<Json<GoalResponse>, ApiError> {
    let view = service(&state).get_goal(current.user_id, id).await?;
    Ok(Json(view.into()))
}

#[utoipa::path(
    patch, path = "/api/v1/goals/{id}", tag = "goals",
    params(("id" = Uuid, Path, description = "Id da meta")),
    request_body = UpdateGoalRequest,
    responses(
        (status = 200, body = GoalResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_goal(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath(id): ValidPath<Uuid>,
    ValidJson(body): ValidJson<UpdateGoalRequest>,
) -> Result<Json<GoalResponse>, ApiError> {
    let patch = GoalPatch {
        title: body.title,
        description: body.description,
        deadline: body.deadline,
        status: body.status,
        labels: body.labels,
        visibility: body.visibility,
    };
    let view = service(&state)
        .update_goal(current.user_id, id, patch)
        .await?;
    Ok(Json(view.into()))
}

#[utoipa::path(
    delete, path = "/api/v1/goals/{id}", tag = "goals",
    params(("id" = Uuid, Path, description = "Id da meta")),
    responses(
        (status = 204, description = "Meta e marcos excluídos"),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "not_found"),
    )
)]
pub async fn delete_goal(
    State(state): State<AppState>,
    current: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    ValidPath(id): ValidPath<Uuid>,
) -> Result<StatusCode, ApiError> {
    let deleted = service(&state).delete_goal(current.user_id, id).await?;
    // Depois do commit: as ligações da meta e dos marcos somem dos dois lados (CB-06).
    let owner = current.user_id;
    notify_deleted(hook.clone(), owner, "goal", deleted.goal_id).await;
    for milestone_id in deleted.milestone_ids {
        notify_deleted(hook.clone(), owner, "milestone", milestone_id).await;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get, path = "/api/v1/goals/{id}/milestones", tag = "goals",
    params(("id" = Uuid, Path, description = "Id da meta")),
    responses(
        (status = 200, body = MilestonePage),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "not_found"),
    )
)]
pub async fn list_milestones(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath(id): ValidPath<Uuid>,
) -> Result<Json<MilestonePage>, ApiError> {
    let items = service(&state).list_milestones(current.user_id, id).await?;
    Ok(Json(MilestonePage {
        items: items.into_iter().map(MilestoneResponse::from).collect(),
        next_cursor: None,
    }))
}

#[utoipa::path(
    post, path = "/api/v1/goals/{id}/milestones", tag = "goals",
    params(("id" = Uuid, Path, description = "Id da meta")),
    request_body = CreateMilestoneRequest,
    responses(
        (status = 201, body = MilestoneResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn create_milestone(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath(id): ValidPath<Uuid>,
    ValidJson(body): ValidJson<CreateMilestoneRequest>,
) -> Result<(StatusCode, Json<MilestoneResponse>), ApiError> {
    let new = NewMilestone {
        title: body.title,
        position: body.position,
        visibility: body.visibility.unwrap_or_default(),
    };
    let milestone = service(&state)
        .create_milestone(current.user_id, id, new)
        .await?;
    Ok((StatusCode::CREATED, Json(milestone.into())))
}

#[utoipa::path(
    patch, path = "/api/v1/goals/{id}/milestones/{milestone_id}", tag = "goals",
    params(
        ("id" = Uuid, Path, description = "Id da meta"),
        ("milestone_id" = Uuid, Path, description = "Id do marco"),
    ),
    request_body = UpdateMilestoneRequest,
    responses(
        (status = 200, body = MilestoneResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_milestone(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath((id, milestone_id)): ValidPath<(Uuid, Uuid)>,
    ValidJson(body): ValidJson<UpdateMilestoneRequest>,
) -> Result<Json<MilestoneResponse>, ApiError> {
    let patch = MilestonePatch {
        title: body.title,
        position: body.position,
        completed: body.completed,
        visibility: body.visibility,
    };
    let milestone = service(&state)
        .update_milestone(current.user_id, id, milestone_id, patch)
        .await?;
    Ok(Json(milestone.into()))
}

#[utoipa::path(
    delete, path = "/api/v1/goals/{id}/milestones/{milestone_id}", tag = "goals",
    params(
        ("id" = Uuid, Path, description = "Id da meta"),
        ("milestone_id" = Uuid, Path, description = "Id do marco"),
    ),
    responses(
        (status = 204, description = "Marco excluído"),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "not_found"),
    )
)]
pub async fn delete_milestone(
    State(state): State<AppState>,
    current: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    ValidPath((id, milestone_id)): ValidPath<(Uuid, Uuid)>,
) -> Result<StatusCode, ApiError> {
    service(&state)
        .delete_milestone(current.user_id, id, milestone_id)
        .await?;
    notify_deleted(hook, current.user_id, "milestone", milestone_id).await;
    Ok(StatusCode::NO_CONTENT)
}
