//! Testes de integração do Financeiro, contra um PostgreSQL real em container
//! ([project/testing-02]), com o relógio e os ids fixos do auxiliar de `http`.

mod accounts;
mod authorization;
mod credit_cards;
mod deletion_hook;
mod listings;
mod recurring_transactions;
mod summaries;
mod transactions;
mod transfers;

use axum::Router;
use axum::body::Body;
use axum::http::{Method, StatusCode};
use serde_json::{Value, json};
use uuid::Uuid;

use crate::finance;
use crate::http::AppState;
use crate::http::test_support::{TestContext, TestSession, send};

pub const ALICE: Uuid = Uuid::from_u128(0xa11ce);
pub const BOB: Uuid = Uuid::from_u128(0xb0b);

pub struct FinanceTest {
    pub ctx: TestContext,
    pub app: Router,
    pub alice: TestSession,
    pub bob: TestSession,
}

impl FinanceTest {
    pub async fn new() -> Self {
        Self::with_api(finance::router()).await
    }

    /// App com as rotas dadas, para os testes que acrescentam camadas (gancho).
    pub async fn with_api(api: Router<AppState>) -> Self {
        let ctx = TestContext::new().await;
        finance::migrator()
            .run(&ctx.state.pool)
            .await
            .expect("migrações do Financeiro");
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

    pub fn pool(&self) -> &sqlx::PgPool {
        &self.ctx.state.pool
    }

    pub async fn call(
        &self,
        session: &TestSession,
        method: Method,
        uri: &str,
        body: Option<&Value>,
    ) -> (StatusCode, Value) {
        let request = match body {
            Some(body) => session.json(method, &format!("/api/v1{uri}"), body),
            None => session
                .request(method, &format!("/api/v1{uri}"))
                .body(Body::empty())
                .expect("pedido"),
        };
        let (status, _, json) = send(&self.app, request).await;
        (status, json)
    }

    pub async fn get(&self, session: &TestSession, uri: &str) -> (StatusCode, Value) {
        self.call(session, Method::GET, uri, None).await
    }

    pub async fn post(&self, session: &TestSession, uri: &str, body: Value) -> (StatusCode, Value) {
        self.call(session, Method::POST, uri, Some(&body)).await
    }

    pub async fn patch(
        &self,
        session: &TestSession,
        uri: &str,
        body: Value,
    ) -> (StatusCode, Value) {
        self.call(session, Method::PATCH, uri, Some(&body)).await
    }

    pub async fn delete(&self, session: &TestSession, uri: &str) -> (StatusCode, Value) {
        self.call(session, Method::DELETE, uri, None).await
    }

    /// POST com `Idempotency-Key`.
    pub async fn post_with_key(
        &self,
        session: &TestSession,
        uri: &str,
        key: &str,
        body: &Value,
    ) -> (StatusCode, Value) {
        let request = session
            .request(Method::POST, &format!("/api/v1{uri}"))
            .header("content-type", "application/json")
            .header("idempotency-key", key)
            .body(Body::from(body.to_string()))
            .expect("pedido");
        let (status, _, json) = send(&self.app, request).await;
        (status, json)
    }

    pub async fn accounts(&self, session: &TestSession) -> Vec<Value> {
        let (status, body) = self.get(session, "/accounts").await;
        assert_eq!(status, StatusCode::OK, "{body}");
        body["items"].as_array().cloned().unwrap_or_default()
    }

    pub async fn default_account(&self, session: &TestSession) -> String {
        let accounts = self.accounts(session).await;
        let default = accounts
            .iter()
            .find(|account| account["is_default"] == true)
            .expect("conta padrão");
        id_of(default)
    }

    pub async fn create_account(&self, session: &TestSession, name: &str) -> String {
        let (status, body) = self
            .post(session, "/accounts", json!({ "name": name }))
            .await;
        assert_eq!(status, StatusCode::CREATED, "{body}");
        id_of(&body)
    }

    pub async fn create_card(
        &self,
        session: &TestSession,
        closing_day: u32,
        due_day: u32,
    ) -> String {
        let body = json!({
            "name": "Cartão",
            "kind": "credit_card",
            "credit_limit_amount": 500_000,
            "closing_day": closing_day,
            "due_day": due_day,
        });
        let (status, body) = self.post(session, "/accounts", body).await;
        assert_eq!(status, StatusCode::CREATED, "{body}");
        id_of(&body)
    }

    pub async fn create_category(
        &self,
        session: &TestSession,
        name: &str,
        kind: &str,
        color: &str,
    ) -> String {
        let body = json!({ "name": name, "kind": kind, "color": color });
        let (status, body) = self.post(session, "/categories", body).await;
        assert_eq!(status, StatusCode::CREATED, "{body}");
        id_of(&body)
    }

    /// Cria uma recorrente e devolve o corpo dela.
    pub async fn create_recurring(
        &self,
        session: &TestSession,
        account_id: &str,
        kind: &str,
        expected_amount: i64,
        rule: Value,
    ) -> Value {
        let body = json!({
            "kind": kind,
            "account_id": account_id,
            "expected_amount": expected_amount,
            "rule": rule,
        });
        let (status, body) = self.post(session, "/recurring-transactions", body).await;
        assert_eq!(status, StatusCode::CREATED, "{body}");
        body
    }

    /// Liquida a ocorrência aberta da recorrente; a resposta é a cópia liquidada.
    pub async fn settle_occurrence(
        &self,
        session: &TestSession,
        recurrence_id: &str,
        occurrence_date: &str,
        settled_amount: i64,
        settled_at: &str,
    ) -> (StatusCode, Value) {
        let body = json!({
            "occurrence_date": occurrence_date,
            "settled_amount": settled_amount,
            "settled_at": settled_at,
        });
        self.post(
            session,
            &format!("/recurring-transactions/{recurrence_id}/settlement"),
            body,
        )
        .await
    }

    /// Pula a ocorrência aberta da recorrente, sem cópia.
    pub async fn skip_occurrence(
        &self,
        session: &TestSession,
        recurrence_id: &str,
        occurrence_date: &str,
    ) -> (StatusCode, Value) {
        let body = json!({ "occurrence_date": occurrence_date });
        self.post(
            session,
            &format!("/recurring-transactions/{recurrence_id}/skip"),
            body,
        )
        .await
    }

    /// Desfaz a liquidação de uma movimentação (DEC-005).
    pub async fn undo_settlement(
        &self,
        session: &TestSession,
        transaction_id: &str,
    ) -> (StatusCode, Value) {
        self.delete(
            session,
            &format!("/transactions/{transaction_id}/settlement"),
        )
        .await
    }

    /// Muda o "hoje" do relógio injetável.
    pub fn set_now(&self, instant: &str) {
        self.ctx.clock.set(instant.parse().expect("instante"));
    }

    /// Itens de uma listagem, com a falha do pedido no texto da asserção.
    pub async fn items(&self, session: &TestSession, uri: &str) -> Vec<Value> {
        let (status, body) = self.get(session, uri).await;
        assert_eq!(status, StatusCode::OK, "{uri}: {body}");
        body["items"].as_array().cloned().unwrap_or_default()
    }

    /// Cria uma movimentação simples e devolve o corpo dela.
    pub async fn create_transaction(
        &self,
        session: &TestSession,
        account_id: &str,
        kind: &str,
        expected_amount: i64,
        expected_date: &str,
    ) -> Value {
        let body = json!({
            "kind": kind,
            "account_id": account_id,
            "expected_amount": expected_amount,
            "expected_date": expected_date,
        });
        let (status, body) = self.post(session, "/transactions", body).await;
        assert_eq!(status, StatusCode::CREATED, "{body}");
        body["items"][0].clone()
    }

    pub async fn settle(
        &self,
        session: &TestSession,
        transaction_id: &str,
        settled_amount: i64,
        settled_at: &str,
    ) -> (StatusCode, Value) {
        let body = json!({ "settled_amount": settled_amount, "settled_at": settled_at });
        self.post(
            session,
            &format!("/transactions/{transaction_id}/settlement"),
            body,
        )
        .await
    }

    pub async fn balance(&self, session: &TestSession, account_id: &str) -> i64 {
        let (status, body) = self.get(session, &format!("/accounts/{account_id}")).await;
        assert_eq!(status, StatusCode::OK, "{body}");
        body["balance_amount"].as_i64().expect("saldo")
    }
}

pub fn id_of(body: &Value) -> String {
    body["id"].as_str().expect("id").to_owned()
}

pub fn monthly_rule(starts_on: &str, month_day: u32) -> Value {
    json!({
        "frequency": "monthly",
        "interval": 1,
        "weekdays": [],
        "month_day": month_day,
        "time": "08:00",
        "timezone": "America/Sao_Paulo",
        "starts_on": starts_on,
        "ends_on": null
    })
}
