//! Handlers HTTP de ligações: validação na borda e conversão de `LinkError` em
//! `problem+json` ([project/code-style-03]).

use axum::Json;
use axum::extract::{FromRequest, FromRequestParts, Path, Query, Request, State};
use axum::http::StatusCode;
use axum::http::request::Parts;
use serde::de::DeserializeOwned;
use uuid::Uuid;

use super::dto::{CreateLinkRequest, LinkListQuery, LinkPage, LinkResponse};
use crate::http::AppState;
use crate::http::session::CurrentUser;
use crate::links::application::service::{CreateLink, LinkService, ListLinks};
use crate::links::domain::error::LinkError;
use crate::links::domain::link::{EntityRef, EntityType};
use crate::links::infrastructure::pg_link_repository::PgLinkRepository;
use crate::shared::error::{ApiError, FieldError, ProblemDetails};
use crate::shared::pagination::{Cursor, DEFAULT_LIMIT, MAX_LIMIT};

fn validation(field: &str, code: &str) -> ApiError {
    ApiError::unprocessable("validation_failed", vec![FieldError::new(field, code)])
}

impl From<LinkError> for ApiError {
    fn from(error: LinkError) -> Self {
        match error {
            // Ligação de outro usuário também é 404: não revela que ela existe (RNF-02).
            LinkError::NotFound => Self::not_found("link_not_found"),
            LinkError::AlreadyExists => Self::conflict("link_already_exists"),
            LinkError::SelfLink => Self::unprocessable("self_link", Vec::new()),
            LinkError::UnknownEntityType => Self::unprocessable("unknown_entity_type", Vec::new()),
            LinkError::InvalidCursor => validation("cursor", "invalid"),
            LinkError::Infrastructure(cause) => Self::internal_from(cause.as_ref()),
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

/// Id da ligação no caminho; um id malformado é tratado como ligação inexistente.
pub struct LinkId(pub Uuid);

impl<S: Send + Sync> FromRequestParts<S> for LinkId {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        Path::<Uuid>::from_request_parts(parts, state)
            .await
            .map(|Path(id)| Self(id))
            .map_err(|_| ApiError::not_found("link_not_found"))
    }
}

fn service(state: &AppState) -> LinkService<PgLinkRepository> {
    LinkService::new(
        PgLinkRepository::from_state(state),
        state.clock.clone(),
        state.ids.clone(),
    )
}

fn list_query(query: LinkListQuery) -> Result<ListLinks, ApiError> {
    let (Some(entity_type), Some(entity_id)) = (query.entity_type, query.entity_id) else {
        return Err(validation("entity_id", "required"));
    };
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
    let linked_type = query
        .linked_type
        .as_deref()
        .map(str::parse::<EntityType>)
        .transpose()?;
    Ok(ListLinks {
        entity: EntityRef::new(entity_type.parse()?, entity_id),
        linked_type,
        after,
        limit,
    })
}

#[utoipa::path(
    post, path = "/api/v1/links", tag = "links", request_body = CreateLinkRequest,
    responses(
        (status = 201, body = LinkResponse),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
        (status = 409, body = ProblemDetails, description = "link_already_exists"),
        (status = 422, body = ProblemDetails,
            description = "self_link, unknown_entity_type ou validation_failed"),
    )
)]
pub async fn create_link(
    State(state): State<AppState>,
    user: CurrentUser,
    ValidJson(body): ValidJson<CreateLinkRequest>,
) -> Result<(StatusCode, Json<LinkResponse>), ApiError> {
    let input = CreateLink {
        a: EntityRef::new(body.source_type.parse()?, body.source_id),
        b: EntityRef::new(body.target_type.parse()?, body.target_id),
        visibility: body.visibility.unwrap_or_default(),
    };
    let link = service(&state).create(user.user_id, input).await?;
    Ok((
        StatusCode::CREATED,
        Json(LinkResponse::from_link(link, None)),
    ))
}

#[utoipa::path(
    get, path = "/api/v1/links", tag = "links", params(LinkListQuery),
    responses(
        (status = 200, body = LinkPage),
        (status = 401, body = ProblemDetails, description = "unauthenticated"),
        (status = 422, body = ProblemDetails,
            description = "unknown_entity_type ou validation_failed"),
    )
)]
pub async fn list_links(
    State(state): State<AppState>,
    user: CurrentUser,
    ValidQuery(query): ValidQuery<LinkListQuery>,
) -> Result<Json<LinkPage>, ApiError> {
    let query = list_query(query)?;
    let entity = query.entity;
    let page = service(&state).list_for_entity(user.user_id, query).await?;
    Ok(Json(LinkPage {
        items: page
            .items
            .into_iter()
            .map(|link| LinkResponse::from_link(link, Some(&entity)))
            .collect(),
        next_cursor: page.next_cursor.map(|cursor| cursor.encode()),
    }))
}

#[utoipa::path(
    delete, path = "/api/v1/links/{id}", tag = "links",
    params(("id" = Uuid, Path, description = "Id da ligação")),
    responses(
        (status = 204, description = "Ligação removida dos dois lados"),
        (status = 404, body = ProblemDetails, description = "link_not_found"),
    )
)]
pub async fn delete_link(
    State(state): State<AppState>,
    user: CurrentUser,
    LinkId(id): LinkId,
) -> Result<StatusCode, ApiError> {
    service(&state).delete(user.user_id, id).await?;
    Ok(StatusCode::NO_CONTENT)
}
