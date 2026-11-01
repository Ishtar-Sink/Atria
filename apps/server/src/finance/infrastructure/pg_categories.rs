//! Repositório de categorias, com tipo e cor (PD-49, PD-58).

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::finance::application::ports::{CategoryRepository, Outcome};
use crate::finance::domain::FinanceError;
use crate::finance::domain::category::{
    Category, CategoryColor, SystemCategory, ensure_same_kind, replacement_for_deletion,
};
use crate::finance::domain::transaction::TransactionKind;
use crate::finance::infrastructure::{Tx, begin, commit, corrupt, is_unique_violation, storage};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone)]
pub struct PgCategories {
    pool: PgPool,
}

impl PgCategories {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(Debug, sqlx::FromRow)]
struct CategoryRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    name: String,
    kind: String,
    color: String,
    system_key: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl CategoryRow {
    fn into_domain(self) -> Outcome<Category> {
        Ok(Category {
            id: self.id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            name: self.name,
            kind: TransactionKind::parse(&self.kind).ok_or_else(|| corrupt("kind"))?,
            color: CategoryColor::parse(&self.color).ok_or_else(|| corrupt("color"))?,
            system_key: self
                .system_key
                .map(|key| SystemCategory::from_key(&key).ok_or_else(|| corrupt("system_key")))
                .transpose()?,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

/// Nome repetido no mesmo tipo (sem diferenciar maiúsculas) é erro de validação do
/// campo.
fn name_error(error: sqlx::Error) -> FinanceError {
    if is_unique_violation(&error) {
        return FinanceError::invalid("name", "taken");
    }
    storage(error)
}

/// Tipo da categoria ativa do dono, travada para a exclusão.
async fn kind_of(
    tx: &mut Tx<'_>,
    owner_id: Uuid,
    id: Uuid,
    lock: bool,
) -> Outcome<Option<TransactionKind>> {
    let kind = if lock {
        sqlx::query_scalar!(
            "SELECT kind FROM categories WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL \
             FOR UPDATE",
            id,
            owner_id
        )
        .fetch_optional(&mut **tx)
        .await
    } else {
        sqlx::query_scalar!(
            "SELECT kind FROM categories WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL",
            id,
            owner_id
        )
        .fetch_optional(&mut **tx)
        .await
    }
    .map_err(storage)?;
    kind.map(|text| TransactionKind::parse(&text).ok_or_else(|| corrupt("kind")))
        .transpose()
}

impl CategoryRepository for PgCategories {
    async fn list(
        &self,
        owner_id: Uuid,
        kind: Option<TransactionKind>,
        after: Option<Uuid>,
        limit: u32,
    ) -> Outcome<Vec<Category>> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let rows: Vec<CategoryRow> = sqlx::query_as!(CategoryRow, "SELECT id, owner_id, visibility AS \"visibility: _\", name, kind, color, system_key, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM categories WHERE owner_id = $1 AND deleted_at IS NULL \
             AND ($2::text IS NULL OR kind = $2) \
             AND ($3::uuid IS NULL OR id > $3) ORDER BY id LIMIT $4", owner_id, kind.map(TransactionKind::as_str), after, i64::from(limit))
        .fetch_all(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        rows.into_iter().map(CategoryRow::into_domain).collect()
    }

    async fn get(&self, owner_id: Uuid, id: Uuid) -> Outcome<Category> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let row: Option<CategoryRow> = sqlx::query_as!(CategoryRow, "SELECT id, owner_id, visibility AS \"visibility: _\", name, kind, color, system_key, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM categories WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL", id, owner_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        row.ok_or(FinanceError::NotFound)?.into_domain()
    }

    async fn insert(&self, category: &Category) -> Outcome<()> {
        let mut tx = begin(&self.pool, category.owner_id).await?;
        sqlx::query!(
            "INSERT INTO categories (id, owner_id, visibility, name, kind, color, created_at, \
             updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            category.id,
            category.owner_id,
            category.visibility as _,
            &category.name,
            category.kind.as_str(),
            category.color.as_str(),
            category.created_at as _,
            category.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(name_error)?;
        commit(tx).await
    }

    async fn update(&self, category: &Category) -> Outcome<()> {
        let mut tx = begin(&self.pool, category.owner_id).await?;
        let result = sqlx::query!(
            "UPDATE categories SET name = $1, color = $2, visibility = $3, updated_at = $4, \
             system_key = $7 WHERE id = $5 AND owner_id = $6 AND deleted_at IS NULL",
            &category.name,
            category.color.as_str(),
            category.visibility as _,
            category.updated_at as _,
            category.id,
            category.owner_id,
            category.system_key.map(SystemCategory::key)
        )
        .execute(&mut *tx)
        .await
        .map_err(name_error)?;
        if result.rows_affected() == 0 {
            return Err(FinanceError::NotFound);
        }
        commit(tx).await
    }

    async fn count_all_including_deleted(&self, owner_id: Uuid) -> Outcome<i64> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let count = sqlx::query_scalar!(
            "SELECT count(*) AS \"count!\" FROM categories WHERE owner_id = $1",
            owner_id
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        Ok(count)
    }

    async fn insert_defaults(&self, owner_id: Uuid, categories: &[Category]) -> Outcome<()> {
        let mut tx = begin(&self.pool, owner_id).await?;
        for category in categories {
            // Duas listagens simultâneas da mesma pessoa batem no índice único de nome
            // por tipo; a segunda só ignora as que a primeira já gravou.
            sqlx::query!(
                "INSERT INTO categories (id, owner_id, visibility, name, kind, color, system_key, \
                 created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) \
                 ON CONFLICT DO NOTHING",
                category.id,
                owner_id,
                category.visibility as _,
                &category.name,
                category.kind.as_str(),
                category.color.as_str(),
                category.system_key.map(SystemCategory::key),
                category.created_at as _,
                category.updated_at as _
            )
            .execute(&mut *tx)
            .await
            .map_err(storage)?;
        }
        commit(tx).await
    }

    async fn delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        replacement_id: Option<Uuid>,
        now: DateTime<Utc>,
    ) -> Outcome<()> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let kind = kind_of(&mut tx, owner_id, id, true)
            .await?
            .ok_or(FinanceError::NotFound)?;
        let in_use: bool = sqlx::query_scalar!("SELECT EXISTS (SELECT 1 FROM transactions WHERE category_id = $1 AND deleted_at IS NULL) \
             OR EXISTS (SELECT 1 FROM recurring_transactions WHERE category_id = $1 \
                        AND deleted_at IS NULL) AS \"in_use!\"", id)
        .fetch_one(&mut *tx)
        .await
        .map_err(storage)?;
        if let Some(target) = replacement_for_deletion(id, in_use, replacement_id)? {
            let target_kind = kind_of(&mut tx, owner_id, target, false)
                .await?
                .ok_or_else(|| FinanceError::invalid("replacement_id", "not_found"))?;
            ensure_same_kind(target_kind, kind)?;
            sqlx::query!(
                "UPDATE transactions SET category_id = $1, updated_at = $2 \
                 WHERE category_id = $3 AND owner_id = $4 AND deleted_at IS NULL",
                target,
                now as _,
                id,
                owner_id
            )
            .execute(&mut *tx)
            .await
            .map_err(storage)?;
            sqlx::query!(
                "UPDATE recurring_transactions SET category_id = $1, updated_at = $2 \
                 WHERE category_id = $3 AND owner_id = $4 AND deleted_at IS NULL",
                target,
                now as _,
                id,
                owner_id
            )
            .execute(&mut *tx)
            .await
            .map_err(storage)?;
        }
        sqlx::query!("UPDATE categories SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND owner_id = $3", now as _, id, owner_id)
            .execute(&mut *tx)
            .await
            .map_err(storage)?;
        commit(tx).await
    }
}
