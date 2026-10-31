//! Início e confirmação do 2FA por TOTP ([project/security-17]).

use uuid::Uuid;

use super::AuthService;
use crate::auth::domain::error::AuthError;
use crate::auth::domain::totp::TotpSecret;
use crate::auth::infrastructure::pg_users;

pub struct TotpEnrollment {
    pub secret: String,
    pub otpauth_uri: String,
}

impl AuthService {
    /// Gera o segredo pendente, cifrado em repouso, e devolve a URI para o QR code.
    pub async fn begin_totp(&self, user_id: Uuid) -> Result<TotpEnrollment, AuthError> {
        let user = self.active_user(user_id).await?;
        if user.totp_enabled() {
            return Err(AuthError::TotpAlreadyEnabled);
        }
        let secret = TotpSecret::generate();
        let encrypted = self
            .cipher
            .encrypt(secret.as_bytes(), &Self::totp_associated_data(user.id))
            .map_err(|error| AuthError::Internal(error.to_string()))?;
        let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
        pg_users::set_pending_totp(&mut conn, user.id, &encrypted, self.clock.now()).await?;
        Ok(TotpEnrollment {
            secret: secret.to_base32(),
            otpauth_uri: secret.otpauth_uri(Self::totp_issuer(), &user.email),
        })
    }

    /// Confirma o segredo pendente com um código válido e ativa o 2FA.
    pub async fn activate_totp(&self, user_id: Uuid, code: &str) -> Result<(), AuthError> {
        let user = self.active_user(user_id).await?;
        if user.totp_enabled() {
            return Err(AuthError::TotpAlreadyEnabled);
        }
        let pending = user
            .totp_pending_secret_encrypted
            .as_deref()
            .ok_or(AuthError::TotpNotStarted)?;
        let secret = self.decrypt_secret(&user, pending)?;
        let now = self.clock.now();
        if !secret.verify(code, now) {
            return Err(AuthError::InvalidTotpCode);
        }
        let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
        pg_users::activate_totp(&mut conn, user.id, now).await
    }
}
