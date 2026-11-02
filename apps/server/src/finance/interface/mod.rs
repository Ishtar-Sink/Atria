//! Rotas HTTP do Financeiro, montadas sob `/api/v1` ([project/api-01]).

pub mod dto;
pub mod handlers;
pub mod openapi;

use axum::Router;
use axum::routing::{get, post};

use crate::finance::interface::handlers as h;
use crate::http::AppState;

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/accounts", get(h::list_accounts).post(h::create_account))
        .route(
            "/accounts/{id}",
            get(h::get_account)
                .patch(h::update_account)
                .delete(h::delete_account),
        )
        .route(
            "/categories",
            get(h::list_categories).post(h::create_category),
        )
        .route(
            "/categories/{id}",
            get(h::get_category)
                .patch(h::update_category)
                .delete(h::delete_category),
        )
        .route(
            "/transactions",
            get(h::list_transactions).post(h::create_transactions),
        )
        // O segmento fixo tem precedência sobre `{id}`.
        .route(
            "/transactions/settlement-preview",
            post(h::preview_settlement),
        )
        .route(
            "/transactions/{id}",
            get(h::get_transaction)
                .patch(h::update_transaction)
                .delete(h::delete_transaction),
        )
        .route(
            "/transactions/{id}/settlement",
            post(h::settle_transaction).delete(h::undo_settlement),
        )
        .route(
            "/transfers",
            get(h::list_transfers).post(h::create_transfer),
        )
        .route(
            "/transfers/{id}",
            get(h::get_transfer).delete(h::delete_transfer),
        )
        .route(
            "/recurring-transactions",
            get(h::list_recurring_transactions).post(h::create_recurring_transaction),
        )
        .route(
            "/recurring-transactions/{id}",
            get(h::get_recurring_transaction)
                .patch(h::update_recurring_transaction)
                .delete(h::delete_recurring_transaction),
        )
        .route(
            "/recurring-transactions/{id}/settlement",
            post(h::settle_occurrence),
        )
        .route(
            "/recurring-transactions/{id}/skip",
            post(h::skip_occurrence),
        )
        .route(
            "/recurring-transactions/{id}/settled-transactions",
            get(h::list_settled_transactions),
        )
        .route("/financial-summaries", get(h::get_financial_summary))
}
