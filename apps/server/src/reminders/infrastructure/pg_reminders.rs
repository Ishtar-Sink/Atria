//! Repositório de lembretes e de inscrições no PostgreSQL. Cada transação identifica
//! o usuário para a RLS e toda query filtra também por `owner_id` ([project/security-04]).

use chrono::{DateTime, Utc};
use sqlx::types::Json;
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::reminders::application::ports::{
    BoxFuture, ReminderFilter, ReminderRecord, ReminderRepository, ReminderWrite,
    SubscriptionRepository,
};
use crate::reminders::application::reminders::cursor_instant;
use crate::reminders::domain::error::RemindersError;
use crate::reminders::domain::push_subscription::{NewPushSubscription, PushSubscription};
use crate::reminders::domain::reminder::{Reminder, ReminderKind, Schedule};
use crate::reminders::infrastructure::pg_schedule;
use crate::shared::db::begin_for_user;
use crate::shared::recurrence::RecurrenceRule;
use crate::shared::visibility::Visibility;

#[derive(Debug)]
pub(crate) struct ReminderRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    title: String,
    notes: Option<String>,
    timezone: String,
    remind_at: Option<DateTime<Utc>>,
    rule: Option<Json<RecurrenceRule>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    next_fire_at: Option<DateTime<Utc>>,
}

impl ReminderRow {
    pub(crate) fn into_record(self) -> Result<ReminderRecord, RemindersError> {
        let schedule = match (self.remind_at, self.rule) {
            (Some(remind_at), None) => Schedule::OneOff { remind_at },
            (None, Some(Json(rule))) => Schedule::Recurring { rule },
            // O CHECK do banco impede; tratado como erro de armazenamento.
            _ => return Err(RemindersError::storage(InvalidRow)),
        };
        Ok(ReminderRecord {
            reminder: Reminder {
                id: self.id,
                owner_id: self.owner_id,
                visibility: self.visibility,
                title: self.title,
                notes: self.notes,
                timezone: self.timezone,
                schedule,
                created_at: self.created_at,
                updated_at: self.updated_at,
            },
            next_fire_at: self.next_fire_at,
        })
    }
}

#[derive(Debug, thiserror::Error)]
#[error("linha de lembrete sem agendamento válido")]
pub(crate) struct InvalidRow;

fn storage(error: sqlx::Error) -> RemindersError {
    RemindersError::storage(error)
}

pub struct PgReminderRepository {
    pool: PgPool,
}

impl PgReminderRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    async fn create_record(&self, write: ReminderWrite) -> Result<ReminderRecord, RemindersError> {
        let mut tx = begin_for_user(&self.pool, write.owner_id)
            .await
            .map_err(storage)?;
        let data = &write.data;
        sqlx::query!(
            "INSERT INTO reminders (id, owner_id, visibility, title, notes, timezone, \
             remind_at, rule, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)",
            write.id,
            write.owner_id,
            data.visibility as _,
            &data.title,
            &data.notes as _,
            &data.timezone,
            data.schedule.remind_at() as _,
            data.schedule.rule().map(Json) as _,
            write.now as _
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        pg_schedule::set_next(&mut tx, write.id, write.owner_id, write.next_fire_at).await?;
        let record = fetch(&mut tx, write.owner_id, write.id).await?;
        tx.commit().await.map_err(storage)?;
        Ok(record)
    }

