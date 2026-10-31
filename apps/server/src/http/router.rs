//! Montagem do servidor: `/api/v1`, `/healthz`, frontend e as camadas comuns.

use axum::Router;
use axum::extract::{DefaultBodyLimit, MatchedPath, Request};
use axum::http::{Response, StatusCode};
use axum::middleware::{from_fn, from_fn_with_state};
use axum::response::IntoResponse;
use axum::routing::get;
use tower::ServiceBuilder;
use tower_http::request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer};
use tower_http::trace::TraceLayer;
use tracing::Span;

use crate::http::AppState;
use crate::http::csrf::csrf;
use crate::http::healthz::healthz;
use crate::http::run_to_completion::run_to_completion;
use crate::http::security_headers::security_headers;
use crate::http::session::session_layer;
use crate::http::static_files::static_files;
use crate::shared::error::ApiError;

/// Limite padrão do corpo. É um `DefaultBodyLimit`, e não o `RequestBodyLimitLayer`,
/// porque só assim as rotas de envio dos contextos conseguem ampliar o limite com o
/// próprio `DefaultBodyLimit`.
const BODY_LIMIT: usize = 1024 * 1024;

pub fn build_router(state: AppState, api: Router<AppState>) -> Router {
    build_router_with(state, api, Router::new())
}

/// Como `build_router`, com rotas extras na raiz sob as mesmas camadas (testes).
pub(crate) fn build_router_with(
    state: AppState,
    api: Router<AppState>,
    extra: Router<AppState>,
) -> Router {
    let trace = TraceLayer::new_for_http()
        .make_span_with(|request: &Request| {
            // Só método e rota casada: a URI pode ter dados pessoais na query
            // ([project/security-13]).
            let route = request
                .extensions()
                .get::<MatchedPath>()
                .map_or("unmatched", MatchedPath::as_str);
            tracing::info_span!(
                "request",
                method = %request.method(),
                route,
                status = tracing::field::Empty
            )
        })
        .on_response(
            |response: &Response<_>, latency: std::time::Duration, span: &Span| {
                span.record("status", response.status().as_u16());
                tracing::info!(latency_ms = latency.as_millis(), "resposta");
            },
        );
    let layers = ServiceBuilder::new()
        .layer(trace)
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
        .layer(PropagateRequestIdLayer::x_request_id())
        // Daqui para dentro (sessão, CSRF e handler), o cliente desconectar não interrompe
        // a requisição no meio de uma transação.
        .layer(from_fn(run_to_completion))
        .layer(from_fn_with_state(state.config.clone(), security_headers))
        .layer(DefaultBodyLimit::max(BODY_LIMIT))
        .layer(session_layer(state.pool.clone(), &state.config))
        .layer(from_fn_with_state(state.config.clone(), csrf));
    Router::new()
        .nest("/api/v1", api.route("/healthz", get(healthz)))
        .route("/healthz", get(healthz))
        .merge(extra)
        .method_not_allowed_fallback(method_not_allowed)
        .fallback(static_files)
        .layer(layers)
        .with_state(state)
}

/// Rota existente com método errado: o mesmo `problem+json` das demais respostas.
async fn method_not_allowed() -> axum::response::Response {
    ApiError::new(
        StatusCode::METHOD_NOT_ALLOWED,
        "method_not_allowed",
        "Method Not Allowed",
    )
    .into_response()
}
