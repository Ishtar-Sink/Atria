//! Usuário, papel e regras de quem gere quem (RN-12, RN-13).

use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Admin,
    Elevated,
    User,
}

impl Role {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Admin => "admin",
            Self::Elevated => "elevated",
            Self::User => "user",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "admin" => Some(Self::Admin),
            "elevated" => Some(Self::Elevated),
            "user" => Some(Self::User),
            _ => None,
        }
    }

    /// Gera convites, lista contas e lê o estado da instância.
    pub fn can_manage_accounts(self) -> bool {
        matches!(self, Self::Admin | Self::Elevated)
    }

    /// Muda papéis, configurações da instância e gera links de redefinição:
    /// exclusivo do admin (RN-12).
    pub fn is_admin(self) -> bool {
        self == Self::Admin
    }

    /// O admin gere qualquer conta que não seja a dele; o `elevated`, só as `user`.
    pub fn can_change_state_of(self, target: Role) -> bool {
        match self {
            Self::Admin => target != Self::Admin,
            Self::Elevated => target == Self::User,
            Self::User => false,
        }
    }

    /// Só o admin muda papéis, e só entre `elevated` e `user`: o admin é único.
    pub fn can_change_role(self, from: Role, to: Role) -> bool {
        self.is_admin() && from != Self::Admin && to != Self::Admin
    }
}

#[derive(Debug, Clone)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub role: Role,
    pub is_active: bool,
    pub totp_secret_encrypted: Option<Vec<u8>>,
    pub totp_pending_secret_encrypted: Option<Vec<u8>>,
    pub totp_enabled_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl User {
    pub fn totp_enabled(&self) -> bool {
        self.totp_enabled_at.is_some()
    }

    /// O admin só usa a instância depois de ativar o 2FA (RF-07).
    pub fn is_complete(&self) -> bool {
        self.role != Role::Admin || self.totp_enabled()
    }
}

/// E-mail em minúsculas e sem espaços nas pontas: a chave de comparação.
pub fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn user(role: Role, totp: bool) -> User {
        let now: DateTime<Utc> = "2026-11-01T12:00:00Z".parse().unwrap();
        User {
            id: Uuid::from_u128(1),
            email: "a@example.com".to_owned(),
            password_hash: String::new(),
            role,
            is_active: true,
            totp_secret_encrypted: None,
            totp_pending_secret_encrypted: None,
            totp_enabled_at: totp.then_some(now),
            created_at: now,
        }
    }

    #[test]
    fn elevated_cannot_change_roles() {
        assert!(!Role::Elevated.can_change_role(Role::User, Role::Elevated));
        assert!(!Role::Elevated.can_change_role(Role::Elevated, Role::User));
        assert!(!Role::Elevated.is_admin());
    }

    #[test]
    fn elevated_can_deactivate_only_user_role() {
        assert!(Role::Elevated.can_change_state_of(Role::User));
        assert!(!Role::Elevated.can_change_state_of(Role::Elevated));
        assert!(!Role::Elevated.can_change_state_of(Role::Admin));
        assert!(!Role::User.can_change_state_of(Role::User));
    }

    #[test]
    fn admin_grants_and_revokes_elevated() {
        assert!(Role::Admin.can_change_role(Role::User, Role::Elevated));
        assert!(Role::Admin.can_change_role(Role::Elevated, Role::User));
        assert!(!Role::Admin.can_change_role(Role::User, Role::Admin));
        assert!(!Role::Admin.can_change_role(Role::Admin, Role::User));
    }

    #[test]
    fn admin_without_totp_is_incomplete() {
        assert!(!user(Role::Admin, false).is_complete());
        assert!(user(Role::Admin, true).is_complete());
        assert!(user(Role::User, false).is_complete());
    }

    #[test]
    fn email_is_normalized() {
        assert_eq!(normalize_email("  Ana@Example.COM "), "ana@example.com");
    }

    #[test]
    fn role_round_trips_through_text() {
        for role in [Role::Admin, Role::Elevated, Role::User] {
            assert_eq!(Role::parse(role.as_str()), Some(role));
        }
        assert_eq!(Role::parse("root"), None);
    }
}
