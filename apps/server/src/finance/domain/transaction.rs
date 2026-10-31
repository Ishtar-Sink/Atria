//! Movimentação (entrada ou saída) com valores previstos e efetivos em centavos, o
//! estado da liquidação, a data efetiva e o status (RF-27, RF-32, PD-51, PD-55), a
//! edição e o desfazer da liquidação (DEC-005).

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::finance::domain::credit_card::{CardCycle, StatementPeriod};
use crate::finance::domain::settlement::{self, Settlement};
use crate::finance::domain::{FinanceError, optional_text};
use crate::shared::money::Currency;
use crate::shared::visibility::Visibility;

pub const DESCRIPTION_MAX_CHARS: usize = 200;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TransactionKind {
    Income,
    Expense,
}

impl TransactionKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Income => "income",
            Self::Expense => "expense",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        match text {
            "income" => Some(Self::Income),
            "expense" => Some(Self::Expense),
            _ => None,
        }
    }

    /// Valor com o sinal do efeito no saldo: entrada soma, saída subtrai.
    pub fn signed(self, amount: i64) -> i64 {
        match self {
            Self::Income => amount,
            Self::Expense => -amount,
        }
    }
}

/// Situação de um item da listagem: liquidado, aberto, atrasado ou previsto (a
/// ocorrência futura de uma recorrente, calculada sem gravar linha).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ItemStatus {
    Settled,
    Open,
    Overdue,
    Forecast,
}

impl ItemStatus {
    /// Aberto até a data prevista; atrasado depois dela, até ser liquidado.
    pub fn pending(expected_date: NaiveDate, today: NaiveDate) -> Self {
        if expected_date < today {
            return Self::Overdue;
        }
        Self::Open
    }
}

/// Campos de uma edição; os ausentes ficam como estão. A descrição vazia apaga a
/// atual.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TransactionEdit {
    pub description: Option<String>,
    pub expected_amount: Option<i64>,
    pub expected_date: Option<NaiveDate>,
    /// A conta nova e a moeda dela.
    pub account: Option<(Uuid, Currency)>,
    pub category_id: Option<Uuid>,
    pub visibility: Option<Visibility>,
}

impl TransactionEdit {
    /// Valor, data e conta já entraram no saldo de uma liquidada.
    fn touches_settled_fields(&self) -> bool {
        self.expected_amount.is_some() || self.expected_date.is_some() || self.account.is_some()
    }

