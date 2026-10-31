//! Fila `reminder_schedule`: o próximo disparo de cada lembrete. A tabela não tem RLS
//! (só ids e o instante); o resto do disparo roda na transação do dono.

use chrono::{DateTime, Utc};
use sqlx::{PgConnection, PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::reminders::application::ports::{
    BoxFuture, ClaimedReminder, DueReminder, ScheduleQueue,
};
use crate::reminders::domain::error::RemindersError;
use crate::reminders::domain::push_subscription::PushSubscription;
use crate::reminders::domain::reminder::{PushStatus, Schedule};
use crate::reminders::infrastructure::pg_reminders::{SubscriptionRow, fetch};

fn storage(error: sqlx::Error) -> RemindersError {
    RemindersError::storage(error)
}

/// Grava o próximo disparo do lembrete ou, sem disparo futuro, tira-o da fila.
pub(crate) async fn set_next(
    conn: &mut PgConnection,
    reminder_id: Uuid,
    owner_id: Uuid,
    next_fire_at: Option<DateTime<Utc>>,
) -> Result<(), RemindersError> {
    let query = match next_fire_at {
        Some(next_fire_at) => sqlx::query!(
            "INSERT INTO reminder_schedule (reminder_id, owner_id, next_fire_at) \
             VALUES ($1, $2, $3) \
             ON CONFLICT (reminder_id) DO UPDATE SET next_fire_at = EXCLUDED.next_fire_at",
            reminder_id,
            owner_id,
            next_fire_at as _
        ),
        None => {
            sqlx::query!(
                "DELETE FROM reminder_schedule WHERE reminder_id = $1 AND owner_id = $2",
                reminder_id,
                owner_id
            )
        }
    };
    query.execute(conn).await.map_err(storage)?;
    Ok(())
}

/// Abre a transação do dono para a RLS. Ao contrário de `shared::db::begin_for_user`,
/// a transação é `'static`, para viver dentro do `ClaimedReminder`.
async fn begin_owner(
    pool: &PgPool,
    owner_id: Uuid,
) -> Result<Transaction<'static, Postgres>, RemindersError> {
    let mut tx = pool.begin().await.map_err(storage)?;
    sqlx::query!(
        "SELECT set_config('app.current_user_id', $1, true)",
        owner_id.to_string()
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(storage)?;
    Ok(tx)
}

pub struct PgScheduleQueue {
    pool: PgPool,
}

impl PgScheduleQueue {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    async fn due_rows(
        &self,
        now: DateTime<Utc>,
        limit: u32,
    ) -> Result<Vec<DueReminder>, RemindersError> {
        let rows = sqlx::query!(
            "SELECT reminder_id, owner_id FROM reminder_schedule \
             WHERE next_fire_at <= $1 ORDER BY next_fire_at LIMIT $2",
            now as _,
            i64::from(limit)
        )
        .fetch_all(&self.pool)
        .await
        .map_err(storage)?;
        Ok(rows
            .into_iter()
            .map(|row| DueReminder {
                reminder_id: row.reminder_id,
                owner_id: row.owner_id,
            })
            .collect())
    }

    async fn claim_row(
        &self,
        due: DueReminder,
        now: DateTime<Utc>,
    ) -> Result<Option<Box<dyn ClaimedReminder>>, RemindersError> {
        let mut tx = begin_owner(&self.pool, due.owner_id).await?;
        // `SKIP LOCKED`: outro disparo em andamento fica com a linha.
        let next_fire_at: Option<DateTime<Utc>> = sqlx::query_scalar!(
            "SELECT next_fire_at AS \"next_fire_at: DateTime<Utc>\" FROM reminder_schedule \
             WHERE reminder_id = $1 AND owner_id = $2 AND next_fire_at <= $3 \
             FOR UPDATE SKIP LOCKED",
            due.reminder_id,
            due.owner_id,
            now as _
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage)?;
        let Some(next_fire_at) = next_fire_at else {
            return Ok(None);
        };
        let reminder = match fetch(&mut tx, due.owner_id, due.reminder_id).await {
            Ok(record) => Some((record.reminder.title, record.reminder.schedule)),
            Err(RemindersError::NotFound) => None,
            Err(error) => return Err(error),
        };
        Ok(Some(Box::new(PgClaim {
            tx,
            due,
            next_fire_at,
            reminder,
        })))
    }
}

impl ScheduleQueue for PgScheduleQueue {
    fn due(
        &self,
        now: DateTime<Utc>,
        limit: u32,
    ) -> BoxFuture<'_, Result<Vec<DueReminder>, RemindersError>> {
        Box::pin(self.due_rows(now, limit))
    }

    fn claim(
        &self,
        due: DueReminder,
        now: DateTime<Utc>,
    ) -> BoxFuture<'_, Result<Option<Box<dyn ClaimedReminder>>, RemindersError>> {
        Box::pin(self.claim_row(due, now))
    }
}

