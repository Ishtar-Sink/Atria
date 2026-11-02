//! Painel do Financeiro por período livre (RF-35, PD-55, PD-58): fechamento realizado
//! e previsto, comparação com o período anterior, "Para onde foi", previsto x
//! realizado, economias e perdas, saldo previsto, próximas movimentações e a série
//! "Mês a mês", com 6 meses realizados e 6 projetados (RF-17). As transferências
//! ficam fora de todos os totais (RN-05). O total dos descontos e acréscimos por nome
//! (SPEC-004, RF-14) agrupa sem diferenciar maiúsculas e acentos, com as liquidadas pelos
//! valores da liquidação e as previstas e projeções pelos previstos (RN-11).

use std::collections::HashMap;

use chrono::{Datelike, Duration, Months, NaiveDate};
use uuid::Uuid;

use crate::finance::domain::adjustment::{AdjustmentDirection, ComputedAdjustment};
use crate::finance::domain::forecast::FinanceItem;
use crate::finance::domain::settlement::DifferenceKind;
use crate::finance::domain::transaction::TransactionKind;

/// Maior período do resumo, para limitar a projeção das recorrentes.
pub const MAX_PERIOD_DAYS: i64 = 3660;
/// "Próximas movimentações" olha sempre os próximos 30 dias.
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

/// Próximas movimentações: entradas e saídas não liquidadas até hoje + 30 dias,
/// inclusive as atrasadas, pela data prevista (RF-15).
pub fn upcoming_movements(items: Vec<FinanceItem>, today: NaiveDate) -> Vec<FinanceItem> {
    let until = today + Duration::days(UPCOMING_DAYS);
    let mut movements: Vec<FinanceItem> = items
        .into_iter()
        .filter(|item| !item.is_settled() && item.expected_date() <= until)
        .collect();
    movements.sort_by_key(|item| (item.expected_date(), item.key()));
    movements
}

/// Meses do "Mês a mês": os realizados terminam no mês de hoje (RF-15, RF-17).
pub const MONTHLY_REALIZED_MONTHS: u32 = 6;
pub const MONTHLY_PROJECTED_MONTHS: u32 = 6;

/// Um mês do "Mês a mês": `month` é o primeiro dia do mês e `balance`, o saldo ao fim
/// dele. Os projetados vêm das pendentes e das recorrentes, sem linhas gravadas (RN-08).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MonthTotals {
    pub month: NaiveDate,
    pub income: i64,
    pub expense: i64,
    pub balance: i64,
    pub projected: bool,
}

fn first_of_month(day: NaiveDate) -> NaiveDate {
    day.with_day(1).unwrap_or(day)
}

fn last_of_month(first: NaiveDate) -> NaiveDate {
    first
        .checked_add_months(Months::new(1))
        .and_then(|next| next.pred_opt())
        .unwrap_or(first)
}

/// Do primeiro dia do mês de hoje menos 5 meses ao último dia do mês de hoje mais 6.
pub fn monthly_window(today: NaiveDate) -> Period {
    let current = first_of_month(today);
    let from = current
        .checked_sub_months(Months::new(MONTHLY_REALIZED_MONTHS - 1))
        .unwrap_or(today);
    let to = current
        .checked_add_months(Months::new(MONTHLY_PROJECTED_MONTHS))
        .map_or(today, last_of_month);
    Period { from, to }
}

/// 12 meses consecutivos: os realizados somam as liquidadas pela data efetiva e voltam
/// do saldo atual; os projetados somam as pendentes pela data prevista e usam o saldo
/// previsto, que inclui as atrasadas (RF-17, CB-08).
pub fn monthly_series(
    settled: &[FinanceItem],
    pending: &[FinanceItem],
    current_balance: i64,
    today: NaiveDate,
) -> Vec<MonthTotals> {
    let start = monthly_window(today).from;
    (0..MONTHLY_REALIZED_MONTHS + MONTHLY_PROJECTED_MONTHS)
        .filter_map(|offset| start.checked_add_months(Months::new(offset)))
        .map(|month| {
            if month > first_of_month(today) {
                projected_month(pending, current_balance, month, today)
            } else {
                realized_month(settled, current_balance, month)
            }
        })
        .collect()
}