    fn moves_installment(&self) -> bool {
        self.expected_date.is_some() || self.account.is_some()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Installment {
    pub number: u32,
    pub total: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Transaction {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub kind: TransactionKind,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub description: Option<String>,
    pub expected_amount: i64,
    pub expected_date: NaiveDate,
    pub currency: Currency,
    pub settlement: Option<Settlement>,
    /// Recorrente de onde veio a cópia liquidada; a cópia em si não tem recorrência.
    pub generated_from: Option<Uuid>,
    /// Data da ocorrência que a cópia liquidou.
    pub occurrence_date: Option<NaiveDate>,
    pub installment: Option<Installment>,
    pub installment_group_id: Option<Uuid>,
    pub statement_period: Option<StatementPeriod>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Transaction {
    /// Liquida com o valor e a data efetivos e devolve a variação do saldo da conta
    /// (RN-01). Uma movimentação liquidada não é liquidada de novo.
    pub fn settle(
        &mut self,
        settled_amount: i64,
        settled_at: NaiveDate,
        now: DateTime<Utc>,
    ) -> Result<i64, FinanceError> {
        if self.settlement.is_some() {
            return Err(FinanceError::TransactionAlreadySettled);
        }
        let result =
            settlement::settle(self.kind, self.expected_amount, settled_amount, settled_at)?;
        self.settlement = Some(result);
        self.updated_at = now;
        Ok(settlement::balance_delta(self.kind, settled_amount))
    }

    /// Variação que a movimentação já aplicou no saldo: zero enquanto prevista.
    pub fn applied_balance_delta(&self) -> i64 {
        self.settlement.as_ref().map_or(0, |done| {
            settlement::balance_delta(self.kind, done.settled_amount)
        })
    }

    pub fn is_settled(&self) -> bool {
        self.settlement.is_some()
    }

    /// Aplica a edição sem mexer no saldo (RN-01). A liquidada só muda descrição,
    /// categoria e visibilidade; a parcela não muda de conta nem de data. `cycle` é o
    /// ciclo da conta final, quando ela é um cartão, para recalcular a fatura.
    pub fn apply_edit(
        &mut self,
        edit: &TransactionEdit,
        cycle: Option<CardCycle>,
        now: DateTime<Utc>,
    ) -> Result<(), FinanceError> {
        if self.is_settled() && edit.touches_settled_fields() {
            return Err(FinanceError::TransactionAlreadySettled);
        }
        if self.installment_group_id.is_some() && edit.moves_installment() {
            return Err(FinanceError::InstallmentNotEditable);
        }
        if let Some(amount) = edit.expected_amount {
            validate_expected_amount(amount)?;
            self.expected_amount = amount;
        }
        if let Some(text) = edit.description.clone() {
            self.description = optional_text(Some(text), "description", DESCRIPTION_MAX_CHARS)?;
        }
        if let Some((account_id, currency)) = edit.account {
            self.account_id = account_id;
            self.currency = currency;
        }
        if let Some(date) = edit.expected_date {
            self.expected_date = date;
        }
        if edit.moves_installment() {
            self.statement_period = cycle.map(|cycle| cycle.statement_for(self.expected_date));
        }
        if let Some(category_id) = edit.category_id {
            self.category_id = Some(category_id);
        }
        if let Some(visibility) = edit.visibility {
            self.visibility = visibility;
        }
        self.updated_at = now;
        Ok(())
    }

    /// Desfaz a liquidação: volta a ficar prevista e devolve a variação do saldo que
    /// reverte o efeito dela.
    pub fn undo_settlement(&mut self, now: DateTime<Utc>) -> Result<i64, FinanceError> {
        if !self.is_settled() {
            return Err(FinanceError::TransactionNotSettled);
        }
        let revert = -self.applied_balance_delta();
        self.settlement = None;
        self.updated_at = now;
        Ok(revert)
    }

    /// Data da liquidação, quando liquidada, e a prevista nos outros casos (PD-55).
    pub fn effective_date(&self) -> NaiveDate {
        self.settlement
            .map_or(self.expected_date, |done| done.settled_at)
    }

    /// O valor liquidado, quando liquidada, e o previsto nos outros casos.
    pub fn value(&self) -> i64 {
        self.settlement
            .map_or(self.expected_amount, |done| done.settled_amount)
    }

    pub fn status(&self, today: NaiveDate) -> ItemStatus {
        if self.is_settled() {
            return ItemStatus::Settled;
        }
        ItemStatus::pending(self.expected_date, today)
    }
}

pub fn validate_expected_amount(amount: i64) -> Result<(), FinanceError> {
    if amount <= 0 {
        return Err(FinanceError::invalid("expected_amount", "must_be_positive"));
    }
    Ok(())
}

#[cfg(test)]
pub(crate) mod fixtures {
    use super::*;

    pub fn date(text: &str) -> NaiveDate {
        text.parse().unwrap()
    }

    pub fn instant() -> DateTime<Utc> {
        crate::http::test_support::TEST_INSTANT.parse().unwrap()
    }

    pub fn transaction(kind: TransactionKind, expected_amount: i64) -> Transaction {
        Transaction {
            id: Uuid::from_u128(10),
            owner_id: Uuid::from_u128(1),
            visibility: Visibility::Personal,
            kind,
            account_id: Uuid::from_u128(2),
            category_id: None,
            description: None,
            expected_amount,
            expected_date: date("2026-11-05"),
            currency: Currency::default(),
            settlement: None,
            generated_from: None,
            occurrence_date: None,
            installment: None,
            installment_group_id: None,
            statement_period: None,
            created_at: instant(),
            updated_at: instant(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::fixtures::{date, instant, transaction};
    use super::*;

    #[test]
    fn settled_transaction_cannot_be_settled_again() {
        let mut expense = transaction(TransactionKind::Expense, 10_000);
        expense
            .settle(9_000, date("2026-11-04"), instant())
            .unwrap();

        let again = expense.settle(9_000, date("2026-11-04"), instant());

        assert!(matches!(
            again,
            Err(FinanceError::TransactionAlreadySettled)
        ));
        assert_eq!(expense.applied_balance_delta(), -9_000);
    }

    #[test]
    fn expected_amount_must_be_positive() {
        assert!(validate_expected_amount(0).is_err());
        assert!(validate_expected_amount(-1).is_err());
        assert!(validate_expected_amount(1).is_ok());
    }

    #[test]
    fn unsettled_transaction_edit_accepts_all_editable_fields() {
        let mut item = transaction(TransactionKind::Expense, 10_000);
        let card = CardCycle::new(10, 17).unwrap();
        let edit = TransactionEdit {
            description: Some("  Conta de luz ".to_owned()),
            expected_amount: Some(12_000),
            expected_date: Some(date("2026-11-15")),
            account: Some((Uuid::from_u128(3), Currency::default())),
            category_id: Some(Uuid::from_u128(4)),
            visibility: Some(Visibility::Shared),
        };

        item.apply_edit(&edit, Some(card), instant()).unwrap();

        assert_eq!(item.description.as_deref(), Some("Conta de luz"));
        assert_eq!(item.expected_amount, 12_000);
        assert_eq!(item.expected_date, date("2026-11-15"));
        assert_eq!(item.account_id, Uuid::from_u128(3));
        assert_eq!(item.category_id, Some(Uuid::from_u128(4)));
        assert_eq!(item.visibility, Visibility::Shared);
        assert_eq!(item.statement_period, StatementPeriod::parse("2026-12"));
        assert_eq!(item.applied_balance_delta(), 0);
        let invalid = TransactionEdit {
            expected_amount: Some(0),
            ..TransactionEdit::default()
        };
        assert!(item.apply_edit(&invalid, None, instant()).is_err());
    }

    #[test]
    fn settled_transaction_edit_allows_only_description_category_and_visibility() {
        let mut item = transaction(TransactionKind::Expense, 10_000);
        item.settle(9_000, date("2026-11-04"), instant()).unwrap();
        let allowed = TransactionEdit {
            description: Some("Feira".to_owned()),
            category_id: Some(Uuid::from_u128(4)),
            visibility: Some(Visibility::Shared),
            ..TransactionEdit::default()
        };

        item.apply_edit(&allowed, None, instant()).unwrap();

        assert_eq!(item.description.as_deref(), Some("Feira"));
        for refused in [
            TransactionEdit {
                expected_amount: Some(1),
                ..TransactionEdit::default()
            },
            TransactionEdit {
                expected_date: Some(date("2026-11-06")),
                ..TransactionEdit::default()
            },
            TransactionEdit {
                account: Some((Uuid::from_u128(3), Currency::default())),
                ..TransactionEdit::default()
            },
        ] {
            assert!(matches!(
                item.apply_edit(&refused, None, instant()),
                Err(FinanceError::TransactionAlreadySettled)
            ));
        }
        assert_eq!(item.expected_amount, 10_000);
        assert_eq!(item.applied_balance_delta(), -9_000);
    }

    #[test]
    fn installment_edit_refuses_account_and_date() {
        let mut item = Transaction {
            installment: Some(Installment {
                number: 2,
                total: 3,
            }),
            installment_group_id: Some(Uuid::from_u128(9)),
            statement_period: StatementPeriod::parse("2026-12"),
            ..transaction(TransactionKind::Expense, 10_000)
        };
        let description = TransactionEdit {
            description: Some("Parcela".to_owned()),
            expected_amount: Some(11_000),
            ..TransactionEdit::default()
        };

        item.apply_edit(&description, None, instant()).unwrap();

        assert_eq!(item.expected_amount, 11_000);
        assert_eq!(item.statement_period, StatementPeriod::parse("2026-12"));
        for refused in [
            TransactionEdit {
                expected_date: Some(date("2026-12-20")),
                ..TransactionEdit::default()
            },
            TransactionEdit {
                account: Some((Uuid::from_u128(3), Currency::default())),
                ..TransactionEdit::default()
            },
        ] {
            assert!(matches!(
                item.apply_edit(&refused, None, instant()),
                Err(FinanceError::InstallmentNotEditable)
            ));
        }
    }

    #[test]
    fn undo_settlement_restores_open_state_and_reverts_balance_effect() {
        let mut expense = transaction(TransactionKind::Expense, 10_000);
        let mut income = transaction(TransactionKind::Income, 50_000);
        expense
            .settle(9_000, date("2026-11-04"), instant())
            .unwrap();
        income
            .settle(52_000, date("2026-11-04"), instant())
            .unwrap();

        assert_eq!(expense.undo_settlement(instant()).unwrap(), 9_000);
        assert_eq!(income.undo_settlement(instant()).unwrap(), -52_000);

        assert_eq!(expense.settlement, None);
        assert_eq!(expense.status(date("2026-11-05")), ItemStatus::Open);
        assert_eq!(expense.effective_date(), date("2026-11-05"));
        assert!(matches!(
            expense.undo_settlement(instant()),
            Err(FinanceError::TransactionNotSettled)
        ));
    }

    #[test]
    fn stored_status_is_settled_open_or_overdue() {
        let mut item = transaction(TransactionKind::Expense, 10_000);

        assert_eq!(item.status(date("2026-11-05")), ItemStatus::Open);
        assert_eq!(item.status(date("2026-11-06")), ItemStatus::Overdue);
        item.settle(10_000, date("2026-11-07"), instant()).unwrap();
        assert_eq!(item.status(date("2026-11-30")), ItemStatus::Settled);
    }
}
