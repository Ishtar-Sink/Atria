//! Repositório das preferências (com RLS) e das configurações da instância.

use chrono::{DateTime, Utc};
use sqlx::PgConnection;
use uuid::Uuid;

use super::pg_users::internal;
use crate::auth::domain::error::AuthError;
use crate::auth::domain::instance_settings::InstanceSettings;
use crate::auth::domain::preferences::Preferences;

struct PreferencesRow {
    theme: String,
    locale: String,
    timezone: String,
    currency: String,
    palette_shortcut: String,
    search_contexts: Vec<String>,
}

/// Roda dentro da transação aberta por `begin_for_user`, para a política de RLS valer.
pub async fn get_preferences(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> Result<Option<Preferences>, AuthError> {
    let row: Option<PreferencesRow> = sqlx::query_as!(
        PreferencesRow,
        "SELECT theme, locale, timezone, currency, palette_shortcut, search_contexts \
         FROM user_preferences WHERE user_id = $1",
        user_id
    )
    .fetch_optional(conn)
    .await
    .map_err(internal)?;
    Ok(row.map(|row| Preferences {
        theme: row.theme,
        locale: row.locale,
        timezone: row.timezone,
        currency: row.currency,
        palette_shortcut: row.palette_shortcut,
        search_contexts: row.search_contexts,
    }))
}

pub async fn upsert_preferences(
    conn: &mut PgConnection,
    user_id: Uuid,
    preferences: &Preferences,
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    sqlx::query!("INSERT INTO user_preferences \
           (user_id, theme, locale, timezone, currency, palette_shortcut, search_contexts, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) \
         ON CONFLICT (user_id) DO UPDATE SET theme = EXCLUDED.theme, locale = EXCLUDED.locale, \
           timezone = EXCLUDED.timezone, currency = EXCLUDED.currency, \
           palette_shortcut = EXCLUDED.palette_shortcut, \
           search_contexts = EXCLUDED.search_contexts, updated_at = EXCLUDED.updated_at", user_id, &preferences.theme, &preferences.locale, &preferences.timezone, &preferences.currency, &preferences.palette_shortcut, &preferences.search_contexts, now as _)
    .execute(conn)
    .await
    .map(|_| ())
    .map_err(internal)
}

struct InstanceRow {
    invite_required: bool,
    web_push_enabled: bool,
    smtp_host: Option<String>,
    smtp_port: Option<i32>,
    smtp_user: Option<String>,
    smtp_from: Option<String>,
}

pub async fn get_instance(conn: &mut PgConnection) -> Result<InstanceSettings, AuthError> {
    let row: InstanceRow = sqlx::query_as!(
        InstanceRow,
        "SELECT invite_required, web_push_enabled, smtp_host, smtp_port, smtp_user, smtp_from \
         FROM instance_settings WHERE id"
    )
    .fetch_one(conn)
    .await
    .map_err(internal)?;
    Ok(InstanceSettings {
        invite_required: row.invite_required,
        web_push_enabled: row.web_push_enabled,
        smtp_host: row.smtp_host,
        smtp_port: row.smtp_port.and_then(|port| u16::try_from(port).ok()),
        smtp_user: row.smtp_user,
        smtp_from: row.smtp_from,
    })
}

pub async fn update_instance(
    conn: &mut PgConnection,
    settings: &InstanceSettings,
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    sqlx::query!(
        "UPDATE instance_settings SET invite_required = $1, web_push_enabled = $2, \
         smtp_host = $3, smtp_port = $4, smtp_user = $5, smtp_from = $6, updated_at = $7 \
         WHERE id",
        settings.invite_required,
        settings.web_push_enabled,
        &settings.smtp_host as _,
        settings.smtp_port.map(i32::from),
        &settings.smtp_user as _,
        &settings.smtp_from as _,
        now as _
    )
    .execute(conn)
    .await
    .map(|_| ())
    .map_err(internal)
}

pub async fn database_bytes(conn: &mut PgConnection) -> Result<i64, AuthError> {
    sqlx::query_scalar!(r#"SELECT pg_database_size(current_database()) AS "bytes!""#)
        .fetch_one(conn)
        .await
        .map_err(internal)
}

pub async fn ping(conn: &mut PgConnection) -> bool {
    sqlx::query!("SELECT 1 AS one")
        .fetch_one(conn)
        .await
        .is_ok()
}
