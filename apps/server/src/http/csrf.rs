//! Proteção contra CSRF em toda mutação ([project/security-03]): token na sessão,
//! repetido pelo frontend no cabeçalho `X-CSRF-Token` (padrão de cookie duplo), e
//! `Origin`, quando presente, igual à origem pública.

use std::sync::Arc;

use axum::extract::{Request, State};
use axum::http::{HeaderMap, HeaderValue, Method, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use cookie::{Cookie, SameSite};
use subtle::ConstantTimeEq;
use tower_sessions::Session;

use crate::http::Config;
use crate::shared::error::ApiError;

pub const CSRF_COOKIE: &str = "atria_csrf";
pub const CSRF_HEADER: &str = "x-csrf-token";
const TOKEN_KEY: &str = "csrf_token";

fn new_token() -> String {
    let mut bytes = [0u8; 32];
    rand::fill(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn session_error(error: tower_sessions::session::Error) -> ApiError {
    ApiError::internal_from(&error)
}

/// Grava um token novo na sessão; o middleware o devolve no cookie.
pub async fn rotate_token(session: &Session) -> Result<(), ApiError> {
    session
        .insert(TOKEN_KEY, new_token())
        .await
        .map_err(session_error)
}

async fn session_token(session: &Session) -> Result<Option<String>, ApiError> {
    session
        .get::<String>(TOKEN_KEY)
        .await
        .map_err(session_error)
}

fn is_mutation(method: &Method) -> bool {
    matches!(
        *method,
        Method::POST | Method::PUT | Method::PATCH | Method::DELETE
    )
}

/// Sondas de saúde não abrem sessão: um token criaria um registro de sessão a cada
/// sonda e tornaria o `/healthz` dependente da escrita no banco.
fn is_health_probe(path: &str) -> bool {
    path == "/healthz" || path == "/api/v1/healthz"
}

fn cookie_token(headers: &HeaderMap) -> Option<String> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(Cookie::split_parse)
        .filter_map(Result::ok)
        .find(|cookie| cookie.name() == CSRF_COOKIE)
        .map(|cookie| cookie.value().to_owned())
}

fn origin_allowed(headers: &HeaderMap, config: &Config) -> bool {
    match headers.get(header::ORIGIN) {
        None => true,
        Some(origin) => origin.as_bytes() == config.public_origin().as_bytes(),
    }
}

fn header_matches(headers: &HeaderMap, expected: Option<&str>) -> bool {
    let (Some(sent), Some(expected)) = (headers.get(CSRF_HEADER), expected) else {
        return false;
    };
    sent.as_bytes().ct_eq(expected.as_bytes()).into()
}

fn csrf_cookie(token: String, config: &Config) -> Option<HeaderValue> {
    // Sem `HttpOnly`: o frontend lê o cookie para repetir o token no cabeçalho.
    let cookie = Cookie::build((CSRF_COOKIE, token))
        .path("/")
        .secure(config.is_https())
        .same_site(SameSite::Strict)
        .build();
    HeaderValue::from_str(&cookie.to_string()).ok()
}

pub async fn csrf(
    State(config): State<Arc<Config>>,
    session: Session,
    request: Request,
    next: Next,
) -> Response {
    match guard(&config, &session, request, next).await {
        Ok(response) => response,
        Err(error) => error.into_response(),
    }
}

async fn guard(
    config: &Config,
    session: &Session,
    request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let sent_cookie = cookie_token(request.headers());
    let mut token = session_token(session).await?;
    if is_mutation(request.method()) {
        let valid = origin_allowed(request.headers(), config)
            && header_matches(request.headers(), token.as_deref());
        if !valid {
            return Err(ApiError::forbidden("csrf_invalid"));
        }
    } else if token.is_none() && !is_health_probe(request.uri().path()) {
        rotate_token(session).await?;
        token = session_token(session).await?;
    }
    let mut response = next.run(request).await;
    // O handler pode ter trocado o token (início de sessão): o cookie acompanha.
    let current = session_token(session).await?.or(token);
    if let Some(current) = current.filter(|current| Some(current) != sent_cookie.as_ref())
        && let Some(value) = csrf_cookie(current, config)
    {
        response.headers_mut().append(header::SET_COOKIE, value);
    }
    Ok(response)
}
