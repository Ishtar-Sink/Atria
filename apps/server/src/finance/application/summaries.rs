//! Dados do painel do Financeiro num período livre (RF-35, PD-55, PD-58, DEC-004).
//! Fechamento, comparação, "Para onde foi", previsto x realizado e economias seguem
//! o período; saldo e próximas contas são o estado de hoje.

use std::collections::HashMap;

use chrono::{DateTime, Duration, NaiveDate, Utc};
use uuid::Uuid;

use crate::finance::application::ports::{
    AccountRepository, CategoryRepository, Outcome, RecurringTransactionRepository,
    TransactionFilter, TransactionRepository, TransferRepository,
};
use crate::finance::application::{Env, accounts, categories, transactions};
use crate::finance::domain::account::Account;
use crate::finance::domain::category::Category;
use crate::finance::domain::forecast::{FinanceItem, project};
use crate::finance::domain::recurring_transaction::RecurringTransaction;
use crate::finance::domain::summary::{
    Entry, ExpectedVsSettled, Period, PeriodTotals, SavingsAndLosses, UPCOMING_DAYS, WhereItem,
    expected_vs_settled, forecast_balance, period_totals, savings_and_losses, upcoming_movements,
    where_it_went,
};
use crate::shared::money::Currency;

/// Limites pedidos; os ausentes seguem a DEC-004.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct SummaryRequest {
    pub from: Option<NaiveDate>,
    pub to: Option<NaiveDate>,
}

/// Item de "Para onde foi" com o nome e a cor da categoria.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WhereView {
    pub item: WhereItem,
    pub category: Option<Category>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PeriodSummaryView {
    pub today: NaiveDate,
    pub currency: Currency,
    pub period: Period,
    pub previous_period: Option<Period>,
    pub totals: PeriodTotals,
    pub previous_totals: Option<PeriodTotals>,
    pub where_it_went: Vec<WhereView>,
    pub expected_vs_settled: ExpectedVsSettled,
    pub savings_and_losses: SavingsAndLosses,
    pub current_balance: i64,
    pub forecast_at_period_end: Option<i64>,
    /// Todas as contas; o saldo atual soma todas.
    pub accounts: Vec<Account>,
    pub upcoming_bills: Vec<FinanceItem>,
}

/// Repositórios que o resumo lê.
pub struct SummarySources<'a, A, C, T, X, R> {
    pub accounts: &'a A,
    pub categories: &'a C,
    pub transactions: &'a T,
    pub transfers: &'a X,
    pub recurring: &'a R,
}

fn projected<'m>(
    models: &'m [RecurringTransaction],
    from: Option<NaiveDate>,
    to: NaiveDate,
    now: DateTime<Utc>,
) -> impl Iterator<Item = FinanceItem> + 'm {
    models.iter().flat_map(move |model| {
        project(model, from, Some(to), now, usize::MAX)
            .into_iter()
            .map(FinanceItem::Virtual)
    })
}

pub async fn period<A, C, T, X, R>(
    sources: SummarySources<'_, A, C, T, X, R>,
    env: Env<'_>,
    owner_id: Uuid,
    request: SummaryRequest,
) -> Outcome<PeriodSummaryView>
where
    A: AccountRepository,
    C: CategoryRepository,
    T: TransactionRepository,
    X: TransferRepository,
    R: RecurringTransactionRepository,
{
    let now = env.clock.now();
    let today = now.date_naive();
    let all_accounts = accounts::list_all(sources.accounts, env, owner_id).await?;
    let period = resolve_period(sources.transactions, owner_id, request, today).await?;
    let models = transactions::list_all_recurring(sources.recurring, owner_id).await?;
    let entries = period_entries(&sources, &models, owner_id, period, now).await?;
    let previous_period = match (request.from, request.to) {
        (Some(_), Some(_)) => Some(period.previous()),
        _ => None,
    };
    let previous_totals = match previous_period {
        Some(previous) => {
            let previous_entries =
                period_entries(&sources, &models, owner_id, previous, now).await?;
            Some(period_totals(&previous_entries))
        }
        None => None,
    };
    let current_balance = all_accounts.iter().fold(0i64, |sum, account| {
        sum.saturating_add(account.balance_amount)
    });
    let forecast_at_period_end = if period.to < today {
        None
    } else {
        let pending =
            pending_until(sources.transactions, &models, owner_id, period.to, now).await?;
        forecast_balance(current_balance, &pending, period.to, today)
    };
    let category_list = categories::list_all(sources.categories, owner_id).await?;
    let bills = upcoming(sources.transactions, &models, owner_id, now).await?;
    Ok(PeriodSummaryView {
        today,
        currency: all_accounts
            .first()
            .map_or_else(Currency::default, |account| account.currency),
        period,
        previous_period,
        totals: period_totals(&entries),
        previous_totals,
        where_it_went: with_categories(where_it_went(&entries), category_list),
        expected_vs_settled: expected_vs_settled(&entries),
        savings_and_losses: savings_and_losses(&entries),
        current_balance,
        forecast_at_period_end,
        accounts: all_accounts,
        upcoming_bills: bills,
    })
}

