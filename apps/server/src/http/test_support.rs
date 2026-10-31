//! Auxiliar de testes único para todos os contextos: monta o app com sessão e CSRF
//! e cria sessões de usuários de teste, sobre um PostgreSQL real em container.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::Router;
use axum::body::Body;
use axum::extract::{ConnectInfo, Path};
use axum::http::{HeaderMap, Method, Request, StatusCode, header, request};
use axum::routing::post;
use http_body_util::BodyExt;
use tower::ServiceExt;
use tower_sessions::Session;
use uuid::Uuid;

use crate::http::csrf::{CSRF_COOKIE, CSRF_HEADER};
use crate::http::router::build_router_with;
use crate::http::session::{SESSION_COOKIE, migrate_store};
use crate::http::{AppState, Config, start_user_session};
use crate::shared::clock::FixedClock;
use crate::shared::crypto::FieldCipher;
use crate::shared::error::ApiError;
use crate::shared::ids::SequentialIds;
use crate::shared::test_support::{TestDatabase, test_pool};
use crate::storage::local::LocalFileStorage;

pub const TEST_PUBLIC_URL: &str = "https://atria.test";
pub const TEST_INSTANT: &str = "2026-11-01T12:00:00Z";
const TEST_KEY: [u8; 32] = [42u8; 32];

pub struct TestContext {
    pub state: AppState,
    pub clock: Arc<FixedClock>,
    // Declarado depois de `state`: o banco só é apagado depois que o pool do estado sai.
    _database: TestDatabase,
    // Mantém a pasta do storage viva enquanto o contexto existir.
    _storage_dir: tempfile::TempDir,
}

pub fn test_config(storage_path: PathBuf) -> Config {
    Config {
        database_url: "postgres://atria_app@localhost/test".to_owned(),
        bind_address: SocketAddr::from(([127, 0, 0, 1], 0)),
        public_url: TEST_PUBLIC_URL.to_owned(),
        encryption_key_file: PathBuf::from("/dev/null"),
        storage_path,
        trusted_proxies: Vec::new(),
        log_level: "info".to_owned(),
        smtp: None,
        web_push_vapid_key_file: None,
    }
}

impl TestContext {
    pub async fn new() -> Self {
        let database = test_pool().await;
        migrate_store(database.pool())
            .await
            .expect("migração das sessões");
        let storage_dir = tempfile::tempdir().expect("pasta temporária do storage");
        let clock = Arc::new(FixedClock::new(TEST_INSTANT.parse().expect("instante")));
        let state = AppState {
            pool: database.pool().clone(),
            config: Arc::new(test_config(storage_dir.path().to_path_buf())),
            clock: clock.clone(),
            ids: Arc::new(SequentialIds::default()),
            cipher: Arc::new(FieldCipher::from_key(&TEST_KEY).expect("chave de teste")),
            storage: Arc::new(LocalFileStorage::new(storage_dir.path())),
            http_client: reqwest::Client::new(),
        };
        Self {
            state,
            clock,
            _database: database,
            _storage_dir: storage_dir,
        }
    }

    /// App completo com as rotas `api` sob `/api/v1` e a rota de teste
    /// `POST /__test/sessions/{user_id}`.
    pub fn app(&self, api: Router<AppState>) -> Router {
        let extra = Router::new().route("/__test/sessions/{user_id}", post(test_sign_in));
        build_router_with(self.state.clone(), api, extra)
    }

    /// Sessão anônima, só com o token CSRF.
    pub async fn anonymous(&self) -> TestSession {
        let app = self.app(Router::new());
        let request = Request::get("/").body(Body::empty()).expect("pedido");
        let (_, headers, _) = send(&app, request).await;
        TestSession::from_set_cookies(&headers, None)
    }

    /// Sessão autenticada; o usuário não precisa existir em tabela.
    pub async fn sign_in_as(&self, user_id: Uuid) -> TestSession {
        let anonymous = self.anonymous().await;
        let app = self.app(Router::new());
        let request = anonymous
            .request(Method::POST, &format!("/__test/sessions/{user_id}"))
            .body(Body::empty())
            .expect("pedido");
        let (status, headers, _) = send(&app, request).await;
        assert_eq!(
            status,
            StatusCode::NO_CONTENT,
            "falha ao criar a sessão de teste"
        );
        TestSession::from_set_cookies(&headers, Some(&anonymous))
    }
}

async fn test_sign_in(session: Session, Path(user_id): Path<Uuid>) -> Result<StatusCode, ApiError> {
    start_user_session(&session, user_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Debug, Clone)]
pub struct TestSession {
    /// Valor pronto do cabeçalho `Cookie`.
    pub cookie: String,
    pub csrf_token: String,
}

impl TestSession {
    fn from_set_cookies(headers: &HeaderMap, previous: Option<&TestSession>) -> Self {
        let session = set_cookie_value(headers, SESSION_COOKIE)
            .or_else(|| previous.and_then(|p| cookie_value(&p.cookie, SESSION_COOKIE)))
            .expect("cookie de sessão");
        let csrf_token = set_cookie_value(headers, CSRF_COOKIE)
            .or_else(|| previous.map(|p| p.csrf_token.clone()))
            .expect("cookie do CSRF");
        Self {
            cookie: format!("{SESSION_COOKIE}={session}; {CSRF_COOKIE}={csrf_token}"),
            csrf_token,
        }
    }

    /// Pedido com o cookie, o token CSRF, a origem pública e um IP de cliente.
    pub fn request(&self, method: Method, uri: &str) -> request::Builder {
        Request::builder()
            .method(method)
            .uri(uri)
            .header(header::COOKIE, &self.cookie)
            .header(CSRF_HEADER, &self.csrf_token)
            .header(header::ORIGIN, TEST_PUBLIC_URL)
            .extension(ConnectInfo(SocketAddr::from(([203, 0, 113, 10], 40000))))
    }

    pub fn json(&self, method: Method, uri: &str, body: &serde_json::Value) -> Request<Body> {
        self.request(method, uri)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(body.to_string()))
            .expect("pedido JSON")
    }
}

/// Valor do cookie `name` nos `Set-Cookie` da resposta.
pub fn set_cookie_value(headers: &HeaderMap, name: &str) -> Option<String> {
    set_cookie_header(headers, name).and_then(|raw| {
        let pair = raw.split(';').next()?;
        let (_, value) = pair.split_once('=')?;
        Some(value.trim().to_owned())
    })
}

/// O `Set-Cookie` inteiro do cookie `name`, com os atributos.
pub fn set_cookie_header(headers: &HeaderMap, name: &str) -> Option<String> {
    headers
        .get_all(header::SET_COOKIE)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .rfind(|value| value.starts_with(&format!("{name}=")))
        .map(str::to_owned)
}

fn cookie_value(cookie: &str, name: &str) -> Option<String> {
    cookie
        .split(';')
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(key, _)| *key == name)
        .map(|(_, value)| value.to_owned())
}

/// Envia o pedido e devolve o status, os cabeçalhos e o corpo JSON (`Null` se vazio
/// ou não JSON).
pub async fn send(
    app: &Router,
    request: Request<Body>,
) -> (StatusCode, HeaderMap, serde_json::Value) {
    let response = app.clone().oneshot(request).await.expect("resposta");
    let status = response.status();
    let headers = response.headers().clone();
    let bytes = response
        .into_body()
        .collect()
        .await
        .expect("corpo")
        .to_bytes();
    let json = serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);
    (status, headers, json)
}
