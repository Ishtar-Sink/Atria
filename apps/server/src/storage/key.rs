//! Chave de armazenamento gerada pelo servidor: segmentos `[a-z0-9-]+` separados
//! por `/`, sem `..` nem caminho absoluto ([project/security-10]).

use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
#[error("chave de armazenamento inválida")]
pub struct InvalidStorageKey;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct StorageKey(String);

impl StorageKey {
    pub fn new(key: &str) -> Result<Self, InvalidStorageKey> {
        let valid_segment = |s: &str| {
            !s.is_empty()
                && s.bytes()
                    .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        };
        if key.split('/').all(valid_segment) {
            return Ok(Self(key.to_owned()));
        }
        Err(InvalidStorageKey)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for StorageKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}
