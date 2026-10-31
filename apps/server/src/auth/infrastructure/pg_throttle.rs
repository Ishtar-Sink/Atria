//! Repositório das tentativas com bloqueio progressivo.

use chrono::{DateTime, Utc};
use sqlx::PgConnection;

use super::pg_users::internal;
use crate::auth::domain::error::AuthError;
use crate::auth::domain::throttle::Throttle;

pub async fn get(conn: &mut PgConnection, key: &str) -> Result<Throttle, AuthError> {
    let row = sqlx::query!(
        r#"SELECT failures, locked_until AS "locked_until: DateTime<Utc>"
           FROM auth_attempts WHERE key = $1"#,
        key
    )
    .fetch_optional(conn)
    .await
    .map_err(internal)?
    .map(|row| (row.failures, row.locked_until));
    Ok(
        row.map_or_else(Throttle::default, |(failures, locked_until)| Throttle {
            failures: u32::try_from(failures).unwrap_or(0),
            locked_until,
        }),
    )
}

pub async fn save(
    conn: &mut PgConnection,
    key: &str,
    throttle: &Throttle,
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    sqlx::query!(
        "INSERT INTO auth_attempts (key, failures, locked_until, updated_at) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (key) DO UPDATE \
         SET failures = EXCLUDED.failures, locked_until = EXCLUDED.locked_until, \
             updated_at = EXCLUDED.updated_at",
        key,
        i32::try_from(throttle.failures).unwrap_or(i32::MAX),
        throttle.locked_until as _,
        now as _
    )
    .execute(conn)
    .await
    .map(|_| ())
    .map_err(internal)
}