    async fn update_record(&self, write: ReminderWrite) -> Result<ReminderRecord, RemindersError> {
        let mut tx = begin_for_user(&self.pool, write.owner_id)
            .await
            .map_err(storage)?;
        let data = &write.data;
        let updated = sqlx::query!(
            "UPDATE reminders SET visibility = $3, title = $4, notes = $5, timezone = $6, \
             remind_at = $7, rule = $8, updated_at = $9 \
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL",
            write.id,
            write.owner_id,
            data.visibility as _,
            &data.title,
            &data.notes as _,
            &data.timezone,
            data.schedule.remind_at() as _,
            data.schedule.rule().map(Json) as _,
            write.now as _
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        if updated.rows_affected() == 0 {
            return Err(RemindersError::NotFound);
        }
        pg_schedule::set_next(&mut tx, write.id, write.owner_id, write.next_fire_at).await?;
        let record = fetch(&mut tx, write.owner_id, write.id).await?;
        tx.commit().await.map_err(storage)?;
        Ok(record)
    }

    async fn get_record(&self, owner_id: Uuid, id: Uuid) -> Result<ReminderRecord, RemindersError> {
        let mut tx = begin_for_user(&self.pool, owner_id)
            .await
            .map_err(storage)?;
        let record = fetch(&mut tx, owner_id, id).await?;
        tx.commit().await.map_err(storage)?;
        Ok(record)
    }

    async fn delete_record(
        &self,
        owner_id: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<(), RemindersError> {
        let mut tx = begin_for_user(&self.pool, owner_id)
            .await
            .map_err(storage)?;
        let deleted = sqlx::query!(
            "UPDATE reminders SET deleted_at = $3, updated_at = $3 \
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL",
            id,
            owner_id,
            now as _
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        if deleted.rows_affected() == 0 {
            return Err(RemindersError::NotFound);
        }
        pg_schedule::set_next(&mut tx, id, owner_id, None).await?;
        tx.commit().await.map_err(storage)
    }

    async fn list_records(
        &self,
        owner_id: Uuid,
        filter: ReminderFilter,
    ) -> Result<Vec<ReminderRecord>, RemindersError> {
        let after = filter
            .cursor
            .as_ref()
            .map(|cursor| cursor_instant(cursor).map(|instant| (instant, cursor.id)))
            .transpose()?;
        let kind = filter.kind.map(|kind| match kind {
            ReminderKind::OneOff => "one_off",
            ReminderKind::Recurring => "recurring",
        });
        let pattern = filter.query.as_deref().map(like_pattern);
        let mut tx = begin_for_user(&self.pool, owner_id)
            .await
            .map_err(storage)?;
        let rows: Vec<ReminderRow> = sqlx::query_as!(ReminderRow, "SELECT r.id, r.owner_id, r.visibility AS \"visibility: _\", r.title, r.notes, \
     r.timezone, r.remind_at AS \"remind_at: _\", r.rule AS \"rule: _\", r.created_at AS \"created_at: _\", r.updated_at AS \"updated_at: _\", s.next_fire_at AS \"next_fire_at: _\" \
     FROM reminders r LEFT JOIN reminder_schedule s ON s.reminder_id = r.id WHERE r.owner_id = $1 AND r.deleted_at IS NULL \
             AND ($2::text IS NULL \
                  OR ($2 = 'one_off' AND r.remind_at IS NOT NULL) \
                  OR ($2 = 'recurring' AND r.rule IS NOT NULL)) \
             AND ($3::text IS NULL OR r.visibility = $3) \
             AND ($4::text IS NULL OR r.title ILIKE $4 ESCAPE '\\') \
             AND ($5::timestamptz IS NULL OR (r.created_at, r.id) < ($5, $6)) \
             ORDER BY r.created_at DESC, r.id DESC LIMIT $7", owner_id, kind, filter.visibility as _, pattern, after.map(|(instant, _)| instant) as _, after.map(|(_, id)| id), i64::from(filter.limit))
            .fetch_all(&mut *tx)
            .await
            .map_err(storage)?;
        tx.commit().await.map_err(storage)?;
        rows.into_iter().map(ReminderRow::into_record).collect()
    }

    async fn live_reminders(&self, owner_id: Uuid) -> Result<Vec<Reminder>, RemindersError> {
        let mut tx = begin_for_user(&self.pool, owner_id)
            .await
            .map_err(storage)?;
        let rows: Vec<ReminderRow> = sqlx::query_as!(ReminderRow, "SELECT r.id, r.owner_id, r.visibility AS \"visibility: _\", r.title, r.notes, \
     r.timezone, r.remind_at AS \"remind_at: _\", r.rule AS \"rule: _\", r.created_at AS \"created_at: _\", r.updated_at AS \"updated_at: _\", s.next_fire_at AS \"next_fire_at: _\" \
     FROM reminders r LEFT JOIN reminder_schedule s ON s.reminder_id = r.id WHERE r.owner_id = $1 AND r.deleted_at IS NULL", owner_id)
            .fetch_all(&mut *tx)
            .await
            .map_err(storage)?;
        tx.commit().await.map_err(storage)?;
        rows.into_iter()
            .map(|row| row.into_record().map(|record| record.reminder))
            .collect()
    }
}

/// Busca no título: os curingas do `LIKE` digitados viram texto literal.
fn like_pattern(query: &str) -> String {
    let escaped = query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    format!("%{escaped}%")
}

/// Lembrete vivo do dono, dentro da transação.
pub(crate) async fn fetch(
    conn: &mut PgConnection,
    owner_id: Uuid,
    id: Uuid,
) -> Result<ReminderRecord, RemindersError> {
    let row: Option<ReminderRow> = sqlx::query_as!(ReminderRow, "SELECT r.id, r.owner_id, r.visibility AS \"visibility: _\", r.title, r.notes, \
     r.timezone, r.remind_at AS \"remind_at: _\", r.rule AS \"rule: _\", r.created_at AS \"created_at: _\", r.updated_at AS \"updated_at: _\", s.next_fire_at AS \"next_fire_at: _\" \
     FROM reminders r LEFT JOIN reminder_schedule s ON s.reminder_id = r.id WHERE r.id = $1 AND r.owner_id = $2 AND r.deleted_at IS NULL", id, owner_id)
        .fetch_optional(conn)
        .await
        .map_err(storage)?;
    row.ok_or(RemindersError::NotFound)?.into_record()
}

impl ReminderRepository for PgReminderRepository {
    fn create(
        &self,
        write: ReminderWrite,
    ) -> BoxFuture<'_, Result<ReminderRecord, RemindersError>> {
        Box::pin(self.create_record(write))
    }

    fn get(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> BoxFuture<'_, Result<ReminderRecord, RemindersError>> {
        Box::pin(self.get_record(owner_id, id))
    }

    fn update(
        &self,
        write: ReminderWrite,
    ) -> BoxFuture<'_, Result<ReminderRecord, RemindersError>> {
        Box::pin(self.update_record(write))
    }

    fn delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> BoxFuture<'_, Result<(), RemindersError>> {
        Box::pin(self.delete_record(owner_id, id, now))
    }

