//! Handlers de tarefas: validação na borda e conversão de `TasksError` em
//! `problem+json` ([project/api-03], [project/code-style-03]).

use axum::Extension;
use axum::Json;
use axum::extract::rejection::{JsonRejection, PathRejection, QueryRejection};
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::http::{AppState, CurrentUser};
use crate::shared::error::{ApiError, FieldError, ProblemDetails};
use crate::shared::pagination::{Cursor, PageParams};
use crate::tasks::application::ports::{EntityDeletedHook, TaskFilter, TaskStatus};
use crate::tasks::application::tasks::{NewTask, TaskChanges, TasksService};
use crate::tasks::domain::TasksError;
use crate::tasks::infrastructure::PgTasksRepository;
use crate::tasks::interface::dto::{
    CompletionQuery, CompletionRequest, CompletionResponse, CreateTaskRequest,
    OccurrenceListResponse, OccurrencesQuery, TaskListQuery, TaskPageResponse, TaskResponse,
    TaskStatusParam, UpdateTaskRequest,
};

/// Tipo usado no gancho de exclusão para as ligações ([project/architecture-05]).
pub const TASK_ENTITY: &str = "task";
const QUERY_MAX_CHARS: usize = 200;

fn service(state: &AppState) -> TasksService<PgTasksRepository> {
    let repository = PgTasksRepository::new(state.pool.clone(), state.ids.clone());
    TasksService::new(repository, state.clock.clone(), state.ids.clone())
}

pub(crate) fn api_error(error: TasksError) -> ApiError {
    let code = error.code();
    match error {
        TasksError::NotFound | TasksError::OccurrenceNotFound => ApiError::not_found(code),
        TasksError::OccurrenceDateRequired => {
            ApiError::unprocessable(code, vec![FieldError::new("occurrence_date", "required")])
        }
        TasksError::OccurrenceInPast => {
            ApiError::unprocessable(code, vec![FieldError::new("occurrence_date", "in_past")])
        }
        TasksError::OccurrenceDateNotAllowed => ApiError::unprocessable(
            code,
            vec![FieldError::new("occurrence_date", "not_allowed")],
        ),
        TasksError::Validation(issues) => ApiError::unprocessable(
            code,
            issues
                .iter()
                .map(|issue| FieldError::new(issue.field, issue.code))
                .collect(),
        ),
        TasksError::AlreadyCompleted | TasksError::NotCompleted => ApiError::conflict(code),
        TasksError::Storage(cause) => ApiError::internal_from(cause.as_ref()),
    }
}

fn invalid(field: &str, code: &str) -> ApiError {
    ApiError::unprocessable("validation_failed", vec![FieldError::new(field, code)])
}

fn body<T>(payload: Result<Json<T>, JsonRejection>) -> Result<T, ApiError> {
    payload
        .map(|Json(value)| value)
        .map_err(|_| invalid("body", "invalid"))
}

fn query<T>(params: Result<Query<T>, QueryRejection>) -> Result<T, ApiError> {
    params
        .map(|Query(value)| value)
        .map_err(|_| invalid("query", "invalid"))
}

/// Id malformado responde como inexistente.
fn task_id(path: Result<Path<Uuid>, PathRejection>) -> Result<Uuid, ApiError> {
    path.map(|Path(id)| id)
        .map_err(|_| ApiError::not_found("not_found"))
}

fn list_filter(params: TaskListQuery) -> Result<TaskFilter, ApiError> {
    let page = PageParams {
        cursor: params.cursor,
        limit: params.limit,
    };
    let after = match page.cursor().map_err(|_| invalid("cursor", "invalid"))? {
        Some(cursor) => Some(cursor_position(&cursor)?),
        None => None,
    };
    let query = params
        .q
        .map(|text| text.trim().to_owned())
        .filter(|text| !text.is_empty());
    if query
        .as_ref()
        .is_some_and(|text| text.chars().count() > QUERY_MAX_CHARS)
    {
        return Err(invalid("q", "too_long"));
    }
    Ok(TaskFilter {
        status: params.status.map(|status| match status {
            TaskStatusParam::Open => TaskStatus::Open,
            TaskStatusParam::Completed => TaskStatus::Completed,
        }),
        recurring: params.recurring,
        due_from: params.due_from,
        due_to: params.due_to,
        query,
        label: params.label,
        after,
        limit: page.limit(),
    })
}