/// Sem `to`, hoje; sem `from`, a data efetiva da primeira movimentação gravada (hoje,
/// se não houver nenhuma). Um início explícito depois de hoje leva o fim junto.
async fn resolve_period<T: TransactionRepository>(
    transactions: &T,
    owner_id: Uuid,
    request: SummaryRequest,
    today: NaiveDate,
) -> Outcome<Period> {
    let to = request.to.unwrap_or(today);
    let from = match request.from {
        Some(from) => from,
        None => {
            let first = transactions
                .list(owner_id, &TransactionFilter::default(), None, 1)
                .await?;
            first
                .first()
                .map_or(today, |item| item.effective_date())
                .min(to)
        }
    };
    Ok(Period {
        from,
        to: to.max(from),
    })
}

async fn period_entries<A, C, T, X, R>(
    sources: &SummarySources<'_, A, C, T, X, R>,
    models: &[RecurringTransaction],
    owner_id: Uuid,
    period: Period,
    now: DateTime<Utc>,
) -> Outcome<Vec<Entry>>
where
    T: TransactionRepository,
    X: TransferRepository,
{
    let filter = TransactionFilter {
        from: Some(period.from),
        to: Some(period.to),
        ..TransactionFilter::default()
    };
    let stored = transactions::list_all(sources.transactions, owner_id, &filter).await?;
    let transfers = sources
        .transfers
        .between(owner_id, period.from, period.to)
        .await?;
    Ok(stored
        .into_iter()
        .map(FinanceItem::Stored)
        .chain(projected(models, Some(period.from), period.to, now))
        .map(|item| Entry::Item(Box::new(item)))
        .chain(transfers.iter().map(|transfer| Entry::Transfer {
            amount: transfer.amount,
        }))
        .collect())
}

/// Não liquidadas até `to`, inclusive as atrasadas e as virtuais.
async fn pending_until<T: TransactionRepository>(
    transactions: &T,
    models: &[RecurringTransaction],
    owner_id: Uuid,
    to: NaiveDate,
    now: DateTime<Utc>,
) -> Outcome<Vec<FinanceItem>> {
    let filter = TransactionFilter {
        to: Some(to),
        settled: Some(false),
        ..TransactionFilter::default()
    };
    let stored = transactions::list_all(transactions, owner_id, &filter).await?;
    Ok(stored
        .into_iter()
        .map(FinanceItem::Stored)
        .chain(projected(models, None, to, now))
        .collect())
}

async fn upcoming<T: TransactionRepository>(
    transactions: &T,
    models: &[RecurringTransaction],
    owner_id: Uuid,
    now: DateTime<Utc>,
) -> Outcome<Vec<FinanceItem>> {
    let today = now.date_naive();
    let until = today + Duration::days(UPCOMING_DAYS);
    let filter = TransactionFilter {
        to: Some(until),
        settled: Some(false),
        ..TransactionFilter::default()
    };
    let stored = transactions::list_all(transactions, owner_id, &filter).await?;
    let items = stored
        .into_iter()
        .map(FinanceItem::Stored)
        .chain(projected(models, None, until, now))
        .collect();
    Ok(upcoming_movements(items, today))
}

fn with_categories(items: Vec<WhereItem>, list: Vec<Category>) -> Vec<WhereView> {
    let mut by_id: HashMap<Uuid, Category> = list
        .into_iter()
        .map(|category| (category.id, category))
        .collect();
    items
        .into_iter()
        .map(|item| WhereView {
            category: item.category_id.and_then(|id| by_id.remove(&id)),
            item,
        })
        .collect()
}
