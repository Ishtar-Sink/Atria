//! Metadados dos arquivos em PostgreSQL e conteúdo no storage, com chave gerada pelo
//! servidor (`library/<owner_id>/<file_id>`), nunca vinda do cliente ([project/security-10]).

use std::sync::Arc;

use axum::body::Bytes;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::infra;
use crate::http::AppState;
use crate::library::application::ports::{FileStore, NewFile};
use crate::library::domain::error::LibraryError;
use crate::library::domain::library_file::{FileKind, LibraryFile};
use crate::shared::db::begin_for_user;
use crate::storage::{FileStorage, StorageError, StorageKey};

struct FileRow {
    id: Uuid,
    owner_id: Uuid,
    kind: String,
    content_type: String,
    size_bytes: i64,
    sha256: String,
    storage_key: String,
    created_at: DateTime<Utc>,
}

impl FileRow {
    fn into_file(self) -> Result<LibraryFile, LibraryError> {
        let kind = FileKind::parse(&self.kind)
            .ok_or_else(|| LibraryError::infrastructure("tipo de arquivo desconhecido no banco"))?;
        Ok(LibraryFile {
            id: self.id,
            owner_id: self.owner_id,
            kind,
            content_type: self.content_type,
            size_bytes: self.size_bytes,
            sha256: self.sha256,
            storage_key: self.storage_key,
            created_at: self.created_at,
        })
    }
}

#[derive(Clone)]
pub struct PgFileStore {
    pool: PgPool,
    storage: Arc<dyn FileStorage>,
}

impl PgFileStore {
    pub fn new(pool: PgPool, storage: Arc<dyn FileStorage>) -> Self {
        Self { pool, storage }
    }

    pub fn from_state(state: &AppState) -> Self {
        Self::new(state.pool.clone(), state.storage.clone())
    }

    async fn insert_row(&self, file: &LibraryFile) -> Result<(), LibraryError> {
        let mut tx = begin_for_user(&self.pool, file.owner_id)
            .await
            .map_err(infra)?;
        sqlx::query!(
            "INSERT INTO library_files (id, owner_id, kind, content_type, size_bytes, sha256, \
             storage_key, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)",
            file.id,
            file.owner_id,
            file.kind.as_str(),
            &file.content_type,
            file.size_bytes,
            &file.sha256,
            &file.storage_key,
            file.created_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)
    }
}

fn storage_key(key: &str) -> Result<StorageKey, LibraryError> {
    StorageKey::new(key).map_err(infra)
}

impl FileStore for PgFileStore {
    async fn save(&self, new: &NewFile, bytes: Bytes) -> Result<LibraryFile, LibraryError> {
        let key = storage_key(&LibraryFile::storage_key_for(new.owner_id, new.id))?;
        let stored = self.storage.put(&key, bytes).await.map_err(infra)?;
        let file = LibraryFile {
            id: new.id,
            owner_id: new.owner_id,
            kind: new.kind,
            content_type: new.content_type.to_owned(),
            size_bytes: i64::try_from(stored.size).map_err(infra)?,
            sha256: stored.sha256,
            storage_key: key.as_str().to_owned(),
            created_at: new.created_at,
        };
        if let Err(error) = self.insert_row(&file).await {
            // Sem a linha, o conteúdo ficaria órfão no storage.
            let _ = self.storage.delete(&key).await;
            return Err(error);
        }
        Ok(file)
    }

    async fn load(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> Result<Option<(LibraryFile, Bytes)>, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let row = sqlx::query_as!(FileRow, "SELECT id, owner_id, kind, content_type, size_bytes, sha256, storage_key, \
     created_at AS \"created_at: _\" FROM library_files WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL", owner_id, id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        let Some(row) = row else {
            return Ok(None);
        };
        let file = row.into_file()?;
        match self.storage.get(&storage_key(&file.storage_key)?).await {
            Ok(bytes) => Ok(Some((file, bytes))),
            Err(StorageError::NotFound) => Ok(None),
            Err(error) => Err(infra(error)),
        }
    }

    async fn discard(
        &self,
        owner_id: Uuid,
        id: Uuid,
        at: DateTime<Utc>,
    ) -> Result<(), LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let key = sqlx::query_scalar!(
            "UPDATE library_files SET deleted_at = $3, updated_at = $3 \
             WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL RETURNING storage_key",
            owner_id,
            id,
            at as _
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        let Some(key) = key else {
            return Ok(());
        };
        match self.storage.delete(&storage_key(&key)?).await {
            Ok(()) | Err(StorageError::NotFound) => Ok(()),
            Err(error) => Err(infra(error)),
        }
    }
}
