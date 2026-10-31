//! Token de redefinição de senha: uso único, com prazo por origem
//! ([project/security-06]).

use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

#[cfg(test)]
use super::error::AuthError;

pub const EMAIL_TTL_MINUTES: i64 = 30;
pub const ADMIN_TTL_HOURS: i64 = 24;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResetOrigin {
    Email,
    Admin,
}

impl ResetOrigin {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Email => "email",
            Self::Admin => "admin",
        }
    }

    pub fn ttl(self) -> Duration {
        match self {
            Self::Email => Duration::minutes(EMAIL_TTL_MINUTES),
            Self::Admin => Duration::hours(ADMIN_TTL_HOURS),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ResetToken {
    pub id: Uuid,
    pub user_id: Uuid,
    pub origin: ResetOrigin,
    pub expires_at: DateTime<Utc>,
    // O uso em produção é marcado no próprio `UPDATE` (pg_tokens); a regra fica nos testes.
    #[cfg(test)]
    pub used_at: Option<DateTime<Utc>>,
}

impl ResetToken {
    pub fn issue(id: Uuid, user_id: Uuid, origin: ResetOrigin, now: DateTime<Utc>) -> Self {
        Self {
            id,
            user_id,
            origin,
            expires_at: now + origin.ttl(),
            #[cfg(test)]
            used_at: None,
        }
    }

    #[cfg(test)]
    pub fn is_valid(&self, now: DateTime<Utc>) -> bool {
        self.used_at.is_none() && now < self.expires_at
    }

    #[cfg(test)]
    pub fn consume(&mut self, now: DateTime<Utc>) -> Result<(), AuthError> {
        if !self.is_valid(now) {
            return Err(AuthError::ResetTokenInvalid);
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

    fn token(origin: ResetOrigin) -> ResetToken {
        ResetToken::issue(Uuid::from_u128(1), Uuid::from_u128(2), origin, now())
    }

    #[test]
    fn reset_token_is_single_use() {
        let mut token = token(ResetOrigin::Email);

        assert!(token.consume(now()).is_ok());
        assert!(matches!(
            token.consume(now()),
            Err(AuthError::ResetTokenInvalid)
        ));
    }

    #[test]
    fn email_token_expires_in_30_minutes() {
        let token = token(ResetOrigin::Email);

        assert!(token.is_valid(now() + Duration::minutes(29)));
        assert!(!token.is_valid(now() + Duration::minutes(30)));
    }

    #[test]
    fn admin_token_expires_in_24_hours() {
        let token = token(ResetOrigin::Admin);

        assert!(token.is_valid(now() + Duration::hours(23)));
        assert!(!token.is_valid(now() + Duration::hours(24)));
    }
}
