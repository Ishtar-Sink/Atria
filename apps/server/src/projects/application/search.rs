//! Busca de projetos e cartões para a busca global (TASK-16), sobre o `tsvector` gerado:
//! a busca não lê as tabelas do contexto, só pede por aqui ([project/architecture-04]).

use std::sync::Arc;

use uuid::Uuid;

pub use super::ports::ProjectSearchHit;
use super::ports::SearchRepository;
use crate::projects::domain::error::ProjectError;

const MAX_LIMIT: i64 = 100;

#[derive(Clone)]
pub struct ProjectSearch {
    repository: Arc<dyn SearchRepository>,
}

impl ProjectSearch {
    pub fn new(repository: Arc<dyn SearchRepository>) -> Self {
        Self { repository }
    }

    /// Projetos e cartões do dono que casam com o texto, sem diferenciar acento, do mais
    /// para o menos relevante.
    pub async fn search(
        &self,
        owner_id: Uuid,
        query: &str,
        limit: i64,
    ) -> Result<Vec<ProjectSearchHit>, ProjectError> {
        let query = query.trim();
        if query.is_empty() {
            return Ok(Vec::new());
        }
        let limit = limit.clamp(1, MAX_LIMIT);
        self.repository.search(owner_id, query, limit).await
    }
}
