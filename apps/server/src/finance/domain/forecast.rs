//! Itens da listagem e do painel: as movimentações gravadas e as ocorrências
//! virtuais das recorrentes, projetadas pela regra num intervalo sem gravar linhas
//! (PD-51, PD-55, DEC-003). A ordem é a data efetiva e depois a chave.
//! As parcelas abertas dos consignados (SPEC-006) também são virtuais: seguem as ocorrências da entrada e entram nos totais como saídas (RF-06, RN-01).

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::finance::domain::adjustment::ComputedAdjustment;
use crate::finance::domain::payroll_loan::PayrollLoan;
use crate::finance::domain::recurring_transaction::{RecurringTransaction, next_date_after};
use crate::finance::domain::settlement::Settlement;
use crate::finance::domain::transaction::{ItemStatus, Transaction, TransactionKind};
use crate::shared::money::Currency;
use crate::shared::visibility::Visibility;

/// Ocorrência de uma recorrente calculada na leitura: a aberta (aberta ou atrasada)
/// ou uma das seguintes (prevista). Não tem `id` próprio.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VirtualOccurrence {
    pub recurrence_id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub kind: TransactionKind,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub description: Option<String>,
    pub expected_amount: i64,
    /// Bruto da regra; igual a `expected_amount` sem itens.
    pub gross_amount: i64,
    /// Itens previstos da regra, na ordem (RF-08).
    pub adjustments: Vec<ComputedAdjustment>,
    pub currency: Currency,
    pub occurrence_date: NaiveDate,
    pub status: ItemStatus,
}

/// Parcela aberta de um consignado, calculada na leitura sobre a ocorrência da entrada:
/// a da recorrente (`recurrence_id`) ou a da avulsa ainda aberta (`income_transaction_id`).
/// Não tem `id` próprio; a chave é o consignado (RF-06, CB-07).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VirtualInstallment {
    pub loan_id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub account_id: Uuid,
    pub category_id: Uuid,
    pub description: String,
    pub amount: i64,
    pub currency: Currency,
    pub date: NaiveDate,
    pub number: Option<i16>,
    pub recurrence_id: Option<Uuid>,
    pub income_transaction_id: Option<Uuid>,
    pub status: ItemStatus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FinanceItem {
    Stored(Transaction),
    Virtual(VirtualOccurrence),
    Installment(VirtualInstallment),
}

impl FinanceItem {
    /// `id` da gravada, `recurrence_id` da virtual ou o consignado da parcela: uma
    /// recorrente e um consignado têm no máximo um item por data, então a posição é única.
    pub fn key(&self) -> Uuid {
        match self {
            Self::Stored(item) => item.id,
            Self::Virtual(item) => item.recurrence_id,
            Self::Installment(item) => item.loan_id,
        }
    }

    pub fn effective_date(&self) -> NaiveDate {
        match self {
            Self::Stored(item) => item.effective_date(),
            Self::Virtual(item) => item.occurrence_date,
            Self::Installment(item) => item.date,
        }
    }

    pub fn position(&self) -> (NaiveDate, Uuid) {
        (self.effective_date(), self.key())
    }

    pub fn expected_date(&self) -> NaiveDate {
        match self {
            Self::Stored(item) => item.expected_date,
            Self::Virtual(item) => item.occurrence_date,
            Self::Installment(item) => item.date,
        }
    }

    pub fn kind(&self) -> TransactionKind {
        match self {
            Self::Stored(item) => item.kind,
            Self::Virtual(item) => item.kind,
            Self::Installment(_) => TransactionKind::Expense,
        }
    }

    pub fn category_id(&self) -> Option<Uuid> {
        match self {
            Self::Stored(item) => item.category_id,
            Self::Virtual(item) => item.category_id,
            Self::Installment(item) => Some(item.category_id),
        }
    }

    pub fn expected_amount(&self) -> i64 {
        match self {
            Self::Stored(item) => item.expected_amount,
            Self::Virtual(item) => item.expected_amount,
            Self::Installment(item) => item.amount,
        }
    }

