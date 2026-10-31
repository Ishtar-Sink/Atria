//! Camada de interface HTTP do contexto do diário.

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
            "/journal-entries",
            get(handlers::list_entries).post(handlers::create_entry),
        )
        .route(
            "/journal-entries/{id}",
            get(handlers::get_entry)
                .patch(handlers::update_entry)
                .delete(handlers::delete_entry),
        )
        .route(
            "/emotions",
            get(handlers::list_emotions).post(handlers::create_emotion),
        )
        .route(
            "/emotions/{id}",
            axum::routing::patch(handlers::update_emotion).delete(handlers::delete_emotion),
        )
}
