//! Repositório de contas.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::finance::application::ports::{AccountRepository, Outcome};
use crate::finance::domain::FinanceError;
use crate::finance::domain::account::{Account, AccountKind, CreditCardTerms};
use crate::finance::domain::credit_card::CardCycle;
use crate::finance::infrastructure::{begin, commit, corrupt, currency, day, small, storage};
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
    kind: String,
    is_default: bool,
    balance_amount: i64,
    currency: String,
    credit_limit_amount: Option<i64>,
    closing_day: Option<i16>,
    due_day: Option<i16>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl AccountRow {
    fn into_domain(self) -> Outcome<Account> {
        let kind = AccountKind::parse(&self.kind).ok_or_else(|| corrupt("kind"))?;
        let closing = day(self.closing_day, "closing_day")?;
        let due = day(self.due_day, "due_day")?;
        let card = match (self.credit_limit_amount, closing, due) {
            (Some(credit_limit_amount), Some(closing_day), Some(due_day)) => {
                Some(CreditCardTerms {
                    credit_limit_amount,
                    cycle: CardCycle::new(closing_day, due_day)
                        .map_err(|_| corrupt("closing_day"))?,
                })
            }
            _ => None,
        };
        Ok(Account {
            id: self.id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            name: self.name,
            kind,
            is_default: self.is_default,
            balance_amount: self.balance_amount,
            currency: currency(&self.currency)?,
            card,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

fn card_columns(account: &Account) -> Outcome<(Option<i64>, Option<i16>, Option<i16>)> {
    let Some(terms) = account.card else {
        return Ok((None, None, None));
    };
    Ok((
        Some(terms.credit_limit_amount),
        Some(small(terms.cycle.closing_day, "closing_day")?),
        Some(small(terms.cycle.due_day, "due_day")?),
    ))
}

impl AccountRepository for PgAccounts {
    async fn ensure_default(&self, owner_id: Uuid, candidate: &Account) -> Outcome<()> {
        let mut tx = begin(&self.pool, owner_id).await?;
        sqlx::query!(
            "INSERT INTO accounts (id, owner_id, visibility, name, kind, is_default, \
             balance_amount, currency, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, 'standard', true, 0, $5, $6, $7) \
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
        let rows: Vec<AccountRow> = sqlx::query_as!(AccountRow, "SELECT id, owner_id, visibility AS \"visibility: _\", name, kind, is_default, balance_amount, currency, \
    credit_limit_amount, closing_day, due_day, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM accounts WHERE owner_id = $1 AND deleted_at IS NULL \
             AND ($2::uuid IS NULL OR id > $2) ORDER BY id LIMIT $3", owner_id, after, i64::from(limit))
        .fetch_all(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        rows.into_iter().map(AccountRow::into_domain).collect()
    }

    async fn get(&self, owner_id: Uuid, id: Uuid) -> Outcome<Account> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let row: Option<AccountRow> = sqlx::query_as!(AccountRow, "SELECT id, owner_id, visibility AS \"visibility: _\", name, kind, is_default, balance_amount, currency, \
    credit_limit_amount, closing_day, due_day, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM accounts WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL", id, owner_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        row.ok_or(FinanceError::NotFound)?.into_domain()
    }

    async fn insert(&self, account: &Account) -> Outcome<()> {
        let (limit, closing, due) = card_columns(account)?;
        let mut tx = begin(&self.pool, account.owner_id).await?;
        sqlx::query!(
            "INSERT INTO accounts (id, owner_id, visibility, name, kind, is_default, \
             balance_amount, currency, credit_limit_amount, closing_day, due_day, created_at, \
             updated_at) VALUES ($1, $2, $3, $4, $5, false, 0, $6, $7, $8, $9, $10, $11)",
            account.id,
            account.owner_id,
            account.visibility as _,
            &account.name,
            account.kind.as_str(),
            account.currency.as_str(),
            limit,
            closing,
            due,
            account.created_at as _,
            account.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await
    }

    async fn update(&self, account: &Account) -> Outcome<()> {
        let (limit, closing, due) = card_columns(account)?;
        let mut tx = begin(&self.pool, account.owner_id).await?;
        let result = sqlx::query!(
            "UPDATE accounts SET name = $1, visibility = $2, credit_limit_amount = $3, \
             closing_day = $4, due_day = $5, updated_at = $6 \
             WHERE id = $7 AND owner_id = $8 AND deleted_at IS NULL",
            &account.name,
            account.visibility as _,
            limit,
            closing,
            due,
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
        let row: Option<AccountRow> = sqlx::query_as!(AccountRow, "SELECT id, owner_id, visibility AS \"visibility: _\", name, kind, is_default, balance_amount, currency, \
    credit_limit_amount, closing_day, due_day, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM accounts WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL \
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
