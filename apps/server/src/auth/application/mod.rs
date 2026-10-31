//! Serviços de aplicação do contexto `auth`. Cada arquivo acrescenta casos de uso ao
//! `AuthService`, que reúne as dependências injetadas.

pub mod admin;
pub mod password_resets;
pub mod ports;
pub mod preferences;
pub mod setup;
pub mod sign_in;
pub mod sign_up;
pub mod totp_enrollment;

use std::sync::Arc;

use sqlx::PgPool;
use uuid::Uuid;

use self::ports::{MailSender, PasswordHasher};
use super::domain::error::AuthError;
use super::domain::user::{User, normalize_email};
use super::infrastructure::pg_users;
use crate::http::Config;
use crate::shared::clock::Clock;
use crate::shared::crypto::FieldCipher;
use crate::shared::ids::IdGenerator;

pub const EMAIL_MAX_LEN: usize = 254;
pub const PASSWORD_MIN_LEN: usize = 12;
pub const PASSWORD_MAX_LEN: usize = 128;
const TOTP_ISSUER: &str = "Atria";

pub struct AuthService {
    pub pool: PgPool,
    pub clock: Arc<dyn Clock>,
    pub ids: Arc<dyn IdGenerator>,
    pub cipher: Arc<FieldCipher>,
    pub config: Arc<Config>,
    pub hasher: Arc<dyn PasswordHasher>,
    pub mailer: Arc<dyn MailSender>,
}

impl AuthService {
    /// Usuário da sessão, lido do banco a cada pedido: uma conta desativada perde o
    /// acesso na hora, mesmo com a sessão ainda viva.
    pub async fn active_user(&self, user_id: Uuid) -> Result<User, AuthError> {
        let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
        match pg_users::find_by_id(&mut conn, user_id).await? {
            Some(user) if user.is_active => Ok(user),
            _ => Err(AuthError::Unauthenticated),
        }
    }

    /// Hash em thread própria: o Argon2id é caro e bloquearia o executor.
    pub(crate) async fn hash_password(&self, password: String) -> Result<String, AuthError> {
        let hasher = self.hasher.clone();
        tokio::task::spawn_blocking(move || hasher.hash(&password))
            .await
            .map_err(|error| AuthError::Internal(error.to_string()))?
    }

    pub(crate) async fn verify_password(&self, password: String, hash: Option<String>) -> bool {
        let hasher = self.hasher.clone();
        let task = tokio::task::spawn_blocking(move || match hash {
            Some(hash) => hasher.verify(&password, &hash),
            None => {
                // Mesmo custo quando a conta não existe, para não revelar o e-mail.
                hasher.verify_dummy(&password);
                false
            }
        });
        task.await.unwrap_or(false)
    }

    pub(crate) fn totp_associated_data(user_id: Uuid) -> Vec<u8> {
        format!("users.totp_secret_encrypted:{user_id}").into_bytes()
    }

    pub(crate) fn totp_issuer() -> &'static str {
        TOTP_ISSUER
    }
}

/// Valida e normaliza o e-mail: um `@`, partes não vazias, sem espaços, até 254.
pub fn validate_email(raw: &str) -> Result<String, AuthError> {
    let email = normalize_email(raw);
    let valid = email.len() <= EMAIL_MAX_LEN
        && !email.chars().any(|c| c.is_whitespace() || c.is_control())
        && email.split_once('@').is_some_and(|(local, domain)| {
            !local.is_empty()
                && domain.contains('.')
                && !domain.contains('@')
                && !domain.starts_with('.')
                && !domain.ends_with('.')
        });
    if valid {
        Ok(email)
    } else {
        Err(AuthError::invalid_field("email", "invalid"))
    }
}

/// Senha de 12 a 128 caracteres.
pub fn validate_password(password: &str) -> Result<(), AuthError> {
    let length = password.chars().count();
    if (PASSWORD_MIN_LEN..=PASSWORD_MAX_LEN).contains(&length) {
        Ok(())
    } else {
        Err(AuthError::invalid_field("password", "invalid_length"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn email_is_validated_and_normalized() {
        assert_eq!(
            validate_email(" Ana@Example.com ").unwrap(),
            "ana@example.com"
        );
        for bad in [
            "",
            "ana",
            "ana@",
            "@example.com",
            "a b@example.com",
            "a@b@c.com",
            "a@com",
        ] {
            assert!(validate_email(bad).is_err(), "{bad}");
        }
        let long = format!("{}@example.com", "a".repeat(250));
        assert!(validate_email(&long).is_err());
    }

    #[test]
    fn password_length_is_between_12_and_128() {
        assert!(validate_password(&"a".repeat(11)).is_err());
        assert!(validate_password(&"a".repeat(12)).is_ok());
        assert!(validate_password(&"a".repeat(128)).is_ok());
        assert!(validate_password(&"a".repeat(129)).is_err());
    }
}
