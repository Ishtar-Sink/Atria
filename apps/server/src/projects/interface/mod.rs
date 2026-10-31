//! Montagem das rotas sob `/api/v1` (o prefixo é aplicado pela TASK-18).

pub mod dto;
pub mod handlers;
pub mod openapi;

use axum::Router;
use axum::routing::{get, post, put};

use crate::http::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/projects",
            get(handlers::list_projects).post(handlers::create_project),
        )
        .route(
            "/projects/{id}",
            get(handlers::get_project)
                .patch(handlers::update_project)
                .delete(handlers::delete_project),
        )
        .route("/projects/{id}/summary", get(handlers::project_summary))
        .route(
            "/projects/{id}/lanes",
            get(handlers::list_lanes).post(handlers::create_lane),
        )
        .route("/projects/{id}/lanes/order", put(handlers::reorder_lanes))
        .route(
            "/projects/{id}/lanes/{lane_id}",
            axum::routing::patch(handlers::update_lane).delete(handlers::delete_lane),
        )
        .route(
            "/projects/{id}/cards",
            get(handlers::list_cards).post(handlers::create_card),
        )
        .route(
            "/projects/{id}/cards/{card_id}",
            get(handlers::get_card)
                .patch(handlers::update_card)
                .delete(handlers::delete_card),
        )
        .route("/cards/{card_id}", get(handlers::get_card_by_id))
        .route(
            "/projects/{id}/cards/{card_id}/move",
            post(handlers::move_card),
        )
}
