//! Contexto `journal`: entradas do Diário com data, hora, texto criptografado em
//! repouso e emoções com intensidade opcional, e a lista editável de emoções
//! (RF-44, RF-45, RF-46, RNF-03).
//!
//! A TASK-18 registra `router()`, `migrator()` e `openapi()`; a busca (TASK-16) e o
//! relatório do Diário (TASK-17) leem as entradas só pelo `JournalReader`, nunca
//! pelas tabelas.

pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod interface;
#[cfg(test)]
mod tests;

use axum::Router;
use utoipa::OpenApi;

// Usados pela busca, pelos relatórios e pela integração (TASK-16 a TASK-18); até lá,
// sem uso no binário.
#[allow(unused_imports)]
pub use self::application::entries::{DecryptedJournalEntry, JournalReader};
#[allow(unused_imports)]
pub use self::interface::openapi::JournalApi;
use crate::http::AppState;

/// Rotas do contexto, relativas a `/api/v1`.
pub fn router() -> Router<AppState> {
    interface::router()
}

/// Migrações do contexto. Os contextos dividem a tabela `_sqlx_migrations`, então o
/// migrator ignora as migrações aplicadas que pertencem a outro contexto.
pub fn migrator() -> sqlx::migrate::Migrator {
    let mut migrator = sqlx::migrate!("src/journal/migrations");
    migrator.set_ignore_missing(true);
    migrator
}

pub fn openapi() -> utoipa::openapi::OpenApi {
    JournalApi::openapi()
}
