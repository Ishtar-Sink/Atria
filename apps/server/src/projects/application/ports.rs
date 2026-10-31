//! Portas do contexto: o repositório, a busca e o gancho de exclusão (CB-06).

use std::future::Future;
use std::pin::Pin;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::projects::domain::card::CardId;
use crate::projects::domain::error::ProjectError;
use crate::projects::domain::project::Project;
use crate::shared::visibility::Visibility;

/// Gancho chamado depois do commit de uma exclusão, com `(owner_id, entity_type,
/// entity_id)`, para as ligações da entidade sumirem dos dois lados (CB-06).
///
/// A grafia tem de ser idêntica à de `links::EntityDeletedHook` (TASK-15) e à dos
/// outros contextos que excluem: só assim é o mesmo tipo na `Extension` e o gancho
/// instalado pela TASK-18 chega aos handlers.
pub type EntityDeletedHook = std::sync::Arc<
    dyn Fn(
            uuid::Uuid,
            &'static str,
            uuid::Uuid,
        ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>>
        + Send
        + Sync,
>;

/// Posição da listagem: criação e id, em ordem decrescente.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProjectPosition {
    pub created_at: DateTime<Utc>,
    pub id: Uuid,
}

#[derive(Debug, Clone, Default)]
pub struct ProjectQuery {
    pub text: Option<String>,
    pub visibility: Option<Visibility>,
    pub after: Option<ProjectPosition>,
    /// O repositório devolve até `limit` linhas; o serviço pede uma a mais.
    pub limit: u32,
}

/// Projeto da listagem, com as raias e o progresso (cartões em raias que contam como
/// concluídas sobre o total), sem os cartões.
#[derive(Debug, Clone)]
pub struct ProjectListItem {
    pub project: Project,
    pub done_cards: u32,
    pub total_cards: u32,
}

/// Toda operação é do `owner` e roda numa transação com a RLS ativa; dado inexistente,
/// excluído ou de outro dono vira `ProjectError::ProjectNotFound`.
pub trait ProjectRepository: Send + Sync {
    /// Grava o projeto com as raias padrão.
    async fn insert_with_lanes(&self, project: &Project) -> Result<(), ProjectError>;
    async fn find_live(&self, owner: Uuid, id: Uuid) -> Result<Project, ProjectError>;
    async fn list_live(
        &self,
        owner: Uuid,
        query: &ProjectQuery,
    ) -> Result<Vec<ProjectListItem>, ProjectError>;
    /// Id do projeto do cartão vivo, de um projeto vivo do dono; sem ele,
    /// `ProjectError::CardNotFound`.
    async fn find_card_project(&self, owner: Uuid, card_id: CardId) -> Result<Uuid, ProjectError>;
    /// Exclusão lógica do projeto e dos cartões vivos; devolve os ids dos cartões.
    async fn soft_delete(
        &self,
        owner: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<Vec<Uuid>, ProjectError>;
    /// Trava a linha do projeto (`SELECT ... FOR UPDATE`), carrega o agregado, aplica a
    /// mudança do domínio e grava só a diferença, tudo numa transação: duas exclusões de
    /// raia simultâneas não deixam o projeto sem raia (RN-16).
    async fn mutate<R, F>(
        &self,
        owner: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
        change: F,
    ) -> Result<R, ProjectError>
    where
        R: Send,
        F: FnOnce(&mut Project) -> Result<R, ProjectError> + Send;
}

/// Resultado da busca global.
#[derive(Debug, Clone, PartialEq)]
pub struct ProjectSearchHit {
    /// `project` ou `project_card`.
    pub entity_type: &'static str,
    pub id: Uuid,
    /// Para um cartão, o projeto dele; para um projeto, o próprio id.
    pub project_id: Uuid,
    pub title: String,
    pub rank: f64,
}

pub type SearchFuture<'a> =
    Pin<Box<dyn Future<Output = Result<Vec<ProjectSearchHit>, ProjectError>> + Send + 'a>>;

pub trait SearchRepository: Send + Sync {
    fn search<'a>(&'a self, owner_id: Uuid, query: &'a str, limit: i64) -> SearchFuture<'a>;
}