    pub fn settlement(&self) -> Option<Settlement> {
        match self {
            Self::Stored(item) => item.settlement,
            Self::Virtual(_) | Self::Installment(_) => None,
        }
    }

    pub fn is_settled(&self) -> bool {
        self.settlement().is_some()
    }

    /// Itens previstos, na ordem.
    // TODO(SPEC-004 TASK-06): usado pelo total por nome do resumo.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn adjustments(&self) -> &[ComputedAdjustment] {
        match self {
            Self::Stored(item) => &item.adjustments,
            Self::Virtual(item) => &item.adjustments,
            Self::Installment(_) => &[],
        }
    }

    /// Itens da liquidação; vazia enquanto prevista.
    // TODO(SPEC-004 TASK-06): usado pelo total por nome do resumo.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn settled_adjustments(&self) -> &[ComputedAdjustment] {
        match self {
            Self::Stored(item) => &item.settled_adjustments,
            Self::Virtual(_) | Self::Installment(_) => &[],
        }
    }

    /// O valor liquidado, quando liquidado, e o previsto nos outros casos.
    pub fn value(&self) -> i64 {
        self.settlement()
            .map_or(self.expected_amount(), |done| done.settled_amount)
    }
}

/// Ocorrências virtuais da recorrente em `[from, to]`, até `max_items`: a aberta e as
/// datas seguintes da regra. Sem `to`, só a aberta, para não gerar uma lista sem fim
/// (DEC-004).
pub fn project(
    recurring: &RecurringTransaction,
    from: Option<NaiveDate>,
    to: Option<NaiveDate>,
    now: DateTime<Utc>,
    max_items: usize,
) -> Vec<VirtualOccurrence> {
    let Some((open, open_status)) = recurring.open_status(now) else {
        return Vec::new();
    };
    let status = |date: NaiveDate| {
        if date == open {
            open_status
        } else {
            ItemStatus::Forecast
        }
    };
    let Some(to) = to else {
        if max_items == 0 || from.is_some_and(|start| open < start) {
            return Vec::new();
        }
        return vec![virtual_occurrence(recurring, open, open_status)];
    };
    let mut next = match from {
        Some(start) if start > open => next_date_after(&recurring.rule, start.pred_opt()),
        _ => Some(open),
    };
    let mut items = Vec::new();
    while let Some(date) = next {
        if date > to || items.len() >= max_items {
            break;
        }
        items.push(virtual_occurrence(recurring, date, status(date)));
        next = next_date_after(&recurring.rule, Some(date));
    }
    items
}

fn virtual_occurrence(
    recurring: &RecurringTransaction,
    occurrence_date: NaiveDate,
    status: ItemStatus,
) -> VirtualOccurrence {
    VirtualOccurrence {
        recurrence_id: recurring.id,
        owner_id: recurring.owner_id,
        visibility: recurring.visibility,
        kind: recurring.kind,
        account_id: recurring.account_id,
        category_id: recurring.category_id,
        description: recurring.description.clone(),
        expected_amount: recurring.expected_amount,
        gross_amount: recurring.gross_amount,
        adjustments: recurring.adjustments.clone(),
        currency: recurring.currency,
        occurrence_date,
        status,
    }
}

/// Parcelas do consignado sobre as ocorrências projetadas da entrada recorrente: uma por
/// ocorrência que tem parcela, com a conta, a moeda e o status dela (RN-07, CB-07).
pub fn recurring_installments(
    loan: &PayrollLoan,
    income_dates: &[NaiveDate],
    occurrences: &[VirtualOccurrence],
) -> Vec<VirtualInstallment> {
    occurrences
        .iter()
        .filter_map(|occurrence| {
            let installment = loan.installment_on(income_dates, occurrence.occurrence_date)?;
            Some(VirtualInstallment {
                recurrence_id: Some(occurrence.recurrence_id),
                income_transaction_id: None,
                ..virtual_installment(
                    loan,
                    occurrence.account_id,
                    occurrence.currency,
                    installment.date,
                    installment.number,
                    occurrence.status,
                )
            })
        })
        .collect()
}

