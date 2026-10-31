//! Contexto `reports`: nove relatórios em JSON, HTML interativo e PDF com a identidade
//! visual, e a exportação dos dados do usuário em JSON e CSV (RF-61, RF-62, RF-63).
//!
//! Não tem tabela própria: lê os outros contextos pelos serviços de aplicação deles
//! ([project/architecture-04]). O `main.rs` registra `router()` e `migrator()` (TASK-18).

pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod interface;
#[cfg(test)]
mod tests;

use axum::Router;

// A TASK-18 usa `ReportsApiDoc` ao montar o OpenAPI; até lá nada a referencia fora dos testes.
#[allow(unused_imports)]
pub use self::interface::ReportsApiDoc;
use crate::http::AppState;

/// Rotas do contexto, relativas a `/api/v1`.
pub fn router() -> Router<AppState> {
    interface::router()
}

/// Migrações do contexto (vazias: não há tabela própria). Os contextos dividem a tabela
/// `_sqlx_migrations`, então o migrator ignora as migrações aplicadas de outro contexto.
pub fn migrator() -> sqlx::migrate::Migrator {
    let mut migrator = sqlx::migrate!("src/reports/migrations");
    migrator.set_ignore_missing(true);
    migrator
}
