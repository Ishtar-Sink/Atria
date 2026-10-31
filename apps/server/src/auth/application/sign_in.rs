//! Login com senha, TOTP e bloqueio progressivo (RF-06, RF-07).

use super::AuthService;
use crate::auth::domain::error::AuthError;
use crate::auth::domain::throttle::Throttle;
use crate::auth::domain::totp::TotpSecret;
use crate::auth::domain::user::{User, normalize_email};
use crate::auth::infrastructure::{pg_throttle, pg_users};

pub struct SignIn {
    pub email: String,
    pub password: String,
    pub totp_code: Option<String>,
    pub client_ip: String,
}

impl AuthService {
    pub async fn sign_in(&self, request: SignIn) -> Result<User, AuthError> {
        let email = normalize_email(&request.email);
        let keys = [
            attempt_key_for_email(&email),
            format!("ip:{}", request.client_ip),
        ];
        self.ensure_not_locked(&keys).await?;
        let user = self.find_active_by_email(&email).await?;
        let password_ok = self
            .verify_password(
                request.password,
                user.as_ref().map(|user| user.password_hash.clone()),
            )
            .await;
        let Some(user) = user.filter(|_| password_ok) else {
            self.register_failures(&keys).await?;
            return Err(AuthError::InvalidCredentials);
        };
        if user.totp_enabled() {
            self.check_totp(&user, request.totp_code.as_deref(), &keys)
                .await?;
        }
        self.reset_failures(&keys).await?;
        Ok(user)
    }

    async fn find_active_by_email(&self, email: &str) -> Result<Option<User>, AuthError> {
        let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
        let user = pg_users::find_by_email(&mut conn, email).await?;
        Ok(user.filter(|user| user.is_active))
    }

    async fn check_totp(
        &self,
        user: &User,
        code: Option<&str>,
        keys: &[String],
    ) -> Result<(), AuthError> {
        let Some(code) = code.filter(|code| !code.trim().is_empty()) else {
            return Err(AuthError::TotpRequired);
        };
        let secret = self.decrypt_totp(user)?;
        if secret.verify(code, self.clock.now()) {
            return Ok(());
        }
        self.register_failures(keys).await?;
        Err(AuthError::InvalidTotpCode)
    }

    pub(crate) fn decrypt_totp(&self, user: &User) -> Result<TotpSecret, AuthError> {
        let encrypted = user
            .totp_secret_encrypted
            .as_deref()
            .ok_or_else(|| AuthError::Internal("2FA ativo sem segredo".to_owned()))?;
        self.decrypt_secret(user, encrypted)
    }

    pub(crate) fn decrypt_secret(
        &self,
        user: &User,
        encrypted: &[u8],
    ) -> Result<TotpSecret, AuthError> {
        let bytes = self
            .cipher
            .decrypt(encrypted, &Self::totp_associated_data(user.id))
            .map_err(|error| AuthError::Internal(error.to_string()))?;
        Ok(TotpSecret::from_bytes(bytes))
    }

    /// Recusa com `too_many_attempts` se qualquer chave estiver bloqueada.
    pub(crate) async fn ensure_not_locked(&self, keys: &[String]) -> Result<(), AuthError> {
        let now = self.clock.now();
        let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
        for key in keys {
            let throttle = pg_throttle::get(&mut conn, key).await?;
            if let Some(seconds) = throttle.locked_for(now) {
                return Err(AuthError::TooManyAttempts {
                    retry_after_seconds: seconds,
                });
            }
        }
        Ok(())
    }

    pub(crate) async fn register_failures(&self, keys: &[String]) -> Result<(), AuthError> {
        let now = self.clock.now();
        let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
        for key in keys {
            let mut throttle = pg_throttle::get(&mut conn, key).await?;
            throttle.register_failure(now);
            pg_throttle::save(&mut conn, key, &throttle, now).await?;
        }
        Ok(())
    }

    pub(crate) async fn reset_failures(&self, keys: &[String]) -> Result<(), AuthError> {
        let now = self.clock.now();
        let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
        for key in keys {
            let mut throttle: Throttle = pg_throttle::get(&mut conn, key).await?;
            if throttle.failures == 0 {
                continue;
            }
            throttle.register_success();
            pg_throttle::save(&mut conn, key, &throttle, now).await?;
        }
        Ok(())
    }
}

/// Chave por e-mail: o hash, nunca o endereço em claro.
pub(crate) fn attempt_key_for_email(email: &str) -> String {
    let hash = crate::auth::domain::invite::hash_token(email);
    let hex: String = hash.iter().map(|byte| format!("{byte:02x}")).collect();
    format!("email:{hex}")
}
