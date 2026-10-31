//! Portas do contexto: o repositório e o gancho de exclusão (CB-06).

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::goals::domain::error::GoalsError;
use crate::goals::domain::goal::{Goal, GoalPatch, GoalStatus, GoalView};
use crate::goals::domain::milestone::{Milestone, MilestonePatch};

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

/// Prazo das metas sem prazo na ordenação por prazo, para ficarem no fim.
pub const NO_DEADLINE: NaiveDate = match NaiveDate::from_ymd_opt(9999, 12, 31) {
    Some(date) => date,
    None => NaiveDate::MAX,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum GoalSort {
    Deadline,
    #[default]
    CreatedAt,
}

/// Posição da listagem, na ordem escolhida.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GoalPosition {
    /// Prazo (meta sem prazo vale o fim dos tempos) e id, em ordem crescente.
    Deadline(NaiveDate, Uuid),
    /// Criação e id, em ordem decrescente.
    CreatedAt(DateTime<Utc>, Uuid),
}

#[derive(Debug, Clone, Default)]
pub struct GoalQuery {
    pub status: Option<GoalStatus>,
    pub text: Option<String>,
    /// Uma etiqueta, comparação exata.
    pub label: Option<String>,
    pub has_deadline: Option<bool>,
    pub sort: GoalSort,
    pub after: Option<GoalPosition>,
    /// O repositório devolve até `limit` linhas; o serviço pede uma a mais.
    pub limit: u32,
}

/// Toda operação é do `owner` e roda numa transação com a RLS ativa; dado
/// inexistente, excluído ou de outro dono vira `GoalsError::NotFound`.
pub trait GoalRepository: Send + Sync {
    async fn insert_goal(&self, goal: &Goal) -> Result<GoalView, GoalsError>;
    async fn list_goals(&self, owner: Uuid, query: &GoalQuery)
    -> Result<Vec<GoalView>, GoalsError>;
    async fn get_goal(&self, owner: Uuid, id: Uuid) -> Result<GoalView, GoalsError>;
    async fn update_goal(
        &self,
        owner: Uuid,
        id: Uuid,
        patch: &GoalPatch,
        now: DateTime<Utc>,
    ) -> Result<GoalView, GoalsError>;
    /// Exclusão lógica da meta e dos marcos ativos; devolve os ids dos marcos excluídos.
    async fn delete_goal(
        &self,
        owner: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<Vec<Uuid>, GoalsError>;
    async fn list_milestones(
        &self,
        owner: Uuid,
        goal_id: Uuid,
    ) -> Result<Vec<Milestone>, GoalsError>;
    /// Sem posição, o marco entra no fim.
    async fn insert_milestone(
        &self,
        milestone: &Milestone,
        position: Option<i32>,
    ) -> Result<Milestone, GoalsError>;
    async fn update_milestone(
        &self,
        owner: Uuid,
        goal_id: Uuid,
        id: Uuid,
        patch: &MilestonePatch,
        now: DateTime<Utc>,
    ) -> Result<Milestone, GoalsError>;
    async fn delete_milestone(
        &self,
        owner: Uuid,
        goal_id: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<(), GoalsError>;
}
