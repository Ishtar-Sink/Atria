//! Repositório das recorrências: o modelo, a regra e `last_closed_on`. A liquidação
//! e o pulo da ocorrência aberta acontecem numa transação, com a recorrente travada
//! por `FOR UPDATE` ([project/database-03]).

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use sqlx::types::Json;
use uuid::Uuid;

use crate::finance::application::ports::{Outcome, RecurringTransactionRepository};
use crate::finance::domain::FinanceError;
use crate::finance::domain::recurring_transaction::{OccurrenceSettlement, RecurringTransaction};
use crate::finance::domain::transaction::{Transaction, TransactionKind};
use crate::finance::infrastructure::{
    TransactionRow, Tx, add_to_balance, begin, card_cycle, commit, corrupt, currency, escape_like,
    insert_transaction, lock_account, save_settlement, storage,
};
use crate::shared::recurrence::RecurrenceRule;
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone)]
pub struct PgRecurringTransactions {
    pool: PgPool,
}

impl PgRecurringTransactions {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct RecurringRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    kind: String,
    account_id: Uuid,
    category_id: Option<Uuid>,
    expected_amount: i64,
    currency: String,
    rule: Json<RecurrenceRule>,
    description: Option<String>,
    last_closed_on: Option<NaiveDate>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl RecurringRow {
    fn into_domain(self) -> Outcome<RecurringTransaction> {
        Ok(RecurringTransaction {
            id: self.id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            kind: TransactionKind::parse(&self.kind).ok_or_else(|| corrupt("kind"))?,
            account_id: self.account_id,
            category_id: self.category_id,
            expected_amount: self.expected_amount,
            currency: currency(&self.currency)?,
            rule: self.rule.0,
            description: self.description,
            last_closed_on: self.last_closed_on,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

/// Trava a recorrente do dono para mudar a ocorrência aberta.
pub(crate) async fn lock_recurring(
    tx: &mut Tx<'_>,
    owner_id: Uuid,
    id: Uuid,
) -> Outcome<RecurringTransaction> {
    let row: Option<RecurringRow> = sqlx::query_as!(RecurringRow, "SELECT id, owner_id, visibility AS \"visibility: _\", kind, account_id, category_id, expected_amount, \
    currency, rule AS \"rule: _\", description, last_closed_on AS \"last_closed_on: _\", created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM recurring_transactions \
         WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL FOR UPDATE", id, owner_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(storage)?;
    row.ok_or(FinanceError::NotFound)?.into_domain()
}

pub(crate) async fn save_last_closed(
    tx: &mut Tx<'_>,
    recurring: &RecurringTransaction,
) -> Outcome<()> {
    sqlx::query!(
        "UPDATE recurring_transactions SET last_closed_on = $1, updated_at = $2 \
         WHERE id = $3 AND owner_id = $4",
        recurring.last_closed_on as _,
        recurring.updated_at as _,
        recurring.id,
        recurring.owner_id
    )
    .execute(&mut **tx)
    .await
    .map_err(storage)?;
    Ok(())
}

impl RecurringTransactionRepository for PgRecurringTransactions {
    async fn insert(&self, recurring: &RecurringTransaction) -> Outcome<()> {
        let mut tx = begin(&self.pool, recurring.owner_id).await?;
        sqlx::query!("INSERT INTO recurring_transactions (id, owner_id, visibility, kind, account_id, \
             category_id, expected_amount, currency, rule, description, last_closed_on, \
             created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)", recurring.id, recurring.owner_id, recurring.visibility as _, recurring.kind.as_str(), recurring.account_id, recurring.category_id, recurring.expected_amount, recurring.currency.as_str(), Json(&recurring.rule) as _, recurring.description.as_deref(), recurring.last_closed_on as _, recurring.created_at as _, recurring.updated_at as _)
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await
    }

    async fn get(&self, owner_id: Uuid, id: Uuid) -> Outcome<RecurringTransaction> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let row: Option<RecurringRow> = sqlx::query_as!(RecurringRow, "SELECT id, owner_id, visibility AS \"visibility: _\", kind, account_id, category_id, expected_amount, \
    currency, rule AS \"rule: _\", description, last_closed_on AS \"last_closed_on: _\", created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM recurring_transactions \
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL", id, owner_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        row.ok_or(FinanceError::NotFound)?.into_domain()
    }

    async fn list(
        &self,
        owner_id: Uuid,
        q: Option<&str>,
        after: Option<Uuid>,
        limit: u32,
    ) -> Outcome<Vec<RecurringTransaction>> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let rows: Vec<RecurringRow> = sqlx::query_as!(RecurringRow, "SELECT id, owner_id, visibility AS \"visibility: _\", kind, account_id, category_id, expected_amount, \
    currency, rule AS \"rule: _\", description, last_closed_on AS \"last_closed_on: _\", created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM recurring_transactions WHERE owner_id = $1 \
             AND deleted_at IS NULL AND ($2::uuid IS NULL OR id > $2) \
             AND ($3::text IS NULL OR finance_unaccent(lower(description)) LIKE '%' || \
    finance_unaccent(lower($3)) || '%' ESCAPE '\\') \
             ORDER BY id LIMIT $4", owner_id, after, q.map(escape_like), i64::from(limit))
        .fetch_all(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        rows.into_iter().map(RecurringRow::into_domain).collect()
    }

    async fn settled_copies(
        &self,
        owner_id: Uuid,
        id: Uuid,
        after: Option<(NaiveDate, Uuid)>,
        limit: u32,
    ) -> Outcome<Vec<Transaction>> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let found: Option<Uuid> = sqlx::query_scalar!(
            "SELECT id FROM recurring_transactions WHERE id = $1 AND owner_id = $2 \
             AND deleted_at IS NULL",
            id,
            owner_id
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage)?;
        found.ok_or(FinanceError::NotFound)?;
        let (after_date, after_id) = after.unzip();
        // Da ocorrência mais recente para a mais antiga; o id desempata.
        let rows: Vec<TransactionRow> = sqlx::query_as!(TransactionRow, "SELECT id, owner_id, visibility AS \"visibility: _\", kind, account_id, \
    category_id, description, expected_amount, expected_date AS \"expected_date: _\", settled_amount, settled_at AS \"settled_at: _\", \
    difference_amount, difference_kind, currency, generated_from, occurrence_date AS \"occurrence_date: _\", \
    installment_number, installment_total, installment_group_id, statement_period, \
    created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM transactions WHERE owner_id = $1 \
             AND generated_from = $2 AND deleted_at IS NULL \
             AND ($3::date IS NULL OR occurrence_date < $3 \
                  OR (occurrence_date = $3 AND id > $4)) \
             ORDER BY occurrence_date DESC, id LIMIT $5", owner_id, id, after_date as _, after_id, i64::from(limit))
        .fetch_all(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        rows.into_iter().map(TransactionRow::into_domain).collect()
    }

    async fn update(&self, recurring: &RecurringTransaction) -> Outcome<()> {
        let mut tx = begin(&self.pool, recurring.owner_id).await?;
        // A trava espera uma liquidação em curso, para não gravar por cima dela.
        lock_recurring(&mut tx, recurring.owner_id, recurring.id).await?;
        sqlx::query!(
            "UPDATE recurring_transactions SET account_id = $1, category_id = $2, \
             expected_amount = $3, currency = $4, rule = $5, description = $6, updated_at = $7 \
             WHERE id = $8 AND owner_id = $9 AND deleted_at IS NULL",
            recurring.account_id,
            recurring.category_id,
            recurring.expected_amount,
            recurring.currency.as_str(),
            Json(&recurring.rule) as _,
            recurring.description.as_deref(),
            recurring.updated_at as _,
            recurring.id,
            recurring.owner_id
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await
    }

    async fn settle_occurrence(
        &self,
        owner_id: Uuid,
        id: Uuid,
        request: OccurrenceSettlement,
        copy_id: Uuid,
        now: DateTime<Utc>,
    ) -> Outcome<Transaction> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let mut recurring = lock_recurring(&mut tx, owner_id, id).await?;
        let cycle = card_cycle(&mut tx, owner_id, recurring.account_id).await?;
        let period = cycle.map(|cycle| cycle.statement_for(request.occurrence_date));
        let (copy, delta) = recurring.settle_open(copy_id, request, period, now)?;
        lock_account(&mut tx, owner_id, copy.account_id).await?;
        insert_transaction(&mut tx, &copy).await?;
        save_settlement(&mut tx, &copy).await?;
        add_to_balance(&mut tx, owner_id, copy.account_id, delta, now).await?;
        save_last_closed(&mut tx, &recurring).await?;
        commit(tx).await?;
        Ok(copy)
    }

    async fn skip_occurrence(
        &self,
        owner_id: Uuid,
        id: Uuid,
        occurrence_date: NaiveDate,
        now: DateTime<Utc>,
    ) -> Outcome<RecurringTransaction> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let mut recurring = lock_recurring(&mut tx, owner_id, id).await?;
        recurring.skip_open(occurrence_date, now)?;
        save_last_closed(&mut tx, &recurring).await?;
        commit(tx).await?;
        Ok(recurring)
    }
}
