//! Conta: comum ou cartão de crédito, a conta padrão por usuário e a regra de
//! exclusão dela (RF-24, RF-25, RF-26, RN-04).

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::finance::domain::credit_card::CardCycle;
use crate::finance::domain::{FinanceError, required_name};
use crate::shared::money::Currency;
use crate::shared::visibility::Visibility;

pub const DEFAULT_ACCOUNT_NAME: &str = "Conta principal";
pub const NAME_MAX_CHARS: usize = 80;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccountKind {
    Standard,
    CreditCard,
}

impl AccountKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Standard => "standard",
            Self::CreditCard => "credit_card",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "standard" => Some(Self::Standard),
            "credit_card" => Some(Self::CreditCard),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CreditCardTerms {
    pub credit_limit_amount: i64,
    pub cycle: CardCycle,
}

/// Campos do cartão como chegam do pedido, ainda sem validação.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct CardFields {
    pub credit_limit_amount: Option<i64>,
    pub closing_day: Option<u32>,
    pub due_day: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Account {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub name: String,
    pub kind: AccountKind,
    pub is_default: bool,
    pub balance_amount: i64,
    pub currency: Currency,
    pub card: Option<CreditCardTerms>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Account {
    /// A conta padrão nasce comum, em BRL (RN-18) e com saldo zero.
    pub fn default_for(owner_id: Uuid, id: Uuid, now: DateTime<Utc>) -> Self {
        Self {
            id,
            owner_id,
            visibility: Visibility::Personal,
            name: DEFAULT_ACCOUNT_NAME.to_owned(),
            kind: AccountKind::Standard,
            is_default: true,
            balance_amount: 0,
            currency: Currency::default(),
            card: None,
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

/// Cartão exige limite, fechamento e vencimento; conta comum não aceita nenhum deles.
pub fn credit_card_terms(
    kind: AccountKind,
    fields: CardFields,
) -> Result<Option<CreditCardTerms>, FinanceError> {
    if kind == AccountKind::Standard {
        if fields != CardFields::default() {
            return Err(FinanceError::invalid(
                "kind",
                "card_fields_require_credit_card",
            ));
        }
        return Ok(None);
    }
    let credit_limit_amount = fields
        .credit_limit_amount
        .ok_or_else(|| FinanceError::invalid("credit_limit_amount", "required"))?;
    if credit_limit_amount < 0 {
        return Err(FinanceError::invalid(
            "credit_limit_amount",
            "must_not_be_negative",
        ));
    }
    let closing_day = fields
        .closing_day
        .ok_or_else(|| FinanceError::invalid("closing_day", "required"))?;
    let due_day = fields
        .due_day
        .ok_or_else(|| FinanceError::invalid("due_day", "required"))?;
    Ok(Some(CreditCardTerms {
        credit_limit_amount,
        cycle: CardCycle::new(closing_day, due_day)?,
    }))
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

    #[test]
    fn credit_card_requires_limit_closing_and_due_days() {
        let complete = CardFields {
            credit_limit_amount: Some(500_000),
            closing_day: Some(10),
            due_day: Some(17),
        };

        let terms = credit_card_terms(AccountKind::CreditCard, complete)
            .unwrap()
            .unwrap();

        assert_eq!(terms.credit_limit_amount, 500_000);
        assert_eq!(terms.cycle, CardCycle::new(10, 17).unwrap());
        for missing in [
            CardFields {
                credit_limit_amount: None,
                ..complete
            },
            CardFields {
                closing_day: None,
                ..complete
            },
            CardFields {
                due_day: None,
                ..complete
            },
            CardFields {
                closing_day: Some(32),
                ..complete
            },
            CardFields {
                credit_limit_amount: Some(-1),
                ..complete
            },
        ] {
            assert!(credit_card_terms(AccountKind::CreditCard, missing).is_err());
        }
        assert!(credit_card_terms(AccountKind::Standard, complete).is_err());
        assert_eq!(
            credit_card_terms(AccountKind::Standard, CardFields::default()).unwrap(),
            None
        );
    }
}
