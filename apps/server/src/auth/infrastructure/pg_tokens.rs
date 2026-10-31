//! Repositório de convites e tokens de redefinição: só o hash do token é guardado.

use chrono::{DateTime, Utc};
use sqlx::PgConnection;
use uuid::Uuid;

use super::pg_users::internal;
use crate::auth::domain::error::AuthError;
use crate::auth::domain::invite::Invite;
use crate::auth::domain::password_reset::ResetToken;

pub async fn insert_invite(
    conn: &mut PgConnection,
    invite: &Invite,
    token_hash: &[u8],
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    sqlx::query!(
        "INSERT INTO invites (id, token_hash, created_by, expires_at, created_at) \
         VALUES ($1, $2, $3, $4, $5)",
        invite.id,
        token_hash,
        invite.created_by,
        invite.expires_at as _,
        now as _
    )
    .execute(conn)
    .await
    .map(|_| ())
    .map_err(internal)
}

/// Consome o convite de uma vez: o `UPDATE` só acerta um convite livre e vigente,
/// então dois cadastros simultâneos com o mesmo token não passam os dois.
pub async fn consume_invite(
    conn: &mut PgConnection,
    token_hash: &[u8],
    now: DateTime<Utc>,
    used_by: Uuid,
) -> Result<bool, AuthError> {
    let id: Option<Uuid> = sqlx::query_scalar!(
        "UPDATE invites SET used_at = $2, used_by = $3 \
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2 RETURNING id",
        token_hash,
        now as _,
        used_by
    )
    .fetch_optional(conn)
    .await
    .map_err(internal)?;
    Ok(id.is_some())
}

pub async fn insert_reset_token(
    conn: &mut PgConnection,
    token: &ResetToken,
    token_hash: &[u8],
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    sqlx::query!("INSERT INTO password_reset_tokens (id, token_hash, user_id, origin, expires_at, created_at) \
         VALUES ($1, $2, $3, $4, $5, $6)", token.id, token_hash, token.user_id, token.origin.as_str(), token.expires_at as _, now as _)
    .execute(conn)
    .await
    .map(|_| ())
    .map_err(internal)
}

/// Consome o token e devolve o usuário dono dele.
pub async fn consume_reset_token(
    conn: &mut PgConnection,
    token_hash: &[u8],
    now: DateTime<Utc>,
) -> Result<Option<Uuid>, AuthError> {
    sqlx::query_scalar!(
        "UPDATE password_reset_tokens SET used_at = $2 \
         WHERE token_hash = $1 AND used_at IS NULL AND expires_at > $2 RETURNING user_id",
        token_hash,
        now as _
    )
    .fetch_optional(conn)
    .await
    .map_err(internal)
}
