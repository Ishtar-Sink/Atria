//! Camada de interface HTTP do contexto de notas.

pub mod dto;
pub mod handlers;
pub mod openapi;

use axum::Router;
use axum::routing::get;

use crate::http::AppState;

/// Rotas relativas: a TASK-18 as monta sob `/api/v1`.
pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/notes",
            get(handlers::list_notes).post(handlers::create_note),
        )
        .route(
            "/notes/{id}",
            get(handlers::get_note)
                .patch(handlers::update_note)
                .delete(handlers::delete_note),
        )
}
