//! Cifra de campo para diário e notas em repouso ([project/security-18]), com a
//! chave lida de um arquivo fora do banco.

use std::fmt;
use std::path::Path;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};

const VERSION: u8 = 0x01;
const KEY_LEN: usize = 32;
const NONCE_LEN: usize = 24;

#[derive(Debug, thiserror::Error)]
pub enum CipherError {
    #[error("não foi possível ler o arquivo da chave")]
    KeyFile(#[from] std::io::Error),
    #[error("a chave precisa ter 32 bytes em base64")]
    InvalidKey,
    #[error("falha ao cifrar")]
    Encrypt,
    #[error("texto cifrado inválido ou adulterado")]
    Decrypt,
}

pub struct FieldCipher {
    cipher: XChaCha20Poly1305,
}

impl FieldCipher {
    /// Lê a chave gerada com `openssl rand -base64 32`.
    pub fn from_key_file(path: &Path) -> Result<Self, CipherError> {
        let text = std::fs::read_to_string(path)?;
        let key = STANDARD
            .decode(text.trim())
            .map_err(|_| CipherError::InvalidKey)?;
        Self::from_key(&key)
    }

    pub fn from_key(key: &[u8]) -> Result<Self, CipherError> {
        if key.len() != KEY_LEN {
            return Err(CipherError::InvalidKey);
        }
        let cipher = XChaCha20Poly1305::new_from_slice(key).map_err(|_| CipherError::InvalidKey)?;
        Ok(Self { cipher })
    }

    /// Formato: versão (1 byte) + nonce aleatório (24 bytes) + texto cifrado. O dado
    /// associado (`<tabela>.<coluna>:<id>`) impede mover o valor para outra linha.
    pub fn encrypt(
        &self,
        plaintext: &[u8],
        associated_data: &[u8],
    ) -> Result<Vec<u8>, CipherError> {
        let mut nonce_bytes = [0u8; NONCE_LEN];
        rand::fill(&mut nonce_bytes);
        let nonce = XNonce::from(nonce_bytes);
        let payload = Payload {
            msg: plaintext,
            aad: associated_data,
        };
        let ciphertext = self
            .cipher
            .encrypt(&nonce, payload)
            .map_err(|_| CipherError::Encrypt)?;
        let mut out = Vec::with_capacity(1 + NONCE_LEN + ciphertext.len());
        out.push(VERSION);
        out.extend_from_slice(&nonce_bytes);
        out.extend_from_slice(&ciphertext);
        Ok(out)
    }

    pub fn decrypt(&self, data: &[u8], associated_data: &[u8]) -> Result<Vec<u8>, CipherError> {
        let Some((&VERSION, rest)) = data.split_first() else {
            return Err(CipherError::Decrypt);
        };
        if rest.len() < NONCE_LEN {
            return Err(CipherError::Decrypt);
        }
        let (nonce_bytes, ciphertext) = rest.split_at(NONCE_LEN);
        let nonce_array: [u8; NONCE_LEN] =
            nonce_bytes.try_into().map_err(|_| CipherError::Decrypt)?;
        let payload = Payload {
            msg: ciphertext,
            aad: associated_data,
        };
        self.cipher
            .decrypt(&XNonce::from(nonce_array), payload)
            .map_err(|_| CipherError::Decrypt)
    }
}

impl fmt::Debug for FieldCipher {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("FieldCipher(..)")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    const KEY: [u8; 32] = [7u8; 32];
    const AD: &[u8] = b"notes.body:0192f0c8-7a1b-7c3e-9a4d-1f2e3d4c5b6a";

    fn cipher() -> FieldCipher {
        FieldCipher::from_key(&KEY).unwrap()
    }

    fn key_file(content: &str) -> tempfile::NamedTempFile {
        let mut file = tempfile::NamedTempFile::new().unwrap();
        file.write_all(content.as_bytes()).unwrap();
        file
    }

    #[test]
    fn encrypt_decrypt_round_trip() {
        let file = key_file(&format!("{}\n", STANDARD.encode(KEY)));
        let cipher = FieldCipher::from_key_file(file.path()).unwrap();
        let encrypted = cipher.encrypt("diário de hoje".as_bytes(), AD).unwrap();

        assert_eq!(encrypted[0], VERSION);
        assert_eq!(
            cipher.decrypt(&encrypted, AD).unwrap(),
            "diário de hoje".as_bytes()
        );
    }

    #[test]
    fn ciphertext_does_not_contain_plaintext() {
        let plaintext = b"marcador-secreto-ct26";
        let first = cipher().encrypt(plaintext, AD).unwrap();
        let second = cipher().encrypt(plaintext, AD).unwrap();

        assert!(!first.windows(plaintext.len()).any(|w| w == plaintext));
        assert_ne!(first, second, "o nonce aleatório muda o texto cifrado");
    }

    #[test]
    fn tampered_ciphertext_is_rejected() {
        let mut encrypted = cipher().encrypt(b"texto", AD).unwrap();
        let last = encrypted.len() - 1;
        encrypted[last] ^= 0x01;

        assert!(matches!(
            cipher().decrypt(&encrypted, AD),
            Err(CipherError::Decrypt)
        ));
        assert!(matches!(
            cipher().decrypt(&[0x02; 60], AD),
            Err(CipherError::Decrypt)
        ));
        assert!(matches!(
            cipher().decrypt(&[VERSION; 5], AD),
            Err(CipherError::Decrypt)
        ));
    }

    #[test]
    fn wrong_associated_data_is_rejected() {
        let encrypted = cipher().encrypt(b"texto", AD).unwrap();

        assert!(matches!(
            cipher().decrypt(&encrypted, b"notes.title:outro"),
            Err(CipherError::Decrypt)
        ));
    }

    #[test]
    fn key_file_with_wrong_length_is_rejected() {
        let short = key_file(&STANDARD.encode([1u8; 16]));
        let not_base64 = key_file("isto não é base64");

        assert!(matches!(
            FieldCipher::from_key_file(short.path()),
            Err(CipherError::InvalidKey)
        ));
        assert!(matches!(
            FieldCipher::from_key_file(not_base64.path()),
            Err(CipherError::InvalidKey)
        ));
    }

    #[test]
    fn debug_does_not_print_key() {
        let text = format!("{:?}", cipher());

        assert_eq!(text, "FieldCipher(..)");
        assert!(!text.contains("7"));
    }
}
