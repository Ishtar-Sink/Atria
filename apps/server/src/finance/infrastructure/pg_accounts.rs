//! Repositório de contas.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::finance::application::ports::{AccountRepository, Outcome};
use crate::finance::domain::FinanceError;
use crate::finance::domain::account::Account;
use crate::finance::infrastructure::{begin, commit, currency, storage};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone)]
pub struct PgAccounts {
    pool: PgPool,
}

impl PgAccounts {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct AccountRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    name: String,
    is_default: bool,
    balance_amount: i64,
    currency: String,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl AccountRow {
    fn into_domain(self) -> Outcome<Account> {
        Ok(Account {
            id: self.id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            name: self.name,
            is_default: self.is_default,
            balance_amount: self.balance_amount,
            currency: currency(&self.currency)?,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

impl AccountRepository for PgAccounts {
    async fn ensure_default(&self, owner_id: Uuid, candidate: &Account) -> Outcome<()> {
        let mut tx = begin(&self.pool, owner_id).await?;
        sqlx::query!(
            "INSERT INTO accounts (id, owner_id, visibility, name, is_default, \
             balance_amount, currency, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, true, 0, $5, $6, $7) \
             ON CONFLICT (owner_id) WHERE is_default AND deleted_at IS NULL DO NOTHING",
            candidate.id,
            owner_id,
            candidate.visibility as _,
            &candidate.name,
            candidate.currency.as_str(),
            candidate.created_at as _,
            candidate.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await
    }

    async fn list(&self, owner_id: Uuid, after: Option<Uuid>, limit: u32) -> Outcome<Vec<Account>> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let rows: Vec<AccountRow> = sqlx::query_as!(AccountRow, "SELECT id, owner_id, visibility AS \"visibility: _\", name, is_default, balance_amount, currency, \
    created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM accounts WHERE owner_id = $1 AND deleted_at IS NULL \
             AND ($2::uuid IS NULL OR id > $2) ORDER BY id LIMIT $3", owner_id, after, i64::from(limit))
        .fetch_all(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        rows.into_iter().map(AccountRow::into_domain).collect()
    }

    async fn get(&self, owner_id: Uuid, id: Uuid) -> Outcome<Account> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let row: Option<AccountRow> = sqlx::query_as!(AccountRow, "SELECT id, owner_id, visibility AS \"visibility: _\", name, is_default, balance_amount, currency, \
    created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM accounts WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL", id, owner_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        row.ok_or(FinanceError::NotFound)?.into_domain()
    }

    async fn insert(&self, account: &Account) -> Outcome<()> {
        let mut tx = begin(&self.pool, account.owner_id).await?;
        sqlx::query!(
            "INSERT INTO accounts (id, owner_id, visibility, name, is_default, \
             balance_amount, currency, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, false, 0, $5, $6, $7)",
            account.id,
            account.owner_id,
            account.visibility as _,
            &account.name,
            account.currency.as_str(),
            account.created_at as _,
            account.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await
    }

    async fn update(&self, account: &Account) -> Outcome<()> {
        let mut tx = begin(&self.pool, account.owner_id).await?;
        let result = sqlx::query!(
            "UPDATE accounts SET name = $1, visibility = $2, updated_at = $3 \
             WHERE id = $4 AND owner_id = $5 AND deleted_at IS NULL",
            &account.name,
            account.visibility as _,
            account.updated_at as _,
            account.id,
            account.owner_id
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        if result.rows_affected() == 0 {
            return Err(FinanceError::NotFound);
        }
        commit(tx).await
    }

    async fn delete(&self, owner_id: Uuid, id: Uuid, now: DateTime<Utc>) -> Outcome<()> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let row: Option<AccountRow> = sqlx::query_as!(AccountRow, "SELECT id, owner_id, visibility AS \"visibility: _\", name, is_default, balance_amount, currency, \
    created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM accounts WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL \
             FOR UPDATE", id, owner_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage)?;
        let account = row.ok_or(FinanceError::NotFound)?.into_domain()?;
        account.ensure_deletable()?;
        let in_use: bool = sqlx::query_scalar!("SELECT EXISTS (SELECT 1 FROM transactions WHERE account_id = $1 AND deleted_at IS NULL) \
             OR EXISTS (SELECT 1 FROM transfers WHERE (from_account_id = $1 OR to_account_id = $1) \
                        AND deleted_at IS NULL) \
             OR EXISTS (SELECT 1 FROM recurring_transactions WHERE account_id = $1 \
                        AND deleted_at IS NULL) AS \"in_use!\"", id)
        .fetch_one(&mut *tx)
        .await
        .map_err(storage)?;
        if in_use {
            return Err(FinanceError::AccountHasTransactions);
        }
        sqlx::query!(
            "UPDATE accounts SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND owner_id = $3",
            now as _,
            id,
            owner_id
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await
    }
}
