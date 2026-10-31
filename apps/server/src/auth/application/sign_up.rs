//! Cadastro com ou sem convite (RF-04, RF-05, RF-11).

use super::{AuthService, validate_email, validate_password};
use crate::auth::domain::error::AuthError;
use crate::auth::domain::invite::hash_token;
use crate::auth::domain::user::{Role, User};
use crate::auth::infrastructure::{pg_settings, pg_tokens, pg_users};

pub struct SignUp {
    pub email: String,
    pub password: String,
    pub invite_token: Option<String>,
    pub client_ip: String,
}

impl AuthService {
    pub async fn sign_up(&self, request: SignUp) -> Result<User, AuthError> {
        let email = validate_email(&request.email)?;
        validate_password(&request.password)?;
        let throttle_key = format!("signup-ip:{}", request.client_ip);
        self.ensure_not_locked(std::slice::from_ref(&throttle_key))
            .await?;
        let settings = {
            let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
            pg_settings::get_instance(&mut conn).await?
        };
        let token = request.invite_token.filter(|token| !token.is_empty());
        if settings.invite_required && token.is_none() {
            return Err(AuthError::InviteRequired);
        }
        let password_hash = self.hash_password(request.password).await?;
        let result = self.create_member(email, password_hash, token).await;
        match &result {
            Err(AuthError::InviteInvalid) => self.register_failures(&[throttle_key]).await?,
            // Como no login: o acerto zera a contagem, e só falhas seguidas travam o IP.
            Ok(_) => self.reset_failures(&[throttle_key]).await?,
            Err(_) => {}
        }
        result
    }

    /// Cria a conta e consome o convite na mesma transação.
    async fn create_member(
        &self,
        email: String,
        password_hash: String,
        token: Option<String>,
    ) -> Result<User, AuthError> {
        let now = self.clock.now();
        let mut tx = self.pool.begin().await.map_err(pg_users::internal)?;
        if pg_users::count(&mut tx).await? == 0 {
            return Err(AuthError::SetupRequired);
        }
        let user = self.new_user(email, password_hash, Role::User);
        pg_users::insert(&mut tx, &user, now).await?;
        if let Some(token) = token {
            let hash = hash_token(&token);
            if !pg_tokens::consume_invite(&mut tx, &hash, now, user.id).await? {
                return Err(AuthError::InviteInvalid);
            }
        }
        tx.commit().await.map_err(pg_users::internal)?;
        Ok(user)
    }
}
