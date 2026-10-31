//! `GET /search`: busca global do dono da sessão (RF-16, RF-59, CT-12). As rotas ficam
//! relativas a `/api/v1`.

use axum::extract::rejection::QueryRejection;
use axum::extract::{Query, State};
use axum::routing::get;
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, OpenApi, ToSchema};
use uuid::Uuid;

use crate::http::AppState;
use crate::http::session::CurrentUser;
use crate::search::application::SearchService;
use crate::search::domain::{SearchError, SearchGroup, SearchHit, SearchQuery};
use crate::search::infrastructure;
use crate::shared::error::{ApiError, FieldError, ProblemDetails};

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct SearchParams {
    /// Texto procurado, até 200 caracteres.
    pub q: Option<String>,
    /// Contextos separados por vírgula (`finance`, `goals`, `tasks`, `reminders`,
    /// `notes`, `journal`, `library`, `projects`); ausente ou vazio busca em todos.
    pub contexts: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SearchHitResponse {
    pub entity_type: &'static str,
    pub id: Uuid,
    /// Só no cartão de projeto, para o link `/projects/<project_id>/cards/<id>`.
    pub project_id: Option<Uuid>,
    pub title: String,
    pub snippet: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SearchGroupResponse {
    pub context: &'static str,
    pub items: Vec<SearchHitResponse>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SearchResponse {
    pub groups: Vec<SearchGroupResponse>,
}

impl From<SearchHit> for SearchHitResponse {
    fn from(hit: SearchHit) -> Self {
        Self {
            entity_type: hit.entity_type,
            id: hit.id,
            project_id: hit.project_id,
            title: hit.title,
            snippet: hit.snippet,
        }
    }
}

impl From<SearchGroup> for SearchGroupResponse {
    fn from(group: SearchGroup) -> Self {
        Self {
            context: group.context.as_str(),
            items: group.items.into_iter().map(Into::into).collect(),
        }
    }
}

fn api_error(error: SearchError) -> ApiError {
    let code = error.code();
    match error {
        SearchError::InvalidContext => {
            ApiError::unprocessable(code, vec![FieldError::new("contexts", "invalid")])
        }
        SearchError::EmptyQuery => {
            ApiError::unprocessable(code, vec![FieldError::new("q", "required")])
        }
        SearchError::QueryTooLong => {
            ApiError::unprocessable(code, vec![FieldError::new("q", "too_long")])
        }
        SearchError::Source { .. } => ApiError::internal(),
    }
}

#[utoipa::path(
    get, path = "/search", tag = "search", params(SearchParams),
    responses(
        (status = 200, body = SearchResponse),
        (status = 401, body = ProblemDetails),
        (status = 422, body = ProblemDetails, description = "invalid_search_context, search_query_empty ou search_query_too_long"),
        (status = 500, body = ProblemDetails),
    )
)]
pub async fn search(
    State(state): State<AppState>,
    current: CurrentUser,
    params: Result<Query<SearchParams>, QueryRejection>,
) -> Result<Json<SearchResponse>, ApiError> {
    let Query(params) = params.map_err(|_| {
        ApiError::unprocessable(
            "validation_failed",
            vec![FieldError::new("query", "invalid")],
        )
    })?;
    let query = SearchQuery::new(
        current.user_id,
        params.q.as_deref().unwrap_or_default(),
        params.contexts.as_deref(),
    )
    .map_err(api_error)?;
    let groups = SearchService::new(infrastructure::sources(&state))
        .search(&query)
        .await
        .map_err(api_error)?;
    Ok(Json(SearchResponse {
        groups: groups.into_iter().map(Into::into).collect(),
    }))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/search", get(search))
}

#[derive(OpenApi)]
#[openapi(
    paths(search),
    components(schemas(
        FieldError,
        ProblemDetails,
        SearchGroupResponse,
        SearchHitResponse,
        SearchResponse,
    ))
)]
pub struct SearchApi;
