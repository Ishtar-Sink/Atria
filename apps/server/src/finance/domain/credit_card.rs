//! Cartão de crédito: período da fatura pelo dia de fechamento, vencimento e divisão
//! de uma compra em parcelas (RN-06, RN-07, CB-10).

use std::fmt;

use chrono::{Datelike, NaiveDate};

use crate::finance::domain::FinanceError;
use crate::finance::domain::transaction::{Transaction, TransactionKind};

pub const MAX_INSTALLMENTS: u32 = 120;

/// Período da fatura: o mês (`YYYY-MM`) do fechamento.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct StatementPeriod {
    year: i32,
    month: u32,
}

impl StatementPeriod {
    pub fn new(year: i32, month: u32) -> Option<Self> {
        NaiveDate::from_ymd_opt(year, month, 1).map(|_| Self { year, month })
    }

    pub fn of(date: NaiveDate) -> Self {
        Self {
            year: date.year(),
            month: date.month(),
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        let (year, month) = text.split_once('-')?;
        if year.len() != 4 || month.len() != 2 {
            return None;
        }
        Self::new(year.parse().ok()?, month.parse().ok()?)
    }

    pub fn plus_months(self, months: u32) -> Self {
        let index = i64::from(self.year) * 12 + i64::from(self.month - 1) + i64::from(months);
        Self {
            year: i32::try_from(index.div_euclid(12)).unwrap_or(i32::MAX),
            month: u32::try_from(index.rem_euclid(12)).unwrap_or(0) + 1,
        }
    }

    /// O dia pedido, ou o último dia do mês quando ele não existe.
    pub fn day(self, day: u32) -> NaiveDate {
        let last = last_day_of_month(self.year, self.month);
        NaiveDate::from_ymd_opt(self.year, self.month, day.clamp(1, last)).unwrap_or_default()
    }
}

impl fmt::Display for StatementPeriod {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:04}-{:02}", self.year, self.month)
    }
}

pub fn last_day_of_month(year: i32, month: u32) -> u32 {
    let (next_year, next_month) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    NaiveDate::from_ymd_opt(next_year, next_month, 1)
        .and_then(|next| next.pred_opt())
        .map_or(28, |last| last.day())
}

/// Dias de fechamento e de vencimento do cartão.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CardCycle {
    pub closing_day: u32,
    pub due_day: u32,
}

impl CardCycle {
    pub fn new(closing_day: u32, due_day: u32) -> Result<Self, FinanceError> {
        if !(1..=31).contains(&closing_day) {
            return Err(FinanceError::invalid("closing_day", "out_of_range"));
        }
        if !(1..=31).contains(&due_day) {
            return Err(FinanceError::invalid("due_day", "out_of_range"));
        }
        Ok(Self {
            closing_day,
            due_day,
        })
    }

    pub fn closing_date(&self, period: StatementPeriod) -> NaiveDate {
        period.day(self.closing_day)
    }

    /// No mês do fechamento se o vencimento vem depois dele; senão, no mês seguinte.
    pub fn due_date(&self, period: StatementPeriod) -> NaiveDate {
        if self.due_day > self.closing_day {
            return period.day(self.due_day);
        }
        period.plus_months(1).day(self.due_day)
    }

    /// Compra até o fechamento do mês entra nele; depois, no fechamento seguinte.
    pub fn statement_for(&self, purchase: NaiveDate) -> StatementPeriod {
        let current = StatementPeriod::of(purchase);
        if purchase <= self.closing_date(current) {
            return current;
        }
        current.plus_months(1)
    }

