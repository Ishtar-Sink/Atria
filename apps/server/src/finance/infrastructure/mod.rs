//! Implementações PostgreSQL das portas do Financeiro. Cada operação abre uma
//! transação já identificada para a Row Level Security ([project/database-09]) e
//! filtra também por `owner_id` ([project/security-04]).

pub mod pg_accounts;
pub mod pg_categories;
pub mod pg_idempotency;
pub mod pg_recurring_transactions;
pub mod pg_transactions;
pub mod pg_transfers;

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::{PgPool, Postgres, Transaction as DbTransaction};
use uuid::Uuid;

use crate::finance::domain::FinanceError;
use crate::finance::domain::credit_card::{CardCycle, StatementPeriod};
use crate::finance::domain::settlement::{DifferenceKind, Settlement};
use crate::finance::domain::transaction::{Installment, Transaction, TransactionKind};
use crate::shared::db::begin_for_user;
use crate::shared::money::Currency;
use crate::shared::visibility::Visibility;

pub use pg_accounts::PgAccounts;
pub use pg_categories::PgCategories;
pub use pg_idempotency::PgIdempotency;
pub use pg_recurring_transactions::PgRecurringTransactions;
pub use pg_transactions::PgTransactions;
pub use pg_transfers::PgTransfers;

pub(crate) type Tx<'a> = DbTransaction<'a, Postgres>;

/// Linha que não corresponde ao domínio; só o nome da coluna vai para o log.
#[derive(Debug, thiserror::Error)]
#[error("valor inválido na coluna {0}")]
pub(crate) struct CorruptRow(pub &'static str);

pub(crate) fn storage(error: sqlx::Error) -> FinanceError {
    FinanceError::storage(error)
}

pub(crate) fn corrupt(column: &'static str) -> FinanceError {
    FinanceError::storage(CorruptRow(column))
}

/// Escapa os curingas do `LIKE`, para a busca achar o texto literal.
pub(crate) fn escape_like(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    for character in text.chars() {
        if matches!(character, '%' | '_' | '\\') {
            escaped.push('\\');
        }
        escaped.push(character);
    }
    escaped
}

pub(crate) fn is_unique_violation(error: &sqlx::Error) -> bool {
    error
        .as_database_error()
        .is_some_and(|db| db.code().as_deref() == Some("23505"))
}

pub(crate) async fn begin(pool: &PgPool, owner_id: Uuid) -> Result<Tx<'_>, FinanceError> {
    begin_for_user(pool, owner_id).await.map_err(storage)
}

pub(crate) async fn commit(tx: Tx<'_>) -> Result<(), FinanceError> {
    tx.commit().await.map_err(storage)
}

pub(crate) fn currency(text: &str) -> Result<Currency, FinanceError> {
    Currency::new(text.trim()).map_err(|_| corrupt("currency"))
}

pub(crate) fn period(text: Option<&str>) -> Result<Option<StatementPeriod>, FinanceError> {
    text.map(|value| {
        StatementPeriod::parse(value.trim()).ok_or_else(|| corrupt("statement_period"))
    })
    .transpose()
}

pub(crate) fn day(value: Option<i16>, column: &'static str) -> Result<Option<u32>, FinanceError> {
    value
        .map(|day| u32::try_from(day).map_err(|_| corrupt(column)))
        .transpose()
}

pub(crate) fn small(value: u32, column: &'static str) -> Result<i16, FinanceError> {
    i16::try_from(value).map_err(|_| corrupt(column))
}

/// Trava a conta para mudar o saldo e confere o dono.
pub(crate) async fn lock_account(
    tx: &mut Tx<'_>,
    owner_id: Uuid,
    account_id: Uuid,
) -> Result<(), FinanceError> {
    let found: Option<Uuid> = sqlx::query_scalar!(
        "SELECT id FROM accounts WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL FOR UPDATE",
        account_id,
        owner_id
    )
    .fetch_optional(&mut **tx)
    .await
    .map_err(storage)?;
    found.map(|_| ()).ok_or(FinanceError::NotFound)
}

pub(crate) async fn add_to_balance(
    tx: &mut Tx<'_>,
    owner_id: Uuid,
    account_id: Uuid,
    delta: i64,
    now: DateTime<Utc>,
) -> Result<(), FinanceError> {
    if delta == 0 {
        return Ok(());
    }
    let result = sqlx::query!(
        "UPDATE accounts SET balance_amount = balance_amount + $1, updated_at = $2 \
         WHERE id = $3 AND owner_id = $4 AND deleted_at IS NULL",
        delta,
        now as _,
        account_id,
        owner_id
    )
    .execute(&mut **tx)
    .await
    .map_err(storage)?;
    if result.rows_affected() == 0 {
        return Err(FinanceError::NotFound);
    }
    Ok(())
}

