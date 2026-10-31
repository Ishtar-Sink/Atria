//! Migrações dos doze contextos numa tabela `_sqlx_migrations` só (decisão 55).

use std::collections::HashSet;

use crate::http::contexts::{migrators, run_migrations};
use crate::shared::test_support::test_pool;

/// Tabelas com `owner_id` sem RLS por decisão do contexto: `reminder_schedule` guarda
/// só ids e o instante, para o disparo achar os vencidos de todos (TASK-10).
const WITHOUT_RLS: [&str; 1] = ["reminder_schedule"];

#[test]
fn migration_versions_are_unique_across_contexts() {
    let mut seen = HashSet::new();
    let mut repeated = Vec::new();
    for (context, migrator) in migrators() {
        for migration in migrator.iter() {
            if !seen.insert(migration.version) {
                repeated.push(format!("{context}: {}", migration.version));
            }
        }
    }
    assert!(seen.len() > 12, "esperava migrações de todos os contextos");
    assert!(repeated.is_empty(), "versões repetidas: {repeated:?}");
}

#[tokio::test]
async fn migrations_apply_on_empty_database_in_order() {
    let database = test_pool().await;

    run_migrations(database.pool()).await.unwrap();

    let applied: Vec<i64> =
        sqlx::query_scalar("SELECT version FROM _sqlx_migrations ORDER BY installed_on, version")
            .fetch_all(database.pool())
            .await
            .unwrap();
    let expected: Vec<i64> = migrators()
        .iter()
        .flat_map(|(_, migrator)| migrator.iter().map(|migration| migration.version))
        .collect();
    assert_eq!(applied, expected, "as migrações seguem a ordem do registro");
}

#[tokio::test]
async fn migrations_are_idempotent() {
    let database = test_pool().await;
    run_migrations(database.pool()).await.unwrap();
    let before: Vec<(i64, Vec<u8>)> =
        sqlx::query_as("SELECT version, checksum FROM _sqlx_migrations ORDER BY version")
            .fetch_all(database.pool())
            .await
            .unwrap();

    run_migrations(database.pool()).await.unwrap();

    let after: Vec<(i64, Vec<u8>)> =
        sqlx::query_as("SELECT version, checksum FROM _sqlx_migrations ORDER BY version")
            .fetch_all(database.pool())
            .await
            .unwrap();
    assert_eq!(before, after);
}

#[tokio::test]
async fn every_owned_table_has_row_level_security() {
    let database = test_pool().await;
    run_migrations(database.pool()).await.unwrap();

    let unprotected: Vec<String> = sqlx::query_scalar(
        "SELECT c.relname::text FROM pg_class c \
         JOIN pg_namespace n ON n.oid = c.relnamespace \
         WHERE n.nspname = 'public' AND c.relkind = 'r' \
           AND EXISTS (SELECT 1 FROM pg_attribute a \
                       WHERE a.attrelid = c.oid AND a.attname = 'owner_id' AND NOT a.attisdropped) \
           AND (NOT c.relrowsecurity \
                OR NOT EXISTS (SELECT 1 FROM pg_policies p \
                               WHERE p.schemaname = 'public' AND p.tablename = c.relname)) \
         ORDER BY 1",
    )
    .fetch_all(database.pool())
    .await
    .unwrap();

    let unprotected: Vec<_> = unprotected
        .into_iter()
        .filter(|table| !WITHOUT_RLS.contains(&table.as_str()))
        .collect();
    assert!(
        unprotected.is_empty(),
        "tabelas com dono sem RLS: {unprotected:?}"
    );
}
