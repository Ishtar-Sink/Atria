//! Contexto Financeiro: contas, movimentações, liquidação, transferências,
//! categorias, recorrências com ocorrência aberta e o painel por período (RF-24 a
//! RF-35, PD-49, PD-51, PD-55, PD-58).

pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod interface;
#[cfg(test)]
mod tests;

// A TASK-18 junta o `FinanceApi` ao documento do servidor; até lá só os testes o usam.
#[allow(unused_imports)]
pub use interface::openapi::FinanceApi;

use crate::http::AppState;

/// Rotas do contexto, montadas sob `/api/v1` pela TASK-18.
pub fn router() -> axum::Router<AppState> {
    interface::routes()
}

/// Migrações do contexto. Ignora as versões dos outros contextos, que dividem a
/// mesma tabela `_sqlx_migrations` no banco.
pub fn migrator() -> sqlx::migrate::Migrator {
    let mut migrator = sqlx::migrate!("src/finance/migrations");
    migrator.set_ignore_missing(true);
    migrator
}
