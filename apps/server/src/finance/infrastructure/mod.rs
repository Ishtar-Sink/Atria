//! Implementações PostgreSQL das portas do Financeiro. Cada operação abre uma
//! transação já identificada para a Row Level Security ([project/database-09]) e
//! filtra também por `owner_id` ([project/security-04]).

pub mod pg_accounts;
pub mod pg_categories;
pub mod pg_idempotency;
pub mod pg_payroll_loans;
pub mod pg_recurring_transactions;
pub mod pg_transactions;
pub mod pg_transfers;

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::types::Json;
use sqlx::{PgPool, Postgres, Transaction as DbTransaction};
use uuid::Uuid;

use crate::finance::domain::FinanceError;
use crate::finance::domain::adjustment::{
    Adjustment, AdjustmentDirection, AdjustmentMode, ComputedAdjustment,
};
use crate::finance::domain::payroll_loan::PayrollInstallment;
use crate::finance::domain::settlement::{DifferenceKind, Settlement};
use crate::finance::domain::transaction::{Transaction, TransactionKind};
use crate::shared::db::begin_for_user;
use crate::shared::money::Currency;
use crate::shared::visibility::Visibility;

pub use pg_accounts::PgAccounts;
pub use pg_categories::PgCategories;
pub use pg_idempotency::PgIdempotency;
pub use pg_payroll_loans::PgPayrollLoans;
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

/// Item de ajuste como fica nas colunas `JSONB`, com as chaves do contrato (RF-01).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub(crate) struct AdjustmentRow {
    name: String,
    direction: String,
    mode: String,
    amount: Option<i64>,
    rate_bp: Option<i32>,
    base_amount: Option<i64>,
    // As linhas da SPEC-004 não têm estas chaves e continuam iguais, sem migração: só são
    // gravadas com vínculo ou parcela, e a leitura usa o padrão (RNF-03).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    base_items: Vec<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    deduction_amount: Option<i64>,
    computed_amount: i64,
}

pub(crate) fn adjustment_rows(items: &[ComputedAdjustment]) -> Vec<AdjustmentRow> {
    items
        .iter()
        .map(|item| AdjustmentRow {
            name: item.adjustment.name.clone(),
            direction: item.adjustment.direction.as_str().to_owned(),
            mode: item.adjustment.mode.as_str().to_owned(),
            amount: item.adjustment.amount,
            rate_bp: item.adjustment.rate_bp,
            base_amount: item.adjustment.base_amount,
            base_items: item.adjustment.base_items.clone(),
            deduction_amount: item.adjustment.deduction_amount,
            computed_amount: item.computed_amount,
        })
        .collect()
}

pub(crate) fn adjustments_from_rows(
    rows: Vec<AdjustmentRow>,
) -> Result<Vec<ComputedAdjustment>, FinanceError> {
    rows.into_iter()
        .map(|row| {
            let direction =
                AdjustmentDirection::parse(&row.direction).ok_or_else(|| corrupt("adjustments"))?;
            let mode = AdjustmentMode::parse(&row.mode).ok_or_else(|| corrupt("adjustments"))?;
            Ok(ComputedAdjustment {
                adjustment: Adjustment {
                    name: row.name,
                    direction,
                    mode,
                    amount: row.amount,
                    rate_bp: row.rate_bp,
                    base_amount: row.base_amount,
                    base_items: row.base_items,
                    deduction_amount: row.deduction_amount,
                },
                computed_amount: row.computed_amount,
            })
        })
        .collect()
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
    gross_amount: i64,
    adjustments: Json<Vec<AdjustmentRow>>,
    expected_date: NaiveDate,
    settled_amount: Option<i64>,
    settled_gross_amount: Option<i64>,
    settled_adjustments: Option<Json<Vec<AdjustmentRow>>>,
    settled_at: Option<NaiveDate>,
    difference_amount: Option<i64>,
    difference_kind: Option<String>,
    currency: String,
    generated_from: Option<Uuid>,
    occurrence_date: Option<NaiveDate>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    payroll_loan_id: Option<Uuid>,
    income_transaction_id: Option<Uuid>,
    installment_number: Option<i16>,
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
                gross_amount: self.settled_gross_amount.unwrap_or(settled_amount),
            }),
            _ => None,
        };
        let payroll = match (self.payroll_loan_id, self.income_transaction_id) {
            (Some(loan_id), Some(income_transaction_id)) => Some(PayrollInstallment {
                loan_id,
                income_transaction_id,
                number: self.installment_number,
            }),
            (None, None) if self.installment_number.is_none() => None,
            _ => return Err(corrupt("payroll_loan_id")),
        };
        let settled_adjustments = match self.settled_adjustments {
            Some(Json(rows)) => adjustments_from_rows(rows)?,
            None => Vec::new(),
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
            gross_amount: self.gross_amount,
            adjustments: adjustments_from_rows(self.adjustments.0)?,
            expected_date: self.expected_date,
            currency: currency(&self.currency)?,
            settlement,
            settled_adjustments,
            generated_from: self.generated_from,
            occurrence_date: self.occurrence_date,
            payroll,
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
    sqlx::query!(
        "INSERT INTO transactions (id, owner_id, visibility, kind, account_id, category_id, \
         description, expected_amount, gross_amount, adjustments, expected_date, currency, \
         generated_from, occurrence_date, created_at, updated_at, payroll_loan_id, \
         income_transaction_id, installment_number) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, \
         $19)",
        item.id,
        item.owner_id,
        item.visibility as _,
        item.kind.as_str(),
        item.account_id,
        item.category_id,
        item.description.as_deref(),
        item.expected_amount,
        item.gross_amount,
        Json(adjustment_rows(&item.adjustments)) as _,
        item.expected_date as _,
        item.currency.as_str(),
        item.generated_from,
        item.occurrence_date as _,
        item.created_at as _,
        item.updated_at as _,
        item.payroll.map(|link| link.loan_id),
        item.payroll.map(|link| link.income_transaction_id),
        item.payroll.and_then(|link| link.number)
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
         difference_kind = $4, settled_gross_amount = $5, settled_adjustments = $6, \
         updated_at = $7 WHERE id = $8 AND owner_id = $9",
        done.settled_amount,
        done.settled_at as _,
        done.difference_amount,
        done.difference_kind.map(DifferenceKind::as_str),
        done.gross_amount,
        Json(adjustment_rows(&item.settled_adjustments)) as _,
        item.updated_at as _,
        item.id,
        item.owner_id
    )
    .execute(&mut **tx)
    .await
    .map_err(storage)?;
    Ok(())
}
