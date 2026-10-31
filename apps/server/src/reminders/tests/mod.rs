//! Auxiliar dos testes de integração: PostgreSQL em container com as migrações do
//! contexto, app de teste com relógio fixo, `PushSender` em memória e
//! `WebPushPolicy` configurável na camada `Extension`.

mod authorization;
mod deletion_hook;
mod dispatcher;
mod reminders;

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use axum::body::Body;
use axum::http::{Method, StatusCode};
use axum::{Extension, Router};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use openssl::ec::{EcGroup, EcKey};
use openssl::nid::Nid;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::http::test_support::{TestContext, TestSession, send};
use crate::reminders::application::dispatcher::Dispatcher;
use crate::reminders::application::ports::{
    BoxFuture, EntityDeletedHook, PushSendError, PushSender, WebPushPolicy,
};
use crate::reminders::domain::push_subscription::PushSubscription;
use crate::reminders::infrastructure::pg_schedule::PgScheduleQueue;
use crate::reminders::{migrator, router};

pub const ALICE: Uuid = Uuid::from_u128(0xa11ce);
pub const BOB: Uuid = Uuid::from_u128(0xb0b);

/// Grava uma chave VAPID P-256 nova em PEM (SEC1) e devolve o caminho.
pub fn write_vapid_key(dir: &Path) -> PathBuf {
    let group = EcGroup::from_curve_name(Nid::X9_62_PRIME256V1).unwrap();
    let key = EcKey::generate(&group).unwrap();
    let path = dir.join("vapid.pem");
    std::fs::write(&path, key.private_key_to_pem().unwrap()).unwrap();
    path
}

/// Política da instância que o teste liga e desliga.
#[derive(Debug, Default)]
pub struct TogglePolicy {
    enabled: AtomicBool,
}

impl TogglePolicy {
    pub fn set(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::SeqCst);
    }
}

impl WebPushPolicy for TogglePolicy {
    fn is_enabled(&self) -> BoxFuture<'_, bool> {
        let enabled = self.enabled.load(Ordering::SeqCst);
        Box::pin(async move { enabled })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SentPush {
    pub endpoint: String,
    pub payload: Value,
    pub ttl_seconds: u32,
}

/// Serviço de push em memória: guarda as mensagens e responde 410 aos endpoints
/// marcados como expirados.
#[derive(Debug, Default)]
pub struct MemoryPushSender {
    sent: Mutex<Vec<SentPush>>,
    gone: Mutex<HashSet<String>>,
}

impl MemoryPushSender {
    pub fn sent(&self) -> Vec<SentPush> {
        self.sent.lock().unwrap().clone()
    }

    pub fn mark_gone(&self, endpoint: &str) {
        self.gone.lock().unwrap().insert(endpoint.to_owned());
    }
}

impl PushSender for MemoryPushSender {
    fn send<'a>(
        &'a self,
        subscription: &'a PushSubscription,
        payload: &'a [u8],
        ttl_seconds: u32,
    ) -> BoxFuture<'a, Result<(), PushSendError>> {
        let result = if self.gone.lock().unwrap().contains(&subscription.endpoint) {
            Err(PushSendError::Gone)
        } else {
            self.sent.lock().unwrap().push(SentPush {
                endpoint: subscription.endpoint.clone(),
                payload: serde_json::from_slice(payload).unwrap(),
                ttl_seconds,
            });
            Ok(())
        };
        Box::pin(async move { result })
    }
}

pub struct TestApp {
    pub ctx: TestContext,
    pub policy: Arc<TogglePolicy>,
    pub sender: Arc<MemoryPushSender>,
    _vapid_dir: tempfile::TempDir,
}

impl TestApp {
    /// App com o Web Push ligado e a chave VAPID configurada.
    pub async fn new() -> Self {
        let mut ctx = TestContext::new().await;
        migrator().run(&ctx.state.pool).await.unwrap();
        let vapid_dir = tempfile::tempdir().unwrap();
        let mut config = (*ctx.state.config).clone();
        config.web_push_vapid_key_file = Some(write_vapid_key(vapid_dir.path()));
        ctx.state.config = Arc::new(config);
        let policy = Arc::new(TogglePolicy::default());
        policy.set(true);
        Self {
            ctx,
            policy,
            sender: Arc::new(MemoryPushSender::default()),
            _vapid_dir: vapid_dir,
        }
    }

