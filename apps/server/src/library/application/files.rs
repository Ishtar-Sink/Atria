//! Arquivos do Acervo: gravação conferida pelo conteúdo e leitura só pelo dono (RN-25).

use axum::body::Bytes;
use uuid::Uuid;

use super::Env;
use super::ports::{FileStore, NewFile};
use crate::library::domain::error::LibraryError;
use crate::library::domain::library_file::{
    DetectedFile, FileKind, LibraryFile, THUMBNAIL_MAX_BYTES, validate_upload,
};

pub struct FileService<F> {
    store: F,
    env: Env,
}

impl<F: FileStore> FileService<F> {
    pub fn new(store: F, env: Env) -> Self {
        Self { store, env }
    }

    /// Confere tipo e tamanho pelo conteúdo e grava; o tipo declarado pelo cliente é ignorado.
    pub async fn store_upload(
        &self,
        owner_id: Uuid,
        bytes: Bytes,
        expected: FileKind,
    ) -> Result<LibraryFile, LibraryError> {
        let detected = validate_upload(&bytes, expected)?;
        self.save(owner_id, detected, bytes).await
    }

    /// Miniatura buscada na internet: imagem de até 2 MiB, com assinatura válida.
    pub async fn store_thumbnail(
        &self,
        owner_id: Uuid,
        bytes: Bytes,
    ) -> Result<LibraryFile, LibraryError> {
        if bytes.len() > THUMBNAIL_MAX_BYTES {
            return Err(LibraryError::FileTooLarge);
        }
        let detected = validate_upload(&bytes, FileKind::Image)?;
        self.save(owner_id, detected, bytes).await
    }

    async fn save(
        &self,
        owner_id: Uuid,
        detected: DetectedFile,
        bytes: Bytes,
    ) -> Result<LibraryFile, LibraryError> {
        let new = NewFile {
            id: self.env.ids.new_id(),
            owner_id,
            kind: detected.kind,
            content_type: detected.content_type,
            created_at: self.env.clock.now(),
        };
        self.store.save(&new, bytes).await
    }

    /// Descarta o arquivo trocado; a falha só vai para o log, porque o item já aponta
    /// para o arquivo novo e o conteúdo órfão não afeta quem usa o Acervo.
    pub async fn discard(&self, owner_id: Uuid, id: Uuid) {
        let at = self.env.clock.now();
        if self.store.discard(owner_id, id, at).await.is_err() {
            tracing::warn!("falha ao descartar um arquivo substituído do Acervo");
        }
    }

    /// Arquivo e conteúdo; 404 para quem não é o dono (RN-25).
    pub async fn read(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> Result<(LibraryFile, Bytes), LibraryError> {
        self.store
            .load(owner_id, id)
            .await?
            .ok_or(LibraryError::FileNotFound)
    }
}
