//! Testes de integração do contexto, contra um PostgreSQL real em container
//! ([project/testing-02]), com relógio fixo ([project/testing-07]).

mod authorization;
mod deletion_hook;
mod goals;

use axum::Router;
use axum::body::Body;
use axum::http::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::http::AppState;
use crate::http::test_support::{TestContext, TestSession, send};

pub const ALICE: Uuid = Uuid::from_u128(0xa11c_e000_0000_7000_8000_0000_0000_0001);
pub const BOB: Uuid = Uuid::from_u128(0xb0b0_0000_0000_7000_8000_0000_0000_0002);

/// App de teste com as rotas de metas e as sessões de dois usuários.
pub struct TestApp {
    pub ctx: TestContext,
    pub app: Router,
    pub alice: TestSession,
    pub bob: TestSession,
}

impl TestApp {
    pub async fn new() -> Self {
        Self::with_api(crate::goals::router()).await
    }

    pub async fn with_api(api: Router<AppState>) -> Self {
        Self::with_api_using(|_| api).await
    }

    /// Como `with_api`, com as rotas montadas a partir do estado (o pool do teste).
    pub async fn with_api_using(build: impl FnOnce(&AppState) -> Router<AppState>) -> Self {
        let ctx = TestContext::new().await;
        crate::goals::migrator()
            .run(&ctx.state.pool)
            .await
            .expect("migrações de metas");
        let app = ctx.app(build(&ctx.state));
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

    /// Cria a meta e devolve o corpo da resposta.
    pub async fn create_goal(&self, session: &TestSession, body: Value) -> Value {
        let (status, json) = self
            .call(session, Method::POST, "/api/v1/goals", Some(body))
            .await;
        assert_eq!(status, StatusCode::CREATED, "{json}");
        json
    }

    pub async fn create_milestone(
        &self,
        session: &TestSession,
        goal_id: &str,
        title: &str,
    ) -> Value {
        let uri = format!("/api/v1/goals/{goal_id}/milestones");
        let (status, json) = self
            .call(session, Method::POST, &uri, Some(json!({ "title": title })))
            .await;
        assert_eq!(status, StatusCode::CREATED, "{json}");
        json
    }

    pub async fn get_goal(&self, session: &TestSession, goal_id: &str) -> Value {
        let uri = format!("/api/v1/goals/{goal_id}");
        let (status, json) = self.call(session, Method::GET, &uri, None).await;
        assert_eq!(status, StatusCode::OK, "{json}");
        json
    }
}
