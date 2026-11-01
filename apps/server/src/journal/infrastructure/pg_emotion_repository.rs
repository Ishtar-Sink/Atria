//! Repositório PostgreSQL da lista de emoções.
//!
//! As queries são checadas na compilação ([project/stack-04]), com os dados offline em `.sqlx`.

use chrono::{DateTime, Utc};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::http::AppState;
use crate::journal::application::ports::EmotionRepository;
use crate::journal::domain::emotion::{Emotion, EmotionIcon, SystemEmotion};
use crate::journal::domain::error::JournalError;
use crate::shared::db::begin_for_user;
use crate::shared::visibility::Visibility;

const NAME_UNIQUE_INDEX: &str = "emotions_owner_name_uniq";

struct EmotionRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    system_key: Option<String>,
    name: Option<String>,
    icon: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    deleted_at: Option<DateTime<Utc>>,
}

fn infra(error: impl std::error::Error + Send + Sync + 'static) -> JournalError {
    JournalError::infrastructure(error)
}

/// Converte a violação do nome único em `EmotionNameTaken`; o resto é infraestrutura.
fn write_error(error: sqlx::Error) -> JournalError {
    match &error {
        sqlx::Error::Database(db) if db.constraint() == Some(NAME_UNIQUE_INDEX) => {
            JournalError::EmotionNameTaken
        }
        _ => infra(error),
    }
}

/// Chave padrão lida do banco; o `CHECK` da coluna garante que ela é conhecida.
pub(crate) fn system_key_from_db(key: Option<&str>) -> Result<Option<SystemEmotion>, JournalError> {
    key.map(|key| {
        SystemEmotion::from_key(key)
            .ok_or_else(|| JournalError::infrastructure("chave de emoção padrão desconhecida"))
    })
    .transpose()
}

impl TryFrom<EmotionRow> for Emotion {
    type Error = JournalError;

    fn try_from(row: EmotionRow) -> Result<Self, Self::Error> {
        Ok(Self {
            system_key: system_key_from_db(row.system_key.as_deref())?,
            id: row.id,
            owner_id: row.owner_id,
            visibility: row.visibility,
            name: row.name,
            icon: row
                .icon
                .map(|key| {
                    EmotionIcon::from_key(&key)
                        .ok_or_else(|| JournalError::infrastructure("ícone de emoção desconhecido"))
                })
                .transpose()?,
            created_at: row.created_at,
            updated_at: row.updated_at,
            deleted_at: row.deleted_at,
        })
    }
}

async fn insert_in(
    tx: &mut Transaction<'_, Postgres>,
    emotion: &Emotion,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO emotions (id, owner_id, visibility, system_key, name, icon, \
         created_at, updated_at, deleted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        emotion.id,
        emotion.owner_id,
        emotion.visibility as _,
        emotion.system_key.map(SystemEmotion::key),
        emotion.name.as_deref(),
        emotion.icon.map(EmotionIcon::key),
        emotion.created_at as _,
        emotion.updated_at as _,
        emotion.deleted_at as _
    )
    .execute(&mut **tx)
    .await
    .map(|_| ())
}

/// Dois primeiros acessos ao mesmo tempo semeiam uma vez só: o índice único da chave
/// padrão descarta a segunda cópia.
async fn insert_ignoring_existing(
    tx: &mut Transaction<'_, Postgres>,
    emotion: &Emotion,
) -> Result<(), sqlx::Error> {
    sqlx::query!(
        "INSERT INTO emotions (id, owner_id, visibility, system_key, name, icon, \
         created_at, updated_at, deleted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
         ON CONFLICT DO NOTHING",
        emotion.id,
        emotion.owner_id,
        emotion.visibility as _,
        emotion.system_key.map(SystemEmotion::key),
        emotion.name.as_deref(),
        emotion.icon.map(EmotionIcon::key),
        emotion.created_at as _,
        emotion.updated_at as _,
        emotion.deleted_at as _
    )
    .execute(&mut **tx)
    .await
    .map(|_| ())
}

