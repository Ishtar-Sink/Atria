//! Liquidação: diferença entre o efetivo e o previsto, o tipo dela (RN-02, RN-03) e o
//! efeito no saldo da conta (RN-01). Com descontos e acréscimos, a diferença é sempre entre
//! os líquidos, liquidado e previsto (SPEC-004, RN-08).

use chrono::NaiveDate;

use crate::finance::domain::FinanceError;
use crate::finance::domain::transaction::TransactionKind;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DifferenceKind {
    Saving,
    Gain,
    Loss,
}

impl DifferenceKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Saving => "saving",
            Self::Gain => "gain",
            Self::Loss => "loss",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "saving" => Some(Self::Saving),
            "gain" => Some(Self::Gain),
            "loss" => Some(Self::Loss),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Settlement {
    pub settled_amount: i64,
    pub settled_at: NaiveDate,
    pub difference_amount: i64,
    pub difference_kind: Option<DifferenceKind>,
    /// Bruto liquidado; igual ao liquidado sem itens (RN-09). A movimentação com itens troca pelo bruto equivalente (RF-09).
    pub gross_amount: i64,
}

/// `difference_amount = settled_amount - expected_amount`.
pub fn settle(
    kind: TransactionKind,
    expected_amount: i64,
    settled_amount: i64,
    settled_at: NaiveDate,
) -> Result<Settlement, FinanceError> {
    if settled_amount < 0 {
        return Err(FinanceError::invalid(
            "settled_amount",
            "must_not_be_negative",
        ));
    }
    let difference_amount = settled_amount
        .checked_sub(expected_amount)
        .ok_or_else(|| FinanceError::invalid("settled_amount", "too_large"))?;
    Ok(Settlement {
        settled_amount,
        settled_at,
        difference_amount,
        difference_kind: difference_kind(kind, difference_amount),
        gross_amount: settled_amount,
    })
}

/// Saída: pagar menos é economia, pagar mais é perda. Entrada: receber mais é ganho,
/// receber menos é perda. Sem diferença, sem tipo.
pub fn difference_kind(kind: TransactionKind, difference_amount: i64) -> Option<DifferenceKind> {
    match (kind, difference_amount.signum()) {
        (_, 0) => None,
        (TransactionKind::Expense, -1) => Some(DifferenceKind::Saving),
        (TransactionKind::Income, 1) => Some(DifferenceKind::Gain),
        _ => Some(DifferenceKind::Loss),
    }
}

/// Entrada soma o efetivo ao saldo; saída subtrai.
pub fn balance_delta(kind: TransactionKind, settled_amount: i64) -> i64 {
    match kind {
        TransactionKind::Income => settled_amount,
        TransactionKind::Expense => -settled_amount,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day() -> NaiveDate {
        "2026-11-03".parse().unwrap()
    }

    #[test]
    fn adj_ct08_difference_uses_net_amounts() {
        let result = settle(TransactionKind::Income, 708_000, 700_000, day()).unwrap();

        assert_eq!(result.difference_amount, -8_000);
        assert_eq!(result.difference_kind, Some(DifferenceKind::Loss));
        assert_eq!(result.gross_amount, 700_000);
    }

    #[test]
    fn expense_settled_below_expected_is_saving() {
        let result = settle(TransactionKind::Expense, 150_000, 145_000, day()).unwrap();

        assert_eq!(result.difference_amount, -5_000);
        assert_eq!(result.difference_kind, Some(DifferenceKind::Saving));
    }

    #[test]
    fn expense_settled_above_expected_is_loss() {
        let result = settle(TransactionKind::Expense, 10_000, 12_500, day()).unwrap();

        assert_eq!(result.difference_amount, 2_500);
        assert_eq!(result.difference_kind, Some(DifferenceKind::Loss));
    }

    #[test]
    fn income_settled_above_expected_is_gain() {
        let result = settle(TransactionKind::Income, 500_000, 520_000, day()).unwrap();

        assert_eq!(result.difference_amount, 20_000);
        assert_eq!(result.difference_kind, Some(DifferenceKind::Gain));
    }

    #[test]
    fn income_settled_below_expected_is_loss() {
        let result = settle(TransactionKind::Income, 500_000, 480_000, day()).unwrap();

        assert_eq!(result.difference_amount, -20_000);
        assert_eq!(result.difference_kind, Some(DifferenceKind::Loss));
    }

    #[test]
    fn settled_equal_to_expected_has_no_difference() {
        let result = settle(TransactionKind::Expense, 10_000, 10_000, day()).unwrap();

        assert_eq!(result.difference_amount, 0);
        assert_eq!(result.difference_kind, None);
        assert_eq!(result.settled_at, day());
    }

    #[test]
    fn settlement_changes_balance_by_settled_amount() {
        assert_eq!(balance_delta(TransactionKind::Income, 520_000), 520_000);
        assert_eq!(balance_delta(TransactionKind::Expense, 145_000), -145_000);
        assert!(settle(TransactionKind::Expense, 10_000, -1, day()).is_err());
    }
}
