//! Rotas HTTP de tarefas sob `/api/v1`.

pub mod dto;
pub mod handlers;
pub mod openapi;

use axum::Router;
use axum::routing::{get, post};

use crate::http::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/tasks",
            get(handlers::list_tasks).post(handlers::create_task),
        )
        .route("/tasks/occurrences", get(handlers::list_occurrences))
        .route(
            "/tasks/{id}",
            get(handlers::get_task)
                .patch(handlers::update_task)
                .delete(handlers::delete_task),
        )
        .route(
            "/tasks/{id}/completion",
            post(handlers::complete_task).delete(handlers::reopen_task),
        )
}
