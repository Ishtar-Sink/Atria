//! Auxiliar dos testes de integração do contexto: PostgreSQL em container, o
//! `migrator()` do contexto, o app de teste, relógio fixo e um `MailSender` em memória.

mod password_resets;
mod preferences;
mod roles;
mod setup;
mod sign_in;
mod sign_up;

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use axum::Router;
use axum::body::Body;
use axum::extract::ConnectInfo;
use axum::http::{HeaderMap, Method, Request, StatusCode, header};
use serde_json::{Value, json};
use totp_rs::Secret;
use uuid::Uuid;

use super::application::ports::{Mail, MailFuture, MailSender, SmtpSettings};
use super::domain::totp::TotpSecret;
use super::domain::user::{Role, User};
use super::infrastructure::argon2_hasher::Argon2Hasher;
use super::infrastructure::pg_users;
use super::interface::{Collaborators, router};
use crate::auth::application::ports::PasswordHasher;
use crate::http::csrf::{CSRF_COOKIE, CSRF_HEADER};
use crate::http::session::SESSION_COOKIE;
use crate::http::test_support::{
    TEST_PUBLIC_URL, TestContext, TestSession, send, set_cookie_value,
};

pub const PASSWORD: &str = "correct horse battery";
pub const NEW_PASSWORD: &str = "another long passphrase";

/// `MailSender` que guarda os e-mails em vez de enviá-los.
#[derive(Default)]
pub struct MemoryMailer {
    sent: Mutex<Vec<Mail>>,
}

impl MemoryMailer {
    pub fn sent(&self) -> Vec<Mail> {
        self.sent.lock().unwrap().clone()
    }
}

impl MailSender for MemoryMailer {
    fn send<'a>(&'a self, _smtp: &'a SmtpSettings, mail: &'a Mail) -> MailFuture<'a> {
        Box::pin(async move {
            self.sent.lock().unwrap().push(mail.clone());
            Ok(())
        })
    }
}

pub struct Harness {
    pub ctx: TestContext,
    pub app: Router,
    pub mailer: Arc<MemoryMailer>,
    hasher: Arc<Argon2Hasher>,
}

pub type Reply = (StatusCode, HeaderMap, Value);

impl Harness {
    pub async fn new() -> Self {
        let ctx = TestContext::new().await;
        super::migrator().run(&ctx.state.pool).await.unwrap();
        let mailer = Arc::new(MemoryMailer::default());
        let hasher = Arc::new(Argon2Hasher::cheap());
        let app = ctx.app(router(Collaborators {
            hasher: hasher.clone(),
            mailer: mailer.clone(),
        }));
        Self {
            ctx,
            app,
            mailer,
            hasher,
        }
    }

    pub async fn anonymous(&self) -> TestSession {
        self.ctx.anonymous().await
    }

    pub fn now(&self) -> chrono::DateTime<chrono::Utc> {
        self.ctx.state.clock.now()
    }

    pub async fn get(&self, session: &TestSession, uri: &str) -> Reply {
        let request = session
            .request(Method::GET, uri)
            .body(Body::empty())
            .unwrap();
        send(&self.app, request).await
    }

    pub async fn post(&self, session: &TestSession, uri: &str, body: &Value) -> Reply {
        send(&self.app, session.json(Method::POST, uri, body)).await
    }

    pub async fn put(&self, session: &TestSession, uri: &str, body: &Value) -> Reply {
        send(&self.app, session.json(Method::PUT, uri, body)).await
    }

    pub async fn patch(&self, session: &TestSession, uri: &str, body: &Value) -> Reply {
        send(&self.app, session.json(Method::PATCH, uri, body)).await
    }

    /// Insere a conta direto no banco, com a senha `PASSWORD`.
    pub async fn seed_user(&self, email: &str, role: Role) -> Uuid {
        let user = User {
            id: self.ctx.state.ids.new_id(),
            email: email.to_owned(),
            password_hash: self.hasher.hash(PASSWORD).unwrap(),
            role,
            is_active: true,
            totp_secret_encrypted: None,
            totp_pending_secret_encrypted: None,
            totp_enabled_at: None,
            created_at: self.now(),
        };
        let mut conn = self.ctx.state.pool.acquire().await.unwrap();
        pg_users::insert(&mut conn, &user, self.now())
            .await
            .unwrap();
        user.id
    }

    /// Como `seed_user`, com o 2FA já ativo; devolve o segredo para gerar códigos.
    pub async fn seed_user_with_totp(&self, email: &str, role: Role) -> (Uuid, TotpSecret) {
        let id = self.seed_user(email, role).await;
        let secret = TotpSecret::generate();
        let encrypted = self
            .ctx
            .state
            .cipher
            .encrypt(
                secret.as_bytes(),
                format!("users.totp_secret_encrypted:{id}").as_bytes(),
            )
            .unwrap();
        sqlx::query(
            "UPDATE users SET totp_secret_encrypted = $2, totp_enabled_at = $3 WHERE id = $1",
        )
        .bind(id)
        .bind(encrypted)
        .bind(self.now())
        .execute(&self.ctx.state.pool)
        .await
        .unwrap();
        (id, secret)
    }

