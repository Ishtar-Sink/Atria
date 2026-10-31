//! Sessão em cookie `HttpOnly`, `Secure` e `SameSite`, guardada no PostgreSQL
//! ([project/security-02]). Os contextos criam e encerram sessões só por esta API.

use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use sqlx::PgPool;
use tower_sessions::cookie::SameSite;
use tower_sessions::cookie::time::Duration;
use tower_sessions::{Expiry, Session, SessionManagerLayer};
use tower_sessions_sqlx_store::PostgresStore;
use uuid::Uuid;

use crate::http::Config;
use crate::http::csrf;
use crate::shared::error::ApiError;

pub const SESSION_COOKIE: &str = "atria_session";
pub(crate) const USER_ID_KEY: &str = "user_id";
const INACTIVITY_DAYS: i64 = 30;

pub fn session_layer(pool: PgPool, config: &Config) -> SessionManagerLayer<PostgresStore> {
    SessionManagerLayer::new(PostgresStore::new(pool))
        .with_name(SESSION_COOKIE)
        .with_http_only(true)
        .with_secure(config.is_https())
        .with_same_site(SameSite::Lax)
        .with_path("/")
        .with_expiry(Expiry::OnInactivity(Duration::days(INACTIVITY_DAYS)))
}

/// Cria a tabela do armazenamento de sessões.
pub async fn migrate_store(pool: &PgPool) -> Result<(), sqlx::Error> {
    PostgresStore::new(pool.clone()).migrate().await
}

fn session_error(error: tower_sessions::session::Error) -> ApiError {
    ApiError::internal_from(&error)
}

/// Autentica a sessão: troca o id (contra fixação de sessão), grava o usuário e um
/// token CSRF novo.
pub async fn start_user_session(session: &Session, user_id: Uuid) -> Result<(), ApiError> {
    session.cycle_id().await.map_err(session_error)?;
    session
        .insert(USER_ID_KEY, user_id)
        .await
        .map_err(session_error)?;
    csrf::rotate_token(session).await
}

/// Encerra a sessão: apaga os dados e o registro no banco.
pub async fn end_user_session(session: &Session) -> Result<(), ApiError> {
    session.flush().await.map_err(session_error)
}

/// Usuário autenticado da sessão; sem sessão de usuário, 401 `unauthenticated`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CurrentUser {
    pub user_id: Uuid,
}

impl<S: Send + Sync> FromRequestParts<S> for CurrentUser {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let session = Session::from_request_parts(parts, state)
            .await
            .map_err(|_| ApiError::internal())?;
        let user_id = session
            .get::<Uuid>(USER_ID_KEY)
            .await
            .map_err(session_error)?
            .ok_or_else(|| ApiError::unauthorized("unauthenticated"))?;
        Ok(Self { user_id })
    }
}
