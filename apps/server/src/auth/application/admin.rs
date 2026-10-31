//! Administração: usuários, convites, papéis, estado e configurações da instância
//! (RF-10 a RF-13, RF-60). Nenhuma operação devolve conteúdo de outro contexto (RN-13).

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::AuthService;
use crate::auth::domain::error::AuthError;
use crate::auth::domain::instance_settings::{InstanceSettings, InstanceSettingsPatch};
use crate::auth::domain::invite::{Invite, OpaqueToken};
use crate::auth::domain::user::{Role, User};
use crate::auth::infrastructure::{pg_settings, pg_tokens, pg_users};
use crate::shared::pagination::Cursor;

pub struct UserFilter {
    pub role: Option<Role>,
    pub query: Option<String>,
    pub cursor: Option<Cursor>,
    pub limit: u32,
}

pub struct UserPage {
    pub items: Vec<User>,
    pub next_cursor: Option<String>,
}

pub struct UserChange {
    pub role: Option<Role>,
    pub is_active: Option<bool>,
}

pub struct IssuedInvite {
    pub id: Uuid,
    pub link: String,
    pub expires_at: DateTime<Utc>,
}

pub struct InstanceState {
    pub version: &'static str,
    pub database_bytes: i64,
    pub storage_bytes: u64,
    pub healthy: bool,
    pub invite_required: bool,
    pub web_push_enabled: bool,
}

impl AuthService {
    async fn account_manager(&self, actor_id: Uuid) -> Result<User, AuthError> {
        let actor = self.active_user(actor_id).await?;
        if actor.role.can_manage_accounts() {
            Ok(actor)
        } else {
            Err(AuthError::Forbidden)
        }
    }

    async fn instance_admin(&self, actor_id: Uuid) -> Result<User, AuthError> {
        let actor = self.active_user(actor_id).await?;
        if actor.role.is_admin() {
            Ok(actor)
        } else {
            Err(AuthError::Forbidden)
        }
    }

    pub async fn list_users(
        &self,
        actor_id: Uuid,
        filter: UserFilter,
    ) -> Result<UserPage, AuthError> {
        self.account_manager(actor_id).await?;
        let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
        let limit = i64::from(filter.limit);
        let mut items = pg_users::list(&mut conn, &filter, limit + 1).await?;
        let has_more = items.len() > usize::try_from(limit).unwrap_or(usize::MAX);
        items.truncate(usize::try_from(limit).unwrap_or(usize::MAX));
        let next_cursor = match items.last() {
            Some(last) if has_more => {
                Some(Cursor::new(last.email.to_lowercase(), last.id).encode())
            }
            _ => None,
        };
        Ok(UserPage { items, next_cursor })
    }

    pub async fn change_user(
        &self,
        actor_id: Uuid,
        target_id: Uuid,
        change: UserChange,
    ) -> Result<User, AuthError> {
        let actor = self.account_manager(actor_id).await?;
        if change.role.is_some() && !actor.role.is_admin() {
            return Err(AuthError::Forbidden);
        }
        let mut tx = self.pool.begin().await.map_err(pg_users::internal)?;
        let target = pg_users::find_by_id(&mut tx, target_id)
            .await?
            .ok_or(AuthError::UserNotFound)?;
        let now = self.clock.now();
        if let Some(role) = change.role
            && role != target.role
        {
            if !actor.role.can_change_role(target.role, role) {
                return Err(AuthError::Forbidden);
            }
            pg_users::update_role(&mut tx, target.id, role, now).await?;
        }
        if let Some(is_active) = change.is_active {
            if !actor.role.can_change_state_of(target.role) {
                return Err(AuthError::Forbidden);
            }
            pg_users::update_active(&mut tx, target.id, is_active, now).await?;
            if !is_active {
                pg_users::delete_sessions_of(&mut tx, target.id).await?;
            }
        }
        let updated = pg_users::find_by_id(&mut tx, target.id)
            .await?
            .ok_or(AuthError::UserNotFound)?;
        tx.commit().await.map_err(pg_users::internal)?;
        Ok(updated)
    }

    /// O link leva o token em claro; ele existe só nesta resposta (RF-11).
    pub async fn create_invite(&self, actor_id: Uuid) -> Result<IssuedInvite, AuthError> {
        let actor = self.account_manager(actor_id).await?;
        let now = self.clock.now();
        let token = OpaqueToken::generate();
        let invite = Invite::issue(self.new_id(), actor.id, now);
        let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
        pg_tokens::insert_invite(&mut conn, &invite, &token.hash, now).await?;
        Ok(IssuedInvite {
            id: invite.id,
            link: format!(
                "{}/sign-up?invite={}",
                self.config.public_url.trim_end_matches('/'),
                token.value
            ),
            expires_at: invite.expires_at,
        })
    }

    pub async fn instance_state(&self, actor_id: Uuid) -> Result<InstanceState, AuthError> {
        self.account_manager(actor_id).await?;
        let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
        let settings = pg_settings::get_instance(&mut conn).await?;
        let database_bytes = pg_settings::database_bytes(&mut conn).await?;
        let healthy = pg_settings::ping(&mut conn).await;
        drop(conn);
        Ok(InstanceState {
            version: env!("CARGO_PKG_VERSION"),
            database_bytes,
            storage_bytes: storage_bytes(&self.config.storage_path).await,
            healthy,
            invite_required: settings.invite_required,
            web_push_enabled: settings.web_push_enabled,
        })
    }

    pub async fn instance_settings(&self, actor_id: Uuid) -> Result<InstanceSettings, AuthError> {
        self.instance_admin(actor_id).await?;
        let mut conn = self.pool.acquire().await.map_err(pg_users::internal)?;
        pg_settings::get_instance(&mut conn).await
    }

    pub async fn update_instance_settings(
        &self,
        actor_id: Uuid,
        patch: InstanceSettingsPatch,
    ) -> Result<InstanceSettings, AuthError> {
        self.instance_admin(actor_id).await?;
        let mut tx = self.pool.begin().await.map_err(pg_users::internal)?;
        let mut settings = pg_settings::get_instance(&mut tx).await?;
        settings.apply(patch)?;
        pg_settings::update_instance(&mut tx, &settings, self.clock.now()).await?;
        tx.commit().await.map_err(pg_users::internal)?;
        Ok(settings)
    }
}

/// Se o Web Push está ligado na instância. Sem ator: é lido pelo disparador de
/// lembretes e não devolve nenhuma outra configuração.
pub async fn web_push_enabled(pool: &PgPool) -> Result<bool, AuthError> {
    let mut conn = pool.acquire().await.map_err(pg_users::internal)?;
    let settings = pg_settings::get_instance(&mut conn).await?;
    Ok(settings.web_push_enabled)
}

/// Soma o tamanho dos arquivos da pasta de armazenamento. O módulo `storage` ainda não
/// expõe o espaço usado, então a leitura é direta; pasta ausente conta como zero.
async fn storage_bytes(root: &std::path::Path) -> u64 {
    let root = root.to_path_buf();
    tokio::task::spawn_blocking(move || directory_size(&root))
        .await
        .unwrap_or(0)
}

fn directory_size(path: &std::path::Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(path) else {
        return 0;
    };
    entries
        .filter_map(Result::ok)
        .map(|entry| match entry.metadata() {
            Ok(meta) if meta.is_dir() => directory_size(&entry.path()),
            Ok(meta) => meta.len(),
            Err(_) => 0,
        })
        .sum()
}
