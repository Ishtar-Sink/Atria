//! Leitura e atualização das preferências do próprio usuário (RF-58, RF-59).

use uuid::Uuid;

use super::AuthService;
use crate::auth::domain::error::AuthError;
use crate::auth::domain::preferences::{Preferences, PreferencesPatch};
use crate::auth::infrastructure::{pg_settings, pg_users};
use crate::shared::db::begin_for_user;

impl AuthService {
    pub async fn preferences(&self, user_id: Uuid) -> Result<Preferences, AuthError> {
        let mut tx = begin_for_user(&self.pool, user_id)
            .await
            .map_err(pg_users::internal)?;
        let stored = pg_settings::get_preferences(&mut tx, user_id).await?;
        Ok(stored.unwrap_or_default())
    }

    pub async fn update_preferences(
        &self,
        user_id: Uuid,
        patch: PreferencesPatch,
    ) -> Result<Preferences, AuthError> {
        let mut tx = begin_for_user(&self.pool, user_id)
            .await
            .map_err(pg_users::internal)?;
        let mut preferences = pg_settings::get_preferences(&mut tx, user_id)
            .await?
            .unwrap_or_default();
        preferences.apply(patch)?;
        pg_settings::upsert_preferences(&mut tx, user_id, &preferences, self.clock.now()).await?;
        tx.commit().await.map_err(pg_users::internal)?;
        Ok(preferences)
    }
}
