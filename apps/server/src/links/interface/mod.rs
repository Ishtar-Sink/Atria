//! Camada de interface HTTP do contexto de ligações.

pub mod dto;
pub mod handlers;
pub mod openapi;

use axum::Router;
use axum::routing::{delete, get};

use crate::http::AppState;

/// Rotas relativas: a TASK-18 as monta sob `/api/v1`.
pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/links",
            get(handlers::list_links).post(handlers::create_link),
        )
        .route("/links/{id}", delete(handlers::delete_link))
}
