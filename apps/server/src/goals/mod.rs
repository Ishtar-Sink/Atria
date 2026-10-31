//! Contexto `goals`: metas e marcos, com o progresso calculado pelos marcos
//! concluídos (RF-36, RF-37, RN-15).
//!
//! O `main.rs` registra `router()` e `migrator()` (TASK-18), que também instala o
//! gancho de exclusão como `Extension<EntityDeletedHook>`.

pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod interface;
#[cfg(test)]
mod tests;

use axum::Router;

// A TASK-18 usa `GoalsApi` ao montar o OpenAPI; até lá nada a referencia fora dos testes.
#[allow(unused_imports)]
pub use self::interface::openapi::GoalsApi;
use crate::http::AppState;

/// Rotas do contexto, relativas a `/api/v1`.
pub fn router() -> Router<AppState> {
    interface::router()
}

/// Migrações do contexto. Os contextos dividem a tabela `_sqlx_migrations`, então cada
/// migrator ignora as migrações aplicadas que pertencem a outro contexto.
pub fn migrator() -> sqlx::migrate::Migrator {
    let mut migrator = sqlx::migrate!("src/goals/migrations");
    migrator.set_ignore_missing(true);
    migrator
}
