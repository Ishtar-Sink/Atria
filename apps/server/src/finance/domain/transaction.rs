//! Movimentação (entrada ou saída) com valores previstos e efetivos em centavos, o
//! estado da liquidação, a data efetiva e o status (RF-27, RF-32, PD-51, PD-55), a
//! edição e o desfazer da liquidação (DEC-005). Com descontos e acréscimos (SPEC-004),
//! guarda o bruto e os itens previstos e liquidados; `expected_amount` continua sendo o
//! líquido, e a liquidação pelo líquido recalcula o bruto e os percentuais (RF-09).

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::finance::domain::adjustment::{
    Adjustment, Breakdown, ComputedAdjustment, compute_net, gross_for_net,
};
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
    pub gross_amount: Option<i64>,
    pub adjustments: Option<Vec<Adjustment>>,
}

impl TransactionEdit {
    /// Valor, bruto, itens, data e conta já entraram no saldo de uma liquidada.
    fn touches_settled_fields(&self) -> bool {
        self.expected_amount.is_some()
            || self.gross_amount.is_some()
            || self.adjustments.is_some()
            || self.expected_date.is_some()
            || self.account.is_some()
    }
}

/// Líquido, bruto e itens previstos de uma movimentação ou recorrente.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedAmounts {
    pub expected_amount: i64,
    pub gross_amount: i64,
    pub adjustments: Vec<ComputedAdjustment>,
}

/// Previsto a partir do bruto e dos itens: o líquido calculado vira `expected_amount`.
pub fn planned_from_gross(
    gross_amount: i64,
    adjustments: &[Adjustment],
) -> Result<PlannedAmounts, FinanceError> {
    let breakdown = compute_net(gross_amount, adjustments)?;
    Ok(PlannedAmounts {
        expected_amount: breakdown.net_amount,
        gross_amount,
        adjustments: breakdown.items,
    })
}

/// Previsto do pedido de criação: exatamente um entre o líquido e o bruto. Só o líquido,
/// sem itens, é como antes, com o bruto igual ao líquido (RN-09).
pub fn planned_amounts(
    expected_amount: Option<i64>,
    gross_amount: Option<i64>,
    adjustments: &[Adjustment],
) -> Result<PlannedAmounts, FinanceError> {
    match (expected_amount, gross_amount) {
        (Some(_), Some(_)) => Err(FinanceError::invalid(
            "expected_amount",
            "conflicts_with_gross_amount",
        )),
        (Some(amount), None) if adjustments.is_empty() => {
            validate_expected_amount(amount)?;
            Ok(PlannedAmounts {
                expected_amount: amount,
                gross_amount: amount,
                adjustments: Vec::new(),
            })
        }
        (_, None) => Err(FinanceError::invalid("gross_amount", "required")),
        (None, Some(gross)) => planned_from_gross(gross, adjustments),
    }
}

/// Previsto depois de uma edição, ou `None` quando ela não mexe em valores. O que a
/// edição não informa vem do previsto atual.
pub fn edited_amounts(
    current: &PlannedAmounts,
    expected_amount: Option<i64>,
    gross_amount: Option<i64>,
    adjustments: Option<&[Adjustment]>,
) -> Result<Option<PlannedAmounts>, FinanceError> {
    match (
        expected_amount,
        gross_amount.is_some() || adjustments.is_some(),
    ) {
        (None, false) => Ok(None),
        (Some(_), true) => Err(FinanceError::invalid(
            "expected_amount",
            "conflicts_with_gross_amount",
        )),
        (Some(_), false) if !current.adjustments.is_empty() => {
            Err(FinanceError::invalid("expected_amount", "has_adjustments"))
        }
        (Some(amount), false) => {
            validate_expected_amount(amount)?;
            Ok(Some(PlannedAmounts {
                expected_amount: amount,
                gross_amount: amount,
                adjustments: Vec::new(),
            }))
        }
        (None, true) => {
            let items =
                adjustments.map_or_else(|| definitions(&current.adjustments), <[_]>::to_vec);
            planned_from_gross(gross_amount.unwrap_or(current.gross_amount), &items).map(Some)
        }
    }
}

