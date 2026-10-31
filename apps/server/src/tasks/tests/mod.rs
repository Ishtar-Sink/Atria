//! Testes de integração do contexto, contra um PostgreSQL real em container
//! ([project/testing-02]), com relógio fixo ([project/testing-07]).

mod authorization;
mod deletion_hook;
mod tasks;

use axum::Router;
use axum::body::Body;
use axum::http::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::http::AppState;
use crate::http::test_support::{TestContext, TestSession, send};

pub const ALICE: Uuid = Uuid::from_u128(0xa11c_e000_0000_7000_8000_0000_0000_0001);
pub const BOB: Uuid = Uuid::from_u128(0xb0b0_0000_0000_7000_8000_0000_0000_0002);

/// App de teste com as rotas de tarefas e as sessões de dois usuários. O relógio
/// começa em 2026-11-01T12:00:00Z (09:00 em `America/Sao_Paulo`).
pub struct TestApp {
    pub ctx: TestContext,
    pub app: Router,
    pub alice: TestSession,
    pub bob: TestSession,
}

impl TestApp {
    pub async fn new() -> Self {
        Self::with_api(crate::tasks::router()).await
    }

    pub async fn with_api(api: Router<AppState>) -> Self {
        let ctx = TestContext::new().await;
        crate::tasks::migrator()
            .run(&ctx.state.pool)
            .await
            .expect("migrações de tarefas");
        let app = ctx.app(api);
        let alice = ctx.sign_in_as(ALICE).await;
        let bob = ctx.sign_in_as(BOB).await;
        Self {
            ctx,
            app,
            alice,
            bob,
        }
    }

    pub async fn call(
        &self,
        session: &TestSession,
        method: Method,
        uri: &str,
        body: Option<Value>,
    ) -> (StatusCode, Value) {
        let request = match body {
            Some(body) => session.json(method, uri, &body),
            None => session
                .request(method, uri)
                .body(Body::empty())
                .expect("pedido"),
        };
        let (status, _, json) = send(&self.app, request).await;
        (status, json)
    }

    /// Cria a tarefa e devolve o corpo da resposta.
    pub async fn create(&self, session: &TestSession, body: Value) -> Value {
        let (status, json) = self
            .call(session, Method::POST, "/api/v1/tasks", Some(body))
            .await;
        assert_eq!(status, StatusCode::CREATED, "{json}");
        json
    }

    pub async fn occurrences(&self, session: &TestSession, from: &str, to: &str) -> Vec<Value> {
        let uri = format!("/api/v1/tasks/occurrences?from={from}&to={to}");
        let (status, json) = self.call(session, Method::GET, &uri, None).await;
        assert_eq!(status, StatusCode::OK, "{json}");
        json["items"].as_array().cloned().unwrap_or_default()
    }
}

/// Regra diária às 08:00 em `America/Sao_Paulo`.
pub fn daily_rule(starts_on: &str) -> Value {
    json!({
        "frequency": "daily",
        "interval": 1,
        "weekdays": [],
        "month_day": null,
        "time": "08:00",
        "timezone": "America/Sao_Paulo",
        "starts_on": starts_on,
        "ends_on": null
    })
}

pub fn id_of(task: &Value) -> String {
    task["id"].as_str().expect("id da tarefa").to_owned()
}
