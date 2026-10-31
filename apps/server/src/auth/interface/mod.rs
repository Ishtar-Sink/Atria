//! Montagem das rotas sob `/api/v1` e da camada `require_complete_account`.

pub mod dto;
pub mod handlers;
pub mod openapi;

use std::convert::Infallible;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll};

use axum::Router;
use axum::extract::{OriginalUri, Request};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, patch, post, put};
use tower::{Layer, Service};
use tower_sessions::Session;

use self::handlers::INCOMPLETE_KEY;
use super::application::ports::{MailSender, PasswordHasher};
use crate::http::AppState;
use crate::shared::error::ApiError;

/// Dependências trocáveis: o hash de senha e o envio de e-mail.
pub struct Collaborators {
    pub hasher: Arc<dyn PasswordHasher>,
    pub mailer: Arc<dyn MailSender>,
}

pub fn router(collaborators: Collaborators) -> Router<AppState> {
    let protected = Router::new()
        .route("/admin/users", get(handlers::list_users))
        .route("/admin/users/{id}", patch(handlers::update_user))
        .route("/admin/invites", post(handlers::create_invite))
        .route(
            "/admin/password-resets",
            post(handlers::create_admin_password_reset),
        )
        .route("/admin/instance", get(handlers::instance_state))
        .route(
            "/admin/instance/settings",
            get(handlers::get_instance_settings).patch(handlers::update_instance_settings),
        )
        .route(
            "/me/preferences",
            get(handlers::get_preferences).patch(handlers::update_preferences),
        )
        .layer(require_complete_account());
    Router::new()
        .route(
            "/setup",
            get(handlers::setup_status).post(handlers::run_setup),
        )
        .route("/auth/sign-up", post(handlers::sign_up))
        .route("/auth/sign-in", post(handlers::sign_in))
        .route("/auth/sign-out", post(handlers::sign_out))
        .route(
            "/auth/password-resets",
            post(handlers::request_password_reset),
        )
        .route(
            "/auth/password-resets/{token}",
            put(handlers::reset_password),
        )
        .route("/auth/totp", post(handlers::begin_totp))
        .route("/auth/totp/activation", post(handlers::activate_totp))
        .route("/me", get(handlers::me))
        .merge(protected)
        .layer(axum::Extension(Arc::new(collaborators)))
}

/// Camada que barra o admin sem 2FA em toda rota fora de `/auth/*`, `/setup` e `/me`.
/// As demais rotas de contexto a aplicam nos seus roteadores protegidos.
pub fn require_complete_account() -> CompleteAccountLayer {
    CompleteAccountLayer
}

#[derive(Debug, Clone, Copy)]
pub struct CompleteAccountLayer;

impl<S> Layer<S> for CompleteAccountLayer {
    type Service = CompleteAccountService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        CompleteAccountService { inner }
    }
}

#[derive(Debug, Clone)]
pub struct CompleteAccountService<S> {
    inner: S,
}

impl<S> Service<Request> for CompleteAccountService<S>
where
    S: Service<Request, Response = Response, Error = Infallible> + Clone + Send + 'static,
    S::Future: Send + 'static,
{
    type Response = Response;
    type Error = Infallible;
    type Future = Pin<Box<dyn Future<Output = Result<Response, Infallible>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, request: Request) -> Self::Future {
        // O clone pronto é o que fica; o original (já "ready") atende este pedido.
        let clone = self.inner.clone();
        let mut inner = std::mem::replace(&mut self.inner, clone);
        let session = blocking_session(&request);
        Box::pin(async move {
            if let Some(session) = session
                && matches!(session.get::<bool>(INCOMPLETE_KEY).await, Ok(Some(true)))
            {
                return Ok(ApiError::forbidden("totp_required").into_response());
            }
            inner.call(request).await
        })
    }
}

/// A sessão a consultar, ou nada quando a rota é isenta ou não há sessão. Sessão sem a
/// marca (usuário comum, ou criada por outro caminho) passa.
fn blocking_session(request: &Request) -> Option<Session> {
    if is_exempt(request) {
        return None;
    }
    request.extensions().get::<Session>().cloned()
}

fn is_exempt(request: &Request) -> bool {
    let full = request
        .extensions()
        .get::<OriginalUri>()
        .map_or_else(|| request.uri().path(), |original| original.0.path());
    let path = full.strip_prefix("/api/v1").unwrap_or(full);
    path == "/setup" || path == "/me" || path.starts_with("/me/") || path.starts_with("/auth/")
}