#[derive(Clone)]
pub struct PgEmotionRepository {
    pool: PgPool,
}

impl PgEmotionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn from_state(state: &AppState) -> Self {
        Self::new(state.pool.clone())
    }
}

impl EmotionRepository for PgEmotionRepository {
    async fn list_live(&self, owner_id: Uuid) -> Result<Vec<Emotion>, JournalError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let rows = sqlx::query_as!(EmotionRow, "SELECT id, owner_id, visibility AS \"visibility: _\", system_key, name, icon, created_at AS \"created_at: _\", \
     updated_at AS \"updated_at: _\", deleted_at AS \"deleted_at: _\" FROM emotions \
     WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY created_at, id", owner_id)
            .fetch_all(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        rows.into_iter().map(Emotion::try_from).collect()
    }

    async fn find_live(&self, owner_id: Uuid, id: Uuid) -> Result<Option<Emotion>, JournalError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let row = sqlx::query_as!(EmotionRow, "SELECT id, owner_id, visibility AS \"visibility: _\", system_key, name, icon, created_at AS \"created_at: _\", \
     updated_at AS \"updated_at: _\", deleted_at AS \"deleted_at: _\" FROM emotions \
     WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL", owner_id, id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        row.map(Emotion::try_from).transpose()
    }

    async fn count_all_including_deleted(&self, owner_id: Uuid) -> Result<i64, JournalError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let count = sqlx::query_scalar!(
            r#"SELECT count(*) AS "count!" FROM emotions WHERE owner_id = $1"#,
            owner_id
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(count)
    }

    async fn insert_many(&self, owner_id: Uuid, emotions: &[Emotion]) -> Result<(), JournalError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        for emotion in emotions.iter().filter(|e| e.owner_id == owner_id) {
            insert_ignoring_existing(&mut tx, emotion)
                .await
                .map_err(infra)?;
        }
        tx.commit().await.map_err(infra)
    }

    async fn insert(&self, emotion: &Emotion) -> Result<(), JournalError> {
        let mut tx = begin_for_user(&self.pool, emotion.owner_id)
            .await
            .map_err(infra)?;
        insert_in(&mut tx, emotion).await.map_err(write_error)?;
        tx.commit().await.map_err(infra)
    }

    async fn update(&self, emotion: &Emotion) -> Result<(), JournalError> {
        let mut tx = begin_for_user(&self.pool, emotion.owner_id)
            .await
            .map_err(infra)?;
        let result = sqlx::query!(
            "UPDATE emotions SET name = $3, visibility = $4, updated_at = $5, icon = $6 \
             WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL",
            emotion.owner_id,
            emotion.id,
            emotion.name.as_deref(),
            emotion.visibility as _,
            emotion.updated_at as _,
            emotion.icon.map(EmotionIcon::key)
        )
        .execute(&mut *tx)
        .await
        .map_err(write_error)?;
        if result.rows_affected() == 0 {
            return Err(JournalError::EmotionNotFound);
        }
        tx.commit().await.map_err(infra)
    }

    async fn soft_delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        deleted_at: DateTime<Utc>,
    ) -> Result<bool, JournalError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let result = sqlx::query!(
            "UPDATE emotions SET deleted_at = $3, updated_at = $3 \
             WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL",
            owner_id,
            id,
            deleted_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(result.rows_affected() == 1)
    }

    async fn find_live_ids_for_owner(
        &self,
        owner_id: Uuid,
        ids: &[Uuid],
    ) -> Result<Vec<Uuid>, JournalError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let found = sqlx::query_scalar!(
            "SELECT id FROM emotions \
             WHERE owner_id = $1 AND id = ANY($2) AND deleted_at IS NULL",
            owner_id,
            ids
        )
        .fetch_all(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(found)
    }
}
