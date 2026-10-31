//! Painel do Financeiro por período livre (RF-35, PD-55, PD-58): fechamento realizado
//! e previsto, comparação com o período anterior, "Para onde foi", previsto x
//! realizado, economias e perdas, saldo previsto, cartões e próximas contas. As
//! transferências ficam fora de todos os totais (RN-05).

use std::collections::HashMap;

use chrono::{Duration, NaiveDate};
use uuid::Uuid;

use crate::finance::domain::credit_card::StatementPeriod;
use crate::finance::domain::forecast::FinanceItem;
use crate::finance::domain::settlement::DifferenceKind;
use crate::finance::domain::transaction::{Transaction, TransactionKind};

/// Maior período do resumo, para limitar a projeção das recorrentes.
pub const MAX_PERIOD_DAYS: i64 = 3660;
/// "Próximas contas" olha sempre os próximos 30 dias.
pub const UPCOMING_DAYS: i64 = 30;
/// Categorias com barra própria em "Para onde foi"; o resto vira "Outras".
pub const WHERE_TOP: usize = 6;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Period {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

impl Period {
    pub fn days(self) -> i64 {
        (self.to - self.from).num_days() + 1
    }

    /// Período anterior de mesmo tamanho, terminando na véspera do início.
    pub fn previous(self) -> Self {
        let length = Duration::days(self.days());
        Self {
            from: self.from - length,
            to: self.from - Duration::days(1),
        }
    }
}

/// Item do período que entra no resumo.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Entry {
    Item(Box<FinanceItem>),
    Transfer { amount: i64 },
}

fn items(entries: &[Entry]) -> impl Iterator<Item = &FinanceItem> {
    // Transferência só move dinheiro entre contas do dono (RN-05).
    entries.iter().filter_map(|entry| match entry {
        Entry::Item(item) => Some(item.as_ref()),
        Entry::Transfer { .. } => None,
    })
}

