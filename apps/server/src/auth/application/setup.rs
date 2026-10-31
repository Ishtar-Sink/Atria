//! Assistente de primeira execução (RF-03): cria o admin uma única vez.

use uuid::Uuid;

use super::{AuthService, validate_email, validate_password};
use crate::auth::domain::error::AuthError;
use crate::auth::domain::user::{Role, User};
use crate::auth::infrastructure::pg_users;

/// Chave do `pg_advisory_xact_lock` que serializa o assistente.
const SETUP_LOCK_KEY: i64 = 0x4154_5249_4153_0001;

impl AuthService {
    pub async fn setup_required(&self) -> Result<bool, AuthError> {
        let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
        Ok(pg_users::count(&mut conn).await? == 0)
    }

    pub async fn run_setup(&self, email: &str, password: &str) -> Result<User, AuthError> {
        let email = validate_email(email)?;
        validate_password(password)?;
        let password_hash = self.hash_password(password.to_owned()).await?;
        let mut tx = self.pool.begin().await.map_err(pg_users::internal)?;
        sqlx::query!("SELECT pg_advisory_xact_lock($1)", SETUP_LOCK_KEY)
            .execute(&mut *tx)
            .await
            .map_err(pg_users::internal)?;
        if pg_users::count(&mut tx).await? > 0 {
            return Err(AuthError::SetupAlreadyDone);
        }
        let user = self.new_user(email, password_hash, Role::Admin);
        pg_users::insert(&mut tx, &user, self.clock.now()).await?;
        tx.commit().await.map_err(pg_users::internal)?;
        Ok(user)
    }

    pub(crate) fn new_user(&self, email: String, password_hash: String, role: Role) -> User {
        User {
            id: self.ids.new_id(),
            email,
            password_hash,
            role,
            is_active: true,
            totp_secret_encrypted: None,
            totp_pending_secret_encrypted: None,
            totp_enabled_at: None,
            created_at: self.clock.now(),
        }
    }

    pub(crate) fn new_id(&self) -> Uuid {
        self.ids.new_id()
    }
}
