//! Testes de integração do contexto, contra um PostgreSQL real em container
//! ([project/testing-02]), com relógio e ids fixos ([project/testing-07]).

mod api;

use axum::Router;
use axum::body::Body;
use axum::http::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::http::AppState;
use crate::http::test_support::{TestContext, TestSession, send};

pub const ALICE: Uuid = Uuid::from_u128(0xa11c_e000_0000_7000_8000_0000_0000_0001);
pub const BOB: Uuid = Uuid::from_u128(0xb0b0_0000_0000_7000_8000_0000_0000_0002);

/// App de teste com as rotas de projetos e as sessões de dois usuários.
pub struct TestApp {
    pub ctx: TestContext,
    pub app: Router,
    pub alice: TestSession,
    pub bob: TestSession,
}

impl TestApp {
    pub async fn new() -> Self {
        Self::with_api_using(|_| crate::projects::router()).await
    }

    /// Como `new`, com as rotas montadas a partir do estado (o pool do teste).
    pub async fn with_api_using(build: impl FnOnce(&AppState) -> Router<AppState>) -> Self {
        let ctx = TestContext::new().await;
        crate::projects::migrator()
            .run(&ctx.state.pool)
            .await
            .expect("migrações de projetos");
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

    /// Chamada da Alice que espera o status dado e devolve o corpo.
    pub async fn alice_expects(
        &self,
        status: StatusCode,
        method: Method,
        uri: &str,
        body: Option<Value>,
    ) -> Value {
        let (actual, json) = self.call(&self.alice, method, uri, body).await;
        assert_eq!(actual, status, "{uri}: {json}");
        json
    }

    pub async fn create_project(&self, session: &TestSession, name: &str) -> Value {
        let (status, json) = self
            .call(
                session,
                Method::POST,
                "/api/v1/projects",
                Some(json!({ "name": name })),
            )
            .await;
        assert_eq!(status, StatusCode::CREATED, "{json}");
        json
    }

    pub async fn create_card(&self, project_id: &str, body: Value) -> Value {
        let uri = format!("/api/v1/projects/{project_id}/cards");
        self.alice_expects(StatusCode::CREATED, Method::POST, &uri, Some(body))
            .await
    }

    pub async fn get_project(&self, project_id: &str) -> Value {
        let uri = format!("/api/v1/projects/{project_id}");
        self.alice_expects(StatusCode::OK, Method::GET, &uri, None)
            .await
    }
}

/// Id da raia padrão (`waiting`, `in_progress` ou `done`) do projeto devolvido pela API.
pub fn lane_id(project: &Value, system_key: &str) -> String {
    project["lanes"]
        .as_array()
        .and_then(|lanes| lanes.iter().find(|l| l["system_key"] == system_key))
        .and_then(|lane| lane["id"].as_str())
        .map(str::to_owned)
        .unwrap_or_else(|| panic!("raia {system_key} ausente: {project}"))
}
