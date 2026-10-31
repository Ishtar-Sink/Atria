//! Registro de `Idempotency-Key` por dono ([project/api-06], CB-09).

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use sqlx::types::Json;
use uuid::Uuid;

use crate::finance::application::ports::{IdempotencyStore, Outcome, StoredResponse};
use crate::finance::infrastructure::{begin, commit, corrupt, storage};

#[derive(Debug, Clone)]
pub struct PgIdempotency {
    pool: PgPool,
}

impl PgIdempotency {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

impl IdempotencyStore for PgIdempotency {
    async fn find(&self, owner_id: Uuid, key: &str) -> Outcome<Option<StoredResponse>> {
        let mut tx = begin(&self.pool, owner_id).await?;
        let row = sqlx::query!(
            "SELECT request_hash, response_status, response_body FROM finance_idempotency_keys \
             WHERE owner_id = $1 AND key = $2",
            owner_id,
            key
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await?;
        row.map(|row| {
            Ok(StoredResponse {
                request_hash: row.request_hash,
                status: u16::try_from(row.response_status)
                    .map_err(|_| corrupt("response_status"))?,
                body: row.response_body,
            })
        })
        .transpose()
    }

    async fn save(
        &self,
        owner_id: Uuid,
        key: &str,
        response: &StoredResponse,
        now: DateTime<Utc>,
    ) -> Outcome<()> {
        let status = i16::try_from(response.status).map_err(|_| corrupt("response_status"))?;
        let mut tx = begin(&self.pool, owner_id).await?;
        sqlx::query!(
            "INSERT INTO finance_idempotency_keys (owner_id, key, request_hash, response_status, \
             response_body, created_at) VALUES ($1, $2, $3, $4, $5, $6) \
             ON CONFLICT (owner_id, key) DO NOTHING",
            owner_id,
            key,
            &response.request_hash,
            status,
            Json(&response.body) as _,
            now as _
        )
        .execute(&mut *tx)
        .await
        .map_err(storage)?;
        commit(tx).await
    }
}