/// Realizado (só os liquidados) e previsto (todos os itens, pelo valor liquidado ou
/// previsto de cada um).
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Flow {
    pub realized: i64,
    pub forecast: i64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct PeriodTotals {
    pub income: Flow,
    pub expense: Flow,
    /// Entradas menos saídas.
    pub surplus: Flow,
}

pub fn period_totals(entries: &[Entry]) -> PeriodTotals {
    let mut totals = PeriodTotals::default();
    for item in items(entries) {
        let flow = match item.kind() {
            TransactionKind::Income => &mut totals.income,
            TransactionKind::Expense => &mut totals.expense,
        };
        flow.forecast = flow.forecast.saturating_add(item.value());
        if let Some(done) = item.settlement() {
            flow.realized = flow.realized.saturating_add(done.settled_amount);
        }
    }
    totals.surplus = Flow {
        realized: totals
            .income
            .realized
            .saturating_sub(totals.expense.realized),
        forecast: totals
            .income
            .forecast
            .saturating_sub(totals.expense.forecast),
    };
    totals
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Planned {
    pub expected_amount: i64,
    pub settled_amount: i64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ExpectedVsSettled {
    pub income: Planned,
    pub expense: Planned,
}

/// Por tipo, a soma dos valores previstos e a dos liquidados.
pub fn expected_vs_settled(entries: &[Entry]) -> ExpectedVsSettled {
    let mut result = ExpectedVsSettled::default();
    for item in items(entries) {
        let planned = match item.kind() {
            TransactionKind::Income => &mut result.income,
            TransactionKind::Expense => &mut result.expense,
        };
        planned.expected_amount = planned
            .expected_amount
            .saturating_add(item.expected_amount());
        if let Some(done) = item.settlement() {
            planned.settled_amount = planned.settled_amount.saturating_add(done.settled_amount);
        }
    }
    result
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct SavingsAndLosses {
    pub savings_amount: i64,
    pub gains_amount: i64,
    pub losses_amount: i64,
}

/// Diferenças das liquidações do período, por tipo.
pub fn savings_and_losses(entries: &[Entry]) -> SavingsAndLosses {
    let mut result = SavingsAndLosses::default();
    for done in items(entries).filter_map(FinanceItem::settlement) {
        let difference = done.difference_amount.saturating_abs();
        let target = match done.difference_kind {
            Some(DifferenceKind::Saving) => &mut result.savings_amount,
            Some(DifferenceKind::Gain) => &mut result.gains_amount,
            Some(DifferenceKind::Loss) => &mut result.losses_amount,
            None => continue,
        };
        *target = target.saturating_add(difference);
    }
    result
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WhereGroup {
    Category,
    Uncategorized,
    Others,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WhereItem {
    pub group: WhereGroup,
    pub category_id: Option<Uuid>,
    pub amount: i64,
}

/// "Para onde foi": saídas por categoria, em ordem decrescente, até `WHERE_TOP`
/// categorias; o resto somado em "Outras" e as sem categoria num item próprio.
pub fn where_it_went(entries: &[Entry]) -> Vec<WhereItem> {
    let mut by_category: HashMap<Uuid, i64> = HashMap::new();
    let mut uncategorized = 0i64;
    for item in items(entries).filter(|item| item.kind() == TransactionKind::Expense) {
        match item.category_id() {
            Some(id) => {
                let sum = by_category.entry(id).or_default();
                *sum = sum.saturating_add(item.value());
            }
            None => uncategorized = uncategorized.saturating_add(item.value()),
        }
    }
    let mut ranked: Vec<(Uuid, i64)> = by_category.into_iter().collect();
    ranked.sort_by_key(|(id, amount)| (std::cmp::Reverse(*amount), *id));
    let others = ranked
        .iter()
        .skip(WHERE_TOP)
        .fold(0i64, |sum, (_, amount)| sum.saturating_add(*amount));
    let mut result: Vec<WhereItem> = ranked
        .into_iter()
        .take(WHERE_TOP)
        .map(|(id, amount)| WhereItem {
            group: WhereGroup::Category,
            category_id: Some(id),
            amount,
        })
        .collect();
    for (group, amount) in [
        (WhereGroup::Others, others),
        (WhereGroup::Uncategorized, uncategorized),
    ] {
        if amount != 0 {
            result.push(WhereItem {
                group,
                category_id: None,
                amount,
            });
        }
    }
    result
}

/// Saldo atual mais as entradas e menos as saídas não liquidadas até o fim do
/// período, inclusive atrasadas e virtuais; nulo quando o período já terminou.
pub fn forecast_balance(
    current: i64,
    pending: &[FinanceItem],
    to: NaiveDate,
    today: NaiveDate,
) -> Option<i64> {
    if to < today {
        return None;
    }
    Some(
        pending
            .iter()
            .filter(|item| !item.is_settled() && item.expected_date() <= to)
            .fold(current, |sum, item| {
                sum.saturating_add(item.kind().signed(item.expected_amount()))
            }),
    )
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct CardUsage {
    /// Saídas menos entradas da fatura aberta, pelo valor liquidado ou previsto.
    pub open_statement_amount: i64,
    /// As não liquidadas do cartão mais as liquidadas da fatura aberta.
    pub used_limit_amount: i64,
}

/// Uso do cartão a partir das movimentações dele e do período da fatura aberta.
pub fn card_usage(items: &[Transaction], open: StatementPeriod) -> CardUsage {
    let charge = |item: &Transaction, amount: i64| -item.kind.signed(amount);
    let mut usage = CardUsage::default();
    for item in items {
        let in_open = item.statement_period == Some(open);
        if in_open {
            usage.open_statement_amount = usage
                .open_statement_amount
                .saturating_add(charge(item, item.value()));
        }
        if !item.is_settled() || in_open {
            usage.used_limit_amount = usage
                .used_limit_amount
                .saturating_add(charge(item, item.value()));
        }
    }
    usage
}

/// Próximas contas: saídas não liquidadas até hoje + 30 dias, inclusive as
/// atrasadas, pela data prevista.
pub fn upcoming_bills(items: Vec<FinanceItem>, today: NaiveDate) -> Vec<FinanceItem> {
    let until = today + Duration::days(UPCOMING_DAYS);
    let mut bills: Vec<FinanceItem> = items
        .into_iter()
        .filter(|item| {
            item.kind() == TransactionKind::Expense
                && !item.is_settled()
                && item.expected_date() <= until
        })
        .collect();
    bills.sort_by_key(|item| (item.expected_date(), item.key()));
    bills
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::finance::domain::forecast::project;
    use crate::finance::domain::recurring_transaction::fixtures::rent;
    use crate::finance::domain::transaction::fixtures::{date, instant, transaction};

    fn stored(kind: TransactionKind, expected: i64, day: &str) -> Transaction {
        Transaction {
            expected_date: date(day),
            ..transaction(kind, expected)
        }
    }

    fn settled(kind: TransactionKind, expected: i64, amount: i64) -> Entry {
        let mut item = transaction(kind, expected);
        item.settle(amount, date("2026-11-10"), instant()).unwrap();
        Entry::Item(Box::new(FinanceItem::Stored(item)))
    }

    fn planned(kind: TransactionKind, expected: i64) -> Entry {
        Entry::Item(Box::new(FinanceItem::Stored(transaction(kind, expected))))
    }

    fn expense_in(category: Option<u128>, amount: i64) -> Entry {
        Entry::Item(Box::new(FinanceItem::Stored(Transaction {
            category_id: category.map(Uuid::from_u128),
            ..transaction(TransactionKind::Expense, amount)
        })))
    }

    #[test]
    fn transfers_are_excluded_from_income_and_expense_totals() {
        let entries = [
            planned(TransactionKind::Income, 100_000),
            Entry::Transfer { amount: 50_000 },
            planned(TransactionKind::Expense, 30_000),
        ];

        let totals = period_totals(&entries);

        assert_eq!(totals.income.forecast, 100_000);
        assert_eq!(totals.expense.forecast, 30_000);
        assert_eq!(totals.income.realized, 0);
        assert_eq!(
            expected_vs_settled(&entries).income.expected_amount,
            100_000
        );
        assert!(
            where_it_went(&entries)
                .iter()
                .all(|item| item.amount == 30_000)
        );
    }

    #[test]
    fn period_totals_split_realized_and_forecast() {
        let entries = [
            settled(TransactionKind::Income, 500_000, 520_000),
            planned(TransactionKind::Income, 50_000),
            settled(TransactionKind::Expense, 150_000, 145_000),
            planned(TransactionKind::Expense, 20_000),
        ];

        let totals = period_totals(&entries);

        assert_eq!(
            totals.income,
            Flow {
                realized: 520_000,
                forecast: 570_000
            }
        );
        assert_eq!(
            totals.expense,
            Flow {
                realized: 145_000,
                forecast: 165_000
            }
        );
        assert_eq!(
            totals.surplus,
            Flow {
                realized: 375_000,
                forecast: 405_000
            }
        );
        assert_eq!(
            expected_vs_settled(&entries).expense,
            Planned {
                expected_amount: 170_000,
                settled_amount: 145_000
            }
        );
    }

    #[test]
    fn savings_and_losses_are_summed_from_settled_transactions() {
        let entries = [
            settled(TransactionKind::Expense, 150_000, 145_000),
            settled(TransactionKind::Expense, 10_000, 12_500),
            settled(TransactionKind::Income, 500_000, 520_000),
            settled(TransactionKind::Income, 100_000, 90_000),
            settled(TransactionKind::Expense, 8_000, 8_000),
            planned(TransactionKind::Expense, 1_000),
        ];

        let result = savings_and_losses(&entries);

        assert_eq!(result.savings_amount, 5_000);
        assert_eq!(result.gains_amount, 20_000);
        assert_eq!(result.losses_amount, 12_500);
    }

    #[test]
    fn previous_period_has_same_length_and_ends_the_day_before() {
        let november = Period {
            from: date("2026-11-01"),
            to: date("2026-11-30"),
        };
        let ten_days = Period {
            from: date("2026-03-01"),
            to: date("2026-03-10"),
        };

        assert_eq!(november.days(), 30);
        assert_eq!(
            november.previous(),
            Period {
                from: date("2026-10-02"),
                to: date("2026-10-31")
            }
        );
        assert_eq!(
            ten_days.previous(),
            Period {
                from: date("2026-02-19"),
                to: date("2026-02-28")
            }
        );
    }

    #[test]
    fn where_it_went_keeps_top_six_categories_and_sums_the_rest_as_others() {
        let mut entries: Vec<Entry> = (1..=8u128)
            .map(|id| expense_in(Some(id), i64::try_from(id).unwrap() * 1_000))
            .collect();
        entries.push(expense_in(Some(8), 500));
        entries.push(expense_in(None, 700));
        entries.push(planned(TransactionKind::Income, 99_000));

        let result = where_it_went(&entries);

        let categories: Vec<(u128, i64)> = result
            .iter()
            .filter(|item| item.group == WhereGroup::Category)
            .map(|item| (item.category_id.unwrap().as_u128(), item.amount))
            .collect();
        assert_eq!(
            categories,
            [
                (8, 8_500),
                (7, 7_000),
                (6, 6_000),
                (5, 5_000),
                (4, 4_000),
                (3, 3_000)
            ]
        );
        assert_eq!(
            result[6..],
            [
                WhereItem {
                    group: WhereGroup::Others,
                    category_id: None,
                    amount: 3_000
                },
                WhereItem {
                    group: WhereGroup::Uncategorized,
                    category_id: None,
                    amount: 700
                }
            ]
        );
    }

    #[test]
    fn forecast_balance_adds_pending_items_until_period_end() {
        let mut paid = stored(TransactionKind::Expense, 4_000, "2026-11-03");
        paid.settle(4_000, date("2026-11-03"), instant()).unwrap();
        let mut rent = rent();
        rent.rule.starts_on = date("2026-10-31");
        let projected = project(&rent, None, Some(date("2026-11-30")), instant(), usize::MAX);
        let mut pending: Vec<FinanceItem> = [
            stored(TransactionKind::Expense, 30_000, "2026-10-20"),
            stored(TransactionKind::Income, 10_000, "2026-11-25"),
            stored(TransactionKind::Expense, 70_000, "2026-12-01"),
            paid,
        ]
        .into_iter()
        .map(FinanceItem::Stored)
        .collect();
        pending.extend(projected.into_iter().map(FinanceItem::Virtual));

        let result = forecast_balance(100_000, &pending, date("2026-11-30"), date("2026-11-01"));

        // Atrasada de 20/10, entrada de 25/11 e o aluguel atrasado de 31/10 e o de
        // 30/11; a saída de dezembro e a liquidada ficam de fora.
        assert_eq!(result, Some(100_000 - 30_000 + 10_000 - 200_000 - 200_000));
    }

    #[test]
    fn forecast_balance_is_absent_when_period_ended_before_today() {
        let pending = [FinanceItem::Stored(stored(
            TransactionKind::Expense,
            1_000,
            "2026-10-05",
        ))];

        assert_eq!(
            forecast_balance(5_000, &pending, date("2026-10-31"), date("2026-11-01")),
            None
        );
        assert_eq!(
            forecast_balance(5_000, &pending, date("2026-11-01"), date("2026-11-01")),
            Some(4_000)
        );
    }

    #[test]
    fn card_used_limit_sums_unsettled_and_settled_in_open_statement() {
        let open = StatementPeriod::parse("2026-11").unwrap();
        let period = |text: &str| StatementPeriod::parse(text);
        let on_card = |amount: i64, statement: &str| Transaction {
            statement_period: period(statement),
            ..transaction(TransactionKind::Expense, amount)
        };
        let mut paid_now = on_card(30_000, "2026-11");
        paid_now
            .settle(30_000, date("2026-11-08"), instant())
            .unwrap();
        let mut paid_before = on_card(5_000, "2026-10");
        paid_before
            .settle(5_000, date("2026-10-17"), instant())
            .unwrap();
        let refund = Transaction {
            statement_period: period("2026-11"),
            ..transaction(TransactionKind::Income, 2_000)
        };
        let items = [
            on_card(10_000, "2026-10"),
            on_card(20_000, "2026-11"),
            paid_now,
            on_card(40_000, "2026-12"),
            paid_before,
            refund,
        ];

        let usage = card_usage(&items, open);

        assert_eq!(usage.open_statement_amount, 20_000 + 30_000 - 2_000);
        assert_eq!(
            usage.used_limit_amount,
            10_000 + 20_000 + 40_000 - 2_000 + 30_000
        );
    }

    #[test]
    fn upcoming_bills_cover_overdue_and_next_30_days() {
        let mut paid = stored(TransactionKind::Expense, 9_000, "2026-11-05");
        paid.settle(9_000, date("2026-11-05"), instant()).unwrap();
        let mut rent = rent();
        rent.rule.starts_on = date("2026-11-20");
        let projected = project(&rent, None, Some(date("2026-12-31")), instant(), usize::MAX);
        let mut items: Vec<FinanceItem> = [
            stored(TransactionKind::Expense, 3_000, "2026-12-01"),
            stored(TransactionKind::Expense, 1_000, "2026-10-20"),
            stored(TransactionKind::Expense, 4_000, "2026-12-02"),
            stored(TransactionKind::Income, 2_000, "2026-11-10"),
            paid,
        ]
        .into_iter()
        .map(FinanceItem::Stored)
        .collect();
        items.extend(projected.into_iter().map(FinanceItem::Virtual));

        let bills = upcoming_bills(items, date("2026-11-01"));

        assert_eq!(
            bills
                .iter()
                .map(|bill| (bill.expected_date(), bill.expected_amount()))
                .collect::<Vec<_>>(),
            [
                (date("2026-10-20"), 1_000),
                (date("2026-11-30"), 200_000),
                (date("2026-12-01"), 3_000),
            ]
        );
    }
}