struct PgClaim {
    tx: Transaction<'static, Postgres>,
    due: DueReminder,
    next_fire_at: DateTime<Utc>,
    reminder: Option<(String, Schedule)>,
}

impl PgClaim {
    async fn insert_delivery(
        &mut self,
        id: Uuid,
        fire_at: DateTime<Utc>,
        now: DateTime<Utc>,
    ) -> Result<bool, RemindersError> {
        let inserted = sqlx::query!(
            "INSERT INTO reminder_deliveries \
             (id, owner_id, reminder_id, fire_at, delivered_at, push_status) \
             VALUES ($1, $2, $3, $4, $5, $6) \
             ON CONFLICT (reminder_id, fire_at) DO NOTHING",
            id,
            self.due.owner_id,
            self.due.reminder_id,
            fire_at as _,
            now as _,
            PushStatus::Skipped.as_str()
        )
        .execute(&mut *self.tx)
        .await
        .map_err(storage)?;
        Ok(inserted.rows_affected() == 1)
    }

    async fn update_status(
        &mut self,
        fire_at: DateTime<Utc>,
        status: PushStatus,
    ) -> Result<(), RemindersError> {
        sqlx::query!(
            "UPDATE reminder_deliveries SET push_status = $4 \
             WHERE reminder_id = $1 AND owner_id = $2 AND fire_at = $3",
            self.due.reminder_id,
            self.due.owner_id,
            fire_at as _,
            status.as_str()
        )
        .execute(&mut *self.tx)
        .await
        .map_err(storage)?;
        Ok(())
    }

    async fn owner_subscriptions(&mut self) -> Result<Vec<PushSubscription>, RemindersError> {
        let rows: Vec<SubscriptionRow> = sqlx::query_as!(
            SubscriptionRow,
            "SELECT id, owner_id, endpoint, p256dh, auth, created_at AS \"created_at: _\" \
             FROM push_subscriptions WHERE owner_id = $1 ORDER BY created_at, id",
            self.due.owner_id
        )
        .fetch_all(&mut *self.tx)
        .await
        .map_err(storage)?;
        Ok(rows.into_iter().map(PushSubscription::from).collect())
    }

    async fn delete_subscription(&mut self, id: Uuid) -> Result<(), RemindersError> {
        sqlx::query!(
            "DELETE FROM push_subscriptions WHERE id = $1 AND owner_id = $2",
            id,
            self.due.owner_id
        )
        .execute(&mut *self.tx)
        .await
        .map_err(storage)?;
        Ok(())
    }

    async fn commit(mut self, next_fire_at: Option<DateTime<Utc>>) -> Result<(), RemindersError> {
        set_next(
            &mut self.tx,
            self.due.reminder_id,
            self.due.owner_id,
            next_fire_at,
        )
        .await?;
        self.tx.commit().await.map_err(storage)
    }
}

impl ClaimedReminder for PgClaim {
    fn reminder_id(&self) -> Uuid {
        self.due.reminder_id
    }

    fn next_fire_at(&self) -> DateTime<Utc> {
        self.next_fire_at
    }

    fn reminder(&self) -> Option<(&str, &Schedule)> {
        self.reminder
            .as_ref()
            .map(|(title, schedule)| (title.as_str(), schedule))
    }

    fn record_delivery(
        &mut self,
        id: Uuid,
        fire_at: DateTime<Utc>,
        now: DateTime<Utc>,
    ) -> BoxFuture<'_, Result<bool, RemindersError>> {
        Box::pin(self.insert_delivery(id, fire_at, now))
    }

    fn set_push_status(
        &mut self,
        fire_at: DateTime<Utc>,
        status: PushStatus,
    ) -> BoxFuture<'_, Result<(), RemindersError>> {
        Box::pin(self.update_status(fire_at, status))
    }

    fn subscriptions(&mut self) -> BoxFuture<'_, Result<Vec<PushSubscription>, RemindersError>> {
        Box::pin(self.owner_subscriptions())
    }

    fn remove_subscription(&mut self, id: Uuid) -> BoxFuture<'_, Result<(), RemindersError>> {
        Box::pin(self.delete_subscription(id))
    }

    fn finish(
        self: Box<Self>,
        next_fire_at: Option<DateTime<Utc>>,
    ) -> BoxFuture<'static, Result<(), RemindersError>> {
        Box::pin((*self).commit(next_fire_at))
    }
}
