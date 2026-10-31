//! Registro dos doze contextos: a única lista que o `main.rs` e o roteador consultam
//! para montar as rotas, as migrações e as extensões globais do `/api/v1`.

use std::sync::Arc;

use axum::{Extension, Router};
use sqlx::PgPool;
use sqlx::migrate::{MigrateError, Migrator};

use crate::http::AppState;
use crate::reminders::application::ports::BoxFuture;
use crate::{
    auth, finance, goals, journal, library, links, notes, projects, reminders, reports, search,
    tasks,
};

#[derive(Debug, thiserror::Error)]
pub enum MigrationError {
    #[error("falha ao migrar o store de sessões")]
    Sessions(#[source] sqlx::Error),
    #[error("falha ao aplicar as migrações do contexto {context}")]
    Context {
        context: &'static str,
        #[source]
        source: MigrateError,
    },
}

/// Migrators na ordem de aplicação (auth primeiro, decisão 55). Os contextos dividem a
/// tabela `_sqlx_migrations`, então cada um ignora as migrações aplicadas dos outros.
pub fn migrators() -> Vec<(&'static str, Migrator)> {
    let contexts = [
        ("auth", auth::migrator()),
        ("finance", finance::migrator()),
        ("goals", goals::migrator()),
        ("tasks", tasks::migrator()),
        ("reminders", reminders::migrator()),
        ("notes", notes::migrator()),
        ("journal", journal::migrator()),
        ("library", library::migrator()),
        ("projects", projects::migrator()),
        ("links", links::migrator()),
        ("search", search::migrator()),
        ("reports", reports::migrator()),
    ];
    contexts
        .into_iter()
        .map(|(name, mut migrator)| {
            migrator.set_ignore_missing(true);
            (name, migrator)
        })
        .collect()
}

/// Store de sessões e depois um contexto por vez, na ordem de `migrators()`.
pub async fn run_migrations(pool: &PgPool) -> Result<(), MigrationError> {
    crate::http::session::migrate_store(pool)
        .await
        .map_err(MigrationError::Sessions)?;
    for (context, migrator) in migrators() {
        migrator
            .run(pool)
            .await
            .map_err(|source| MigrationError::Context { context, source })?;
    }
    Ok(())
}

/// Política de Web Push do `reminders` sobre a configuração da instância do `auth`.
struct InstanceWebPushPolicy {
    pool: PgPool,
}

impl reminders::WebPushPolicy for InstanceWebPushPolicy {
    fn is_enabled(&self) -> BoxFuture<'_, bool> {
        Box::pin(async move {
            match auth::web_push_enabled(&self.pool).await {
                Ok(enabled) => enabled,
                Err(error) => {
                    // Na dúvida, desligado: o lembrete continua aparecendo no app.
                    tracing::warn!(error = %error, "falha ao ler a política de Web Push");
                    false
                }
            }
        })
    }
}

pub fn web_push_policy(pool: PgPool) -> Arc<dyn reminders::WebPushPolicy> {
    Arc::new(InstanceWebPushPolicy { pool })
}

/// Rotas dos doze contextos, relativas a `/api/v1`, com as camadas globais: conta
/// completa (admin com 2FA), gancho de exclusão de `links` e política de Web Push.
pub fn api_router(state: &AppState) -> Router<AppState> {
    Router::new()
        .merge(auth::router())
        .merge(finance::router())
        .merge(goals::router())
        .merge(tasks::router())
        .merge(reminders::router())
        .merge(notes::router())
        .merge(journal::router())
        .merge(library::router())
        .merge(projects::router())
        .merge(links::router())
        .merge(search::router())
        .merge(reports::router())
        .layer(auth::require_complete_account())
        .layer(Extension(links::entity_deleted_hook(state.pool.clone())))
        .layer(Extension(web_push_policy(state.pool.clone())))
}
