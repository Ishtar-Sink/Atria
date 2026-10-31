//! Frontend compilado embutido no binário: um único processo além do banco
//! ([project/self-hosting-02]).

use axum::body::Body;
use axum::http::{HeaderValue, StatusCode, Uri, header};
use axum::response::{IntoResponse, Response};

use crate::shared::error::ApiError;

#[derive(rust_embed::Embed)]
#[folder = "../web/dist"]
#[allow_missing = true]
struct WebAssets;

const IMMUTABLE: &str = "public, max-age=31536000, immutable";
const NO_CACHE: &str = "no-cache";

pub async fn static_files(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');
    if path == "api" || path.starts_with("api/") {
        return ApiError::not_found("route_not_found").into_response();
    }
    if let Some(response) = asset(path) {
        return response;
    }
    // Rotas do frontend (sem extensão) recebem o `index.html` do roteador do cliente.
    let is_route = !path.rsplit('/').next().unwrap_or_default().contains('.');
    if is_route && let Some(response) = asset("index.html") {
        return response;
    }
    StatusCode::NOT_FOUND.into_response()
}

fn asset(path: &str) -> Option<Response> {
    let path = if path.is_empty() { "index.html" } else { path };
    let file = WebAssets::get(path)?;
    let cache = if path.starts_with("assets/") {
        IMMUTABLE
    } else {
        NO_CACHE
    };
    let mime = file.metadata.mimetype().to_owned();
    let mut response = Response::new(Body::from(file.data.into_owned()));
    let headers = response.headers_mut();
    if let Ok(value) = HeaderValue::from_str(&mime) {
        headers.insert(header::CONTENT_TYPE, value);
    }
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(cache));
    Some(response)
}
