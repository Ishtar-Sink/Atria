//! Itens da listagem e do painel: as movimentações gravadas e as ocorrências
//! virtuais das recorrentes, projetadas pela regra num intervalo sem gravar linhas
//! (PD-51, PD-55, DEC-003). A ordem é a data efetiva e depois a chave.

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

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
    pub currency: Currency,
    pub occurrence_date: NaiveDate,
    pub status: ItemStatus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FinanceItem {
    Stored(Transaction),
    Virtual(VirtualOccurrence),
}

impl FinanceItem {
    /// `id` da gravada ou `recurrence_id` da virtual: uma recorrente tem no máximo
    /// um item por data, então a posição é única.
    pub fn key(&self) -> Uuid {
        match self {
            Self::Stored(item) => item.id,
            Self::Virtual(item) => item.recurrence_id,
        }
    }

    pub fn effective_date(&self) -> NaiveDate {
        match self {
            Self::Stored(item) => item.effective_date(),
            Self::Virtual(item) => item.occurrence_date,
        }
    }

    pub fn position(&self) -> (NaiveDate, Uuid) {
        (self.effective_date(), self.key())
    }

    pub fn expected_date(&self) -> NaiveDate {
        match self {
            Self::Stored(item) => item.expected_date,
            Self::Virtual(item) => item.occurrence_date,
        }
    }

    pub fn kind(&self) -> TransactionKind {
        match self {
            Self::Stored(item) => item.kind,
            Self::Virtual(item) => item.kind,
        }
    }

    pub fn category_id(&self) -> Option<Uuid> {
        match self {
            Self::Stored(item) => item.category_id,
            Self::Virtual(item) => item.category_id,
        }
    }

    pub fn expected_amount(&self) -> i64 {
        match self {
            Self::Stored(item) => item.expected_amount,
            Self::Virtual(item) => item.expected_amount,
        }
    }

    pub fn settlement(&self) -> Option<Settlement> {
        match self {
            Self::Stored(item) => item.settlement,
            Self::Virtual(_) => None,
        }
    }

    pub fn is_settled(&self) -> bool {
        self.settlement().is_some()
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
        currency: recurring.currency,
        occurrence_date,
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
    use crate::finance::domain::recurring_transaction::fixtures::rent;
    use crate::finance::domain::transaction::fixtures::{date, instant, transaction};

    fn dated(items: &[VirtualOccurrence]) -> Vec<(NaiveDate, ItemStatus)> {
        items
            .iter()
            .map(|item| (item.occurrence_date, item.status))
            .collect()
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
