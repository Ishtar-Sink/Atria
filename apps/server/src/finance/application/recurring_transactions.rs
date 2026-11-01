//! Casos de uso das movimentações recorrentes (RF-31, PD-51, DEC-003): criação,
//! mudança (vale para a aberta e as seguintes, RN-08), liquidação da aberta com
//! cópia, pulo e exclusão.

use chrono::NaiveDate;
use uuid::Uuid;

use crate::finance::application::Env;
use crate::finance::application::ports::{
    AccountRepository, CategoryRepository, Outcome, RecurringTransactionRepository,
};
use crate::finance::application::transactions::check_category;
use crate::finance::domain::optional_text;
use crate::finance::domain::recurring_transaction::{
    OccurrenceSettlement, RecurringTransaction, validate_rule,
};
use crate::finance::domain::transaction::{
    DESCRIPTION_MAX_CHARS, Transaction, TransactionKind, validate_expected_amount,
};
use crate::shared::recurrence::RecurrenceRule;
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewRecurringTransaction {
    pub kind: TransactionKind,
    pub account_id: Uuid,
    pub category_id: Option<Uuid>,
    pub expected_amount: i64,
    pub description: Option<String>,
    pub rule: RecurrenceRule,
    pub visibility: Visibility,
}

/// Campos ausentes ficam como estão; o que muda vale para a aberta e as seguintes.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RecurringTransactionPatch {
    pub account_id: Option<Uuid>,
    pub expected_amount: Option<i64>,
    pub category_id: Option<Uuid>,
    pub description: Option<String>,
    pub rule: Option<RecurrenceRule>,
}

pub async fn create<A, C, R>(
    accounts: &A,
    categories: &C,
    recurring: &R,
    env: Env<'_>,
    owner_id: Uuid,
    input: NewRecurringTransaction,
) -> Outcome<RecurringTransaction>
where
    A: AccountRepository,
    C: CategoryRepository,
    R: RecurringTransactionRepository,
{
    validate_expected_amount(input.expected_amount)?;
    validate_rule(&input.rule)?;
    let description = optional_text(input.description, "description", DESCRIPTION_MAX_CHARS)?;
    let account = accounts.get(owner_id, input.account_id).await?;
    check_category(categories, owner_id, input.category_id, input.kind).await?;
    let now = env.clock.now();
    let created = RecurringTransaction {
        id: env.ids.new_id(),
        owner_id,
        visibility: input.visibility,
        kind: input.kind,
        account_id: account.id,
        category_id: input.category_id,
        expected_amount: input.expected_amount,
        currency: account.currency,
        rule: input.rule,
        description,
        last_closed_on: None,
        created_at: now,
        updated_at: now,
    };
    recurring.insert(&created).await?;
    Ok(created)
}

pub async fn list<R: RecurringTransactionRepository>(
    recurring: &R,
    owner_id: Uuid,
    after: Option<Uuid>,
    limit: u32,
) -> Outcome<Vec<RecurringTransaction>> {
    recurring.list(owner_id, None, after, limit).await
}

/// Cópias liquidadas da recorrente, paginadas pela ocorrência (DEC-005).
pub async fn settled_copies<R: RecurringTransactionRepository>(
    recurring: &R,
    owner_id: Uuid,
    id: Uuid,
    after: Option<(NaiveDate, Uuid)>,
    limit: u32,
) -> Outcome<Vec<Transaction>> {
    recurring.settled_copies(owner_id, id, after, limit).await
}

/// Aplica a mudança na recorrente. As cópias liquidadas não mudam, e a aberta é
/// recalculada pela regra nova a partir de `last_closed_on`.
pub async fn change<A, C, R>(
    accounts: &A,
    categories: &C,
    recurring: &R,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
    patch: RecurringTransactionPatch,
) -> Outcome<RecurringTransaction>
where
    A: AccountRepository,
    C: CategoryRepository,
    R: RecurringTransactionRepository,
{
    let mut updated = recurring.get(owner_id, id).await?;
    if let Some(amount) = patch.expected_amount {
        validate_expected_amount(amount)?;
        updated.expected_amount = amount;
    }
    if let Some(account_id) = patch.account_id {
        let account = accounts.get(owner_id, account_id).await?;
        updated.account_id = account.id;
        updated.currency = account.currency;
    }
    if let Some(category_id) = patch.category_id {
        check_category(categories, owner_id, Some(category_id), updated.kind).await?;
        updated.category_id = Some(category_id);
    }
    if patch.description.is_some() {
        updated.description =
            optional_text(patch.description, "description", DESCRIPTION_MAX_CHARS)?;
    }
    if let Some(rule) = patch.rule {
        validate_rule(&rule)?;
        updated.rule = rule;
    }
    updated.updated_at = env.clock.now();
    recurring.update(&updated).await?;
    Ok(updated)
}

/// Liquida a ocorrência aberta e devolve a cópia liquidada.
pub async fn settle_occurrence<R: RecurringTransactionRepository>(
    recurring: &R,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
    request: OccurrenceSettlement,
) -> Outcome<Transaction> {
    recurring
        .settle_occurrence(owner_id, id, request, env.ids.new_id(), env.clock.now())
        .await
}

/// Pula a ocorrência aberta e devolve a recorrente na ocorrência seguinte.
pub async fn skip_occurrence<R: RecurringTransactionRepository>(
    recurring: &R,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
    occurrence_date: NaiveDate,
) -> Outcome<RecurringTransaction> {
    recurring
        .skip_occurrence(owner_id, id, occurrence_date, env.clock.now())
        .await
}

/// Exclui a recorrente e a aberta; as cópias liquidadas ficam no histórico (RF-01, RF-02, RF-03).
pub async fn delete<R: RecurringTransactionRepository>(
    recurring: &R,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
) -> Outcome<()> {
    recurring.delete(owner_id, id, env.clock.now()).await
}
