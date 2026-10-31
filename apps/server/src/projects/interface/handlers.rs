//! Handlers HTTP: validação na borda e conversão de `ProjectError` em `problem+json`
//! ([project/code-style-03]).

use axum::extract::{FromRequest, FromRequestParts, Path, Query, Request, State};
use axum::http::StatusCode;
use axum::http::request::Parts;
use axum::{Extension, Json};
use serde::de::DeserializeOwned;
use uuid::Uuid;

use super::dto::{
    CardPage, CardResponse, CreateCardRequest, CreateLaneRequest, CreateProjectRequest,
    DeleteLaneQuery, LanePage, LaneResponse, MoveCardRequest, ProjectListQuery, ProjectPage,
    ProjectResponse, ProjectSummaryQuery, ProjectSummaryResponse, ReorderLanesRequest,
    UpdateCardRequest, UpdateLaneRequest, UpdateProjectRequest,
};
use crate::http::AppState;
use crate::http::session::CurrentUser;
use crate::projects::application::ports::EntityDeletedHook;
use crate::projects::application::service::{
    ChecklistInput, LanePatch, NewCardInput, NewLane, NewProject, ProjectFilter, ProjectPatch,
    ProjectService,
};
use crate::projects::domain::error::ProjectError;
use crate::projects::infrastructure::pg_project_repository::PgProjectRepository;
use crate::shared::error::{ApiError, FieldError, ProblemDetails};
use crate::shared::pagination::{Cursor, DEFAULT_LIMIT, MAX_LIMIT};

