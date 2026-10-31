//! Casos de uso de movimentações: registro, compra parcelada no cartão, liquidação,
//! listagem por período livre com as ocorrências virtuais das recorrentes e exclusão
//! (RF-27, RF-28, RF-32, RF-33, PD-51, PD-52, PD-55).

use chrono::NaiveDate;
use uuid::Uuid;

use crate::finance::application::Env;
use crate::finance::application::ports::{
    AccountRepository, CategoryRepository, Outcome, RecurringTransactionRepository, Repetition,
    SettlementRequest, TransactionFilter, TransactionRepository, UndoneSettlement,
};
use crate::finance::domain::account::Account;
use crate::finance::domain::category::ensure_same_kind;
use crate::finance::domain::forecast::{FinanceItem, VirtualOccurrence, project, sort_items};
use crate::finance::domain::recurring_transaction::RecurringTransaction;
use crate::finance::domain::transaction::{
    DESCRIPTION_MAX_CHARS, Installment, Transaction, TransactionEdit, TransactionKind,
    validate_expected_amount,
};
use crate::finance::domain::{FinanceError, optional_text};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewTransaction {
    pub kind: TransactionKind,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub description: Option<String>,
    pub expected_amount: i64,
    pub expected_date: NaiveDate,
    /// Número de parcelas de uma compra no cartão (RF-28).
    pub installments: Option<u32>,
    pub visibility: Visibility,
}

/// Confere que a categoria existe, é do dono e tem o tipo da movimentação.
pub async fn check_category<C: CategoryRepository>(
    categories: &C,
    owner_id: Uuid,
    category_id: Option<Uuid>,
    kind: TransactionKind,
) -> Outcome<()> {
    let Some(category_id) = category_id else {
        return Ok(());
    };
    let category = categories.get(owner_id, category_id).await?;
    ensure_same_kind(category.kind, kind)
}

/// Registra a movimentação, ou uma por parcela na compra parcelada.
pub async fn create<A, C, T>(
    accounts: &A,
    categories: &C,
    transactions: &T,
    env: Env<'_>,
    owner_id: Uuid,
    input: NewTransaction,
) -> Outcome<Vec<Transaction>>
where
    A: AccountRepository,
    C: CategoryRepository,
    T: TransactionRepository,
{
    validate_expected_amount(input.expected_amount)?;
    let description = optional_text(
        input.description.clone(),
        "description",
        DESCRIPTION_MAX_CHARS,
    )?;
    let account = accounts.get(owner_id, input.account_id).await?;
    check_category(categories, owner_id, input.category_id, input.kind).await?;
    let base = Transaction {
        id: env.ids.new_id(),
        owner_id,
        visibility: input.visibility,
        kind: input.kind,
        account_id: account.id,
        category_id: input.category_id,
        description,
        expected_amount: input.expected_amount,
        expected_date: input.expected_date,
        currency: account.currency,
        settlement: None,
        generated_from: None,
        occurrence_date: None,
        installment: None,
        installment_group_id: None,
        statement_period: account
            .card
            .map(|terms| terms.cycle.statement_for(input.expected_date)),
        created_at: env.clock.now(),
        updated_at: env.clock.now(),
    };
    let items = match input.installments {
        None => vec![base],
        Some(count) => installments(&account, base, count, env)?,
    };
    transactions.insert_many(&items).await?;
    Ok(items)
}

fn installments(
    account: &Account,
    base: Transaction,
    count: u32,
    env: Env<'_>,
) -> Outcome<Vec<Transaction>> {
    let Some(terms) = account.card else {
        return Err(FinanceError::invalid(
            "installments",
            "requires_credit_card",
        ));
    };
    if base.kind != TransactionKind::Expense {
        return Err(FinanceError::invalid("installments", "requires_expense"));
    }
    let plan = terms
        .cycle
        .plan_installments(base.expected_date, base.expected_amount, count)?;
    let group_id = base.id;
    Ok(plan
        .into_iter()
        .map(|planned| Transaction {
            id: if planned.number == 1 {
                base.id
            } else {
                env.ids.new_id()
            },
            expected_amount: planned.amount,
            expected_date: planned.expected_date,
            installment: Some(Installment {
                number: planned.number,
                total: planned.total,
            }),
            installment_group_id: Some(group_id),
            statement_period: Some(planned.period),
            ..base.clone()
        })
        .collect())
}

/// A recorrente entra numa listagem com este filtro?
fn recurring_matches(recurring: &RecurringTransaction, filter: &TransactionFilter) -> bool {
    filter
        .account_id
        .is_none_or(|id| id == recurring.account_id)
        && filter
            .category_id
            .is_none_or(|id| Some(id) == recurring.category_id)
        && filter.kind.is_none_or(|kind| kind == recurring.kind)
}

