//! Contexto `search`: busca global em todos os contextos, agrupada por contexto
//! (RF-16, RF-59, CT-12). Não tem tabela própria: chama o serviço público de cada
//! contexto ([project/architecture-04]).

pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod interface;
#[cfg(test)]
mod tests;

use axum::Router;

#[allow(unused_imports)]
pub use self::interface::SearchApi;
use crate::http::AppState;

/// Rotas do contexto, relativas a `/api/v1`.
pub fn router() -> Router<AppState> {
    interface::router()
}

/// Migrações do contexto: nenhuma, mas os contextos dividem a tabela
/// `_sqlx_migrations`, então o migrator ignora as migrações de outro contexto.
pub fn migrator() -> sqlx::migrate::Migrator {
    let mut migrator = sqlx::migrate!("src/search/migrations");
    migrator.set_ignore_missing(true);
    migrator
}

/// Documento OpenAPI do contexto.
#[allow(dead_code)]
pub fn openapi() -> utoipa::openapi::OpenApi {
    use utoipa::OpenApi;
    SearchApi::openapi()
}