fn realized_month(settled: &[FinanceItem], current_balance: i64, month: NaiveDate) -> MonthTotals {
    let end = last_of_month(month);
    let mut totals = MonthTotals {
        month,
        income: 0,
        expense: 0,
        balance: current_balance,
        projected: false,
    };
    for item in settled {
        let Some(done) = item.settlement() else {
            continue;
        };
        let date = item.effective_date();
        if date > end {
            totals.balance = totals
                .balance
                .saturating_sub(item.kind().signed(done.settled_amount));
        } else if date >= month {
            add_to(&mut totals, item.kind(), done.settled_amount);
        }
    }
    totals
}

fn projected_month(
    pending: &[FinanceItem],
    current_balance: i64,
    month: NaiveDate,
    today: NaiveDate,
) -> MonthTotals {
    let end = last_of_month(month);
    let mut totals = MonthTotals {
        month,
        income: 0,
        expense: 0,
        balance: forecast_balance(current_balance, pending, end, today).unwrap_or(current_balance),
        projected: true,
    };
    for item in pending {
        let date = item.expected_date();
        if !item.is_settled() && date >= month && date <= end {
            add_to(&mut totals, item.kind(), item.expected_amount());
        }
    }
    totals
}

fn add_to(totals: &mut MonthTotals, kind: TransactionKind, amount: i64) {
    match kind {
        TransactionKind::Income => totals.income = totals.income.saturating_add(amount),
        TransactionKind::Expense => totals.expense = totals.expense.saturating_add(amount),
    }
}

/// Total de um desconto ou acréscimo no período, pelo nome (RF-14): `expected` com as liquidadas pelos valores da liquidação e as previstas e projeções pelos previstos; `settled` só as liquidadas (RN-11).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdjustmentTotal {
    pub name: String,
    pub direction: AdjustmentDirection,
    pub expected: i64,
    pub settled: i64,
}

/// Letra sem acento. Uma tabela própria das letras do português e do espanhol basta
/// para agrupar os nomes, sem trazer uma dependência de normalização Unicode
/// ([project/stack-12]).
fn unaccent(c: char) -> char {
    match c {
        'á' | 'à' | 'â' | 'ã' | 'ä' | 'å' => 'a',
        'é' | 'è' | 'ê' | 'ë' => 'e',
        'í' | 'ì' | 'î' | 'ï' => 'i',
        'ó' | 'ò' | 'ô' | 'õ' | 'ö' => 'o',
        'ú' | 'ù' | 'û' | 'ü' => 'u',
        'ç' => 'c',
        'ñ' => 'n',
        'ý' | 'ÿ' => 'y',
        other => other,
    }
}

/// Chave de agrupamento: aparada, com os espaços internos reduzidos a um, em
/// minúsculas e sem acentos (RN-11).
fn name_key(name: &str) -> String {
    name.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
        .chars()
        .map(unaccent)
        .collect()
}

