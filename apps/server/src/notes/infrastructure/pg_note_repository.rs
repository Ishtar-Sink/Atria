//! Repositório PostgreSQL de notas: título e corpo só entram e saem cifrados
//! ([project/security-18]), com o id da linha como dado associado.
//!
//! As queries são checadas na compilação ([project/stack-04]), com os dados offline em `.sqlx`.

use std::sync::Arc;

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::http::AppState;
use crate::notes::application::ports::{NoteListFilter, NoteRepository, NoteSort};
use crate::notes::application::service::{NoteReader, parse_sort_key};
use crate::notes::domain::error::NoteError;
use crate::notes::domain::note::Note;
use crate::shared::crypto::FieldCipher;
use crate::shared::db::begin_for_user;
use crate::shared::visibility::Visibility;

struct NoteRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    title_ciphertext: Vec<u8>,
    body_ciphertext: Vec<u8>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    deleted_at: Option<DateTime<Utc>>,
}

#[derive(Clone)]
pub struct PgNoteRepository {
    pool: PgPool,
    cipher: Arc<FieldCipher>,
}

fn infra(error: impl std::error::Error + Send + Sync + 'static) -> NoteError {
    NoteError::infrastructure(error)
}

fn title_ad(id: Uuid) -> String {
    format!("notes.title:{id}")
}

fn body_ad(id: Uuid) -> String {
    format!("notes.body:{id}")
}

impl PgNoteRepository {
    pub fn new(pool: PgPool, cipher: Arc<FieldCipher>) -> Self {
        Self { pool, cipher }
    }

    pub fn from_state(state: &AppState) -> Self {
        Self::new(state.pool.clone(), state.cipher.clone())
    }

    fn encrypt(&self, note: &Note) -> Result<(Vec<u8>, Vec<u8>), NoteError> {
        let title = self
            .cipher
            .encrypt(note.title.as_bytes(), title_ad(note.id).as_bytes())
            .map_err(infra)?;
        let body = self
            .cipher
            .encrypt(note.body.as_bytes(), body_ad(note.id).as_bytes())
            .map_err(infra)?;
        Ok((title, body))
    }

    fn decrypt_text(&self, data: &[u8], associated_data: &str) -> Result<String, NoteError> {
        let bytes = self
            .cipher
            .decrypt(data, associated_data.as_bytes())
            .map_err(infra)?;
        String::from_utf8(bytes).map_err(infra)
    }

    fn to_note(&self, row: NoteRow) -> Result<Note, NoteError> {
        Ok(Note {
            title: self.decrypt_text(&row.title_ciphertext, &title_ad(row.id))?,
            body: self.decrypt_text(&row.body_ciphertext, &body_ad(row.id))?,
            id: row.id,
            owner_id: row.owner_id,
            visibility: row.visibility,
            created_at: row.created_at,
            updated_at: row.updated_at,
            deleted_at: row.deleted_at,
        })
    }

    fn to_notes(&self, rows: Vec<NoteRow>) -> Result<Vec<Note>, NoteError> {
        rows.into_iter().map(|row| self.to_note(row)).collect()
    }
}

impl NoteRepository for PgNoteRepository {
    async fn insert(&self, note: &Note) -> Result<(), NoteError> {
        let (title, body) = self.encrypt(note)?;
        let mut tx = begin_for_user(&self.pool, note.owner_id)
            .await
            .map_err(infra)?;
        sqlx::query!(
            "INSERT INTO notes (id, owner_id, visibility, title_ciphertext, body_ciphertext, \
             created_at, updated_at, deleted_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            note.id,
            note.owner_id,
            note.visibility as _,
            title,
            body,
            note.created_at as _,
            note.updated_at as _,
            note.deleted_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)
    }

    async fn update(&self, note: &Note) -> Result<(), NoteError> {
        let (title, body) = self.encrypt(note)?;
        let mut tx = begin_for_user(&self.pool, note.owner_id)
            .await
            .map_err(infra)?;
        let result = sqlx::query!(
            "UPDATE notes SET visibility = $3, title_ciphertext = $4, body_ciphertext = $5, \
             updated_at = $6 WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL",
            note.owner_id,
            note.id,
            note.visibility as _,
            title,
            body,
            note.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        if result.rows_affected() == 0 {
            return Err(NoteError::NotFound);
        }
        tx.commit().await.map_err(infra)
    }

    async fn find_live(&self, owner_id: Uuid, id: Uuid) -> Result<Option<Note>, NoteError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let row = sqlx::query_as!(NoteRow, "SELECT id, owner_id, visibility AS \"visibility: _\", title_ciphertext, \
     body_ciphertext, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", deleted_at AS \"deleted_at: _\" FROM notes \
     WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL", owner_id, id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        row.map(|row| self.to_note(row)).transpose()
    }

    async fn list_live(
        &self,
        owner_id: Uuid,
        filter: &NoteListFilter,
    ) -> Result<Vec<Note>, NoteError> {
        let after_key = filter.after.as_ref().map(parse_sort_key).transpose()?;
        let after_id = filter.after.as_ref().map(|cursor| cursor.id);
        let limit = i64::from(filter.limit);
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        // Uma query por ordenação: a coluna nunca vem da entrada do usuário.
        let rows = match filter.sort {
            NoteSort::UpdatedAt => {
                sqlx::query_as!(NoteRow, "SELECT id, owner_id, visibility AS \"visibility: _\", title_ciphertext, \
     body_ciphertext, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", deleted_at AS \"deleted_at: _\" FROM notes \
     WHERE owner_id = $1 AND deleted_at IS NULL \
       AND ($2::text IS NULL OR visibility = $2) \
       AND ($3::timestamptz IS NULL OR (updated_at, id) < ($3, $4)) \
     ORDER BY updated_at DESC, id DESC LIMIT $5", owner_id, filter.visibility as _, after_key as _, after_id, limit)
                    .fetch_all(&mut *tx)
                    .await
            }
            NoteSort::CreatedAt => {
                sqlx::query_as!(NoteRow, "SELECT id, owner_id, visibility AS \"visibility: _\", title_ciphertext, \
     body_ciphertext, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", deleted_at AS \"deleted_at: _\" FROM notes \
     WHERE owner_id = $1 AND deleted_at IS NULL \
       AND ($2::text IS NULL OR visibility = $2) \
       AND ($3::timestamptz IS NULL OR (created_at, id) < ($3, $4)) \
     ORDER BY created_at DESC, id DESC LIMIT $5", owner_id, filter.visibility as _, after_key as _, after_id, limit)
                    .fetch_all(&mut *tx)
                    .await
            }
        }
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        self.to_notes(rows)
    }

    async fn soft_delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        deleted_at: DateTime<Utc>,
    ) -> Result<bool, NoteError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let result = sqlx::query!(
            "UPDATE notes SET deleted_at = $3, updated_at = $3 \
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

    async fn all_live_for_owner(&self, owner_id: Uuid) -> Result<Vec<Note>, NoteError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let rows = sqlx::query_as!(NoteRow, "SELECT id, owner_id, visibility AS \"visibility: _\", title_ciphertext, \
     body_ciphertext, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", deleted_at AS \"deleted_at: _\" FROM notes \
     WHERE owner_id = $1 AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC", owner_id)
            .fetch_all(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        self.to_notes(rows)
    }
}

impl NoteReader<PgNoteRepository> {
    /// Leitor montado com o banco e o cifrador do servidor, para a busca (TASK-16).
    pub fn from_state(state: &AppState) -> Self {
        Self::new(PgNoteRepository::from_state(state))
    }
}
