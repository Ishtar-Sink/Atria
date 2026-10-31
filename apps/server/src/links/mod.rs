//! Contexto `links`: ligações bidirecionais genéricas "Conecta com" (RF-18, RN-10).
//!
//! A TASK-18 registra `router()`, `migrator()` e `openapi()` e instala
//! `Extension(links::entity_deleted_hook(pool))` no app.

pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod interface;
#[cfg(test)]
mod tests;

use axum::Router;
use utoipa::OpenApi;

// Usados pela TASK-18; até lá, sem uso no binário.
#[allow(unused_imports)]
pub use self::application::deletion_hook::{
    EntityDeletedHook, entity_deleted_hook, remove_links_for_entity,
};
#[allow(unused_imports)]
pub use self::interface::openapi::LinksApi;
use crate::http::AppState;

/// Rotas do contexto, relativas a `/api/v1`.
pub fn router() -> Router<AppState> {
    interface::router()
}

/// Migrações do contexto. Os contextos dividem a tabela `_sqlx_migrations`, então o
/// migrator ignora as migrações aplicadas que pertencem a outro contexto.
pub fn migrator() -> sqlx::migrate::Migrator {
    let mut migrator = sqlx::migrate!("src/links/migrations");
    migrator.set_ignore_missing(true);
    migrator
}

pub fn openapi() -> utoipa::openapi::OpenApi {
    LinksApi::openapi()
}
