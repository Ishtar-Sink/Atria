//! Montagem das rotas sob `/api/v1` (o prefixo é aplicado pela TASK-18).

pub mod dto;
pub mod handlers;
pub mod openapi;

use axum::Router;
use axum::routing::get;

use crate::http::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/goals",
            get(handlers::list_goals).post(handlers::create_goal),
        )
        .route(
            "/goals/{id}",
            get(handlers::get_goal)
                .patch(handlers::update_goal)
                .delete(handlers::delete_goal),
        )
        .route(
            "/goals/{id}/milestones",
            get(handlers::list_milestones).post(handlers::create_milestone),
        )
        .route(
            "/goals/{id}/milestones/{milestone_id}",
            axum::routing::patch(handlers::update_milestone).delete(handlers::delete_milestone),
        )
}