fn cursor_position(cursor: &Cursor) -> Result<(DateTime<Utc>, Uuid), ApiError> {
    let created_at = DateTime::parse_from_rfc3339(&cursor.sort_key)
        .map_err(|_| invalid("cursor", "invalid"))?
        .with_timezone(&Utc);
    Ok((created_at, cursor.id))
}

fn encode_cursor((created_at, id): (DateTime<Utc>, Uuid)) -> String {
    let sort_key = created_at.to_rfc3339_opts(chrono::SecondsFormat::Micros, true);
    Cursor::new(sort_key, id).encode()
}

#[utoipa::path(
    get,
    path = "/api/v1/tasks",
    tag = "tasks",
    params(TaskListQuery),
    responses(
        (status = 200, description = "Página de tarefas", body = TaskPageResponse),
        (status = 422, description = "Filtro inválido", body = ProblemDetails)
    )
)]
pub async fn list_tasks(
    State(state): State<AppState>,
    user: CurrentUser,
    params: Result<Query<TaskListQuery>, QueryRejection>,
) -> Result<Json<TaskPageResponse>, ApiError> {
    let filter = list_filter(query(params)?)?;
    let page = service(&state)
        .list(user.user_id, filter)
        .await
        .map_err(api_error)?;
    Ok(Json(TaskPageResponse {
        items: page.items.into_iter().map(TaskResponse::from).collect(),
        next_cursor: page.next.map(encode_cursor),
    }))
}

#[utoipa::path(
    post,
    path = "/api/v1/tasks",
    tag = "tasks",
    request_body = CreateTaskRequest,
    responses(
        (status = 201, description = "Tarefa criada", body = TaskResponse),
        (status = 422, description = "Dados inválidos", body = ProblemDetails)
    )
)]
pub async fn create_task(
    State(state): State<AppState>,
    user: CurrentUser,
    payload: Result<Json<CreateTaskRequest>, JsonRejection>,
) -> Result<(StatusCode, Json<TaskResponse>), ApiError> {
    let request = body(payload)?;
    let input = NewTask {
        title: request.title,
        description: request.description,
        due_on: request.due_on,
        visibility: request.visibility,
        recurrence: request.recurrence,
        labels: request.labels.unwrap_or_default(),
    };
    let view = service(&state)
        .create(user.user_id, input)
        .await
        .map_err(api_error)?;
    Ok((StatusCode::CREATED, Json(TaskResponse::from(view))))
}

#[utoipa::path(
    get,
    path = "/api/v1/tasks/{id}",
    tag = "tasks",
    params(("id" = Uuid, Path, description = "Id da tarefa")),
    responses(
        (status = 200, description = "Tarefa", body = TaskResponse),
        (status = 404, description = "Tarefa inexistente ou de outra pessoa", body = ProblemDetails)
    )
)]
pub async fn get_task(
    State(state): State<AppState>,
    user: CurrentUser,
    path: Result<Path<Uuid>, PathRejection>,
) -> Result<Json<TaskResponse>, ApiError> {
    let id = task_id(path)?;
    let view = service(&state)
        .get(user.user_id, id)
        .await
        .map_err(api_error)?;
    Ok(Json(TaskResponse::from(view)))
}

#[utoipa::path(
    patch,
    path = "/api/v1/tasks/{id}",
    tag = "tasks",
    params(("id" = Uuid, Path, description = "Id da tarefa")),
    request_body = UpdateTaskRequest,
    responses(
        (status = 200, description = "Tarefa alterada", body = TaskResponse),
        (status = 404, description = "Tarefa inexistente ou de outra pessoa", body = ProblemDetails),
        (status = 422, description = "Dados inválidos", body = ProblemDetails)
    )
)]
pub async fn update_task(
    State(state): State<AppState>,
    user: CurrentUser,
    path: Result<Path<Uuid>, PathRejection>,
    payload: Result<Json<UpdateTaskRequest>, JsonRejection>,
) -> Result<Json<TaskResponse>, ApiError> {
    let id = task_id(path)?;
    let request = body(payload)?;
    let changes = TaskChanges {
        title: request.title,
        description: request.description,
        due_on: request.due_on,
        visibility: request.visibility,
        recurrence: request.recurrence,
        effective_from: request.effective_from,
        labels: request.labels,
    };
    let view = service(&state)
        .update(user.user_id, id, changes)
        .await
        .map_err(api_error)?;
    Ok(Json(TaskResponse::from(view)))
}

