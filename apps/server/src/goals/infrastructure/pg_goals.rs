//! Repositório PostgreSQL de metas e marcos, com as queries checadas na compilação.
//! Cada operação abre a transação com o usuário da RLS e filtra também por `owner_id`
//! e `deleted_at IS NULL` ([project/security-04]).

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::goals::application::ports::{
    GoalPosition, GoalQuery, GoalRepository, GoalSort, NO_DEADLINE,
};
use crate::goals::domain::error::GoalsError;
use crate::goals::domain::goal::{Goal, GoalPatch, GoalStatus, GoalView};
use crate::goals::domain::milestone::{Milestone, MilestonePatch};
use crate::shared::db::begin_for_user;
use crate::shared::visibility::Visibility;

pub struct PgGoalRepository {
    pool: PgPool,
}

impl PgGoalRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn internal(error: sqlx::Error) -> GoalsError {
    GoalsError::internal(error)
}

struct GoalRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    title: String,
    description: Option<String>,
    deadline: Option<chrono::NaiveDate>,
    status: GoalStatus,
    labels: Vec<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    milestone_count: i64,
    completed_milestone_count: i64,
}

impl From<GoalRow> for GoalView {
    fn from(row: GoalRow) -> Self {
        Self {
            goal: Goal {
                id: row.id,
                owner_id: row.owner_id,
                visibility: row.visibility,
                title: row.title,
                description: row.description,
                deadline: row.deadline,
                status: row.status,
                labels: row.labels,
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
            milestone_count: u32::try_from(row.milestone_count).unwrap_or(u32::MAX),
            completed_milestone_count: u32::try_from(row.completed_milestone_count)
                .unwrap_or(u32::MAX),
        }
    }
}

/// Escapa `%`, `_` e `\` para a busca por parte do título.
fn like_pattern(text: &str) -> String {
    let escaped = text
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    format!("%{escaped}%")
}

async fn load_goal(
    conn: &mut sqlx::PgConnection,
    owner: Uuid,
    id: Uuid,
) -> Result<GoalView, GoalsError> {
    sqlx::query_as!(GoalRow, "SELECT g.id, g.owner_id, g.visibility AS \"visibility: _\", g.title, g.description, \
     g.deadline AS \"deadline: _\", g.status AS \"status: _\", g.labels, g.created_at AS \"created_at: _\", g.updated_at AS \"updated_at: _\", \
     m.total AS \"milestone_count!\", m.done AS \"completed_milestone_count!\" FROM goals g \
         CROSS JOIN LATERAL (SELECT count(*) AS total, count(completed_at) AS done \
           FROM milestones WHERE goal_id = g.id AND owner_id = $1 AND deleted_at IS NULL) m \
         WHERE g.id = $2 AND g.owner_id = $1 AND g.deleted_at IS NULL", owner, id)
        .fetch_optional(conn)
        .await
        .map_err(internal)?
        .map(GoalView::from)
        .ok_or(GoalsError::NotFound)
}

/// A meta existe, é do dono e não foi excluída.
async fn ensure_goal(
    conn: &mut sqlx::PgConnection,
    owner: Uuid,
    goal_id: Uuid,
) -> Result<(), GoalsError> {
    let found: Option<Uuid> = sqlx::query_scalar!(
        "SELECT id FROM goals WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL",
        goal_id,
        owner
    )
    .fetch_optional(conn)
    .await
    .map_err(internal)?;
    found.map(|_| ()).ok_or(GoalsError::NotFound)
}

impl GoalRepository for PgGoalRepository {
    async fn insert_goal(&self, goal: &Goal) -> Result<GoalView, GoalsError> {
        let mut tx = begin_for_user(&self.pool, goal.owner_id)
            .await
            .map_err(internal)?;
        sqlx::query!(
            "INSERT INTO goals (id, owner_id, visibility, title, description, deadline, status, \
             labels, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
            goal.id,
            goal.owner_id,
            goal.visibility as _,
            &goal.title,
            &goal.description as _,
            goal.deadline as _,
            goal.status as _,
            &goal.labels,
            goal.created_at as _,
            goal.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(internal)?;
        let view = load_goal(&mut tx, goal.owner_id, goal.id).await?;
        tx.commit().await.map_err(internal)?;
        Ok(view)
    }

    async fn list_goals(
        &self,
        owner: Uuid,
        query: &GoalQuery,
    ) -> Result<Vec<GoalView>, GoalsError> {
        let mut tx = begin_for_user(&self.pool, owner).await.map_err(internal)?;
        let pattern = query.text.as_deref().map(like_pattern);
        let limit = i64::from(query.limit);
        let rows = match query.sort {
            GoalSort::Deadline => {
                let (date, id) = match query.after {
                    Some(GoalPosition::Deadline(date, id)) => (Some(date), Some(id)),
                    _ => (None, None),
                };
                sqlx::query_as!(GoalRow, "SELECT g.id, g.owner_id, g.visibility AS \"visibility: _\", g.title, g.description, \
     g.deadline AS \"deadline: _\", g.status AS \"status: _\", g.labels, g.created_at AS \"created_at: _\", g.updated_at AS \"updated_at: _\", \
     m.total AS \"milestone_count!\", m.done AS \"completed_milestone_count!\" FROM goals g \
                     CROSS JOIN LATERAL (SELECT count(*) AS total, count(completed_at) AS done \
                       FROM milestones WHERE goal_id = g.id AND owner_id = $1 AND deleted_at IS NULL) m \
                     WHERE g.owner_id = $1 AND g.deleted_at IS NULL \
                       AND ($2::text IS NULL OR g.status = $2) \
                       AND ($3::text IS NULL OR g.title ILIKE $3) \
                       AND ($4::text IS NULL OR g.labels @> ARRAY[$4::text]) \
                       AND ($5::boolean IS NULL OR (g.deadline IS NOT NULL) = $5) \
                       AND ($6::date IS NULL OR (COALESCE(g.deadline, $8::date), g.id) > ($6::date, $7::uuid)) \
                     ORDER BY COALESCE(g.deadline, $8::date) ASC, g.id ASC LIMIT $9", owner, query.status as _, &pattern as _, &query.label as _, query.has_deadline, date as _, id, NO_DEADLINE as _, limit)
                    .fetch_all(&mut *tx)
                    .await
            }
            GoalSort::CreatedAt => {
                let (instant, id) = match query.after {
                    Some(GoalPosition::CreatedAt(instant, id)) => (Some(instant), Some(id)),
                    _ => (None, None),
                };
                sqlx::query_as!(GoalRow, "SELECT g.id, g.owner_id, g.visibility AS \"visibility: _\", g.title, g.description, \
     g.deadline AS \"deadline: _\", g.status AS \"status: _\", g.labels, g.created_at AS \"created_at: _\", g.updated_at AS \"updated_at: _\", \
     m.total AS \"milestone_count!\", m.done AS \"completed_milestone_count!\" FROM goals g \
                     CROSS JOIN LATERAL (SELECT count(*) AS total, count(completed_at) AS done \
                       FROM milestones WHERE goal_id = g.id AND owner_id = $1 AND deleted_at IS NULL) m \
                     WHERE g.owner_id = $1 AND g.deleted_at IS NULL \
                       AND ($2::text IS NULL OR g.status = $2) \
                       AND ($3::text IS NULL OR g.title ILIKE $3) \
                       AND ($4::text IS NULL OR g.labels @> ARRAY[$4::text]) \
                       AND ($5::boolean IS NULL OR (g.deadline IS NOT NULL) = $5) \
                       AND ($6::timestamptz IS NULL OR (g.created_at, g.id) < ($6::timestamptz, $7::uuid)) \
                     ORDER BY g.created_at DESC, g.id DESC LIMIT $8", owner, query.status as _, &pattern as _, &query.label as _, query.has_deadline, instant as _, id, limit)
                    .fetch_all(&mut *tx)
                    .await
            }
        }
        .map_err(internal)?;
        tx.commit().await.map_err(internal)?;
        Ok(rows.into_iter().map(GoalView::from).collect())
    }

    async fn get_goal(&self, owner: Uuid, id: Uuid) -> Result<GoalView, GoalsError> {
        let mut tx = begin_for_user(&self.pool, owner).await.map_err(internal)?;
        let view = load_goal(&mut tx, owner, id).await?;
        tx.commit().await.map_err(internal)?;
        Ok(view)
    }

    async fn update_goal(
        &self,
        owner: Uuid,
        id: Uuid,
        patch: &GoalPatch,
        now: DateTime<Utc>,
    ) -> Result<GoalView, GoalsError> {
        let mut tx = begin_for_user(&self.pool, owner).await.map_err(internal)?;
        let (set_description, description) = match &patch.description {
            Some(value) => (true, value.as_deref()),
            None => (false, None),
        };
        let (set_deadline, deadline) = match patch.deadline {
            Some(value) => (true, value),
            None => (false, None),
        };
        let updated: Option<Uuid> = sqlx::query_scalar!(
            "UPDATE goals SET \
               title = COALESCE($3, title), \
               description = CASE WHEN $4 THEN $5 ELSE description END, \
               deadline = CASE WHEN $6 THEN $7 ELSE deadline END, \
               status = COALESCE($8, status), \
               labels = COALESCE($9::text[], labels), \
               visibility = COALESCE($10, visibility), \
               updated_at = $11 \
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL RETURNING id",
            id,
            owner,
            &patch.title as _,
            set_description,
            description,
            set_deadline,
            deadline as _,
            patch.status as _,
            &patch.labels as _,
            patch.visibility as _,
            now as _
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(internal)?;
        updated.ok_or(GoalsError::NotFound)?;
        let view = load_goal(&mut tx, owner, id).await?;
        tx.commit().await.map_err(internal)?;
        Ok(view)
    }

    async fn delete_goal(
        &self,
        owner: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<Vec<Uuid>, GoalsError> {
        let mut tx = begin_for_user(&self.pool, owner).await.map_err(internal)?;
        let deleted: Option<Uuid> = sqlx::query_scalar!(
            "UPDATE goals SET deleted_at = $3, updated_at = $3 \
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL RETURNING id",
            id,
            owner,
            now as _
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(internal)?;
        deleted.ok_or(GoalsError::NotFound)?;
        let milestone_ids: Vec<Uuid> = sqlx::query_scalar!(
            "UPDATE milestones SET deleted_at = $3, updated_at = $3 \
             WHERE goal_id = $1 AND owner_id = $2 AND deleted_at IS NULL RETURNING id",
            id,
            owner,
            now as _
        )
        .fetch_all(&mut *tx)
        .await
        .map_err(internal)?;
        tx.commit().await.map_err(internal)?;
        Ok(milestone_ids)
    }

    async fn list_milestones(
        &self,
        owner: Uuid,
        goal_id: Uuid,
    ) -> Result<Vec<Milestone>, GoalsError> {
        let mut tx = begin_for_user(&self.pool, owner).await.map_err(internal)?;
        ensure_goal(&mut tx, owner, goal_id).await?;
        let rows = sqlx::query_as!(Milestone, "SELECT id, owner_id, visibility AS \"visibility: _\", goal_id, title, position, \
     completed_at AS \"completed_at: _\", created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", deleted_at AS \"deleted_at: _\" FROM milestones \
             WHERE goal_id = $1 AND owner_id = $2 AND deleted_at IS NULL \
             ORDER BY position ASC, id ASC", goal_id, owner)
            .fetch_all(&mut *tx)
            .await
            .map_err(internal)?;
        tx.commit().await.map_err(internal)?;
        Ok(rows)
    }

    async fn insert_milestone(
        &self,
        milestone: &Milestone,
        position: Option<i32>,
    ) -> Result<Milestone, GoalsError> {
        let owner = milestone.owner_id;
        let mut tx = begin_for_user(&self.pool, owner).await.map_err(internal)?;
        ensure_goal(&mut tx, owner, milestone.goal_id).await?;
        let row = sqlx::query_as!(Milestone, "INSERT INTO milestones (id, owner_id, visibility, goal_id, title, position, \
               created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, \
               COALESCE($6, (SELECT COALESCE(MAX(position) + 1, 0) FROM milestones \
                 WHERE goal_id = $4 AND owner_id = $2 AND deleted_at IS NULL)), $7, $7) \
             RETURNING id, owner_id, visibility AS \"visibility: _\", goal_id, title, position, \
     completed_at AS \"completed_at: _\", created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", deleted_at AS \"deleted_at: _\"", milestone.id, owner, milestone.visibility as _, milestone.goal_id, &milestone.title, position, milestone.created_at as _)
            .fetch_one(&mut *tx)
            .await
            .map_err(internal)?;
        tx.commit().await.map_err(internal)?;
        Ok(row)
    }

    async fn update_milestone(
        &self,
        owner: Uuid,
        goal_id: Uuid,
        id: Uuid,
        patch: &MilestonePatch,
        now: DateTime<Utc>,
    ) -> Result<Milestone, GoalsError> {
        let mut tx = begin_for_user(&self.pool, owner).await.map_err(internal)?;
        ensure_goal(&mut tx, owner, goal_id).await?;
        let row = sqlx::query_as!(Milestone, "UPDATE milestones SET \
               title = COALESCE($4, title), \
               position = COALESCE($5, position), \
               completed_at = CASE WHEN $6::boolean IS NULL THEN completed_at \
                 WHEN $6 THEN COALESCE(completed_at, $8) ELSE NULL END, \
               visibility = COALESCE($7, visibility), \
               updated_at = $8 \
             WHERE id = $1 AND goal_id = $2 AND owner_id = $3 AND deleted_at IS NULL \
             RETURNING id, owner_id, visibility AS \"visibility: _\", goal_id, title, position, \
     completed_at AS \"completed_at: _\", created_at AS \"created_at: _\", updated_at AS \"updated_at: _\", deleted_at AS \"deleted_at: _\"", id, goal_id, owner, &patch.title as _, patch.position, patch.completed, patch.visibility as _, now as _)
            .fetch_optional(&mut *tx)
            .await
            .map_err(internal)?
            .ok_or(GoalsError::NotFound)?;
        tx.commit().await.map_err(internal)?;
        Ok(row)
    }

    async fn delete_milestone(
        &self,
        owner: Uuid,
        goal_id: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<(), GoalsError> {
        let mut tx = begin_for_user(&self.pool, owner).await.map_err(internal)?;
        ensure_goal(&mut tx, owner, goal_id).await?;
        let deleted: Option<Uuid> = sqlx::query_scalar!(
            "UPDATE milestones SET deleted_at = $4, updated_at = $4 \
             WHERE id = $1 AND goal_id = $2 AND owner_id = $3 AND deleted_at IS NULL RETURNING id",
            id,
            goal_id,
            owner,
            now as _
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(internal)?;
        deleted.ok_or(GoalsError::NotFound)?;
        tx.commit().await.map_err(internal)?;
        Ok(())
    }
}