    fn list(
        &self,
        owner_id: Uuid,
        filter: ReminderFilter,
    ) -> BoxFuture<'_, Result<Vec<ReminderRecord>, RemindersError>> {
        Box::pin(self.list_records(owner_id, filter))
    }

    fn all_live(&self, owner_id: Uuid) -> BoxFuture<'_, Result<Vec<Reminder>, RemindersError>> {
        Box::pin(self.live_reminders(owner_id))
    }
}

#[derive(Debug)]
pub(crate) struct SubscriptionRow {
    pub(crate) id: Uuid,
    pub(crate) owner_id: Uuid,
    pub(crate) endpoint: String,
    pub(crate) p256dh: String,
    pub(crate) auth: String,
    pub(crate) created_at: DateTime<Utc>,
}

impl From<SubscriptionRow> for PushSubscription {
    fn from(row: SubscriptionRow) -> Self {
        Self {
            id: row.id,
            owner_id: row.owner_id,
            endpoint: row.endpoint,
            p256dh: row.p256dh,
            auth: row.auth,
            created_at: row.created_at,
        }
    }
}

pub struct PgSubscriptionRepository {
    pool: PgPool,
}

impl PgSubscriptionRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    async fn upsert_subscription(
        &self,
        id: Uuid,
        owner_id: Uuid,
        subscription: NewPushSubscription,
        now: DateTime<Utc>,
    ) -> Result<PushSubscription, RemindersError> {
        let mut tx = begin_for_user(&self.pool, owner_id)
            .await
            .map_err(storage)?;
        let row: SubscriptionRow = sqlx::query_as!(
            SubscriptionRow,
            "INSERT INTO push_subscriptions (id, owner_id, endpoint, p256dh, auth, created_at) \
             VALUES ($1, $2, $3, $4, $5, $6) \
             ON CONFLICT (owner_id, endpoint) \
             DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth \
             RETURNING id, owner_id, endpoint, p256dh, auth, created_at AS \"created_at: _\"",
            id,
            owner_id,
            &subscription.endpoint,
            &subscription.p256dh,
            &subscription.auth,
            now as _
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(storage)?;
        tx.commit().await.map_err(storage)?;
        Ok(row.into())
    }

    async fn delete_subscription(&self, owner_id: Uuid, id: Uuid) -> Result<(), RemindersError> {
        let mut tx = begin_for_user(&self.pool, owner_id)
            .await
            .map_err(storage)?;
        let deleted = sqlx::query!(
            "DELETE FROM push_subscriptions WHERE id = $1 AND owner_id = $2",
            id,
            owner_id
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        if deleted.rows_affected() == 0 {
            return Err(RemindersError::NotFound);
        }
        tx.commit().await.map_err(storage)
    }
}

impl SubscriptionRepository for PgSubscriptionRepository {
    fn upsert(
        &self,
        id: Uuid,
        owner_id: Uuid,
        subscription: NewPushSubscription,
        now: DateTime<Utc>,
    ) -> BoxFuture<'_, Result<PushSubscription, RemindersError>> {
        Box::pin(self.upsert_subscription(id, owner_id, subscription, now))
    }

    fn delete(&self, owner_id: Uuid, id: Uuid) -> BoxFuture<'_, Result<(), RemindersError>> {
        Box::pin(self.delete_subscription(owner_id, id))
    }
}
