//! Contexto `auth`: contas, sessão, 2FA, convites, redefinição de senha, papéis,
//! preferências e configurações da instância.
//!
//! O `main.rs` registra `router()`, `migrator()` e `AuthApi`, e usa
//! `require_complete_account()` nos roteadores protegidos dos outros contextos.

pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod interface;
#[cfg(test)]
mod tests;

use std::sync::Arc;

use axum::Router;

pub use self::application::admin::web_push_enabled;
use self::infrastructure::argon2_hasher::Argon2Hasher;
use self::infrastructure::smtp_mail_sender::SmtpMailSender;
use self::interface::Collaborators;
pub use self::interface::openapi::AuthApi;
pub use self::interface::require_complete_account;
use crate::http::AppState;

/// Rotas do contexto, relativas a `/api/v1`, com Argon2id e SMTP reais.
pub fn router() -> Router<AppState> {
    interface::router(Collaborators {
        hasher: Arc::new(Argon2Hasher::new()),
        mailer: Arc::new(SmtpMailSender),
    })
}

/// Migrações do contexto. Os contextos dividem a tabela `_sqlx_migrations`, então cada
/// migrator ignora as migrações aplicadas que pertencem a outro contexto.
pub fn migrator() -> sqlx::migrate::Migrator {
    let mut migrator = sqlx::migrate!("src/auth/migrations");
    migrator.set_ignore_missing(true);
    migrator
}
