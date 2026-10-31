//! Cada requisição roda até o fim numa tarefa própria, mesmo quando o cliente desconecta.
//!
//! O hyper descarta o futuro do handler quando a conexão cai. Descartado logo depois do
//! `BEGIN`, o sqlx devolvia a conexão ao pool com a transação aberta, e as escritas seguintes
//! nessa conexão ficavam invisíveis até um COMMIT posterior ou se perdiam num ROLLBACK
//! (TASK-35, ajuste 9). Numa tarefa do Tokio, o handler termina e a resposta é descartada.

use axum::extract::Request;
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use tracing::Instrument;

use crate::shared::error::ApiError;

pub async fn run_to_completion(request: Request, next: Next) -> Response {
    let task = tokio::spawn(next.run(request).in_current_span());
    match task.await {
        Ok(response) => response,
        // Pânico no handler: a mesma resposta 500 de qualquer erro interno.
        Err(error) => {
            tracing::error!(error = %error, "a tarefa da requisição terminou sem resposta");
            ApiError::internal().into_response()
        }
    }
}