#[utoipa::path(
    delete,
    path = "/api/v1/tasks/{id}",
    tag = "tasks",
    params(("id" = Uuid, Path, description = "Id da tarefa")),
    responses(
        (status = 204, description = "Tarefa excluída"),
        (status = 404, description = "Tarefa inexistente ou de outra pessoa", body = ProblemDetails)
    )
)]
pub async fn delete_task(
    State(state): State<AppState>,
    user: CurrentUser,
    hook: Option<Extension<EntityDeletedHook>>,
    path: Result<Path<Uuid>, PathRejection>,
) -> Result<StatusCode, ApiError> {
    let id = task_id(path)?;
    service(&state)
        .delete(user.user_id, id)
        .await
        .map_err(api_error)?;
    // Só depois do commit: as ligações não somem se a exclusão não foi confirmada (CB-06).
    if let Some(Extension(hook)) = hook {
        hook(user.user_id, TASK_ENTITY, id).await;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/api/v1/tasks/{id}/completion",
    tag = "tasks",
    params(("id" = Uuid, Path, description = "Id da tarefa")),
    request_body = CompletionRequest,
    responses(
        (status = 200, description = "Tarefa ou ocorrência concluída", body = CompletionResponse),
        (status = 404, description = "Tarefa ou ocorrência inexistente", body = ProblemDetails),
        (status = 422, description = "Data ausente, passada ou inválida", body = ProblemDetails)
    )
)]
pub async fn complete_task(
    State(state): State<AppState>,
    user: CurrentUser,
    path: Result<Path<Uuid>, PathRejection>,
    payload: Result<Json<CompletionRequest>, JsonRejection>,
) -> Result<Json<CompletionResponse>, ApiError> {
    let id = task_id(path)?;
    let request = body(payload)?;
    let view = service(&state)
        .complete(user.user_id, id, request.occurrence_date)
        .await
        .map_err(api_error)?;
    Ok(Json(CompletionResponse::from(view)))
}

#[utoipa::path(
    delete,
    path = "/api/v1/tasks/{id}/completion",
    tag = "tasks",
    params(("id" = Uuid, Path, description = "Id da tarefa"), CompletionQuery),
    responses(
        (status = 200, description = "Tarefa ou ocorrência reaberta", body = CompletionResponse),
        (status = 404, description = "Tarefa ou ocorrência inexistente", body = ProblemDetails),
        (status = 422, description = "Data ausente, passada ou inválida", body = ProblemDetails)
    )
)]
pub async fn reopen_task(
    State(state): State<AppState>,
    user: CurrentUser,
    path: Result<Path<Uuid>, PathRejection>,
    params: Result<Query<CompletionQuery>, QueryRejection>,
) -> Result<Json<CompletionResponse>, ApiError> {
    let id = task_id(path)?;
    let params = query(params)?;
    let view = service(&state)
        .reopen(user.user_id, id, params.occurrence_date)
        .await
        .map_err(api_error)?;
    Ok(Json(CompletionResponse::from(view)))
}

#[utoipa::path(
    get,
    path = "/api/v1/tasks/occurrences",
    tag = "tasks",
    params(OccurrencesQuery),
    responses(
        (status = 200, description = "Ocorrências do intervalo", body = OccurrenceListResponse),
        (status = 422, description = "Intervalo inválido", body = ProblemDetails)
    )
)]
pub async fn list_occurrences(
    State(state): State<AppState>,
    user: CurrentUser,
    params: Result<Query<OccurrencesQuery>, QueryRejection>,
) -> Result<Json<OccurrenceListResponse>, ApiError> {
    let params = query(params)?;
    let items = service(&state)
        .occurrences(user.user_id, params.from, params.to)
        .await
        .map_err(api_error)?;
    Ok(Json(OccurrenceListResponse {
        items: items.into_iter().map(Into::into).collect(),
    }))
}