/// Ciclo do cartão da conta, quando ela é um cartão.
pub(crate) async fn card_cycle(
    tx: &mut Tx<'_>,
    owner_id: Uuid,
    account_id: Uuid,
) -> Result<Option<CardCycle>, FinanceError> {
    let row = sqlx::query!(
        "SELECT closing_day, due_day FROM accounts WHERE id = $1 AND owner_id = $2",
        account_id,
        owner_id
    )
    .fetch_optional(&mut **tx)
    .await
    .map_err(storage)?
    .map(|row| (row.closing_day, row.due_day));
    let Some((Some(closing), Some(due))) = row else {
        return Ok(None);
    };
    let closing = day(Some(closing), "closing_day")?.unwrap_or(1);
    let due = day(Some(due), "due_day")?.unwrap_or(1);
    CardCycle::new(closing, due).map(Some)
}

#[derive(Debug, sqlx::FromRow)]
pub(crate) struct TransactionRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    kind: String,
    account_id: Uuid,
    category_id: Option<Uuid>,
    description: Option<String>,
    expected_amount: i64,
    expected_date: NaiveDate,
    settled_amount: Option<i64>,
    settled_at: Option<NaiveDate>,
    difference_amount: Option<i64>,
    difference_kind: Option<String>,
    currency: String,
    generated_from: Option<Uuid>,
    occurrence_date: Option<NaiveDate>,
    installment_number: Option<i16>,
    installment_total: Option<i16>,
    installment_group_id: Option<Uuid>,
    statement_period: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl TransactionRow {
    pub(crate) fn into_domain(self) -> Result<Transaction, FinanceError> {
        let kind = TransactionKind::parse(&self.kind).ok_or_else(|| corrupt("kind"))?;
        let settlement = match (self.settled_amount, self.settled_at) {
            (Some(settled_amount), Some(settled_at)) => Some(Settlement {
                settled_amount,
                settled_at,
                difference_amount: self.difference_amount.unwrap_or(0),
                difference_kind: self
                    .difference_kind
                    .as_deref()
                    .map(|text| {
                        DifferenceKind::parse(text).ok_or_else(|| corrupt("difference_kind"))
                    })
                    .transpose()?,
            }),
            _ => None,
        };
        let installment = match (self.installment_number, self.installment_total) {
            (Some(number), Some(total)) => Some(Installment {
                number: u32::try_from(number).map_err(|_| corrupt("installment_number"))?,
                total: u32::try_from(total).map_err(|_| corrupt("installment_total"))?,
            }),
            _ => None,
        };
        Ok(Transaction {
            id: self.id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            kind,
            account_id: self.account_id,
            category_id: self.category_id,
            description: self.description,
            expected_amount: self.expected_amount,
            expected_date: self.expected_date,
            currency: currency(&self.currency)?,
            settlement,
            generated_from: self.generated_from,
            occurrence_date: self.occurrence_date,
            installment,
            installment_group_id: self.installment_group_id,
            statement_period: period(self.statement_period.as_deref())?,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

/// Grava uma movimentação nova. A unicidade de `(generated_from, occurrence_date)`
/// recusa uma segunda cópia da mesma ocorrência (RN-09).
pub(crate) async fn insert_transaction(
    tx: &mut Tx<'_>,
    item: &Transaction,
) -> Result<(), FinanceError> {
    let installment_number = item
        .installment
        .map(|i| small(i.number, "installment_number"))
        .transpose()?;
    let installment_total = item
        .installment
        .map(|i| small(i.total, "installment_total"))
        .transpose()?;
    sqlx::query!(
        "INSERT INTO transactions (id, owner_id, visibility, kind, account_id, category_id, \
         description, expected_amount, expected_date, currency, generated_from, occurrence_date, \
         installment_number, installment_total, installment_group_id, statement_period, \
         created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)",
        item.id,
        item.owner_id,
        item.visibility as _,
        item.kind.as_str(),
        item.account_id,
        item.category_id,
        item.description.as_deref(),
        item.expected_amount,
        item.expected_date as _,
        item.currency.as_str(),
        item.generated_from,
        item.occurrence_date as _,
        installment_number,
        installment_total,
        item.installment_group_id,
        item.statement_period.map(|p| p.to_string()),
        item.created_at as _,
        item.updated_at as _
    )
    .execute(&mut **tx)
    .await
    .map_err(|error| {
        if item.generated_from.is_some() && is_unique_violation(&error) {
            return FinanceError::OccurrenceNotOpen;
        }
        storage(error)
    })?;
    Ok(())
}

/// Grava os efetivos de uma movimentação liquidada.
pub(crate) async fn save_settlement(
    tx: &mut Tx<'_>,
    item: &Transaction,
) -> Result<(), FinanceError> {
    let Some(done) = item.settlement else {
        return Ok(());
    };
    sqlx::query!(
        "UPDATE transactions SET settled_amount = $1, settled_at = $2, difference_amount = $3, \
         difference_kind = $4, updated_at = $5 WHERE id = $6 AND owner_id = $7",
        done.settled_amount,
        done.settled_at as _,
        done.difference_amount,
        done.difference_kind.map(DifferenceKind::as_str),
        item.updated_at as _,
        item.id,
        item.owner_id
    )
    .execute(&mut **tx)
    .await
    .map_err(storage)?;
    Ok(())
}
