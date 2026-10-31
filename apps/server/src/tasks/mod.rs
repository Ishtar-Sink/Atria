//! Contexto de tarefas: pontuais e recorrentes, com cada ocorrência concluída
//! separadamente (RF-38, RF-39).

pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod interface;
#[cfg(test)]
mod tests;

// Ainda sem uso no binário: a TASK-18 junta o `TasksApi` ao OpenAPI do servidor.
#[allow(unused_imports)]
pub use interface::openapi::TasksApi;

/// Rotas do contexto, para montar sob `/api/v1`.
pub fn router() -> axum::Router<crate::http::AppState> {
    interface::routes()
}

/// Migrações do contexto, aplicadas pelo `main.rs` (decisão 55).
pub fn migrator() -> sqlx::migrate::Migrator {
    sqlx::migrate!("src/tasks/migrations")
}