/// Itens virtuais das recorrentes no filtro, depois de `after`, até `limit` por
/// recorrente; nada é gravado (PD-51).
pub async fn virtual_items<R: RecurringTransactionRepository>(
    recurring: &R,
    env: Env<'_>,
    owner_id: Uuid,
    filter: &TransactionFilter,
    after: Option<(NaiveDate, Uuid)>,
    limit: usize,
) -> Outcome<Vec<VirtualOccurrence>> {
    if filter.repetition == Repetition::OneOff || filter.settled == Some(true) {
        return Ok(Vec::new());
    }
    // Datas antes do cursor não entram; na data dele, só chaves maiores.
    let from = match (filter.from, after) {
        (Some(from), Some((date, _))) => Some(from.max(date)),
        (from, after) => from.or(after.map(|(date, _)| date)),
    };
    let now = env.clock.now();
    let mut items = Vec::new();
    for model in search_recurring(recurring, owner_id, filter.q.as_deref()).await? {
        if !recurring_matches(&model, filter) {
            continue;
        }
        // Uma a mais cobre o item da data do cursor que o filtro abaixo descarta.
        let projected = project(&model, from, filter.to, now, limit.saturating_add(1));
        items.extend(projected.into_iter().filter(|item| {
            after.is_none_or(|position| (item.occurrence_date, item.recurrence_id) > position)
        }));
    }
    Ok(items)
}

/// Gravadas e virtuais do filtro, pela data efetiva e pela chave, cortadas em
/// `limit`.
pub async fn list<R, T>(
    recurring: &R,
    transactions: &T,
    env: Env<'_>,
    owner_id: Uuid,
    filter: &TransactionFilter,
    after: Option<(NaiveDate, Uuid)>,
    limit: u32,
) -> Outcome<Vec<FinanceItem>>
where
    R: RecurringTransactionRepository,
    T: TransactionRepository,
{
    let mut items: Vec<FinanceItem> = Vec::new();
    if filter.repetition != Repetition::Recurring {
        let stored = transactions.list(owner_id, filter, after, limit).await?;
        items.extend(stored.into_iter().map(FinanceItem::Stored));
    }
    let projected = virtual_items(recurring, env, owner_id, filter, after, limit as usize).await?;
    items.extend(projected.into_iter().map(FinanceItem::Virtual));
    sort_items(&mut items);
    items.truncate(limit as usize);
    Ok(items)
}

/// Todas as gravadas do filtro, página a página.
pub async fn list_all<T: TransactionRepository>(
    transactions: &T,
    owner_id: Uuid,
    filter: &TransactionFilter,
) -> Outcome<Vec<Transaction>> {
    let mut all: Vec<Transaction> = Vec::new();
    loop {
        let after = all.last().map(|item| (item.effective_date(), item.id));
        let page = transactions
            .list(owner_id, filter, after, super::SCAN_PAGE)
            .await?;
        let done = page.len() < super::SCAN_PAGE as usize;
        all.extend(page);
        if done {
            return Ok(all);
        }
    }
}

/// Todas as recorrentes do dono, página a página.
pub async fn list_all_recurring<R: RecurringTransactionRepository>(
    recurring: &R,
    owner_id: Uuid,
) -> Outcome<Vec<RecurringTransaction>> {
    search_recurring(recurring, owner_id, None).await
}

/// Recorrentes do dono com a busca opcional na descrição, página a página.
async fn search_recurring<R: RecurringTransactionRepository>(
    recurring: &R,
    owner_id: Uuid,
    q: Option<&str>,
) -> Outcome<Vec<RecurringTransaction>> {
    let mut all: Vec<RecurringTransaction> = Vec::new();
    loop {
        let after = all.last().map(|model| model.id);
        let page = recurring.list(owner_id, q, after, super::SCAN_PAGE).await?;
        let done = page.len() < super::SCAN_PAGE as usize;
        all.extend(page);
        if done {
            return Ok(all);
        }
    }
}

pub async fn settle<T: TransactionRepository>(
    transactions: &T,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
    request: SettlementRequest,
) -> Outcome<Transaction> {
    transactions
        .settle(owner_id, id, request, env.clock.now())
        .await
}

/// Campos da edição como chegam do pedido (DEC-005).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TransactionPatch {
    pub description: Option<String>,
    pub expected_amount: Option<i64>,
    pub expected_date: Option<NaiveDate>,
    pub account_id: Option<Uuid>,
    pub category_id: Option<Uuid>,
    pub visibility: Option<Visibility>,
}

/// Edita a movimentação: confere a conta e a categoria do mesmo tipo e grava sem
/// mexer no saldo.
pub async fn update<A, C, T>(
    accounts: &A,
    categories: &C,
    transactions: &T,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
    patch: TransactionPatch,
) -> Outcome<Transaction>
where
    A: AccountRepository,
    C: CategoryRepository,
    T: TransactionRepository,
{
    let current = transactions.get(owner_id, id).await?;
    check_category(categories, owner_id, patch.category_id, current.kind).await?;
    let account = match patch.account_id {
        Some(account_id) => {
            let account = accounts.get(owner_id, account_id).await?;
            Some((account.id, account.currency))
        }
        None => None,
    };
    let edit = TransactionEdit {
        description: patch.description,
        expected_amount: patch.expected_amount,
        expected_date: patch.expected_date,
        account,
        category_id: patch.category_id,
        visibility: patch.visibility,
    };
    transactions
        .update(owner_id, id, &edit, env.clock.now())
        .await
}

pub async fn undo_settlement<T: TransactionRepository>(
    transactions: &T,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
) -> Outcome<UndoneSettlement> {
    transactions
        .undo_settlement(owner_id, id, env.clock.now())
        .await
}

pub async fn delete<T: TransactionRepository>(
    transactions: &T,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
) -> Outcome<()> {
    transactions.delete(owner_id, id, env.clock.now()).await
}
