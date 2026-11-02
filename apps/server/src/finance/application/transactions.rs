//! Casos de uso de movimentações: registro, liquidação, listagem por período livre
//! com as ocorrências virtuais das recorrentes e exclusão (RF-27, RF-28, RF-32,
//! RF-33, PD-51, PD-52, PD-55). Com bruto e descontos e acréscimos (SPEC-004), cria e edita
//! pelo bruto e calcula a prévia da liquidação pelo líquido sem gravar (RF-01, RF-09).

use chrono::NaiveDate;
use uuid::Uuid;

use crate::finance::application::Env;
use crate::finance::application::ports::{
    AccountRepository, CategoryRepository, Outcome, RecurringTransactionRepository, Repetition,
    SettlementRequest, TransactionFilter, TransactionRepository, UndoneSettlement,
};
use crate::finance::domain::adjustment::{Adjustment, Breakdown, gross_for_net};
use crate::finance::domain::category::ensure_same_kind;
use crate::finance::domain::forecast::{FinanceItem, VirtualOccurrence, project, sort_items};
use crate::finance::domain::optional_text;
use crate::finance::domain::recurring_transaction::RecurringTransaction;
use crate::finance::domain::transaction::{
    DESCRIPTION_MAX_CHARS, Transaction, TransactionEdit, TransactionKind, planned_amounts,
};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewTransaction {
    pub kind: TransactionKind,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub description: Option<String>,
    pub expected_amount: Option<i64>,
    pub gross_amount: Option<i64>,
    pub adjustments: Vec<Adjustment>,
    pub expected_date: NaiveDate,
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

/// Registra a movimentação; a resposta é uma lista com um único item.
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
    let planned = planned_amounts(
        input.expected_amount,
        input.gross_amount,
        &input.adjustments,
    )?;
    let description = optional_text(
        input.description.clone(),
        "description",
        DESCRIPTION_MAX_CHARS,
    )?;
    let account = accounts.get(owner_id, input.account_id).await?;
    check_category(categories, owner_id, input.category_id, input.kind).await?;
    let item = Transaction {
        id: env.ids.new_id(),
        owner_id,
        visibility: input.visibility,
        kind: input.kind,
        account_id: account.id,
        category_id: input.category_id,
        description,
        expected_amount: planned.expected_amount,
        gross_amount: planned.gross_amount,
        adjustments: planned.adjustments,
        expected_date: input.expected_date,
        currency: account.currency,
        settlement: None,
        settled_adjustments: Vec::new(),
        generated_from: None,
        occurrence_date: None,
        created_at: env.clock.now(),
        updated_at: env.clock.now(),
    };
    let items = vec![item];
    transactions.insert_many(&items).await?;
    Ok(items)
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
    pub gross_amount: Option<i64>,
    pub adjustments: Option<Vec<Adjustment>>,
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
        gross_amount: patch.gross_amount,
        adjustments: patch.adjustments,
    };
    transactions
        .update(owner_id, id, &edit, env.clock.now())
        .await
}

/// Bruto e itens equivalentes a um líquido, sem gravar nada (RF-09, decisão 13).
pub fn preview_settlement(
    settled_amount: i64,
    adjustments: &[Adjustment],
    expected_gross_amount: i64,
) -> Outcome<Breakdown> {
    gross_for_net(settled_amount, adjustments, expected_gross_amount)
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
