//! Transferência entre duas contas distintas da mesma moeda (RF-29). Muda os dois
//! saldos e fica fora dos totais de entradas e saídas (RN-05).

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::finance::domain::FinanceError;
use crate::shared::money::Currency;
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Transfer {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub from_account_id: Uuid,
    pub to_account_id: Uuid,
    pub amount: i64,
    pub currency: Currency,
    pub transferred_on: NaiveDate,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Um lado da transferência: a conta e a moeda dela.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TransferEnd {
    pub account_id: Uuid,
    pub currency: Currency,
}

pub fn validate_transfer(
    from: TransferEnd,
    to: TransferEnd,
    amount: i64,
) -> Result<(), FinanceError> {
    if from.account_id == to.account_id {
        return Err(FinanceError::invalid("to_account_id", "same_account"));
    }
    if from.currency != to.currency {
        return Err(FinanceError::invalid("to_account_id", "currency_mismatch"));
    }
    if amount <= 0 {
        return Err(FinanceError::invalid("amount", "must_be_positive"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn end(id: u128, currency: &str) -> TransferEnd {
        TransferEnd {
            account_id: Uuid::from_u128(id),
            currency: Currency::new(currency).unwrap(),
        }
    }

    #[test]
    fn transfer_between_same_account_is_refused() {
        let result = validate_transfer(end(1, "BRL"), end(1, "BRL"), 1_000);

        assert!(
            matches!(result, Err(FinanceError::Validation(issues)) if issues[0].code == "same_account")
        );
        assert!(validate_transfer(end(1, "BRL"), end(2, "BRL"), 1_000).is_ok());
        assert!(validate_transfer(end(1, "BRL"), end(2, "BRL"), 0).is_err());
    }

    #[test]
    fn transfer_requires_same_currency() {
        let result = validate_transfer(end(1, "BRL"), end(2, "USD"), 1_000);

        assert!(
            matches!(result, Err(FinanceError::Validation(issues)) if issues[0].code == "currency_mismatch")
        );
    }
}
