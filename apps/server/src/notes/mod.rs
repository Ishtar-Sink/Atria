//! Contexto `notes`: notas independentes, com título e corpo criptografados em
//! repouso (RF-43, RNF-03).
//!
//! A TASK-18 registra `router()`, `migrator()` e `openapi()`; a busca (TASK-16) lê
//! as notas só pelo `NoteReader`, nunca pela tabela.

pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod interface;
#[cfg(test)]
mod tests;

use axum::Router;
use utoipa::OpenApi;

// Usados pela busca (TASK-16) e pela integração (TASK-18); até lá, sem uso no binário.
#[allow(unused_imports)]
pub use self::application::service::{DecryptedNote, NoteReader};
#[allow(unused_imports)]
pub use self::interface::openapi::NotesApi;
use crate::http::AppState;

/// Rotas do contexto, relativas a `/api/v1`.
pub fn router() -> Router<AppState> {
    interface::router()
}

/// Migrações do contexto. Os contextos dividem a tabela `_sqlx_migrations`, então o
/// migrator ignora as migrações aplicadas que pertencem a outro contexto.
pub fn migrator() -> sqlx::migrate::Migrator {
    let mut migrator = sqlx::migrate!("src/notes/migrations");
    migrator.set_ignore_missing(true);
    migrator
}

pub fn openapi() -> utoipa::openapi::OpenApi {
    NotesApi::openapi()
}
