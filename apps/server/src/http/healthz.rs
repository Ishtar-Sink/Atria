//! `/healthz` com a saúde do banco e a versão ([project/self-hosting-05]).

use std::time::Duration;

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use serde_json::{Value, json};
use sqlx::PgPool;

const DATABASE_TIMEOUT: Duration = Duration::from_secs(2);

pub async fn healthz(State(pool): State<PgPool>) -> (StatusCode, Json<Value>) {
    let query = sqlx::query!("SELECT 1 AS one").fetch_one(&pool);
    let healthy = matches!(
        tokio::time::timeout(DATABASE_TIMEOUT, query).await,
        Ok(Ok(_))
    );
    let (status, database) = if healthy {
        (StatusCode::OK, "ok")
    } else {
        (StatusCode::SERVICE_UNAVAILABLE, "unavailable")
    };
    let body = json!({
        "status": if healthy { "ok" } else { "unavailable" },
        "version": env!("CARGO_PKG_VERSION"),
        "database": database,
    });
    (status, Json(body))
}