type TotalsByName = HashMap<(String, &'static str), (String, AdjustmentTotal)>;

fn add_items(totals: &mut TotalsByName, list: &[ComputedAdjustment], settled: bool) {
    for item in list {
        let name = item.adjustment.name.trim();
        let direction = item.adjustment.direction;
        let (_, total) = totals
            .entry((name_key(name), direction.as_str()))
            .or_insert_with(|| {
                (
                    name_key(name),
                    AdjustmentTotal {
                        name: name.to_owned(),
                        direction,
                        expected: 0,
                        settled: 0,
                    },
                )
            });
        total.expected = total.expected.saturating_add(item.computed_amount);
        if settled {
            total.settled = total.settled.saturating_add(item.computed_amount);
        }
    }
}

/// Descontos e acréscimos do período por nome: descontos primeiro e, em cada sentido,
/// o maior `expected` antes (RF-14).
pub fn adjustments_by_name(entries: &[Entry]) -> Vec<AdjustmentTotal> {
    let mut totals = TotalsByName::new();
    for item in items(entries) {
        let (list, settled) = if item.is_settled() {
            (item.settled_adjustments(), true)
        } else {
            (item.adjustments(), false)
        };
        add_items(&mut totals, list, settled);
    }
    let mut ranked: Vec<(String, AdjustmentTotal)> = totals.into_values().collect();
    ranked.sort_by_key(|(key, total)| {
        (
            total.direction == AdjustmentDirection::Addition,
            std::cmp::Reverse(total.expected),
            key.clone(),
        )
    });
    ranked.into_iter().map(|(_, total)| total).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::finance::domain::adjustment::{Adjustment, AdjustmentMode};
    use crate::finance::domain::transaction::planned_from_gross;

    fn fixed_item(name: &str, direction: AdjustmentDirection, amount: i64) -> Adjustment {
        Adjustment {
            name: name.to_owned(),
            direction,
            mode: AdjustmentMode::Fixed,
            amount: Some(amount),
            rate_bp: None,
            base_amount: None,
        }
    }

    fn with_items(kind: TransactionKind, gross: i64, items: &[Adjustment]) -> Transaction {
        let planned = planned_from_gross(gross, items).unwrap();
        let mut item = transaction(kind, planned.expected_amount);
        item.gross_amount = planned.gross_amount;
        item.adjustments = planned.adjustments;
        item
    }

    fn entry(item: Transaction) -> Entry {
        Entry::Item(Box::new(FinanceItem::Stored(item)))
    }

    fn totals(rows: &[AdjustmentTotal]) -> Vec<(&str, i64, i64)> {
        rows.iter()
            .map(|row| (row.name.as_str(), row.expected, row.settled))
            .collect()
    }

    #[test]
    fn adj_adjustments_by_name_groups_names_ignoring_case_and_accents() {
        use AdjustmentDirection::Deduction;
        let entries: Vec<Entry> = [
            ("INSS", 1_000),
            ("inss", 2_000),
            ("  Inss ", 3_000),
            ("Contribuição", 400),
            ("CONTRIBUICAO", 600),
        ]
        .into_iter()
        .map(|(name, amount)| {
            entry(with_items(
                TransactionKind::Income,
                100_000,
                &[fixed_item(name, Deduction, amount)],
            ))
        })
        .collect();

        let rows = adjustments_by_name(&entries);

        assert_eq!(
            totals(&rows),
            [("INSS", 6_000, 0), ("Contribuição", 1_000, 0)]
        );
    }

    #[test]
    fn adj_adjustments_by_name_uses_settled_values_for_settled_items() {
        use AdjustmentDirection::Deduction;
        let mut done = with_items(
            TransactionKind::Income,
            800_000,
            &[fixed_item("INSS", Deduction, 88_000)],
        );
        done.settle_with(
            702_000,
            date("2026-11-10"),
            Some(vec![fixed_item("INSS", Deduction, 98_000)]),
            instant(),
        )
        .unwrap();
        let open = with_items(
            TransactionKind::Income,
            100_000,
            &[fixed_item("inss", Deduction, 10_000)],
        );

        let rows = adjustments_by_name(&[entry(done), entry(open)]);

        assert_eq!(totals(&rows), [("INSS", 108_000, 98_000)]);
    }

    #[test]
    fn adj_adjustments_by_name_orders_deductions_then_additions_and_skips_transfers() {
        use AdjustmentDirection::{Addition, Deduction};
        let entries = [
            entry(with_items(
                TransactionKind::Expense,
                10_000,
                &[fixed_item("Juros", Addition, 500)],
            )),
            entry(with_items(
                TransactionKind::Expense,
                10_000,
                &[fixed_item("Taxa", Addition, 1_500)],
            )),
            entry(with_items(
                TransactionKind::Income,
                10_000,
                &[fixed_item("INSS", Deduction, 300)],
            )),
            Entry::Transfer { amount: 9_000 },
            planned(TransactionKind::Expense, 4_000),
        ];

        let rows = adjustments_by_name(&entries);

        assert_eq!(
            totals(&rows),
            [("INSS", 300, 0), ("Taxa", 1_500, 0), ("Juros", 500, 0)]
        );
        assert_eq!(rows[0].direction, Deduction);
        assert_eq!(rows[1].direction, Addition);
        assert!(adjustments_by_name(&[planned(TransactionKind::Expense, 4_000)]).is_empty());
    }
    use crate::finance::domain::forecast::project;
    use crate::finance::domain::recurring_transaction::fixtures::rent;
    use crate::finance::domain::transaction::Transaction;
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
    fn upcoming_movements_cover_overdue_and_next_30_days() {
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

        let bills = upcoming_movements(items, date("2026-11-01"));

        assert_eq!(
            bills
                .iter()
                .map(|bill| (bill.expected_date(), bill.expected_amount()))
                .collect::<Vec<_>>(),
            [
                (date("2026-10-20"), 1_000),
                (date("2026-11-10"), 2_000),
                (date("2026-11-30"), 200_000),
                (date("2026-12-01"), 3_000),
            ]
        );
    }

    fn settled_on(kind: TransactionKind, amount: i64, day: &str) -> FinanceItem {
        let mut item = stored(kind, amount, day);
        item.settle(amount, date(day), instant()).unwrap();
        FinanceItem::Stored(item)
    }

    fn pending_on(kind: TransactionKind, amount: i64, day: &str) -> FinanceItem {
        FinanceItem::Stored(stored(kind, amount, day))
    }

    fn month<'a>(series: &'a [MonthTotals], first_day: &str) -> &'a MonthTotals {
        series
            .iter()
            .find(|totals| totals.month == date(first_day))
            .expect("mês da série")
    }

    #[test]
    fn monthly_series_has_6_realized_and_6_projected_consecutive_months() {
        let series = monthly_series(&[], &[], 0, date("2026-11-01"));

        let months: Vec<NaiveDate> = series.iter().map(|totals| totals.month).collect();
        let expected: Vec<NaiveDate> = [
            "2026-06-01",
            "2026-07-01",
            "2026-08-01",
            "2026-09-01",
            "2026-10-01",
            "2026-11-01",
            "2026-12-01",
            "2027-01-01",
            "2027-02-01",
            "2027-03-01",
            "2027-04-01",
            "2027-05-01",
        ]
        .into_iter()
        .map(date)
        .collect();
        assert_eq!(months, expected);
        assert!(series[..6].iter().all(|totals| !totals.projected));
        assert!(series[6..].iter().all(|totals| totals.projected));
        assert!(
            series
                .iter()
                .all(|totals| totals.income == 0 && totals.expense == 0 && totals.balance == 0)
        );
    }

    #[test]
    fn monthly_series_realized_months_sum_settled_and_go_back_from_current_balance() {
        let settled = [
            settled_on(TransactionKind::Income, 300_000, "2026-08-05"),
            settled_on(TransactionKind::Expense, 45_000, "2026-10-12"),
        ];

        let series = monthly_series(&settled, &[], 255_000, date("2026-11-01"));

        let august = month(&series, "2026-08-01");
        assert_eq!((august.income, august.balance), (300_000, 300_000));
        let october = month(&series, "2026-10-01");
        assert_eq!((october.expense, october.balance), (45_000, 255_000));
        assert_eq!(month(&series, "2026-06-01").balance, 0);
        assert_eq!(month(&series, "2026-07-01").balance, 0);
        assert_eq!(month(&series, "2026-11-01").balance, 255_000);
    }

    #[test]
    fn monthly_series_projected_months_use_pending_by_expected_date() {
        let mut pending = vec![
            pending_on(TransactionKind::Expense, 20_000, "2027-01-15"),
            pending_on(TransactionKind::Expense, 1_000, "2026-10-20"),
        ];
        for day in [
            "2026-12-05",
            "2027-01-05",
            "2027-02-05",
            "2027-03-05",
            "2027-04-05",
            "2027-05-05",
        ] {
            pending.push(pending_on(TransactionKind::Expense, 10_000, day));
        }

        let series = monthly_series(&[], &pending, 255_000, date("2026-11-01"));

        let december = month(&series, "2026-12-01");
        assert_eq!((december.expense, december.balance), (10_000, 244_000));
        let january = month(&series, "2027-01-01");
        assert_eq!((january.expense, january.balance), (30_000, 214_000));
        assert_eq!(month(&series, "2027-05-01").balance, 174_000);
        assert!(
            series[6..]
                .iter()
                .all(|totals| totals.expense % 10_000 == 0)
        );
    }
}
