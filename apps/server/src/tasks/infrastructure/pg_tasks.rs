//! Repositório PostgreSQL de tarefas, segmentos de regra e conclusões. Cada
//! transação identifica o dono para a RLS e toda query filtra também por
//! `owner_id` e `deleted_at IS NULL` ([project/security-04]).

use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::types::Json;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::shared::db::begin_for_user;
use crate::shared::ids::IdGenerator;
use crate::shared::recurrence::RecurrenceRule;
use crate::shared::visibility::Visibility;
use crate::tasks::application::ports::{
    DatedTask, TaskFilter, TaskStatus, TasksRepository, TasksTransaction,
};
use crate::tasks::domain::{CompletionLog, Schedule, Segment, Task, TasksError};

#[derive(Clone)]
pub struct PgTasksRepository {
    pool: PgPool,
    ids: Arc<dyn IdGenerator>,
}

impl PgTasksRepository {
    pub fn new(pool: PgPool, ids: Arc<dyn IdGenerator>) -> Self {
        Self { pool, ids }
    }
}

pub struct PgTasksTx<'a> {
    tx: Transaction<'a, Postgres>,
    owner_id: Uuid,
    ids: Arc<dyn IdGenerator>,
}

impl TasksRepository for PgTasksRepository {
    type Tx<'a> = PgTasksTx<'a>;

    async fn begin(&self, owner_id: Uuid) -> Result<PgTasksTx<'_>, TasksError> {
        let tx = begin_for_user(&self.pool, owner_id)
            .await
            .map_err(TasksError::storage)?;
        Ok(PgTasksTx {
            tx,
            owner_id,
            ids: self.ids.clone(),
        })
    }
}

