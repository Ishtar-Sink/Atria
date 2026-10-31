//! Repositório PostgreSQL de ligações. As queries são parametrizadas e checadas em
//! execução; a troca pelas macros checadas na compilação ([project/stack-04]) fica
//! com a TASK-18, que gera a `.sqlx`.

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::http::AppState;
use crate::links::application::ports::{LinkListFilter, LinkRepository};
use crate::links::application::service::parse_sort_key;
use crate::links::domain::error::LinkError;
use crate::links::domain::link::{EntityRef, Link};
use crate::shared::db::begin_for_user;
use crate::shared::visibility::Visibility;

struct LinkRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    source_type: String,
    source_id: Uuid,
    target_type: String,
    target_id: Uuid,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl LinkRow {
    fn into_link(self) -> Result<Link, LinkError> {
        Ok(Link {
            id: self.id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            source: EntityRef::new(self.source_type.parse()?, self.source_id),
            target: EntityRef::new(self.target_type.parse()?, self.target_id),
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

fn infra(error: impl std::error::Error + Send + Sync + 'static) -> LinkError {
    LinkError::infrastructure(error)
}

#[derive(Clone)]
pub struct PgLinkRepository {
    pool: PgPool,
}

impl PgLinkRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn from_state(state: &AppState) -> Self {
        Self::new(state.pool.clone())
    }
}

impl LinkRepository for PgLinkRepository {
    async fn insert(&self, link: &Link) -> Result<(), LinkError> {
        let mut tx = begin_for_user(&self.pool, link.owner_id)
            .await
            .map_err(infra)?;
        let result = sqlx::query!(
            "INSERT INTO links (id, owner_id, visibility, source_type, source_id, \
             target_type, target_id, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
            link.id,
            link.owner_id,
            link.visibility as _,
            link.source.entity_type.as_str(),
            link.source.entity_id,
            link.target.entity_type.as_str(),
            link.target.entity_id,
            link.created_at as _,
            link.updated_at as _
        )
        .execute(&mut *tx)
        .await;
        match result {
            Ok(_) => tx.commit().await.map_err(infra),
            Err(sqlx::Error::Database(db)) if db.constraint() == Some("links_pair_uniq") => {
                Err(LinkError::AlreadyExists)
            }
            Err(error) => Err(infra(error)),
        }
    }

    async fn list_for_entity(
        &self,
        owner_id: Uuid,
        filter: &LinkListFilter,
    ) -> Result<Vec<Link>, LinkError> {
        let after_key = filter.after.as_ref().map(parse_sort_key).transpose()?;
        let after_id = filter.after.as_ref().map(|cursor| cursor.id);
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let rows = sqlx::query_as!(LinkRow, "SELECT id, owner_id, visibility AS \"visibility: _\", source_type, source_id, target_type, \
     target_id, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM links WHERE owner_id = $1 \
               AND ((source_type = $2 AND source_id = $3) OR (target_type = $2 AND target_id = $3)) \
               AND ($4::text IS NULL OR \
                    (CASE WHEN source_type = $2 AND source_id = $3 THEN target_type \
                          ELSE source_type END) = $4) \
               AND ($5::timestamptz IS NULL OR (created_at, id) < ($5, $6)) \
             ORDER BY created_at DESC, id DESC LIMIT $7", owner_id, filter.entity.entity_type.as_str(), filter.entity.entity_id, filter.linked_type.map(|kind| kind.as_str()), after_key as _, after_id, i64::from(filter.limit))
            .fetch_all(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        rows.into_iter().map(LinkRow::into_link).collect()
    }

    async fn delete(&self, owner_id: Uuid, id: Uuid) -> Result<bool, LinkError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let result = sqlx::query!(
            "DELETE FROM links WHERE owner_id = $1 AND id = $2",
            owner_id,
            id
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(result.rows_affected() == 1)
    }

    async fn delete_for_entity(
        &self,
        owner_id: Uuid,
        entity: &EntityRef,
    ) -> Result<u64, LinkError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let result = sqlx::query!(
            "DELETE FROM links WHERE owner_id = $1 \
             AND ((source_type = $2 AND source_id = $3) OR (target_type = $2 AND target_id = $3))",
            owner_id,
            entity.entity_type.as_str(),
            entity.entity_id
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(result.rows_affected())
    }
}
