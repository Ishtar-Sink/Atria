//! Repositório PostgreSQL das entradas do Diário: o texto só entra e sai cifrado
//! ([project/security-18]), com o id da linha como dado associado, e as emoções da
//! entrada são gravadas na mesma transação.
//!
//! As queries são checadas na compilação ([project/stack-04]), com os dados offline em `.sqlx`.

use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::pg_emotion_repository::system_key_from_db;
use crate::http::AppState;
use crate::journal::application::entries::{JournalReader, parse_sort_key};
use crate::journal::application::ports::{
    EntryEmotionView, EntryListFilter, JournalEntryRepository, JournalEntryView,
};
use crate::journal::domain::error::JournalError;
use crate::journal::domain::journal_entry::{EntryEmotion, JournalEntry};
use crate::shared::crypto::FieldCipher;
use crate::shared::db::begin_for_user;
use crate::shared::visibility::Visibility;

struct EntryRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    occurred_at: DateTime<Utc>,
    text_ciphertext: Vec<u8>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    deleted_at: Option<DateTime<Utc>>,
}

struct EmotionOfEntryRow {
    entry_id: Uuid,
    emotion_id: Uuid,
    intensity: Option<i16>,
    system_key: Option<String>,
    name: Option<String>,
    deleted: bool,
}

fn infra(error: impl std::error::Error + Send + Sync + 'static) -> JournalError {
    JournalError::infrastructure(error)
}

fn text_ad(id: Uuid) -> String {
    format!("journal_entries.text:{id}")
}

fn emotion_view(row: EmotionOfEntryRow) -> Result<EntryEmotionView, JournalError> {
    let intensity = row.intensity.map(u8::try_from).transpose().map_err(infra)?;
    Ok(EntryEmotionView {
        system_key: system_key_from_db(row.system_key.as_deref())?,
        emotion_id: row.emotion_id,
        intensity,
        name: row.name,
        deleted: row.deleted,
    })
}

async fn insert_emotions(
    tx: &mut Transaction<'_, Postgres>,
    entry: &JournalEntry,
) -> Result<(), sqlx::Error> {
    for emotion in &entry.emotions {
        sqlx::query!(
            "INSERT INTO journal_entry_emotions \
     (entry_id, emotion_id, owner_id, intensity) VALUES ($1, $2, $3, $4)",
            entry.id,
            emotion.emotion_id,
            entry.owner_id,
            emotion.intensity.map(i16::from)
        )
        .execute(&mut **tx)
        .await?;
    }
    Ok(())
}

#[derive(Clone)]
pub struct PgJournalEntryRepository {
    pool: PgPool,
    cipher: Arc<FieldCipher>,
}

impl PgJournalEntryRepository {
    pub fn new(pool: PgPool, cipher: Arc<FieldCipher>) -> Self {
        Self { pool, cipher }
    }

    pub fn from_state(state: &AppState) -> Self {
        Self::new(state.pool.clone(), state.cipher.clone())
    }

    fn encrypt(&self, entry: &JournalEntry) -> Result<Vec<u8>, JournalError> {
        self.cipher
            .encrypt(entry.text.as_bytes(), text_ad(entry.id).as_bytes())
            .map_err(infra)
    }

    fn decrypt(&self, row: &EntryRow) -> Result<String, JournalError> {
        let bytes = self
            .cipher
            .decrypt(&row.text_ciphertext, text_ad(row.id).as_bytes())
            .map_err(infra)?;
        String::from_utf8(bytes).map_err(infra)
    }

    /// Decifra as entradas e junta as emoções de cada uma, lidas na mesma transação.
    async fn to_views(
        &self,
        tx: &mut Transaction<'_, Postgres>,
        owner_id: Uuid,
        rows: Vec<EntryRow>,
    ) -> Result<Vec<JournalEntryView>, JournalError> {
        let ids: Vec<Uuid> = rows.iter().map(|row| row.id).collect();
        // As emoções de cada entrada, na ordem da lista de emoções, inclusive as excluídas.
        let emotion_rows = sqlx::query_as!(
            EmotionOfEntryRow,
            "SELECT marked.entry_id, marked.emotion_id, marked.intensity, \
     emotion.system_key, emotion.name, emotion.deleted_at IS NOT NULL AS \"deleted!\" \
     FROM journal_entry_emotions AS marked \
     JOIN emotions AS emotion ON emotion.id = marked.emotion_id \
     WHERE marked.owner_id = $1 AND marked.entry_id = ANY($2) \
     ORDER BY emotion.created_at, emotion.id",
            owner_id,
            &ids
        )
        .fetch_all(&mut **tx)
        .await
        .map_err(infra)?;
        let mut by_entry: HashMap<Uuid, Vec<EntryEmotionView>> = HashMap::new();
        for row in emotion_rows {
            let entry_id = row.entry_id;
            by_entry
                .entry(entry_id)
                .or_default()
                .push(emotion_view(row)?);
        }
        rows.into_iter()
            .map(|row| {
                let emotions = by_entry.remove(&row.id).unwrap_or_default();
                self.to_view(row, emotions)
            })
            .collect()
    }

    fn to_view(
        &self,
        row: EntryRow,
        emotions: Vec<EntryEmotionView>,
    ) -> Result<JournalEntryView, JournalError> {
        let entry = JournalEntry {
            text: self.decrypt(&row)?,
            emotions: emotions
                .iter()
                .map(|emotion| EntryEmotion {
                    emotion_id: emotion.emotion_id,
                    intensity: emotion.intensity,
                })
                .collect(),
            id: row.id,
            owner_id: row.owner_id,
            visibility: row.visibility,
            occurred_at: row.occurred_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
            deleted_at: row.deleted_at,
        };
        Ok(JournalEntryView { entry, emotions })
    }

