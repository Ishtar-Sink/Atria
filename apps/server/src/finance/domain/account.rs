//! Conta, a conta padrão por usuário e a regra de exclusão dela (RF-24, RF-25,
//! RF-26, RN-04).

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::finance::domain::{FinanceError, required_name};
use crate::shared::money::Currency;
use crate::shared::visibility::Visibility;

pub const DEFAULT_ACCOUNT_NAME: &str = "Conta principal";
pub const NAME_MAX_CHARS: usize = 80;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Account {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub name: String,
    pub is_default: bool,
    pub balance_amount: i64,
    pub currency: Currency,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Account {
    /// A conta padrão nasce em BRL (RN-18) e com saldo zero.
    pub fn default_for(owner_id: Uuid, id: Uuid, now: DateTime<Utc>) -> Self {
        Self {
            id,
            owner_id,
            visibility: Visibility::Personal,
            name: DEFAULT_ACCOUNT_NAME.to_owned(),
            is_default: true,
            balance_amount: 0,
            currency: Currency::default(),
            created_at: now,
            updated_at: now,
        }
    }

    pub fn ensure_deletable(&self) -> Result<(), FinanceError> {
        if self.is_default {
            return Err(FinanceError::DefaultAccountNotDeletable);
        }
        Ok(())
    }

    /// Qualquer conta pode ser renomeada, inclusive a padrão (RN-04).
    pub fn rename(&mut self, name: &str, now: DateTime<Utc>) -> Result<(), FinanceError> {
        self.name = validate_name(name)?;
        self.updated_at = now;
        Ok(())
    }
}

pub fn validate_name(name: &str) -> Result<String, FinanceError> {
    required_name(name, "name", NAME_MAX_CHARS)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::finance::domain::transaction::fixtures::instant;

    fn account(is_default: bool) -> Account {
        Account {
            is_default,
            ..Account::default_for(Uuid::from_u128(1), Uuid::from_u128(2), instant())
        }
    }

    #[test]
    fn default_account_cannot_be_deleted() {
        assert!(matches!(
            account(true).ensure_deletable(),
            Err(FinanceError::DefaultAccountNotDeletable)
        ));
        assert!(account(false).ensure_deletable().is_ok());
    }

    #[test]
    fn default_account_can_be_renamed() {
        let mut default = account(true);

        default.rename("  Conta do dia a dia ", instant()).unwrap();

        assert_eq!(default.name, "Conta do dia a dia");
        assert!(default.rename("   ", instant()).is_err());
        assert!(default.rename(&"x".repeat(81), instant()).is_err());
    }
}
