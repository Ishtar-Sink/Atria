//! Documento OpenAPI do contexto, gerado do código ([project/api-02]).

use utoipa::OpenApi;

use super::dto::{CreateLinkRequest, LinkPage, LinkResponse};
use super::handlers;
use crate::shared::error::{FieldError, ProblemDetails};
use crate::shared::visibility::Visibility;

#[derive(OpenApi)]
#[openapi(
    paths(handlers::create_link, handlers::list_links, handlers::delete_link),
    components(schemas(
        CreateLinkRequest,
        FieldError,
        LinkPage,
        LinkResponse,
        ProblemDetails,
        Visibility,
    )),
    tags((name = "links", description = "Ligações bidirecionais entre entidades"))
)]
pub struct LinksApi;