    /// Entra pela API com e-mail e `PASSWORD`; o código TOTP é opcional.
    pub async fn try_sign_in(
        &self,
        email: &str,
        password: &str,
        code: Option<&str>,
    ) -> (Reply, TestSession) {
        let anonymous = self.anonymous().await;
        let mut body = json!({"email": email, "password": password});
        if let Some(code) = code {
            body["totp_code"] = json!(code);
        }
        let reply = self.post(&anonymous, "/api/v1/auth/sign-in", &body).await;
        let session = merge_cookies(&anonymous, &reply.1);
        (reply, session)
    }

    pub async fn sign_in(&self, email: &str) -> TestSession {
        let ((status, _, body), session) = self.try_sign_in(email, PASSWORD, None).await;
        assert_eq!(status, StatusCode::OK, "{body}");
        session
    }

    /// Sessão do admin já com o 2FA ativo, pronta para as rotas protegidas.
    pub async fn admin_session(&self) -> (Uuid, TestSession) {
        let (id, secret) = self
            .seed_user_with_totp("admin@example.com", Role::Admin)
            .await;
        let code = secret.code_at(self.now());
        let ((status, _, body), session) = self
            .try_sign_in("admin@example.com", PASSWORD, Some(&code))
            .await;
        assert_eq!(status, StatusCode::OK, "{body}");
        (id, session)
    }

    /// Ativa o 2FA da sessão pela API; devolve o segredo.
    pub async fn enable_totp(&self, session: &TestSession) -> TotpSecret {
        let (status, _, body) = self.post(session, "/api/v1/auth/totp", &json!({})).await;
        assert_eq!(status, StatusCode::CREATED, "{body}");
        let encoded = body["secret"].as_str().unwrap().to_owned();
        let secret = TotpSecret::from_bytes(
            Secret::try_from_base32(encoded)
                .unwrap()
                .as_bytes()
                .to_vec(),
        );
        let code = secret.code_at(self.now());
        let (status, _, body) = self
            .post(
                session,
                "/api/v1/auth/totp/activation",
                &json!({"code": code}),
            )
            .await;
        assert_eq!(status, StatusCode::NO_CONTENT, "{body}");
        secret
    }

    /// Cria um convite pela API como `session` e devolve o token do link.
    pub async fn invite_token(&self, session: &TestSession) -> String {
        let (status, _, body) = self
            .post(session, "/api/v1/admin/invites", &json!({}))
            .await;
        assert_eq!(status, StatusCode::CREATED, "{body}");
        let link = body["link"].as_str().unwrap();
        link.split("invite=").nth(1).unwrap().to_owned()
    }

    pub async fn sign_up(&self, email: &str, token: Option<&str>) -> Reply {
        let anonymous = self.anonymous().await;
        let mut body = json!({"email": email, "password": PASSWORD});
        if let Some(token) = token {
            body["invite_token"] = json!(token);
        }
        self.post(&anonymous, "/api/v1/auth/sign-up", &body).await
    }
}

/// Junta os cookies novos da resposta aos da sessão anterior.
pub fn merge_cookies(previous: &TestSession, headers: &HeaderMap) -> TestSession {
    let session = set_cookie_value(headers, SESSION_COOKIE)
        .or_else(|| cookie_of(&previous.cookie, SESSION_COOKIE))
        .unwrap();
    let csrf_token = set_cookie_value(headers, CSRF_COOKIE).unwrap_or(previous.csrf_token.clone());
    TestSession {
        cookie: format!("{SESSION_COOKIE}={session}; {CSRF_COOKIE}={csrf_token}"),
        csrf_token,
    }
}

fn cookie_of(cookie: &str, name: &str) -> Option<String> {
    cookie
        .split(';')
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(key, _)| *key == name)
        .map(|(_, value)| value.to_owned())
}

/// Pedido sem o cabeçalho do CSRF, para provar que a mutação é recusada.
pub fn request_without_csrf(
    session: &TestSession,
    method: Method,
    uri: &str,
    body: &Value,
) -> Request<Body> {
    assert!(!CSRF_HEADER.is_empty());
    Request::builder()
        .method(method)
        .uri(uri)
        .header(header::COOKIE, &session.cookie)
        .header(header::ORIGIN, TEST_PUBLIC_URL)
        .header(header::CONTENT_TYPE, "application/json")
        .extension(ConnectInfo(SocketAddr::from(([203, 0, 113, 10], 40000))))
        .body(Body::from(body.to_string()))
        .unwrap()
}