/// A parcela da entrada avulsa, enquanto ela está aberta (FA-04); liquidada, a parcela já
/// foi gravada.
pub fn one_off_installment(
    loan: &PayrollLoan,
    income: &Transaction,
    today: NaiveDate,
) -> Option<VirtualInstallment> {
    if income.is_settled() {
        return None;
    }
    let installment = loan.installment_on(&[income.expected_date], income.expected_date)?;
    Some(VirtualInstallment {
        recurrence_id: None,
        income_transaction_id: Some(income.id),
        ..virtual_installment(
            loan,
            income.account_id,
            income.currency,
            installment.date,
            installment.number,
            ItemStatus::pending(income.expected_date, today),
        )
    })
}

fn virtual_installment(
    loan: &PayrollLoan,
    account_id: Uuid,
    currency: Currency,
    date: NaiveDate,
    number: Option<i16>,
    status: ItemStatus,
) -> VirtualInstallment {
    VirtualInstallment {
        loan_id: loan.id,
        owner_id: loan.owner_id,
        visibility: loan.visibility,
        account_id,
        category_id: loan.category_id,
        description: loan.name.clone(),
        amount: loan.installment_amount,
        currency,
        date,
        number,
        recurrence_id: None,
        income_transaction_id: None,
        status,
    }
}