impl From<ProjectError> for ApiError {
    fn from(error: ProjectError) -> Self {
        match error {
            ProjectError::ProjectNotFound => Self::not_found("project_not_found"),
            ProjectError::LaneNotFound => Self::not_found("lane_not_found"),
            ProjectError::CardNotFound => Self::not_found("card_not_found"),
            ProjectError::LastLane => Self::conflict("last_lane"),
            ProjectError::LaneHasCards => Self::conflict("lane_has_cards"),
            ProjectError::InvalidTargetLane => Self::unprocessable("invalid_target_lane", vec![]),
            ProjectError::InvalidLaneOrder => Self::unprocessable("invalid_lane_order", vec![]),
            ProjectError::Validation(errors) => Self::unprocessable("validation_failed", errors),
            ProjectError::Internal(message) => {
                tracing::error!(error = %message, "erro interno do contexto projects");
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

/// Id de caminho malformado não existe: 404 `project_not_found`.
pub struct ValidPath<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned + Send> FromRequestParts<S> for ValidPath<T> {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        Path::<T>::from_request_parts(parts, state)
            .await
            .map(|Path(value)| Self(value))
            .map_err(|_| ApiError::not_found("project_not_found"))
    }
}

fn service(state: &AppState) -> ProjectService<PgProjectRepository> {
    ProjectService {
        repo: PgProjectRepository::new(state.pool.clone()),
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

fn checklist_inputs(items: Option<Vec<super::dto::ChecklistItemRequest>>) -> Vec<ChecklistInput> {
    items
        .unwrap_or_default()
        .into_iter()
        .map(ChecklistInput::from)
        .collect()
}

#[utoipa::path(
    get, path = "/api/v1/projects", tag = "projects", params(ProjectListQuery),
    responses(
        (status = 200, body = ProjectPage),
        (status = 401, body = ProblemDetails),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn list_projects(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidQuery(query): ValidQuery<ProjectListQuery>,
) -> Result<Json<ProjectPage>, ApiError> {
    let cursor = query
        .cursor
        .as_deref()
        .map(Cursor::decode)
        .transpose()
        .map_err(|_| invalid_body("cursor"))?;
    let filter = ProjectFilter {
        text: query.q.filter(|text| !text.trim().is_empty()),
        visibility: query.visibility,
        cursor,
        limit: query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT),
    };
    let page = service(&state)
        .list_projects(current.user_id, filter)
        .await?;
    Ok(Json(ProjectPage {
        items: page.items.into_iter().map(ProjectResponse::from).collect(),
        next_cursor: page.next_cursor,
    }))
}

#[utoipa::path(
    post, path = "/api/v1/projects", tag = "projects", request_body = CreateProjectRequest,
    responses(
        (status = 201, body = ProjectResponse),
        (status = 401, body = ProblemDetails),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn create_project(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidJson(body): ValidJson<CreateProjectRequest>,
) -> Result<(StatusCode, Json<ProjectResponse>), ApiError> {
    let new = NewProject {
        name: body.name,
        description: body.description,
        visibility: body.visibility.unwrap_or_default(),
    };
    let project = service(&state).create_project(current.user_id, new).await?;
    Ok((StatusCode::CREATED, Json(project.into())))
}

#[utoipa::path(
    get, path = "/api/v1/projects/{id}", tag = "projects",
    params(("id" = Uuid, Path, description = "Id do projeto")),
    responses(
        (status = 200, body = ProjectResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found"),
    )
)]
pub async fn get_project(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath(id): ValidPath<Uuid>,
) -> Result<Json<ProjectResponse>, ApiError> {
    let project = service(&state).get_project(current.user_id, id).await?;
    Ok(Json(project.into()))
}

#[utoipa::path(
    patch, path = "/api/v1/projects/{id}", tag = "projects",
    params(("id" = Uuid, Path, description = "Id do projeto")),
    request_body = UpdateProjectRequest,
    responses(
        (status = 200, body = ProjectResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_project(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath(id): ValidPath<Uuid>,
    ValidJson(body): ValidJson<UpdateProjectRequest>,
) -> Result<Json<ProjectResponse>, ApiError> {
    let patch = ProjectPatch {
        name: body.name,
        description: body.description,
        visibility: body.visibility,
    };
    let project = service(&state)
        .update_project(current.user_id, id, patch)
        .await?;
    Ok(Json(project.into()))
}

#[utoipa::path(
    delete, path = "/api/v1/projects/{id}", tag = "projects",
    params(("id" = Uuid, Path, description = "Id do projeto")),
    responses(
        (status = 204, description = "Projeto e cartões excluídos"),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found"),
    )
)]
pub async fn delete_project(
    State(state): State<AppState>,
    current: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    ValidPath(id): ValidPath<Uuid>,
) -> Result<StatusCode, ApiError> {
    let deleted = service(&state).delete_project(current.user_id, id).await?;
    // Depois do commit: as ligações do projeto e dos cartões somem dos dois lados (CB-06).
    let owner = current.user_id;
    notify_deleted(hook.clone(), owner, "project", deleted.project_id).await;
    for card_id in deleted.card_ids {
        notify_deleted(hook.clone(), owner, "project_card", card_id).await;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get, path = "/api/v1/projects/{id}/summary", tag = "projects",
    params(("id" = Uuid, Path, description = "Id do projeto"), ProjectSummaryQuery),
    responses(
        (status = 200, body = ProjectSummaryResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn project_summary(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath(id): ValidPath<Uuid>,
    ValidQuery(query): ValidQuery<ProjectSummaryQuery>,
) -> Result<Json<ProjectSummaryResponse>, ApiError> {
    let summary = service(&state)
        .summary(current.user_id, id, query.today)
        .await?;
    Ok(Json(summary.into()))
}

#[utoipa::path(
    get, path = "/api/v1/projects/{id}/lanes", tag = "projects",
    params(("id" = Uuid, Path, description = "Id do projeto")),
    responses(
        (status = 200, body = LanePage),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found"),
    )
)]
pub async fn list_lanes(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath(id): ValidPath<Uuid>,
) -> Result<Json<LanePage>, ApiError> {
    let lanes = service(&state).list_lanes(current.user_id, id).await?;
    Ok(Json(LanePage {
        items: lanes.into_iter().map(LaneResponse::from).collect(),
        next_cursor: None,
    }))
}

#[utoipa::path(
    post, path = "/api/v1/projects/{id}/lanes", tag = "projects",
    params(("id" = Uuid, Path, description = "Id do projeto")),
    request_body = CreateLaneRequest,
    responses(
        (status = 201, body = LaneResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn create_lane(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath(id): ValidPath<Uuid>,
    ValidJson(body): ValidJson<CreateLaneRequest>,
) -> Result<(StatusCode, Json<LaneResponse>), ApiError> {
    let new = NewLane {
        name: body.name,
        color: body.color,
        counts_as_done: body.counts_as_done.unwrap_or(false),
        position: body.position,
    };
    let lane = service(&state)
        .create_lane(current.user_id, id, new)
        .await?;
    Ok((StatusCode::CREATED, Json(lane.into())))
}

#[utoipa::path(
    put, path = "/api/v1/projects/{id}/lanes/order", tag = "projects",
    params(("id" = Uuid, Path, description = "Id do projeto")),
    request_body = ReorderLanesRequest,
    responses(
        (status = 200, body = LanePage),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found"),
        (status = 422, body = ProblemDetails, description = "invalid_lane_order"),
    )
)]
pub async fn reorder_lanes(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath(id): ValidPath<Uuid>,
    ValidJson(body): ValidJson<ReorderLanesRequest>,
) -> Result<Json<LanePage>, ApiError> {
    let lanes = service(&state)
        .reorder_lanes(current.user_id, id, body.lane_ids)
        .await?;
    Ok(Json(LanePage {
        items: lanes.into_iter().map(LaneResponse::from).collect(),
        next_cursor: None,
    }))
}

#[utoipa::path(
    patch, path = "/api/v1/projects/{id}/lanes/{lane_id}", tag = "projects",
    params(
        ("id" = Uuid, Path, description = "Id do projeto"),
        ("lane_id" = Uuid, Path, description = "Id da raia"),
    ),
    request_body = UpdateLaneRequest,
    responses(
        (status = 200, body = LaneResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found ou lane_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_lane(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath((id, lane_id)): ValidPath<(Uuid, Uuid)>,
    ValidJson(body): ValidJson<UpdateLaneRequest>,
) -> Result<Json<LaneResponse>, ApiError> {
    let patch = LanePatch {
        name: body.name,
        color: body.color,
        counts_as_done: body.counts_as_done,
    };
    let lane = service(&state)
        .update_lane(current.user_id, id, lane_id, patch)
        .await?;
    Ok(Json(lane.into()))
}

#[utoipa::path(
    delete, path = "/api/v1/projects/{id}/lanes/{lane_id}", tag = "projects",
    params(
        ("id" = Uuid, Path, description = "Id do projeto"),
        ("lane_id" = Uuid, Path, description = "Id da raia"),
        DeleteLaneQuery,
    ),
    responses(
        (status = 204, description = "Raia excluída"),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found ou lane_not_found"),
        (status = 409, body = ProblemDetails, description = "last_lane ou lane_has_cards"),
        (status = 422, body = ProblemDetails, description = "invalid_target_lane"),
    )
)]
pub async fn delete_lane(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath((id, lane_id)): ValidPath<(Uuid, Uuid)>,
    ValidQuery(query): ValidQuery<DeleteLaneQuery>,
) -> Result<StatusCode, ApiError> {
    service(&state)
        .delete_lane(current.user_id, id, lane_id, query.move_cards_to)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get, path = "/api/v1/projects/{id}/cards", tag = "projects",
    params(("id" = Uuid, Path, description = "Id do projeto")),
    responses(
        (status = 200, body = CardPage),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found"),
    )
)]
pub async fn list_cards(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath(id): ValidPath<Uuid>,
) -> Result<Json<CardPage>, ApiError> {
    let cards = service(&state).list_cards(current.user_id, id).await?;
    Ok(Json(CardPage {
        items: cards.into_iter().map(CardResponse::from).collect(),
        next_cursor: None,
    }))
}

#[utoipa::path(
    post, path = "/api/v1/projects/{id}/cards", tag = "projects",
    params(("id" = Uuid, Path, description = "Id do projeto")),
    request_body = CreateCardRequest,
    responses(
        (status = 201, body = CardResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed ou invalid_target_lane"),
    )
)]
pub async fn create_card(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath(id): ValidPath<Uuid>,
    ValidJson(body): ValidJson<CreateCardRequest>,
) -> Result<(StatusCode, Json<CardResponse>), ApiError> {
    let new = NewCardInput {
        lane_id: body.lane_id,
        title: body.title,
        description: body.description,
        priority: body.priority,
        labels: body.labels.unwrap_or_default(),
        due_date: body.due_date,
        checklist: checklist_inputs(body.checklist),
        position: body.position,
    };
    let card = service(&state)
        .create_card(current.user_id, id, new)
        .await?;
    Ok((StatusCode::CREATED, Json(card.into())))
}

#[utoipa::path(
    get, path = "/api/v1/projects/{id}/cards/{card_id}", tag = "projects",
    params(
        ("id" = Uuid, Path, description = "Id do projeto"),
        ("card_id" = Uuid, Path, description = "Id do cartão"),
    ),
    responses(
        (status = 200, body = CardResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found ou card_not_found"),
    )
)]
pub async fn get_card(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath((id, card_id)): ValidPath<(Uuid, Uuid)>,
) -> Result<Json<CardResponse>, ApiError> {
    let card = service(&state)
        .get_card(current.user_id, id, card_id)
        .await?;
    Ok(Json(card.into()))
}

#[utoipa::path(
    get, path = "/api/v1/cards/{card_id}", tag = "projects",
    params(("card_id" = Uuid, Path, description = "Id do cartão")),
    responses(
        (status = 200, body = CardResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "card_not_found"),
    )
)]
pub async fn get_card_by_id(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath(card_id): ValidPath<Uuid>,
) -> Result<Json<CardResponse>, ApiError> {
    let card = service(&state)
        .get_card_by_id(current.user_id, card_id)
        .await?;
    Ok(Json(card.into()))
}

#[utoipa::path(
    patch, path = "/api/v1/projects/{id}/cards/{card_id}", tag = "projects",
    params(
        ("id" = Uuid, Path, description = "Id do projeto"),
        ("card_id" = Uuid, Path, description = "Id do cartão"),
    ),
    request_body = UpdateCardRequest,
    responses(
        (status = 200, body = CardResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found ou card_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_card(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath((id, card_id)): ValidPath<(Uuid, Uuid)>,
    ValidJson(body): ValidJson<UpdateCardRequest>,
) -> Result<Json<CardResponse>, ApiError> {
    let card = service(&state)
        .update_card(current.user_id, id, card_id, body.into())
        .await?;
    Ok(Json(card.into()))
}

#[utoipa::path(
    post, path = "/api/v1/projects/{id}/cards/{card_id}/move", tag = "projects",
    params(
        ("id" = Uuid, Path, description = "Id do projeto"),
        ("card_id" = Uuid, Path, description = "Id do cartão"),
    ),
    request_body = MoveCardRequest,
    responses(
        (status = 200, body = CardResponse),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found ou card_not_found"),
        (status = 422, body = ProblemDetails, description = "validation_failed ou invalid_target_lane"),
    )
)]
pub async fn move_card(
    State(state): State<AppState>,
    current: CurrentUser,
    ValidPath((id, card_id)): ValidPath<(Uuid, Uuid)>,
    ValidJson(body): ValidJson<MoveCardRequest>,
) -> Result<Json<CardResponse>, ApiError> {
    let card = service(&state)
        .move_card(current.user_id, id, card_id, body.lane_id, body.position)
        .await?;
    Ok(Json(card.into()))
}

#[utoipa::path(
    delete, path = "/api/v1/projects/{id}/cards/{card_id}", tag = "projects",
    params(
        ("id" = Uuid, Path, description = "Id do projeto"),
        ("card_id" = Uuid, Path, description = "Id do cartão"),
    ),
    responses(
        (status = 204, description = "Cartão excluído"),
        (status = 401, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "project_not_found ou card_not_found"),
    )
)]
pub async fn delete_card(
    State(state): State<AppState>,
    current: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    ValidPath((id, card_id)): ValidPath<(Uuid, Uuid)>,
) -> Result<StatusCode, ApiError> {
    service(&state)
        .delete_card(current.user_id, id, card_id)
        .await?;
    notify_deleted(hook, current.user_id, "project_card", card_id).await;
    Ok(StatusCode::NO_CONTENT)
}