struct TaskRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    title: String,
    description: Option<String>,
    due_on: Option<NaiveDate>,
    is_recurring: bool,
    completed_at: Option<DateTime<Utc>>,
    labels: Vec<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<TaskRow> for Task {
    fn from(row: TaskRow) -> Self {
        Self {
            id: row.id,
            owner_id: row.owner_id,
            visibility: row.visibility,
            title: row.title,
            description: row.description,
            due_on: row.due_on,
            is_recurring: row.is_recurring,
            completed_at: row.completed_at,
            labels: row.labels,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

struct SegmentRow {
    task_id: Uuid,
    rule: Json<RecurrenceRule>,
    effective_from: NaiveDate,
    effective_until: Option<NaiveDate>,
}

impl From<SegmentRow> for Segment {
    fn from(row: SegmentRow) -> Self {
        Self {
            rule: row.rule.0,
            effective_from: row.effective_from,
            effective_until: row.effective_until,
        }
    }
}

impl TasksTransaction for PgTasksTx<'_> {
    async fn insert_task(&mut self, task: &Task) -> Result<(), TasksError> {
        sqlx::query!(
            "INSERT INTO tasks (id, owner_id, visibility, title, description, due_on, \
             is_recurring, completed_at, labels, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
            task.id,
            self.owner_id,
            task.visibility as _,
            &task.title,
            &task.description as _,
            task.due_on as _,
            task.is_recurring,
            task.completed_at as _,
            &task.labels,
            task.created_at as _,
            task.updated_at as _
        )
        .execute(&mut *self.tx)
        .await
        .map_err(TasksError::storage)?;
        Ok(())
    }

    async fn find_task(&mut self, id: Uuid) -> Result<Option<Task>, TasksError> {
        let row: Option<TaskRow> = sqlx::query_as!(TaskRow, "SELECT id, owner_id, visibility AS \"visibility: _\", title, description, due_on AS \"due_on: _\", \
     is_recurring, completed_at AS \"completed_at: _\", labels, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM tasks \
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL", id, self.owner_id)
            .fetch_optional(&mut *self.tx)
            .await
            .map_err(TasksError::storage)?;
        Ok(row.map(Task::from))
    }

    async fn update_task(&mut self, task: &Task) -> Result<(), TasksError> {
        sqlx::query!(
            "UPDATE tasks SET visibility = $3, title = $4, description = $5, due_on = $6, \
             completed_at = $7, labels = $8, updated_at = $9 \
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL",
            task.id,
            self.owner_id,
            task.visibility as _,
            &task.title,
            &task.description as _,
            task.due_on as _,
            task.completed_at as _,
            &task.labels,
            task.updated_at as _
        )
        .execute(&mut *self.tx)
        .await
        .map_err(TasksError::storage)?;
        Ok(())
    }

    async fn soft_delete_task(&mut self, id: Uuid, now: DateTime<Utc>) -> Result<bool, TasksError> {
        let result = sqlx::query!(
            "UPDATE tasks SET deleted_at = $3, updated_at = $3 \
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL",
            id,
            self.owner_id,
            now as _
        )
        .execute(&mut *self.tx)
        .await
        .map_err(TasksError::storage)?;
        Ok(result.rows_affected() > 0)
    }

    async fn list_tasks(&mut self, filter: &TaskFilter) -> Result<Vec<Task>, TasksError> {
        let completed = filter.status.map(|status| status == TaskStatus::Completed);
        let (after_created_at, after_id) = filter.after.unzip();
        // Filtros opcionais por parâmetro nulo: uma query literal checada na compilação.
        // O rótulo é comparado por `@>`, servido pelo índice GIN `tasks_labels_idx`, e
        // a busca usa `strpos`, que não trata `%` e `_` como curingas.
        let rows: Vec<TaskRow> = sqlx::query_as!(TaskRow, "SELECT id, owner_id, visibility AS \"visibility: _\", title, description, due_on AS \"due_on: _\", \
     is_recurring, completed_at AS \"completed_at: _\", labels, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM tasks \
             WHERE owner_id = $1 AND deleted_at IS NULL \
             AND ($2::boolean IS NULL OR (completed_at IS NOT NULL) = $2) \
             AND ($3::boolean IS NULL OR is_recurring = $3) \
             AND ($4::date IS NULL OR due_on >= $4) \
             AND ($5::date IS NULL OR due_on <= $5) \
             AND ($6::text IS NULL OR labels @> ARRAY[$6]::text[]) \
             AND ($7::text IS NULL OR strpos(lower(title), lower($7)) > 0) \
             AND ($8::timestamptz IS NULL OR (created_at, id) < ($8, $9)) \
             ORDER BY created_at DESC, id DESC LIMIT $10", self.owner_id, completed, filter.recurring, filter.due_from as _, filter.due_to as _, &filter.label as _, &filter.query as _, after_created_at as _, after_id, i64::from(filter.limit))
        .fetch_all(&mut *self.tx)
        .await
        .map_err(TasksError::storage)?;
        Ok(rows.into_iter().map(Task::from).collect())
    }

    async fn current_rules(
        &mut self,
        task_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, RecurrenceRule>, TasksError> {
        if task_ids.is_empty() {
            return Ok(HashMap::new());
        }
        let rows: Vec<SegmentRow> = sqlx::query_as!(SegmentRow, "SELECT DISTINCT ON (task_id) task_id, rule AS \"rule: _\", effective_from AS \"effective_from: _\", effective_until AS \"effective_until: _\" \
             FROM task_recurrence_segments \
             WHERE owner_id = $1 AND task_id = ANY($2) \
             ORDER BY task_id, effective_from DESC", self.owner_id, task_ids)
        .fetch_all(&mut *self.tx)
        .await
        .map_err(TasksError::storage)?;
        Ok(rows
            .into_iter()
            .map(|row| (row.task_id, row.rule.0))
            .collect())
    }

    async fn load_schedule(&mut self, task_id: Uuid) -> Result<Schedule, TasksError> {
        let rows: Vec<SegmentRow> = sqlx::query_as!(SegmentRow, "SELECT task_id, rule AS \"rule: _\", effective_from AS \"effective_from: _\", effective_until AS \"effective_until: _\" \
             FROM task_recurrence_segments \
             WHERE owner_id = $1 AND task_id = $2 ORDER BY effective_from", self.owner_id, task_id)
        .fetch_all(&mut *self.tx)
        .await
        .map_err(TasksError::storage)?;
        Ok(Schedule::from_segments(
            rows.into_iter().map(Segment::from).collect(),
        ))
    }

    async fn save_schedule(
        &mut self,
        task_id: Uuid,
        schedule: &Schedule,
        now: DateTime<Utc>,
    ) -> Result<(), TasksError> {
        sqlx::query!(
            "DELETE FROM task_recurrence_segments WHERE owner_id = $1 AND task_id = $2",
            self.owner_id,
            task_id
        )
        .execute(&mut *self.tx)
        .await
        .map_err(TasksError::storage)?;
        for segment in schedule.segments() {
            sqlx::query!(
                "INSERT INTO task_recurrence_segments \
                 (id, owner_id, task_id, rule, effective_from, effective_until, created_at) \
                 VALUES ($1, $2, $3, $4, $5, $6, $7)",
                self.ids.new_id(),
                self.owner_id,
                task_id,
                Json(&segment.rule) as _,
                segment.effective_from as _,
                segment.effective_until as _,
                now as _
            )
            .execute(&mut *self.tx)
            .await
            .map_err(TasksError::storage)?;
        }
        Ok(())
    }

    async fn recurring_schedules(&mut self) -> Result<Vec<(Uuid, Schedule)>, TasksError> {
        let rows: Vec<SegmentRow> = sqlx::query_as!(SegmentRow, "SELECT s.task_id, s.rule AS \"rule: _\", s.effective_from AS \"effective_from: _\", s.effective_until AS \"effective_until: _\" \
             FROM task_recurrence_segments s \
             JOIN tasks t ON t.id = s.task_id \
             WHERE s.owner_id = $1 AND t.owner_id = $1 AND t.deleted_at IS NULL \
             ORDER BY s.task_id, s.effective_from", self.owner_id)
        .fetch_all(&mut *self.tx)
        .await
        .map_err(TasksError::storage)?;
        let mut grouped: Vec<(Uuid, Vec<Segment>)> = Vec::new();
        for row in rows {
            match grouped.last_mut() {
                Some((task_id, segments)) if *task_id == row.task_id => {
                    segments.push(Segment::from(row));
                }
                _ => grouped.push((row.task_id, vec![Segment::from(row)])),
            }
        }
        Ok(grouped
            .into_iter()
            .map(|(task_id, segments)| (task_id, Schedule::from_segments(segments)))
            .collect())
    }

    async fn load_completions(
        &mut self,
        task_id: Uuid,
        from: NaiveDate,
    ) -> Result<CompletionLog, TasksError> {
        let dates: Vec<NaiveDate> = sqlx::query_scalar!(
            "SELECT occurrence_date AS \"occurrence_date: NaiveDate\" FROM task_completions \
             WHERE owner_id = $1 AND task_id = $2 AND occurrence_date >= $3",
            self.owner_id,
            task_id,
            from as _
        )
        .fetch_all(&mut *self.tx)
        .await
        .map_err(TasksError::storage)?;
        Ok(CompletionLog::new(dates))
    }

    async fn insert_completion(
        &mut self,
        task_id: Uuid,
        occurrence_date: NaiveDate,
        completed_at: DateTime<Utc>,
    ) -> Result<(), TasksError> {
        sqlx::query!(
            "INSERT INTO task_completions (id, owner_id, task_id, occurrence_date, completed_at) \
             VALUES ($1, $2, $3, $4, $5) \
             ON CONFLICT (task_id, occurrence_date) DO NOTHING",
            self.ids.new_id(),
            self.owner_id,
            task_id,
            occurrence_date as _,
            completed_at as _
        )
        .execute(&mut *self.tx)
        .await
        .map_err(TasksError::storage)?;
        Ok(())
    }

    async fn delete_completion(
        &mut self,
        task_id: Uuid,
        occurrence_date: NaiveDate,
    ) -> Result<(), TasksError> {
        sqlx::query!(
            "DELETE FROM task_completions \
             WHERE owner_id = $1 AND task_id = $2 AND occurrence_date = $3",
            self.owner_id,
            task_id,
            occurrence_date as _
        )
        .execute(&mut *self.tx)
        .await
        .map_err(TasksError::storage)?;
        Ok(())
    }

    async fn discard_completions_before(
        &mut self,
        task_id: Uuid,
        today: NaiveDate,
    ) -> Result<(), TasksError> {
        sqlx::query!(
            "DELETE FROM task_completions \
             WHERE owner_id = $1 AND task_id = $2 AND occurrence_date < $3",
            self.owner_id,
            task_id,
            today as _
        )
        .execute(&mut *self.tx)
        .await
        .map_err(TasksError::storage)?;
        Ok(())
    }

    async fn dated_tasks_between(
        &mut self,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<DatedTask>, TasksError> {
        let rows = sqlx::query!(
            r#"SELECT id, due_on AS "due_on!: NaiveDate", completed_at IS NOT NULL AS "completed!"
               FROM tasks
               WHERE owner_id = $1 AND deleted_at IS NULL AND NOT is_recurring
               AND due_on BETWEEN $2 AND $3"#,
            self.owner_id,
            from as _,
            to as _
        )
        .fetch_all(&mut *self.tx)
        .await
        .map_err(TasksError::storage)?;
        Ok(rows
            .into_iter()
            .map(|row| DatedTask {
                task_id: row.id,
                due_on: row.due_on,
                completed: row.completed,
            })
            .collect())
    }

    async fn commit(self) -> Result<(), TasksError> {
        self.tx.commit().await.map_err(TasksError::storage)
    }
}
