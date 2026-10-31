//! Contexto `library` (Acervo): livros com progresso por sessões de leitura, artigos,
//! vídeos com miniatura, notas de item, PDF opcional servido só ao dono, posição de
//! leitura e destaques (RF-47 a RF-53, RF-64, RF-66 a RF-70).
//!
//! A TASK-18 registra `router()`, `migrator()` e `openapi()`, instala o gancho de
//! exclusão como `Extension<EntityDeletedHook>` e a busca (TASK-16) usa `LibrarySearch`.

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
pub use self::application::search::{LibrarySearch, LibrarySearchHit};
#[allow(unused_imports)]
pub use self::interface::openapi::LibraryApi;
use crate::http::AppState;

/// Rotas do contexto, relativas a `/api/v1`.
pub fn router() -> Router<AppState> {
    interface::router()
}

/// Migrações do contexto. Os contextos dividem a tabela `_sqlx_migrations`, então o
/// migrator ignora as migrações aplicadas que pertencem a outro contexto.
pub fn migrator() -> sqlx::migrate::Migrator {
    let mut migrator = sqlx::migrate!("src/library/migrations");
    migrator.set_ignore_missing(true);
    migrator
}

pub fn openapi() -> utoipa::openapi::OpenApi {
    LibraryApi::openapi()
}
