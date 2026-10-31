//! Conexão com o PostgreSQL e transação por usuário, para a Row Level Security
//! ([project/database-09]) funcionar como segunda camada de isolamento.
//!
//! Regras de migração ([project/development-methodology-02]):
//! - cada contexto guarda as suas em `apps/server/src/<contexto>/migrations`, com o
//!   nome `20261101NN000X_<descricao>.sql`, em que `NN` é o número da tarefa dona do
//!   contexto e `X` a sequência dentro dela; uma migração aplicada nunca é editada;
//! - as queries usam as macros checadas do `sqlx` (`query!`, `query_as!`) contra o
//!   `DATABASE_URL` de um PostgreSQL local com as migrações do contexto aplicadas
//!   (`sqlx migrate run --source src/<contexto>/migrations --ignore-missing`);
//! - toda tabela com dono tem `ENABLE` e `FORCE ROW LEVEL SECURITY` e uma política
//!   por `owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid`;
//!   o `NULLIF` evita erro numa conexão reaproveitada do pool, em que o valor fica `''`
//!   depois da transação.

use std::time::Duration;

use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;

use crate::http::Config;

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("falha ao conectar no PostgreSQL")]
    Connect(#[from] sqlx::Error),
}

pub async fn connect(config: &Config) -> Result<PgPool, DbError> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&config.database_url)
        .await?;
    Ok(pool)
}

/// Abre a transação de um pedido já identificando o usuário para as políticas de RLS.
pub async fn begin_for_user(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Transaction<'_, Postgres>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    sqlx::query!(
        "SELECT set_config('app.current_user_id', $1, true)",
        user_id.to_string()
    )
    .fetch_one(&mut *tx)
    .await?;
    Ok(tx)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::test_support::{APP_ROLE, admin_pool, test_pool};

    #[tokio::test]
    async fn begin_for_user_sets_current_user_id() {
        let database = test_pool().await;
        let pool = database.pool().clone();
        let user_id = Uuid::from_u128(1);
        let mut tx = begin_for_user(&pool, user_id).await.unwrap();

        let current: String = sqlx::query_scalar("SELECT current_setting('app.current_user_id')")
            .fetch_one(&mut *tx)
            .await
            .unwrap();
        tx.commit().await.unwrap();
        let after: Option<String> =
            sqlx::query_scalar("SELECT current_setting('app.current_user_id', true)")
                .fetch_one(&pool)
                .await
                .unwrap();

        assert_eq!(current, user_id.to_string());
        assert!(
            after.unwrap_or_default().is_empty(),
            "o valor vale só na transação"
        );
    }

    #[tokio::test]
    async fn rls_policy_hides_other_users_rows() {
        let database = test_pool().await;
        let pool = database.pool().clone();
        let alice = Uuid::from_u128(1);
        let bob = Uuid::from_u128(2);
        sqlx::raw_sql(
            "CREATE TABLE rls_items (id INT PRIMARY KEY, owner_id UUID NOT NULL);
             ALTER TABLE rls_items ENABLE ROW LEVEL SECURITY;
             ALTER TABLE rls_items FORCE ROW LEVEL SECURITY;
             CREATE POLICY rls_items_owner ON rls_items
               USING (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
               WITH CHECK (owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);",
        )
        .execute(&pool)
        .await
        .unwrap();
        for (id, owner) in [(1, alice), (2, alice), (3, bob)] {
            let mut tx = begin_for_user(&pool, owner).await.unwrap();
            sqlx::query("INSERT INTO rls_items (id, owner_id) VALUES ($1, $2)")
                .bind(id)
                .bind(owner)
                .execute(&mut *tx)
                .await
                .unwrap();
            tx.commit().await.unwrap();
        }

        let mut tx = begin_for_user(&pool, alice).await.unwrap();
        let visible: Vec<i32> = sqlx::query_scalar("SELECT id FROM rls_items ORDER BY id")
            .fetch_all(&mut *tx)
            .await
            .unwrap();
        let foreign_insert = sqlx::query("INSERT INTO rls_items (id, owner_id) VALUES (4, $1)")
            .bind(bob)
            .execute(&mut *tx)
            .await;
        drop(tx);
        let anonymous: i64 = sqlx::query_scalar("SELECT count(*) FROM rls_items")
            .fetch_one(&pool)
            .await
            .unwrap();
        let role_is_plain: bool = sqlx::query_scalar(
            "SELECT NOT rolsuper AND NOT rolbypassrls FROM pg_roles WHERE rolname = $1",
        )
        .bind(APP_ROLE)
        .fetch_one(&admin_pool().await)
        .await
        .unwrap();

        assert_eq!(visible, [1, 2]);
        assert!(foreign_insert.is_err());
        assert_eq!(anonymous, 0);
        assert!(role_is_plain);
    }
}