    pub fn app(&self) -> Router {
        let policy: Arc<dyn WebPushPolicy> = self.policy.clone();
        self.ctx.app(router()).layer(Extension(policy))
    }

    pub fn app_with_hook(&self, hook: EntityDeletedHook) -> Router {
        self.app().layer(Extension(hook))
    }

    pub fn dispatcher(&self) -> Dispatcher {
        let sender: Arc<dyn PushSender> = self.sender.clone();
        let policy: Arc<dyn WebPushPolicy> = self.policy.clone();
        Dispatcher {
            queue: Arc::new(PgScheduleQueue::new(self.ctx.state.pool.clone())),
            sender: Some(sender),
            policy: Some(policy),
            ids: self.ctx.state.ids.clone(),
        }
    }

    pub async fn dispatch(&self) {
        let now = self.ctx.state.clock.now();
        self.dispatcher().dispatch_due(now).await.unwrap();
    }

    pub async fn sign_in(&self, user: Uuid) -> TestSession {
        self.ctx.sign_in_as(user).await
    }

    pub async fn get(&self, session: &TestSession, uri: &str) -> (StatusCode, Value) {
        let request = session
            .request(Method::GET, uri)
            .body(Body::empty())
            .unwrap();
        let (status, _, json) = send(&self.app(), request).await;
        (status, json)
    }

    pub async fn json(
        &self,
        session: &TestSession,
        method: Method,
        uri: &str,
        body: &Value,
    ) -> (StatusCode, Value) {
        let (status, _, json) = send(&self.app(), session.json(method, uri, body)).await;
        (status, json)
    }

    pub async fn delete(&self, session: &TestSession, uri: &str) -> StatusCode {
        let request = session
            .request(Method::DELETE, uri)
            .body(Body::empty())
            .unwrap();
        send(&self.app(), request).await.0
    }

    /// Cria o lembrete e devolve o corpo da resposta.
    pub async fn create(&self, session: &TestSession, body: Value) -> Value {
        let (status, json) = self
            .json(session, Method::POST, "/api/v1/reminders", &body)
            .await;
        assert_eq!(status, StatusCode::CREATED, "{json}");
        json
    }

    pub async fn subscribe(&self, session: &TestSession, endpoint: &str) -> Value {
        let (status, json) = self
            .json(
                session,
                Method::POST,
                "/api/v1/push-subscriptions",
                &subscription_body(endpoint),
            )
            .await;
        assert_eq!(status, StatusCode::CREATED, "{json}");
        json
    }

    /// Contagem de linhas de uma tabela vistas pelo usuário, através da RLS.
    pub async fn count_as(&self, user: Uuid, sql: &str) -> i64 {
        let mut tx = crate::shared::db::begin_for_user(&self.ctx.state.pool, user)
            .await
            .unwrap();
        let count: i64 = sqlx::query_scalar(sql).fetch_one(&mut *tx).await.unwrap();
        tx.commit().await.unwrap();
        count
    }
}

pub fn subscription_body(endpoint: &str) -> Value {
    let mut p256dh = vec![0x04u8];
    p256dh.extend([7u8; 64]);
    json!({
        "endpoint": endpoint,
        "keys": {
            "p256dh": URL_SAFE_NO_PAD.encode(p256dh),
            "auth": URL_SAFE_NO_PAD.encode([9u8; 16]),
        }
    })
}

/// Regra recorrente diária no fuso e na hora pedidos.
pub fn daily_rule(time: &str, timezone: &str, starts_on: &str) -> Value {
    json!({
        "frequency": "daily",
        "interval": 1,
        "time": time,
        "timezone": timezone,
        "starts_on": starts_on,
    })
}
