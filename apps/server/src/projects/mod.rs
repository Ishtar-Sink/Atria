//! Contexto `projects`: projetos com raias e cartões, progresso pelas raias que contam
//! como concluídas e a Visão geral (RF-54 a RF-57, RN-16, RN-20).
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

// A TASK-18 usa `ProjectsApi` ao montar o OpenAPI e a TASK-16 usa a busca; até lá nada
// os referencia fora dos testes.
#[allow(unused_imports)]
pub use self::application::search::{ProjectSearch, ProjectSearchHit};
#[allow(unused_imports)]
pub use self::interface::openapi::ProjectsApi;
use crate::http::AppState;

/// Rotas do contexto, relativas a `/api/v1`.
pub fn router() -> Router<AppState> {
    interface::router()
}

/// Migrações do contexto. Os contextos dividem a tabela `_sqlx_migrations`, então cada
/// migrator ignora as migrações aplicadas que pertencem a outro contexto.
pub fn migrator() -> sqlx::migrate::Migrator {
    let mut migrator = sqlx::migrate!("src/projects/migrations");
    migrator.set_ignore_missing(true);
    migrator
}

/// Documento OpenAPI do contexto.
#[allow(dead_code)]
pub fn openapi() -> utoipa::openapi::OpenApi {
    use utoipa::OpenApi;
    ProjectsApi::openapi()
}
