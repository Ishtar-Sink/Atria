//! Redefinição de senha: pedido por e-mail, link gerado pelo admin e troca da senha
//! (RF-08, RF-09).

use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::ports::{Mail, SmtpSettings};
use super::{AuthService, validate_password};
use crate::auth::domain::error::AuthError;
use crate::auth::domain::invite::{OpaqueToken, hash_token};
use crate::auth::domain::password_reset::{ResetOrigin, ResetToken};
use crate::auth::domain::user::{User, normalize_email};
use crate::auth::infrastructure::{pg_settings, pg_tokens, pg_users};

pub struct IssuedLink {
    pub link: String,
    pub expires_at: DateTime<Utc>,
}

impl AuthService {
    /// Sempre termina sem erro para quem pede (a resposta é a mesma, exista ou não o
    /// e-mail, [project/security-06]); só o limite de tentativas pode recusar.
    pub async fn request_password_reset(
        &self,
        email: &str,
        client_ip: &str,
    ) -> Result<(), AuthError> {
        let key = format!("reset-ip:{client_ip}");
        self.ensure_not_locked(std::slice::from_ref(&key)).await?;
        self.register_failures(&[key]).await?;
        let email = normalize_email(email);
        let Some(smtp) = self.effective_smtp().await? else {
            return Ok(());
        };
        let user = {
            let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
            pg_users::find_by_email(&mut conn, &email).await?
        };
        let Some(user) = user.filter(|user| user.is_active) else {
            return Ok(());
        };
        let issued = self.issue_reset_token(&user, ResetOrigin::Email).await?;
        self.deliver_reset_mail(&smtp, &user, &issued.link).await;
        Ok(())
    }

    /// Link gerado pelo admin, para entregar por outro canal (RF-09).
    pub async fn admin_password_reset(
        &self,
        actor_id: Uuid,
        target_id: Uuid,
    ) -> Result<IssuedLink, AuthError> {
        let actor = self.active_user(actor_id).await?;
        if !actor.role.is_admin() {
            return Err(AuthError::Forbidden);
        }
        let target = {
            let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
            pg_users::find_by_id(&mut conn, target_id).await?
        };
        let target = target.ok_or(AuthError::UserNotFound)?;
        self.issue_reset_token(&target, ResetOrigin::Admin).await
    }

    /// Troca a senha com o token de uso único e encerra as outras sessões do usuário.
    pub async fn reset_password(&self, token: &str, password: &str) -> Result<(), AuthError> {
        validate_password(password)?;
        let password_hash = self.hash_password(password.to_owned()).await?;
        let now = self.clock.now();
        let mut tx = self.pool.begin().await.map_err(pg_users::internal)?;
        let user_id = pg_tokens::consume_reset_token(&mut tx, &hash_token(token), now)
            .await?
            .ok_or(AuthError::ResetTokenInvalid)?;
        pg_users::update_password(&mut tx, user_id, &password_hash, now).await?;
        pg_users::delete_sessions_of(&mut tx, user_id).await?;
        tx.commit().await.map_err(pg_users::internal)?;
        Ok(())
    }

    async fn issue_reset_token(
        &self,
        user: &User,
        origin: ResetOrigin,
    ) -> Result<IssuedLink, AuthError> {
        let now = self.clock.now();
        let token = OpaqueToken::generate();
        let record = ResetToken::issue(self.new_id(), user.id, origin, now);
        let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
        pg_tokens::insert_reset_token(&mut conn, &record, &token.hash, now).await?;
        Ok(IssuedLink {
            link: format!(
                "{}/reset-password/{}",
                self.config.public_url.trim_end_matches('/'),
                token.value
            ),
            expires_at: record.expires_at,
        })
    }

    /// Falha no envio vai só para o log, sem e-mail nem token ([project/security-13]).
    async fn deliver_reset_mail(&self, smtp: &SmtpSettings, user: &User, link: &str) {
        let mail = Mail {
            to: user.email.clone(),
            subject: "Redefinição de senha do Atria".to_owned(),
            body: format!(
                "Recebemos um pedido para redefinir a sua senha.\n\n\
                 Abra o link abaixo em até 30 minutos:\n{link}\n\n\
                 Se não foi você, ignore esta mensagem."
            ),
        };
        if let Err(error) = self.mailer.send(smtp, &mail).await {
            tracing::warn!(user_id = %user.id, %error, "falha ao enviar o e-mail de redefinição");
        }
    }

    /// SMTP efetivo: a instância tem prioridade sobre as variáveis `ATRIA_SMTP_*`;
    /// sem servidor nos dois lugares, nada é enviado.
    pub(crate) async fn effective_smtp(&self) -> Result<Option<SmtpSettings>, AuthError> {
        let settings = {
            let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
            pg_settings::get_instance(&mut conn).await?
        };
        let env = self.config.smtp.as_ref();
        let Some(host) = settings
            .smtp_host
            .clone()
            .or_else(|| env.map(|smtp| smtp.host.clone()))
        else {
            return Ok(None);
        };
        Ok(Some(SmtpSettings {
            host,
            port: settings
                .smtp_port
                .or_else(|| env.map(|smtp| smtp.port))
                .unwrap_or(587),
            user: settings
                .smtp_user
                .or_else(|| env.and_then(|smtp| smtp.user.clone())),
            password: env.and_then(|smtp| smtp.password.clone()),
            from: settings
                .smtp_from
                .or_else(|| env.and_then(|smtp| smtp.from.clone())),
        }))
    }
}
