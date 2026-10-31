//! Servidor completo para os testes de integração: os doze contextos pelo registro,
//! as migrações aplicadas, sessão e CSRF reais e usuários criados pelo fluxo da API.

use std::sync::Arc;

use axum::body::Body;
use axum::http::{HeaderMap, Method, StatusCode};
use axum::{Extension, Router};
use serde_json::{Value, json};
use totp_rs::Secret;
use uuid::Uuid;

use crate::auth::domain::totp::TotpSecret;
use crate::http::contexts::{api_router, run_migrations};
use crate::http::csrf::CSRF_COOKIE;
use crate::http::session::SESSION_COOKIE;
use crate::http::test_support::{TestContext, TestSession, send, set_cookie_value};
use crate::library::application::ports::{FetchedThumbnail, ThumbnailFetcher, ThumbnailFuture};

pub const PASSWORD: &str = "correct horse battery";
pub const ADMIN_EMAIL: &str = "admin@example.com";

pub type Reply = (StatusCode, HeaderMap, Value);

/// Miniatura fixa, sem rede ([project/architecture-12]).
struct FixedThumbnail;

impl ThumbnailFetcher for FixedThumbnail {
    fn fetch<'a>(&'a self, _video_url: &'a reqwest::Url) -> ThumbnailFuture<'a> {
        Box::pin(async {
            Ok(Some(FetchedThumbnail {
                title: Some("Vídeo de teste".to_owned()),
                // O servidor confere só a assinatura `FF D8 FF` do JPEG.
                bytes: axum::body::Bytes::from_static(&[
                    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, b'J', b'F', b'I', b'F', 0x00, 0xFF, 0xD9,
                ]),
            }))
        })
    }
}

pub struct Server {
    pub ctx: TestContext,
    pub app: Router,
}

/// Usuário criado pela API, com a sessão já aberta.
pub struct User {
    pub id: Uuid,
    pub session: TestSession,
}

pub struct Users {
    pub admin: User,
    pub alice: User,
    pub bob: User,
}

impl Server {
    pub async fn new() -> Self {
        let ctx = TestContext::new().await;
        run_migrations(&ctx.state.pool).await.unwrap();
        let fetcher: Arc<dyn ThumbnailFetcher> = Arc::new(FixedThumbnail);
        let app = ctx.app(api_router(&ctx.state).layer(Extension(fetcher)));
        Self { ctx, app }
    }

    pub async fn anonymous(&self) -> TestSession {
        self.ctx.anonymous().await
    }

    pub async fn request(
        &self,
        session: &TestSession,
        method: Method,
        uri: &str,
        body: Option<&Value>,
    ) -> Reply {
        let request = match body {
            Some(body) => session.json(method, uri, body),
            None => session.request(method, uri).body(Body::empty()).unwrap(),
        };
        send(&self.app, request).await
    }

    pub async fn get(&self, session: &TestSession, uri: &str) -> Reply {
        self.request(session, Method::GET, uri, None).await
    }

    pub async fn post(&self, session: &TestSession, uri: &str, body: &Value) -> Reply {
        self.request(session, Method::POST, uri, Some(body)).await
    }

    pub async fn patch(&self, session: &TestSession, uri: &str, body: &Value) -> Reply {
        self.request(session, Method::PATCH, uri, Some(body)).await
    }

    pub async fn delete(&self, session: &TestSession, uri: &str) -> Reply {
        self.request(session, Method::DELETE, uri, None).await
    }

    /// Admin criado pelo assistente de primeira execução, ainda sem 2FA.
    pub async fn setup_admin(&self) -> User {
        let anonymous = self.anonymous().await;
        let (status, headers, body) = self
            .post(
                &anonymous,
                "/api/v1/setup",
                &json!({"email": ADMIN_EMAIL, "password": PASSWORD}),
            )
            .await;
        assert_eq!(status, StatusCode::CREATED, "{body}");
        User {
            id: user_id(&body),
            session: merge_cookies(&anonymous, &headers),
        }
    }

    /// Ativa o 2FA da sessão pela API.
    pub async fn enable_totp(&self, user: &mut User) {
        let (status, headers, body) = self
            .post(&user.session, "/api/v1/auth/totp", &json!({}))
            .await;
        assert_eq!(status, StatusCode::CREATED, "{body}");
        user.session = merge_cookies(&user.session, &headers);
        let encoded = body["secret"].as_str().unwrap().to_owned();
        let secret = TotpSecret::from_bytes(
            Secret::try_from_base32(encoded)
                .unwrap()
                .as_bytes()
                .to_vec(),
        );
        let code = secret.code_at(self.ctx.state.clock.now());
        let (status, headers, body) = self
            .post(
                &user.session,
                "/api/v1/auth/totp/activation",
                &json!({"code": code}),
            )
            .await;
        assert_eq!(status, StatusCode::NO_CONTENT, "{body}");
        user.session = merge_cookies(&user.session, &headers);
    }

    /// Convite gerado pelo admin; devolve o token do link.
    async fn invite_token(&self, admin: &TestSession) -> String {
        let (status, _, body) = self.post(admin, "/api/v1/admin/invites", &json!({})).await;
        assert_eq!(status, StatusCode::CREATED, "{body}");
        let link = body["link"].as_str().unwrap();
        link.split("invite=").nth(1).unwrap().to_owned()
    }

    /// Conta criada por convite e já com a sessão aberta.
    async fn sign_up(&self, admin: &TestSession, email: &str) -> User {
        let token = self.invite_token(admin).await;
        let anonymous = self.anonymous().await;
        let (status, _, body) = self
            .post(
                &anonymous,
                "/api/v1/auth/sign-up",
                &json!({"email": email, "password": PASSWORD, "invite_token": token}),
            )
            .await;
        assert_eq!(status, StatusCode::CREATED, "{body}");
        let id = user_id(&body);
        let anonymous = self.anonymous().await;
        let (status, headers, body) = self
            .post(
                &anonymous,
                "/api/v1/auth/sign-in",
                &json!({"email": email, "password": PASSWORD}),
            )
            .await;
        assert_eq!(status, StatusCode::OK, "{body}");
        User {
            id,
            session: merge_cookies(&anonymous, &headers),
        }
    }

    /// Admin com 2FA, `alice` e `bob`, todos pelo fluxo real da API.
    pub async fn users(&self) -> Users {
        let mut admin = self.setup_admin().await;
        self.enable_totp(&mut admin).await;
        let alice = self.sign_up(&admin.session, "alice@example.com").await;
        let bob = self.sign_up(&admin.session, "bob@example.com").await;
        Users { admin, alice, bob }
    }
}

fn user_id(body: &Value) -> Uuid {
    body["id"]
        .as_str()
        .or_else(|| body["user"]["id"].as_str())
        .and_then(|id| id.parse().ok())
        .unwrap_or_else(|| panic!("resposta sem o id do usuário: {body}"))
}

/// Junta os cookies novos da resposta aos da sessão anterior.
pub fn merge_cookies(previous: &TestSession, headers: &HeaderMap) -> TestSession {
    let session = set_cookie_value(headers, SESSION_COOKIE)
        .or_else(|| cookie_of(&previous.cookie, SESSION_COOKIE))
        .unwrap();
    let csrf_token =
        set_cookie_value(headers, CSRF_COOKIE).unwrap_or_else(|| previous.csrf_token.clone());
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
