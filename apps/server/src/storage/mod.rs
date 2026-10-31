//! Armazenamento de arquivos (PDFs e capas) atrás de uma interface que permite
//! trocar o disco local por um storage compatível com S3 ([project/stack-11]).

pub mod key;
pub mod local;

use std::future::Future;
use std::pin::Pin;

use axum::body::Bytes;

pub use key::StorageKey;

#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("arquivo não encontrado")]
    NotFound,
    #[error("chave de armazenamento inválida")]
    InvalidKey,
    #[error("falha de E/S no armazenamento")]
    Io(#[from] std::io::Error),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredFile {
    pub size: u64,
    pub sha256: String,
}

pub type StorageFuture<'a, T> = Pin<Box<dyn Future<Output = Result<T, StorageError>> + Send + 'a>>;

/// Sem `async_trait`: os métodos devolvem futures em caixa para o trait ser usado
/// como `Arc<dyn FileStorage>`.
pub trait FileStorage: Send + Sync {
    fn put<'a>(&'a self, key: &'a StorageKey, bytes: Bytes) -> StorageFuture<'a, StoredFile>;
    fn get<'a>(&'a self, key: &'a StorageKey) -> StorageFuture<'a, Bytes>;
    fn delete<'a>(&'a self, key: &'a StorageKey) -> StorageFuture<'a, ()>;
    fn exists<'a>(&'a self, key: &'a StorageKey) -> StorageFuture<'a, bool>;
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::local::LocalFileStorage;
    use super::*;

    fn storage() -> (tempfile::TempDir, Arc<dyn FileStorage>) {
        let dir = tempfile::tempdir().unwrap();
        let storage = Arc::new(LocalFileStorage::new(dir.path()));
        (dir, storage)
    }

    fn key(text: &str) -> StorageKey {
        StorageKey::new(text).unwrap()
    }

    #[tokio::test]
    async fn put_get_delete_round_trip() {
        let (_dir, storage) = storage();
        let key = key("library/0192f0c8/file-1");

        storage
            .put(&key, Bytes::from_static(b"%PDF-1.7"))
            .await
            .unwrap();
        assert!(storage.exists(&key).await.unwrap());
        assert_eq!(
            storage.get(&key).await.unwrap(),
            Bytes::from_static(b"%PDF-1.7")
        );

        storage.delete(&key).await.unwrap();
        assert!(!storage.exists(&key).await.unwrap());
    }

    #[tokio::test]
    async fn put_returns_size_and_sha256() {
        let (_dir, storage) = storage();

        let stored = storage
            .put(&key("a/b"), Bytes::from_static(b"abc"))
            .await
            .unwrap();

        assert_eq!(stored.size, 3);
        assert_eq!(
            stored.sha256,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }

    #[test]
    fn rejects_path_traversal_keys() {
        for bad in [
            "../x",
            "/etc/passwd",
            "a//b",
            "",
            "a/../b",
            "A/b",
            "a/b/",
            "a\\b",
            "a.pdf",
        ] {
            assert!(StorageKey::new(bad).is_err(), "deveria recusar {bad:?}");
        }
        assert_eq!(key("library/abc-123/0192").as_str(), "library/abc-123/0192");
    }

    #[tokio::test]
    async fn write_is_atomic_without_partial_file() {
        let (dir, storage) = storage();
        let key = key("covers/one");
        storage
            .put(&key, Bytes::from(vec![1u8; 1024]))
            .await
            .unwrap();

        storage
            .put(&key, Bytes::from(vec![2u8; 4096]))
            .await
            .unwrap();

        assert_eq!(
            storage.get(&key).await.unwrap(),
            Bytes::from(vec![2u8; 4096])
        );
        let leftovers: Vec<_> = std::fs::read_dir(dir.path().join("covers"))
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .filter(|name| name != "one")
            .collect();
        assert!(
            leftovers.is_empty(),
            "sobrou arquivo temporário: {leftovers:?}"
        );
    }

    #[tokio::test]
    async fn get_missing_file_returns_not_found() {
        let (_dir, storage) = storage();

        assert!(matches!(
            storage.get(&key("nada")).await,
            Err(StorageError::NotFound)
        ));
        assert!(matches!(
            storage.delete(&key("nada")).await,
            Err(StorageError::NotFound)
        ));
    }
}
