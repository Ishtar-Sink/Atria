//! Repositório de transferências: os dois saldos mudam na mesma transação
//! ([project/database-03]).

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::finance::application::ports::{Outcome, TransferFilter, TransferRepository};
use crate::finance::domain::FinanceError;
use crate::finance::domain::transfer::Transfer;
use crate::finance::infrastructure::{
    Tx, add_to_balance, begin, commit, currency, escape_like, lock_account, period, storage,
};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone)]
pub struct PgTransfers {
    pool: PgPool,
}

impl PgTransfers {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct TransferRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    from_account_id: Uuid,
    to_account_id: Uuid,
    amount: i64,
    currency: String,
    transferred_on: NaiveDate,
    description: Option<String>,
    statement_period: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl TransferRow {
    fn into_domain(self) -> Outcome<Transfer> {
        Ok(Transfer {
            id: self.id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            from_account_id: self.from_account_id,
            to_account_id: self.to_account_id,
            amount: self.amount,
            currency: currency(&self.currency)?,
            transferred_on: self.transferred_on,
            description: self.description,
            statement_period: period(self.statement_period.as_deref())?,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

pub(crate) async fn insert_transfer(tx: &mut Tx<'_>, transfer: &Transfer) -> Outcome<()> {
    sqlx::query!(
        "INSERT INTO transfers (id, owner_id, visibility, from_account_id, to_account_id, amount, \
         currency, transferred_on, description, statement_period, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
        transfer.id,
        transfer.owner_id,
        transfer.visibility as _,
        transfer.from_account_id,
        transfer.to_account_id,
        transfer.amount,
        transfer.currency.as_str(),
        transfer.transferred_on as _,
        transfer.description.as_deref(),
        transfer.statement_period.map(|p| p.to_string()),
        transfer.created_at as _,
        transfer.updated_at as _
    )
    .execute(&mut **tx)
    .await
    .map_err(storage)?;
    Ok(())
}

async fn lock_both(tx: &mut Tx<'_>, owner_id: Uuid, a: Uuid, b: Uuid) -> Outcome<()> {
    let mut ids = [a, b];
    ids.sort();
    for id in ids {
        lock_account(tx, owner_id, id).await?;
    }
    Ok(())
}

impl TransferRepository for PgTransfers {
    async fn insert(&self, transfer: &Transfer) -> Outcome<()> {
        let owner_id = transfer.owner_id;
        let now = transfer.created_at;
        let mut tx = begin(&self.pool, owner_id).await?;
        lock_both(
            &mut tx,
            owner_id,
            transfer.from_account_id,
            transfer.to_account_id,
        )
        .await?;
        insert_transfer(&mut tx, transfer).await?;
        add_to_balance(
            &mut tx,
            owner_id,
            transfer.from_account_id,
            -transfer.amount,
            now,
        )
        .await?;
        add_to_balance(
            &mut tx,
            owner_id,
            transfer.to_account_id,
            transfer.amount,
            now,
        )
        .await?;
        commit(tx).await
    }

    async fn get(&self, owner_id: Uuid, id: Uuid) -> Outcome<Transfer> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let row: Option<TransferRow> = sqlx::query_as!(TransferRow, "SELECT id, owner_id, visibility AS \"visibility: _\", from_account_id, to_account_id, amount, currency, \
    transferred_on AS \"transferred_on: _\", description, statement_period, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM transfers WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL", id, owner_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        row.ok_or(FinanceError::NotFound)?.into_domain()
    }

    async fn list(
        &self,
        owner_id: Uuid,
        filter: &TransferFilter,
        after: Option<Uuid>,
        limit: u32,
    ) -> Outcome<Vec<Transfer>> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let rows: Vec<TransferRow> = sqlx::query_as!(TransferRow, "SELECT id, owner_id, visibility AS \"visibility: _\", from_account_id, to_account_id, amount, currency, \
    transferred_on AS \"transferred_on: _\", description, statement_period, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM transfers WHERE owner_id = $1 AND deleted_at IS NULL \
             AND ($2::uuid IS NULL OR id > $2) \
             AND ($3::date IS NULL OR transferred_on >= $3) \
             AND ($4::date IS NULL OR transferred_on <= $4) \
             AND ($5::text IS NULL OR finance_unaccent(lower(description)) LIKE '%' || \
    finance_unaccent(lower($5)) || '%' ESCAPE '\\') \
             ORDER BY id LIMIT $6", owner_id, after, filter.range.from as _, filter.range.to as _, filter.q.as_deref().map(escape_like), i64::from(limit))
        .fetch_all(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        rows.into_iter().map(TransferRow::into_domain).collect()
    }

    async fn between(
        &self,
        owner_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Outcome<Vec<Transfer>> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let rows: Vec<TransferRow> = sqlx::query_as!(TransferRow, "SELECT id, owner_id, visibility AS \"visibility: _\", from_account_id, to_account_id, amount, currency, \
    transferred_on AS \"transferred_on: _\", description, statement_period, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM transfers WHERE owner_id = $1 AND deleted_at IS NULL \
             AND transferred_on BETWEEN $2 AND $3 ORDER BY transferred_on, id", owner_id, from as _, to as _)
        .fetch_all(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        rows.into_iter().map(TransferRow::into_domain).collect()
    }

    async fn delete(&self, owner_id: Uuid, id: Uuid, now: DateTime<Utc>) -> Outcome<()> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let row: Option<TransferRow> = sqlx::query_as!(TransferRow, "SELECT id, owner_id, visibility AS \"visibility: _\", from_account_id, to_account_id, amount, currency, \
    transferred_on AS \"transferred_on: _\", description, statement_period, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM transfers WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL \
             FOR UPDATE", id, owner_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage)?;
        let transfer = row.ok_or(FinanceError::NotFound)?.into_domain()?;
        lock_both(
            &mut tx,
            owner_id,
            transfer.from_account_id,
            transfer.to_account_id,
        )
        .await?;
        sqlx::query!(
            "UPDATE transfers SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND owner_id = $3",
            now as _,
            id,
            owner_id
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        add_to_balance(
            &mut tx,
            owner_id,
            transfer.from_account_id,
            transfer.amount,
            now,
        )
        .await?;
        add_to_balance(
            &mut tx,
            owner_id,
            transfer.to_account_id,
            -transfer.amount,
            now,
        )
        .await?;
        commit(tx).await
    }
}