    /// Parcela `k` no período `p + k - 1`, com a data prevista no vencimento dele.
    pub fn plan_installments(
        &self,
        purchase: NaiveDate,
        total_amount: i64,
        count: u32,
    ) -> Result<Vec<PlannedInstallment>, FinanceError> {
        let first = self.statement_for(purchase);
        let amounts = split_installments(total_amount, count)?;
        Ok((1..=count)
            .zip(amounts)
            .map(|(number, amount)| {
                let period = first.plus_months(number - 1);
                PlannedInstallment {
                    number,
                    total: count,
                    amount,
                    period,
                    expected_date: self.due_date(period),
                }
            })
            .collect())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PlannedInstallment {
    pub number: u32,
    pub total: u32,
    pub amount: i64,
    pub period: StatementPeriod,
    pub expected_date: NaiveDate,
}

/// Divide o total em `count` parcelas; o resto da divisão vai para a primeira.
pub fn split_installments(total_amount: i64, count: u32) -> Result<Vec<i64>, FinanceError> {
    if !(1..=MAX_INSTALLMENTS).contains(&count) {
        return Err(FinanceError::invalid("installments", "out_of_range"));
    }
    let parts = i64::from(count);
    // Cada parcela precisa ter ao menos um centavo.
    if total_amount < parts {
        return Err(FinanceError::invalid(
            "expected_amount",
            "too_small_for_installments",
        ));
    }
    let base = total_amount / parts;
    let remainder = total_amount % parts;
    Ok((0..count)
        .map(|index| if index == 0 { base + remainder } else { base })
        .collect())
}

/// Valor a pagar da fatura: saídas menos entradas ainda não liquidadas.
pub fn outstanding_amount(items: &[Transaction]) -> i64 {
    items
        .iter()
        .filter(|item| !item.is_settled())
        .map(|item| match item.kind {
            TransactionKind::Expense => item.expected_amount,
            TransactionKind::Income => -item.expected_amount,
        })
        .fold(0i64, i64::saturating_add)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::finance::domain::transaction::fixtures::{date, transaction};

    fn period(text: &str) -> StatementPeriod {
        StatementPeriod::parse(text).unwrap()
    }

    #[test]
    fn purchase_on_closing_day_enters_current_statement() {
        let cycle = CardCycle::new(10, 17).unwrap();

        assert_eq!(cycle.statement_for(date("2026-11-10")), period("2026-11"));
        assert_eq!(cycle.statement_for(date("2026-11-05")), period("2026-11"));
    }

    #[test]
    fn purchase_after_closing_day_enters_next_statement() {
        let cycle = CardCycle::new(10, 17).unwrap();

        assert_eq!(cycle.statement_for(date("2026-11-11")), period("2026-12"));
        assert_eq!(cycle.statement_for(date("2026-12-15")), period("2027-01"));
    }

    #[test]
    fn closing_day_31_clamps_to_last_day_of_february() {
        let cycle = CardCycle::new(31, 10).unwrap();

        assert_eq!(cycle.closing_date(period("2027-02")), date("2027-02-28"));
        assert_eq!(cycle.closing_date(period("2028-02")), date("2028-02-29"));
        assert_eq!(cycle.statement_for(date("2027-02-28")), period("2027-02"));
        assert_eq!(cycle.statement_for(date("2027-03-01")), period("2027-03"));
    }

    #[test]
    fn due_date_falls_in_next_month_when_due_day_not_after_closing_day() {
        let same_month = CardCycle::new(10, 17).unwrap();
        let next_month = CardCycle::new(25, 5).unwrap();
        let equal_days = CardCycle::new(10, 10).unwrap();
        let clamped = CardCycle::new(20, 31).unwrap();

        assert_eq!(same_month.due_date(period("2026-11")), date("2026-11-17"));
        assert_eq!(next_month.due_date(period("2026-12")), date("2027-01-05"));
        assert_eq!(equal_days.due_date(period("2026-11")), date("2026-12-10"));
        assert_eq!(clamped.due_date(period("2027-02")), date("2027-02-28"));
    }

    #[test]
    fn installments_split_amount_with_remainder_on_first() {
        assert_eq!(
            split_installments(10_000, 3).unwrap(),
            [3_334, 3_333, 3_333]
        );
        assert_eq!(split_installments(30_000, 3).unwrap(), [10_000; 3]);
        assert!(split_installments(10_000, 0).is_err());
        assert!(split_installments(2, 3).is_err());
        assert!(split_installments(10_000, MAX_INSTALLMENTS + 1).is_err());
    }

    #[test]
    fn installments_fall_on_consecutive_statements() {
        let cycle = CardCycle::new(10, 17).unwrap();

        let plan = cycle
            .plan_installments(date("2026-11-15"), 30_000, 3)
            .unwrap();

        let periods: Vec<String> = plan.iter().map(|p| p.period.to_string()).collect();
        assert_eq!(periods, ["2026-12", "2027-01", "2027-02"]);
        assert_eq!(plan[0].expected_date, date("2026-12-17"));
        assert_eq!(plan[2].expected_date, date("2027-02-17"));
        assert_eq!(
            plan.iter().map(|p| (p.number, p.total)).collect::<Vec<_>>(),
            [(1, 3), (2, 3), (3, 3)]
        );
    }

    #[test]
    fn outstanding_amount_counts_only_unsettled_items() {
        let mut settled = transaction(TransactionKind::Expense, 5_000);
        settled
            .settle(5_000, date("2026-11-20"), settled.created_at)
            .unwrap();
        let items = [
            transaction(TransactionKind::Expense, 10_000),
            transaction(TransactionKind::Income, 1_500),
            settled,
        ];

        assert_eq!(outstanding_amount(&items), 8_500);
    }

    #[test]
    fn period_parses_and_advances() {
        assert_eq!(period("2026-12").plus_months(1).to_string(), "2027-01");
        assert_eq!(period("2026-01").plus_months(25).to_string(), "2028-02");
        assert!(StatementPeriod::parse("2026-13").is_none());
        assert!(StatementPeriod::parse("26-01").is_none());
    }
}
