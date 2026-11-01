//! Repositório de contas. A exclusão com conta de destino move tudo e acerta os dois
//! saldos numa única transação ([project/database-03]).

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::finance::application::ports::{AccountRepository, Outcome};
use crate::finance::domain::FinanceError;
use crate::finance::domain::account::Account;
use crate::finance::infrastructure::{Tx, add_to_balance, begin, commit, currency, storage};
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

    async fn delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        move_to: Option<Uuid>,
        now: DateTime<Utc>,
    ) -> Outcome<Vec<Uuid>> {
        let mut tx = begin(&self.pool, owner_id).await?;
        // Linhas antes das contas, como em `settle` e `undo_settlement`: a mesma ordem de
        // travas evita o impasse com uma liquidação simultânea.
        sqlx::query_scalar!(
            "SELECT id FROM transactions WHERE account_id = $1 AND owner_id = $2 \
             AND deleted_at IS NULL ORDER BY id FOR UPDATE",
            id,
            owner_id,
        )
        .fetch_all(&mut *tx)
        .await
        .map_err(storage)?;
        sqlx::query_scalar!(
            "SELECT id FROM recurring_transactions WHERE account_id = $1 AND owner_id = $2 \
             AND deleted_at IS NULL ORDER BY id FOR UPDATE",
            id,
            owner_id,
        )
        .fetch_all(&mut *tx)
        .await
        .map_err(storage)?;
        sqlx::query_scalar!(
            "SELECT id FROM transfers WHERE (from_account_id = $1 OR to_account_id = $1) \
             AND owner_id = $2 AND deleted_at IS NULL ORDER BY id FOR UPDATE",
            id,
            owner_id,
        )
        .fetch_all(&mut *tx)
        .await
        .map_err(storage)?;
        // As contas em ordem de id, como `lock_both`.
        let mut ids = vec![id];
        ids.extend(move_to);
        ids.sort();
        let mut account = None;
        let mut target = None;
        for locked_id in ids {
            let found = locked(&mut tx, owner_id, locked_id).await?;
            if locked_id == id {
                account = found;
            } else {
                target = Some(found.ok_or(FinanceError::invalid("move_to", "not_found"))?);
            }
        }
        let account = account.ok_or(FinanceError::NotFound)?;
        account.ensure_deletable()?;
        if let Some(target) = &target
            && target.currency != account.currency
        {
            return Err(FinanceError::CurrencyMismatch);
        }
        let in_use: bool = sqlx::query_scalar!("SELECT EXISTS (SELECT 1 FROM transactions WHERE account_id = $1 AND deleted_at IS NULL) \
             OR EXISTS (SELECT 1 FROM transfers WHERE (from_account_id = $1 OR to_account_id = $1) \
                        AND deleted_at IS NULL) \
             OR EXISTS (SELECT 1 FROM recurring_transactions WHERE account_id = $1 \
                        AND deleted_at IS NULL) AS \"in_use!\"", id)
        .fetch_one(&mut *tx)
        .await
        .map_err(storage)?;
        let mut deleted_transfers = Vec::new();
        if let Some(target) = target {
            let between = sqlx::query!(
                "UPDATE transfers SET deleted_at = $1, updated_at = $1 WHERE owner_id = $2 \
                 AND deleted_at IS NULL AND ((from_account_id = $3 AND to_account_id = $4) \
                 OR (from_account_id = $4 AND to_account_id = $3)) \
                 RETURNING id, from_account_id, amount",
                now as _,
                owner_id,
                id,
                target.id,
            )
            .fetch_all(&mut *tx)
            .await
            .map_err(storage)?;
            // Reverter cada transferência entre as duas antes de mover o resto (RN-05).
            let mut source_delta: i64 = 0;
            let mut target_delta: i64 = 0;
            for transfer in between {
                if transfer.from_account_id == id {
                    source_delta = source_delta.saturating_add(transfer.amount);
                    target_delta = target_delta.saturating_sub(transfer.amount);
                } else {
                    source_delta = source_delta.saturating_sub(transfer.amount);
                    target_delta = target_delta.saturating_add(transfer.amount);
                }
                deleted_transfers.push(transfer.id);
            }
            sqlx::query!(
                "UPDATE transactions SET account_id = $1, updated_at = $2 \
                 WHERE account_id = $3 AND owner_id = $4 AND deleted_at IS NULL",
                target.id,
                now as _,
                id,
                owner_id,
            )
            .execute(&mut *tx)
            .await
            .map_err(storage)?;
            sqlx::query!(
                "UPDATE recurring_transactions SET account_id = $1, updated_at = $2 \
                 WHERE account_id = $3 AND owner_id = $4 AND deleted_at IS NULL",
                target.id,
                now as _,
                id,
                owner_id,
            )
            .execute(&mut *tx)
            .await
            .map_err(storage)?;
            sqlx::query!(
                "UPDATE transfers SET from_account_id = $1, updated_at = $2 \
                 WHERE from_account_id = $3 AND owner_id = $4 AND deleted_at IS NULL",
                target.id,
                now as _,
                id,
                owner_id,
            )
            .execute(&mut *tx)
            .await
            .map_err(storage)?;
            sqlx::query!(
                "UPDATE transfers SET to_account_id = $1, updated_at = $2 \
                 WHERE to_account_id = $3 AND owner_id = $4 AND deleted_at IS NULL",
                target.id,
                now as _,
                id,
                owner_id,
            )
            .execute(&mut *tx)
            .await
            .map_err(storage)?;
            // O destino recebe o que restou na conta excluída depois das reversões.
            let remaining = account.balance_amount.saturating_add(source_delta);
            add_to_balance(
                &mut tx,
                owner_id,
                target.id,
                target_delta.saturating_add(remaining),
                now,
            )
            .await?;
        } else if in_use {
            return Err(FinanceError::AccountHasTransactions);
        }
        // Saldo zerado: o valor foi para o destino, e o saldo total da pessoa não muda.
        sqlx::query!(
            "UPDATE accounts SET balance_amount = 0, deleted_at = $1, updated_at = $1 \
             WHERE id = $2 AND owner_id = $3",
            now as _,
            id,
            owner_id
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        Ok(deleted_transfers)
    }
}

async fn locked(tx: &mut Tx<'_>, owner_id: Uuid, id: Uuid) -> Outcome<Option<Account>> {
    let row: Option<AccountRow> = sqlx::query_as!(AccountRow, "SELECT id, owner_id, visibility AS \"visibility: _\", name, is_default, balance_amount, currency, \
    created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM accounts WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL \
             FOR UPDATE", id, owner_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(storage)?;
    row.map(AccountRow::into_domain).transpose()
}