    /// Completa as linhas lidas na transação do dono e a encerra.
    async fn finish(
        &self,
        mut tx: Transaction<'_, Postgres>,
        owner_id: Uuid,
        rows: Vec<EntryRow>,
    ) -> Result<Vec<JournalEntryView>, JournalError> {
        let views = self.to_views(&mut tx, owner_id, rows).await?;
        tx.commit().await.map_err(infra)?;
        Ok(views)
    }
}

impl JournalEntryRepository for PgJournalEntryRepository {
    async fn insert(&self, entry: &JournalEntry) -> Result<(), JournalError> {
        let text = self.encrypt(entry)?;
        let mut tx = begin_for_user(&self.pool, entry.owner_id)
            .await
            .map_err(infra)?;
        sqlx::query!(
            "INSERT INTO journal_entries (id, owner_id, visibility, occurred_at, \
             text_ciphertext, created_at, updated_at, deleted_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            entry.id,
            entry.owner_id,
            entry.visibility as _,
            entry.occurred_at as _,
            text,
            entry.created_at as _,
            entry.updated_at as _,
            entry.deleted_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        insert_emotions(&mut tx, entry).await.map_err(infra)?;
        tx.commit().await.map_err(infra)
    }

    async fn update(&self, entry: &JournalEntry) -> Result<(), JournalError> {
        let text = self.encrypt(entry)?;
        let mut tx = begin_for_user(&self.pool, entry.owner_id)
            .await
            .map_err(infra)?;
        let result = sqlx::query!(
            "UPDATE journal_entries SET visibility = $3, occurred_at = $4, \
             text_ciphertext = $5, updated_at = $6 \
             WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL",
            entry.owner_id,
            entry.id,
            entry.visibility as _,
            entry.occurred_at as _,
            text,
            entry.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        if result.rows_affected() == 0 {
            return Err(JournalError::EntryNotFound);
        }
        sqlx::query!(
            "DELETE FROM journal_entry_emotions WHERE owner_id = $1 AND entry_id = $2",
            entry.owner_id,
            entry.id
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        insert_emotions(&mut tx, entry).await.map_err(infra)?;
        tx.commit().await.map_err(infra)
    }

    async fn find_live(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> Result<Option<JournalEntryView>, JournalError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let rows = sqlx::query_as!(EntryRow, "SELECT id, owner_id, visibility AS \"visibility: _\", occurred_at AS \"occurred_at: _\", text_ciphertext, \
     created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", deleted_at AS \"deleted_at: _\" FROM journal_entries \
     WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL", owner_id, id)
        .fetch_all(&mut *tx)
        .await
        .map_err(infra)?;
        Ok(self.finish(tx, owner_id, rows).await?.into_iter().next())
    }

    async fn list_live(
        &self,
        owner_id: Uuid,
        filter: &EntryListFilter,
    ) -> Result<Vec<JournalEntryView>, JournalError> {
        let after_key = filter.after.as_ref().map(parse_sort_key).transpose()?;
        let after_id = filter.after.as_ref().map(|cursor| cursor.id);
        // Período com `from` incluso e `to` excluso; cada filtro ausente vira `NULL`.
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let rows = sqlx::query_as!(EntryRow, "SELECT id, owner_id, visibility AS \"visibility: _\", occurred_at AS \"occurred_at: _\", text_ciphertext, \
     created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", deleted_at AS \"deleted_at: _\" FROM journal_entries AS entry \
     WHERE owner_id = $1 AND deleted_at IS NULL \
       AND ($2::text IS NULL OR visibility = $2) \
       AND ($3::timestamptz IS NULL OR occurred_at >= $3) \
       AND ($4::timestamptz IS NULL OR occurred_at < $4) \
       AND ($5::uuid IS NULL OR EXISTS (SELECT 1 FROM journal_entry_emotions AS marked \
            WHERE marked.entry_id = entry.id AND marked.emotion_id = $5)) \
       AND ($6::timestamptz IS NULL OR (occurred_at, id) < ($6, $7)) \
     ORDER BY occurred_at DESC, id DESC LIMIT $8", owner_id, filter.visibility as _, filter.from as _, filter.to as _, filter.emotion_id, after_key as _, after_id, i64::from(filter.limit))
        .fetch_all(&mut *tx)
        .await
        .map_err(infra)?;
        self.finish(tx, owner_id, rows).await
    }

    async fn soft_delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        deleted_at: DateTime<Utc>,
    ) -> Result<bool, JournalError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let result = sqlx::query!(
            "UPDATE journal_entries SET deleted_at = $3, updated_at = $3 \
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

    async fn all_live_for_owner(
        &self,
        owner_id: Uuid,
    ) -> Result<Vec<JournalEntryView>, JournalError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let rows = sqlx::query_as!(EntryRow, "SELECT id, owner_id, visibility AS \"visibility: _\", occurred_at AS \"occurred_at: _\", text_ciphertext, \
     created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", deleted_at AS \"deleted_at: _\" FROM journal_entries \
     WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY occurred_at DESC, id DESC", owner_id)
        .fetch_all(&mut *tx)
        .await
        .map_err(infra)?;
        self.finish(tx, owner_id, rows).await
    }
}

impl JournalReader<PgJournalEntryRepository> {
    /// Leitor montado com o banco e o cifrador do servidor, para a busca (TASK-16) e o
    /// relatório do Diário (TASK-17).
    pub fn from_state(state: &AppState) -> Self {
        Self::new(PgJournalEntryRepository::from_state(state))
    }
}
