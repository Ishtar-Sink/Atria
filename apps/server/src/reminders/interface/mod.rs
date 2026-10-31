//! Interface HTTP do contexto de lembretes, sob `/api/v1`.

pub mod dto;
pub mod handlers;
pub mod openapi;

use axum::Router;
use axum::routing::{delete, get};

use crate::http::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/reminders",
            get(handlers::list_reminders).post(handlers::create_reminder),
        )
        .route("/reminders/upcoming", get(handlers::upcoming_fires))
        .route(
            "/reminders/{id}",
            get(handlers::get_reminder)
                .patch(handlers::patch_reminder)
                .delete(handlers::delete_reminder),
        )
        .route("/web-push/public-key", get(handlers::web_push_public_key))
        .route(
            "/push-subscriptions",
            axum::routing::post(handlers::create_subscription),
        )
        .route(
            "/push-subscriptions/{id}",
            delete(handlers::delete_subscription),
        )
}
