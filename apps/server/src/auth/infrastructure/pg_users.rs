//! Repositório de usuários. As funções recebem a conexão ou a transação do chamador,
//! para a criação da conta e o consumo do token acontecerem na mesma transação.

use chrono::{DateTime, Utc};
use sqlx::PgConnection;
use uuid::Uuid;

use crate::auth::application::admin::UserFilter;
use crate::auth::domain::error::AuthError;
use crate::auth::domain::user::{Role, User};

pub fn internal(error: sqlx::Error) -> AuthError {
    AuthError::Internal(error.to_string())
}

struct UserRow {
    id: Uuid,
    email: String,
    password_hash: String,
    role: String,
    is_active: bool,
    totp_secret_encrypted: Option<Vec<u8>>,
    totp_pending_secret_encrypted: Option<Vec<u8>>,
    totp_enabled_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

impl TryFrom<UserRow> for User {
    type Error = AuthError;

    fn try_from(row: UserRow) -> Result<Self, AuthError> {
        let role = Role::parse(&row.role)
            .ok_or_else(|| AuthError::Internal("papel desconhecido no banco".to_owned()))?;
        Ok(Self {
            id: row.id,
            email: row.email,
            password_hash: row.password_hash,
            role,
            is_active: row.is_active,
            totp_secret_encrypted: row.totp_secret_encrypted,
            totp_pending_secret_encrypted: row.totp_pending_secret_encrypted,
            totp_enabled_at: row.totp_enabled_at,
            created_at: row.created_at,
        })
    }
}

fn constraint_of(error: &sqlx::Error) -> Option<&str> {
    error.as_database_error().and_then(|db| db.constraint())
}

pub async fn count(conn: &mut PgConnection) -> Result<i64, AuthError> {
    sqlx::query_scalar!(r#"SELECT count(*) AS "count!" FROM users"#)
        .fetch_one(conn)
        .await
        .map_err(internal)
}

pub async fn insert(
    conn: &mut PgConnection,
    user: &User,
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    let result = sqlx::query!(
        "INSERT INTO users (id, email, password_hash, role, is_active, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $6)",
        user.id,
        user.email,
        user.password_hash,
        user.role.as_str(),
        user.is_active,
        now as _,
    )
    .execute(conn)
    .await;
    match result {
        Ok(_) => Ok(()),
        Err(error) if constraint_of(&error) == Some("users_email_lower_key") => {
            Err(AuthError::invalid_field("email", "taken"))
        }
        Err(error) if constraint_of(&error) == Some("users_single_admin_key") => {
            Err(AuthError::SetupAlreadyDone)
        }
        Err(error) => Err(internal(error)),
    }
}

pub async fn find_by_id(conn: &mut PgConnection, id: Uuid) -> Result<Option<User>, AuthError> {
    let row = sqlx::query_as!(
        UserRow,
        "SELECT id, email, password_hash, role, is_active, totp_secret_encrypted, \
         totp_pending_secret_encrypted, totp_enabled_at AS \"totp_enabled_at: _\", created_at AS \"created_at: _\" FROM users WHERE id = $1",
        id
    )
    .fetch_optional(conn)
    .await
    .map_err(internal)?;
    row.map(User::try_from).transpose()
}

/// `email` já normalizado (minúsculas).
pub async fn find_by_email(
    conn: &mut PgConnection,
    email: &str,
) -> Result<Option<User>, AuthError> {
    let row = sqlx::query_as!(
        UserRow,
        "SELECT id, email, password_hash, role, is_active, totp_secret_encrypted, \
         totp_pending_secret_encrypted, totp_enabled_at AS \"totp_enabled_at: _\", created_at AS \"created_at: _\" \
         FROM users WHERE lower(email) = $1",
        email
    )
    .fetch_optional(conn)
    .await
    .map_err(internal)?;
    row.map(User::try_from).transpose()
}

pub async fn update_password(
    conn: &mut PgConnection,
    id: Uuid,
    password_hash: &str,
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    sqlx::query!(
        "UPDATE users SET password_hash = $2, updated_at = $3 WHERE id = $1",
        id,
        password_hash,
        now as _
    )
    .execute(conn)
    .await
    .map(|_| ())
    .map_err(internal)
}

pub async fn set_pending_totp(
    conn: &mut PgConnection,
    id: Uuid,
    encrypted: &[u8],
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    sqlx::query!(
        "UPDATE users SET totp_pending_secret_encrypted = $2, updated_at = $3 WHERE id = $1",
        id,
        encrypted,
        now as _
    )
    .execute(conn)
    .await
    .map(|_| ())
    .map_err(internal)
}

pub async fn activate_totp(
    conn: &mut PgConnection,
    id: Uuid,
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    let result = sqlx::query!(
        "UPDATE users SET totp_secret_encrypted = totp_pending_secret_encrypted, \
         totp_pending_secret_encrypted = NULL, totp_enabled_at = $2, updated_at = $2 \
         WHERE id = $1 AND totp_pending_secret_encrypted IS NOT NULL",
        id,
        now as _
    )
    .execute(conn)
    .await
    .map_err(internal)?;
    if result.rows_affected() == 0 {
        return Err(AuthError::TotpNotStarted);
    }
    Ok(())
}

pub async fn update_role(
    conn: &mut PgConnection,
    id: Uuid,
    role: Role,
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    sqlx::query!(
        "UPDATE users SET role = $2, updated_at = $3 WHERE id = $1",
        id,
        role.as_str(),
        now as _
    )
    .execute(conn)
    .await
    .map(|_| ())
    .map_err(internal)
}

pub async fn update_active(
    conn: &mut PgConnection,
    id: Uuid,
    is_active: bool,
    now: DateTime<Utc>,
) -> Result<(), AuthError> {
    sqlx::query!(
        "UPDATE users SET is_active = $2, updated_at = $3 WHERE id = $1",
        id,
        is_active,
        now as _
    )
    .execute(conn)
    .await
    .map(|_| ())
    .map_err(internal)
}

/// Escapa `%`, `_` e `\` para a busca por e-mail ser literal.
fn like_pattern(text: &str) -> String {
    let escaped = text
        .to_lowercase()
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    format!("%{escaped}%")
}

pub async fn list(
    conn: &mut PgConnection,
    filter: &UserFilter,
    limit: i64,
) -> Result<Vec<User>, AuthError> {
    let (cursor_key, cursor_id) = match &filter.cursor {
        Some(cursor) => (Some(cursor.sort_key.clone()), Some(cursor.id)),
        None => (None, None),
    };
    let rows = sqlx::query_as!(
        UserRow,
        "SELECT id, email, password_hash, role, is_active, totp_secret_encrypted, \
         totp_pending_secret_encrypted, totp_enabled_at AS \"totp_enabled_at: _\", created_at AS \"created_at: _\" FROM users \
         WHERE ($1::text IS NULL OR role = $1) \
           AND ($2::text IS NULL OR lower(email) LIKE $2) \
           AND ($3::text IS NULL OR (lower(email), id) > ($3, $4)) \
         ORDER BY lower(email), id LIMIT $5",
        filter.role.map(Role::as_str),
        filter.query.as_deref().map(like_pattern),
        cursor_key,
        cursor_id,
        limit
    )
    .fetch_all(conn)
    .await
    .map_err(internal)?;
    rows.into_iter().map(User::try_from).collect()
}

/// Encerra todas as sessões do usuário no armazenamento de sessões. A API de sessão
/// de `http` só encerra a sessão corrente, então a busca é pelo id do usuário gravado
/// dentro do registro da sessão (MessagePack, com o UUID em texto).
pub async fn delete_sessions_of(conn: &mut PgConnection, id: Uuid) -> Result<(), AuthError> {
    sqlx::query!(
        "DELETE FROM tower_sessions.session WHERE position(convert_to($1, 'UTF8') IN data) > 0",
        id.to_string()
    )
    .execute(conn)
    .await
    .map(|_| ())
    .map_err(internal)
}