/// Ordena pela data efetiva e depois pela chave.
pub fn sort_items(items: &mut [FinanceItem]) {
    items.sort_by_key(FinanceItem::position);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::finance::domain::payroll_loan::{
        IncomeLink, IncomeSource, LoanTerm, PayrollLoan, income_dates,
    };
    use crate::finance::domain::recurring_transaction::fixtures::{rent, rule};
    use crate::finance::domain::transaction::fixtures::{date, instant, transaction};
    use crate::shared::recurrence::Frequency;

    fn dated(items: &[VirtualOccurrence]) -> Vec<(NaiveDate, ItemStatus)> {
        items
            .iter()
            .map(|item| (item.occurrence_date, item.status))
            .collect()
    }

    #[test]
    fn adj_virtual_occurrence_carries_model_gross_and_adjustments() {
        use crate::finance::domain::adjustment::{Adjustment, AdjustmentDirection, AdjustmentMode};
        use crate::finance::domain::transaction::planned_from_gross;

        let inss = Adjustment {
            name: "INSS".to_owned(),
            direction: AdjustmentDirection::Deduction,
            mode: AdjustmentMode::Percent,
            amount: None,
            rate_bp: Some(1100),
            base_amount: None,
            base_items: Vec::new(),
            deduction_amount: None,
        };
        let planned = planned_from_gross(200_000, &[inss]).unwrap();
        let mut model = rent();
        model.expected_amount = planned.expected_amount;
        model.gross_amount = planned.gross_amount;
        model.adjustments = planned.adjustments.clone();

        let items = project(
            &model,
            Some(date("2027-01-01")),
            Some(date("2027-02-28")),
            instant(),
            usize::MAX,
        );

        assert!(!items.is_empty());
        for item in &items {
            assert_eq!(item.gross_amount, 200_000);
            assert_eq!(item.adjustments, planned.adjustments);
        }
        let virtual_item = FinanceItem::Virtual(items[0].clone());
        assert_eq!(virtual_item.adjustments(), planned.adjustments.as_slice());
        assert!(virtual_item.settled_adjustments().is_empty());
    }

    #[test]
    fn adj_stored_item_exposes_expected_and_settled_adjustments() {
        use crate::finance::domain::adjustment::{Adjustment, AdjustmentDirection, AdjustmentMode};
        use crate::finance::domain::transaction::planned_from_gross;

        let sindical = Adjustment {
            name: "Sindical".to_owned(),
            direction: AdjustmentDirection::Deduction,
            mode: AdjustmentMode::Fixed,
            amount: Some(4_000),
            rate_bp: None,
            base_amount: None,
            base_items: Vec::new(),
            deduction_amount: None,
        };
        let planned = planned_from_gross(50_000, &[sindical]).unwrap();
        let mut stored = transaction(TransactionKind::Income, planned.expected_amount);
        stored.gross_amount = planned.gross_amount;
        stored.adjustments = planned.adjustments.clone();
        let item = FinanceItem::Stored(stored.clone());

        assert_eq!(item.adjustments(), planned.adjustments.as_slice());
        assert!(item.settled_adjustments().is_empty());
        stored
            .settle(46_000, date("2026-11-05"), instant())
            .unwrap();
        let settled = FinanceItem::Stored(stored);
        assert_eq!(settled.settled_adjustments()[0].computed_amount, 4_000);
    }

    #[test]
    fn forecast_projects_following_rule_dates_in_range_as_virtual() {
        let rent = rent();

        let items = project(
            &rent,
            Some(date("2027-01-01")),
            Some(date("2027-04-30")),
            instant(),
            usize::MAX,
        );

        assert_eq!(
            dated(&items),
            [
                (date("2027-01-31"), ItemStatus::Open),
                (date("2027-02-28"), ItemStatus::Forecast),
                (date("2027-03-31"), ItemStatus::Forecast),
                (date("2027-04-30"), ItemStatus::Forecast),
            ]
        );
        assert!(items.iter().all(|item| item.recurrence_id == rent.id
            && item.expected_amount == 200_000
            && item.description.as_deref() == Some("Aluguel")));
        assert_eq!(
            project(&rent, None, Some(date("2027-12-31")), instant(), 2).len(),
            2
        );
    }

    #[test]
    fn forecast_starts_after_open_occurrence() {
        let mut rent = rent();
        rent.last_closed_on = Some(date("2027-02-28"));

        let from_january = project(
            &rent,
            Some(date("2027-01-01")),
            Some(date("2027-04-30")),
            instant(),
            usize::MAX,
        );
        let from_april = project(
            &rent,
            Some(date("2027-04-01")),
            Some(date("2027-05-31")),
            instant(),
            usize::MAX,
        );
        let without_end = project(&rent, None, None, instant(), usize::MAX);
        let after_open = project(&rent, Some(date("2027-04-01")), None, instant(), usize::MAX);

        assert_eq!(
            dated(&from_january),
            [
                (date("2027-03-31"), ItemStatus::Open),
                (date("2027-04-30"), ItemStatus::Forecast),
            ]
        );
        assert_eq!(
            dated(&from_april),
            [
                (date("2027-04-30"), ItemStatus::Forecast),
                (date("2027-05-31"), ItemStatus::Forecast),
            ]
        );
        assert_eq!(
            dated(&without_end),
            [(date("2027-03-31"), ItemStatus::Open)]
        );
        assert!(after_open.is_empty());
    }

    #[test]
    fn effective_date_is_settlement_date_when_settled_and_expected_date_otherwise() {
        let open = transaction(TransactionKind::Expense, 10_000);
        let mut settled = transaction(TransactionKind::Expense, 10_000);
        settled
            .settle(9_000, date("2026-11-09"), instant())
            .unwrap();
        let projected = project(&rent(), None, None, instant(), 1);

        assert_eq!(
            FinanceItem::Stored(open).effective_date(),
            date("2026-11-05")
        );
        let settled = FinanceItem::Stored(settled);
        assert_eq!(settled.effective_date(), date("2026-11-09"));
        assert_eq!(settled.value(), 9_000);
        let projected = FinanceItem::Virtual(projected[0].clone());
        assert_eq!(projected.effective_date(), date("2027-01-31"));
        assert_eq!(projected.value(), 200_000);
    }

    /// Salário mensal no dia 5 a partir de 05/11/2026.
    fn salary_income() -> RecurringTransaction {
        RecurringTransaction {
            kind: TransactionKind::Income,
            expected_amount: 1_066_988,
            gross_amount: 1_066_988,
            rule: rule(Frequency::Monthly, "2026-11-05", Some(5)),
            description: Some("Salário".to_owned()),
            ..rent()
        }
    }

    fn loan_on(current: i16, income: IncomeLink, starts_on: &str) -> PayrollLoan {
        PayrollLoan {
            id: Uuid::from_u128(70),
            owner_id: Uuid::from_u128(1),
            visibility: Visibility::Personal,
            income,
            category_id: Uuid::from_u128(80),
            name: "Empréstimo 178176138".to_owned(),
            contract_number: None,
            installment_amount: 293_723,
            currency: Currency::default(),
            term: LoanTerm::Installments { total: 48, current },
            starts_on: date(starts_on),
            created_at: instant(),
            updated_at: instant(),
        }
    }

    fn installments_until(
        loan: &PayrollLoan,
        income: &RecurringTransaction,
        to: &str,
    ) -> Vec<VirtualInstallment> {
        let dates = income_dates(loan, &IncomeSource::Recurring(income.clone()));
        let occurrences = project(income, None, Some(date(to)), instant(), 10);
        recurring_installments(loan, &dates, &occurrences)
    }

    #[test]
    fn pl_ct03_installments_follow_income_occurrences() {
        let income = salary_income();
        let loan = loan_on(12, IncomeLink::Recurrence(income.id), "2026-11-05");

        let items = installments_until(&loan, &income, "2027-01-31");

        assert_eq!(
            items
                .iter()
                .map(|item| (item.date, item.number, item.status))
                .collect::<Vec<_>>(),
            [
                (date("2026-11-05"), Some(12), ItemStatus::Open),
                (date("2026-12-05"), Some(13), ItemStatus::Forecast),
                (date("2027-01-05"), Some(14), ItemStatus::Forecast),
            ]
        );
        assert!(items.iter().all(|item| item.amount == 293_723
            && item.account_id == income.account_id
            && item.recurrence_id == Some(income.id)
            && item.income_transaction_id.is_none()
            && item.loan_id == loan.id));
        let item = FinanceItem::Installment(items[0].clone());
        assert_eq!(item.kind(), TransactionKind::Expense);
        assert_eq!(item.category_id(), Some(loan.category_id));
        assert_eq!(item.expected_amount(), 293_723);
        assert_eq!(item.key(), loan.id);
        assert_eq!(item.effective_date(), date("2026-11-05"));
        assert!(!item.is_settled());
    }

    #[test]
    fn pl_ct07_no_installment_after_last() {
        let income = salary_income();
        let loan = loan_on(47, IncomeLink::Recurrence(income.id), "2026-11-05");

        let items = installments_until(&loan, &income, "2027-03-31");

        assert_eq!(
            items
                .iter()
                .map(|item| (item.date, item.number))
                .collect::<Vec<_>>(),
            [
                (date("2026-11-05"), Some(47)),
                (date("2026-12-05"), Some(48)),
            ]
        );
    }

    #[test]
    fn pl_fa04_one_off_income_projects_single_installment() {
        let mut income = transaction(TransactionKind::Income, 1_066_988);
        income.expected_date = date("2026-11-20");
        let loan = loan_on(12, IncomeLink::Transaction(income.id), "2026-11-20");
        let today = date("2026-11-01");

        let item = one_off_installment(&loan, &income, today).unwrap();

        assert_eq!(item.date, date("2026-11-20"));
        assert_eq!(item.number, Some(12));
        assert_eq!(item.income_transaction_id, Some(income.id));
        assert_eq!(item.recurrence_id, None);
        assert_eq!(item.status, ItemStatus::Open);
        income
            .settle(1_066_988, date("2026-11-20"), instant())
            .unwrap();
        assert_eq!(one_off_installment(&loan, &income, today), None);
    }

    #[test]
    fn items_are_ordered_by_effective_date_then_key() {
        let stored = |id: u128, day: &str| {
            FinanceItem::Stored(Transaction {
                id: Uuid::from_u128(id),
                expected_date: date(day),
                ..transaction(TransactionKind::Expense, 1_000)
            })
        };
        let projected = FinanceItem::Virtual(project(&rent(), None, None, instant(), 1)[0].clone());
        let mut items = vec![
            stored(70, "2027-02-01"),
            projected,
            stored(40, "2027-01-31"),
            stored(60, "2027-01-31"),
            stored(10, "2026-12-01"),
        ];

        sort_items(&mut items);

        assert_eq!(
            items.iter().map(FinanceItem::key).collect::<Vec<_>>(),
            [10, 40, 50, 60, 70].map(Uuid::from_u128)
        );
    }
}