/// Definições dos itens calculados, na ordem, para recalcular.
pub fn definitions(items: &[ComputedAdjustment]) -> Vec<Adjustment> {
    items.iter().map(|item| item.adjustment.clone()).collect()
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
    /// Bruto previsto; igual a `expected_amount` sem itens (RN-09).
    pub gross_amount: i64,
    /// Itens previstos, na ordem, com o valor calculado (RF-01).
    pub adjustments: Vec<ComputedAdjustment>,
    pub expected_date: NaiveDate,
    pub currency: Currency,
    pub settlement: Option<Settlement>,
    /// Itens da liquidação; vazia enquanto prevista (RF-09).
    pub settled_adjustments: Vec<ComputedAdjustment>,
    /// Recorrente de onde veio a cópia liquidada; a cópia em si não tem recorrência.
    pub generated_from: Option<Uuid>,
    /// Data da ocorrência que a cópia liquidou.
    pub occurrence_date: Option<NaiveDate>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Transaction {
    /// Liquida com o valor e a data efetivos e devolve a variação do saldo da conta
    /// (RN-01). Uma movimentação liquidada não é liquidada de novo. Fora dos testes, a
    /// liquidação passa os itens por `settle_with`.
    #[cfg(test)]
    pub fn settle(
        &mut self,
        settled_amount: i64,
        settled_at: NaiveDate,
        now: DateTime<Utc>,
    ) -> Result<i64, FinanceError> {
        self.settle_with(settled_amount, settled_at, None, now)
    }

    /// Liquida pelo líquido, com os itens editados ou, sem eles, os previstos: os fixos
    /// se mantêm e os percentuais são recalculados sobre o bruto equivalente, com a base
    /// digitada na proporção do bruto (RF-09, RN-06, RN-07). Devolve a variação do saldo.
    pub fn settle_with(
        &mut self,
        settled_amount: i64,
        settled_at: NaiveDate,
        adjustments: Option<Vec<Adjustment>>,
        now: DateTime<Utc>,
    ) -> Result<i64, FinanceError> {
        if self.settlement.is_some() {
            return Err(FinanceError::TransactionAlreadySettled);
        }
        let items = adjustments.unwrap_or_else(|| definitions(&self.adjustments));
        let breakdown: Breakdown = gross_for_net(settled_amount, &items, self.gross_amount)?;
        let mut result =
            settlement::settle(self.kind, self.expected_amount, settled_amount, settled_at)?;
        result.gross_amount = breakdown.gross_amount;
        self.settlement = Some(result);
        self.settled_adjustments = breakdown.items;
        self.updated_at = now;
        Ok(settlement::balance_delta(self.kind, settled_amount))
    }

    /// Líquido, bruto e itens previstos.
    pub fn planned(&self) -> PlannedAmounts {
        PlannedAmounts {
            expected_amount: self.expected_amount,
            gross_amount: self.gross_amount,
            adjustments: self.adjustments.clone(),
        }
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
    /// categoria e visibilidade.
    pub fn apply_edit(
        &mut self,
        edit: &TransactionEdit,
        now: DateTime<Utc>,
    ) -> Result<(), FinanceError> {
        if self.is_settled() && edit.touches_settled_fields() {
            return Err(FinanceError::TransactionAlreadySettled);
        }
        if let Some(planned) = edited_amounts(
            &self.planned(),
            edit.expected_amount,
            edit.gross_amount,
            edit.adjustments.as_deref(),
        )? {
            self.expected_amount = planned.expected_amount;
            self.gross_amount = planned.gross_amount;
            self.adjustments = planned.adjustments;
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
        self.settled_adjustments.clear();
        self.updated_at = now;
        Ok(revert)
    }

    /// Data da liquidação, quando liquidada, e a prevista nos outros casos (PD-55).
    pub fn effective_date(&self) -> NaiveDate {
        self.settlement
            .map_or(self.expected_date, |done| done.settled_at)
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
            gross_amount: expected_amount,
            adjustments: Vec::new(),
            expected_date: date("2026-11-05"),
            currency: Currency::default(),
            settlement: None,
            settled_adjustments: Vec::new(),
            generated_from: None,
            occurrence_date: None,
            created_at: instant(),
            updated_at: instant(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::fixtures::{date, instant, transaction};
    use super::*;
    use crate::finance::domain::adjustment::{AdjustmentDirection, AdjustmentMode};

    fn percent(name: &str, rate_bp: i32, base_amount: Option<i64>) -> Adjustment {
        Adjustment {
            name: name.to_owned(),
            direction: AdjustmentDirection::Deduction,
            mode: AdjustmentMode::Percent,
            amount: None,
            rate_bp: Some(rate_bp),
            base_amount,
            base_items: Vec::new(),
            deduction_amount: None,
        }
    }

    fn fixed(name: &str, amount: i64) -> Adjustment {
        Adjustment {
            name: name.to_owned(),
            direction: AdjustmentDirection::Deduction,
            mode: AdjustmentMode::Fixed,
            amount: Some(amount),
            rate_bp: None,
            base_amount: None,
            base_items: Vec::new(),
            deduction_amount: None,
        }
    }

    fn values(items: &[ComputedAdjustment]) -> Vec<i64> {
        items.iter().map(|item| item.computed_amount).collect()
    }

    fn field_code(error: FinanceError) -> (String, String) {
        match error {
            FinanceError::Validation(issues) => {
                (issues[0].field.to_owned(), issues[0].code.to_owned())
            }
            other => panic!("esperava erro de validação, veio {other:?}"),
        }
    }

    fn with_items(gross: i64, items: &[Adjustment]) -> Transaction {
        let planned = planned_from_gross(gross, items).unwrap();
        let mut item = transaction(TransactionKind::Income, planned.expected_amount);
        item.gross_amount = planned.gross_amount;
        item.adjustments = planned.adjustments;
        item
    }

    #[test]
    fn adj_planned_amounts_follow_request_rules() {
        let taxa = [fixed("Taxa", 500)];

        let plain = planned_amounts(Some(10_000), None, &[]).unwrap();
        assert_eq!(
            (plain.expected_amount, plain.gross_amount),
            (10_000, 10_000)
        );
        assert!(plain.adjustments.is_empty());
        let from_gross = planned_amounts(None, Some(10_000), &taxa).unwrap();
        assert_eq!(from_gross.expected_amount, 9_500);
        for (expected, gross, items, field, code) in [
            (
                Some(10_000),
                Some(10_000),
                &[][..],
                "expected_amount",
                "conflicts_with_gross_amount",
            ),
            (Some(10_000), None, &taxa[..], "gross_amount", "required"),
            (None, None, &[][..], "gross_amount", "required"),
        ] {
            let error = planned_amounts(expected, gross, items).unwrap_err();
            assert_eq!(field_code(error), (field.to_owned(), code.to_owned()));
        }
    }

    #[test]
    fn adj_planned_amounts_compute_net_from_gross() {
        let planned = planned_from_gross(
            800_000,
            &[percent("INSS", 1100, None), fixed("Sindical", 4_000)],
        )
        .unwrap();

        assert_eq!(planned.expected_amount, 708_000);
        assert_eq!(planned.gross_amount, 800_000);
        assert_eq!(values(&planned.adjustments), [88_000, 4_000]);
    }

    #[test]
    fn adj_settle_by_net_uses_gross_for_net_and_keeps_expected_side() {
        let ct02 = [
            percent("INSS", 1100, None),
            percent("IRPF", 1500, Some(712_000)),
        ];
        let mut item = with_items(800_000, &ct02);
        let mut copy = item.clone();

        item.settle(650_000, date("2026-11-05"), instant()).unwrap();
        copy.settle_with(
            650_000,
            date("2026-11-05"),
            Some(vec![
                percent("INSS", 1100, None),
                percent("IRPF", 2250, Some(712_000)),
            ]),
            instant(),
        )
        .unwrap();

        assert_eq!(item.settlement.unwrap().gross_amount, 859_220);
        assert_eq!(values(&item.settled_adjustments), [94_514, 114_706]);
        assert_eq!(item.gross_amount, 800_000);
        assert_eq!(values(&item.adjustments), [88_000, 106_800]);
        assert_eq!(copy.settlement.unwrap().gross_amount, 942_370);
        assert_eq!(values(&copy.settled_adjustments), [103_661, 188_709]);
    }

    #[test]
    fn adj_undo_settlement_clears_settled_breakdown() {
        let mut item = with_items(800_000, &[percent("INSS", 1100, None)]);
        let before = item.planned();
        item.settle(700_000, date("2026-11-05"), instant()).unwrap();

        item.undo_settlement(instant()).unwrap();

        assert!(item.settled_adjustments.is_empty());
        assert_eq!(item.planned(), before);
    }

    #[test]
    fn adj_edit_recomputes_net_and_refuses_expected_amount_with_items() {
        let mut item = with_items(
            800_000,
            &[percent("INSS", 1100, None), fixed("Sindical", 4_000)],
        );

        item.apply_edit(
            &TransactionEdit {
                adjustments: Some(vec![percent("INSS", 1100, None)]),
                ..TransactionEdit::default()
            },
            instant(),
        )
        .unwrap();
        assert_eq!(item.expected_amount, 712_000);
        item.apply_edit(
            &TransactionEdit {
                gross_amount: Some(900_000),
                ..TransactionEdit::default()
            },
            instant(),
        )
        .unwrap();
        assert_eq!(item.expected_amount, 801_000);
        assert_eq!(values(&item.adjustments), [99_000]);
        let error = item
            .apply_edit(
                &TransactionEdit {
                    expected_amount: Some(5_000),
                    ..TransactionEdit::default()
                },
                instant(),
            )
            .unwrap_err();
        assert_eq!(
            field_code(error),
            ("expected_amount".to_owned(), "has_adjustments".to_owned())
        );
    }

    #[test]
    fn adj_settled_edit_refuses_gross_and_adjustments() {
        let mut item = with_items(800_000, &[percent("INSS", 1100, None)]);
        item.settle(712_000, date("2026-11-05"), instant()).unwrap();

        for refused in [
            TransactionEdit {
                gross_amount: Some(1_000),
                ..TransactionEdit::default()
            },
            TransactionEdit {
                adjustments: Some(Vec::new()),
                ..TransactionEdit::default()
            },
        ] {
            assert!(matches!(
                item.apply_edit(&refused, instant()),
                Err(FinanceError::TransactionAlreadySettled)
            ));
        }
        assert_eq!(item.gross_amount, 800_000);
    }

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
        let edit = TransactionEdit {
            description: Some("  Conta de luz ".to_owned()),
            expected_amount: Some(12_000),
            expected_date: Some(date("2026-11-15")),
            account: Some((Uuid::from_u128(3), Currency::default())),
            category_id: Some(Uuid::from_u128(4)),
            visibility: Some(Visibility::Shared),
            ..TransactionEdit::default()
        };

        item.apply_edit(&edit, instant()).unwrap();

        assert_eq!(item.description.as_deref(), Some("Conta de luz"));
        assert_eq!(item.expected_amount, 12_000);
        assert_eq!(item.expected_date, date("2026-11-15"));
        assert_eq!(item.account_id, Uuid::from_u128(3));
        assert_eq!(item.category_id, Some(Uuid::from_u128(4)));
        assert_eq!(item.visibility, Visibility::Shared);
        assert_eq!(item.applied_balance_delta(), 0);
        let invalid = TransactionEdit {
            expected_amount: Some(0),
            ..TransactionEdit::default()
        };
        assert!(item.apply_edit(&invalid, instant()).is_err());
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

        item.apply_edit(&allowed, instant()).unwrap();

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
                item.apply_edit(&refused, instant()),
                Err(FinanceError::TransactionAlreadySettled)
            ));
        }
        assert_eq!(item.expected_amount, 10_000);
        assert_eq!(item.applied_balance_delta(), -9_000);
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
