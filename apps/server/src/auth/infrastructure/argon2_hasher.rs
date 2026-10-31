//! Hash Argon2id das senhas ([project/security-01]).

use argon2::password_hash::phc::PasswordHash;
use argon2::{Argon2, PasswordHasher as _, PasswordVerifier as _};

use crate::auth::application::ports::PasswordHasher;
use crate::auth::domain::error::AuthError;

impl Default for Argon2Hasher {
    fn default() -> Self {
        Self::new()
    }
}

pub struct Argon2Hasher {
    argon2: Argon2<'static>,
    dummy_hash: String,
}

impl Argon2Hasher {
    /// Parâmetros padrão do crate (Argon2id v19, 19 MiB, 2 passes).
    pub fn new() -> Self {
        Self::with_argon2(Argon2::default())
    }

    /// Parâmetros baratos, só para a suíte de testes não gastar segundos por hash.
    #[cfg(test)]
    pub fn cheap() -> Self {
        use argon2::{Algorithm, Params, Version};

        let params = Params::new(8, 1, 1, None).unwrap();
        Self::with_argon2(Argon2::new(Algorithm::Argon2id, Version::V0x13, params))
    }

    fn with_argon2(argon2: Argon2<'static>) -> Self {
        // Se o hash de comparação falhar, a verificação falsa só fica mais rápida.
        let dummy_hash = hash_with(&argon2, "senha-de-comparacao").unwrap_or_default();
        Self { argon2, dummy_hash }
    }
}

fn hash_with(argon2: &Argon2<'_>, password: &str) -> Result<String, AuthError> {
    argon2
        .hash_password(password.as_bytes())
        .map(|hash| hash.to_string())
        .map_err(|error| AuthError::Internal(error.to_string()))
}

impl PasswordHasher for Argon2Hasher {
    fn hash(&self, password: &str) -> Result<String, AuthError> {
        hash_with(&self.argon2, password)
    }

    fn verify(&self, password: &str, hash: &str) -> bool {
        let Ok(parsed) = hash.parse::<PasswordHash>() else {
            return false;
        };
        self.argon2
            .verify_password(password.as_bytes(), &parsed)
            .is_ok()
    }

    fn verify_dummy(&self, password: &str) {
        let _ = self.verify(password, &self.dummy_hash);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hashes_with_argon2id_and_verifies() {
        let hasher = Argon2Hasher::cheap();
        let hash = hasher.hash("uma senha bem longa").unwrap();

        assert!(hash.starts_with("$argon2id$"));
        assert!(hasher.verify("uma senha bem longa", &hash));
        assert!(!hasher.verify("outra senha qualquer", &hash));
        assert!(!hasher.verify("x", "isto não é um hash"));
    }

    #[test]
    fn default_parameters_produce_argon2id() {
        let hasher = Argon2Hasher::new();

        assert!(hasher.hash("senha").unwrap().starts_with("$argon2id$"));
    }
}
