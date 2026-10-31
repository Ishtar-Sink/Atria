//! Convite de cadastro: uso único, com expiração (RN-11). O token é aleatório e só o
//! hash SHA-256 é guardado ([project/security-05]).

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::{DateTime, Duration, Utc};
use sha2::{Digest, Sha256};
use uuid::Uuid;

#[cfg(test)]
use super::error::AuthError;

pub const INVITE_TTL_DAYS: i64 = 7;

/// Token entregue uma única vez; o banco guarda só o hash.
#[derive(Debug, Clone)]
pub struct OpaqueToken {
    pub value: String,
    pub hash: Vec<u8>,
}

impl OpaqueToken {
    /// 32 bytes aleatórios em base64url.
    pub fn generate() -> Self {
        let mut bytes = [0u8; 32];
        rand::fill(&mut bytes);
        let value = URL_SAFE_NO_PAD.encode(bytes);
        let hash = hash_token(&value);
        Self { value, hash }
    }
}

pub fn hash_token(token: &str) -> Vec<u8> {
    Sha256::digest(token.as_bytes()).to_vec()
}

#[derive(Debug, Clone)]
pub struct Invite {
    pub id: Uuid,
    pub created_by: Uuid,
    pub expires_at: DateTime<Utc>,
    // O uso em produção é marcado no próprio `UPDATE` (pg_tokens); a regra fica nos testes.
    #[cfg(test)]
    pub used_at: Option<DateTime<Utc>>,
}

impl Invite {
    pub fn issue(id: Uuid, created_by: Uuid, now: DateTime<Utc>) -> Self {
        Self {
            id,
            created_by,
            expires_at: now + Duration::days(INVITE_TTL_DAYS),
            #[cfg(test)]
            used_at: None,
        }
    }

    #[cfg(test)]
    pub fn is_valid(&self, now: DateTime<Utc>) -> bool {
        self.used_at.is_none() && now < self.expires_at
    }

    /// Marca o uso; um convite usado ou vencido é recusado.
    #[cfg(test)]
    pub fn consume(&mut self, now: DateTime<Utc>) -> Result<(), AuthError> {
        if !self.is_valid(now) {
            return Err(AuthError::InviteInvalid);
        }
        self.used_at = Some(now);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> DateTime<Utc> {
        "2026-11-01T12:00:00Z".parse().unwrap()
    }

    #[test]
    fn invite_is_valid_once() {
        let mut invite = Invite::issue(Uuid::from_u128(1), Uuid::from_u128(2), now());

        assert!(invite.is_valid(now()));
        assert!(invite.consume(now()).is_ok());
        assert!(!invite.is_valid(now()));
        assert!(matches!(
            invite.consume(now()),
            Err(AuthError::InviteInvalid)
        ));
    }

    #[test]
    fn expired_invite_is_invalid() {
        let invite = Invite::issue(Uuid::from_u128(1), Uuid::from_u128(2), now());

        assert!(invite.is_valid(now() + Duration::days(7) - Duration::seconds(1)));
        assert!(!invite.is_valid(now() + Duration::days(7)));
    }

    #[test]
    fn token_is_random_and_stored_as_hash() {
        let first = OpaqueToken::generate();
        let second = OpaqueToken::generate();

        assert_ne!(first.value, second.value);
        assert_eq!(first.hash, hash_token(&first.value));
        assert_eq!(first.hash.len(), 32);
        assert_eq!(URL_SAFE_NO_PAD.decode(&first.value).unwrap().len(), 32);
    }
}
