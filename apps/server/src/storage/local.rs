//! Armazenamento em disco local, em `ATRIA_STORAGE_PATH` ([project/stack-11]).

use std::io::{ErrorKind, SeekFrom};
use std::path::PathBuf;

use axum::body::Bytes;
use sha2::{Digest, Sha256};
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt};
use uuid::Uuid;

use super::{FileStorage, StorageError, StorageFuture, StorageKey, StoredFile};

#[derive(Debug, Clone)]
pub struct LocalFileStorage {
    root: PathBuf,
}

impl LocalFileStorage {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    fn path(&self, key: &StorageKey) -> PathBuf {
        self.root.join(key.as_str())
    }
}

fn not_found_as(error: std::io::Error) -> StorageError {
    if error.kind() == ErrorKind::NotFound {
        return StorageError::NotFound;
    }
    StorageError::Io(error)
}

/// Grava num arquivo temporário da mesma pasta, sincroniza e renomeia: quem lê
/// nunca vê um arquivo pela metade.
async fn write_atomically(path: PathBuf, bytes: Bytes) -> Result<StoredFile, StorageError> {
    let parent = path.parent().ok_or(StorageError::InvalidKey)?.to_path_buf();
    tokio::fs::create_dir_all(&parent).await?;
    let temp = parent.join(format!(".tmp-{}", Uuid::now_v7().simple()));
    let result = async {
        let mut file = tokio::fs::File::create(&temp).await?;
        file.write_all(&bytes).await?;
        file.sync_all().await?;
        tokio::fs::rename(&temp, &path).await
    }
    .await;
    if let Err(error) = result {
        let _ = tokio::fs::remove_file(&temp).await;
        return Err(StorageError::Io(error));
    }
    Ok(StoredFile {
        size: bytes.len() as u64,
        sha256: hex(&Sha256::digest(&bytes)),
    })
}

/// Teto da reserva inicial do buffer: um `len` enorme não aloca antes de ler.
const RANGE_BUFFER_CAP: usize = 1024 * 1024;

async fn read_range(path: PathBuf, start: u64, len: u64) -> Result<Bytes, StorageError> {
    let mut file = tokio::fs::File::open(path).await.map_err(not_found_as)?;
    file.seek(SeekFrom::Start(start)).await?;
    let capacity = usize::try_from(len).map_or(RANGE_BUFFER_CAP, |len| len.min(RANGE_BUFFER_CAP));
    let mut buffer = Vec::with_capacity(capacity);
    file.take(len).read_to_end(&mut buffer).await?;
    Ok(Bytes::from(buffer))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

impl FileStorage for LocalFileStorage {
    fn put<'a>(&'a self, key: &'a StorageKey, bytes: Bytes) -> StorageFuture<'a, StoredFile> {
        Box::pin(write_atomically(self.path(key), bytes))
    }

    fn get<'a>(&'a self, key: &'a StorageKey) -> StorageFuture<'a, Bytes> {
        Box::pin(async move {
            let bytes = tokio::fs::read(self.path(key))
                .await
                .map_err(not_found_as)?;
            Ok(Bytes::from(bytes))
        })
    }

    fn get_range<'a>(
        &'a self,
        key: &'a StorageKey,
        start: u64,
        len: u64,
    ) -> StorageFuture<'a, Bytes> {
        Box::pin(read_range(self.path(key), start, len))
    }

    fn delete<'a>(&'a self, key: &'a StorageKey) -> StorageFuture<'a, ()> {
        Box::pin(async move {
            tokio::fs::remove_file(self.path(key))
                .await
                .map_err(not_found_as)
        })
    }

    fn exists<'a>(&'a self, key: &'a StorageKey) -> StorageFuture<'a, bool> {
        Box::pin(async move { Ok(tokio::fs::try_exists(self.path(key)).await?) })
    }
}
