//! Corpos de requisição e resposta em `snake_case`.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::goals::domain::goal::{GoalStatus, GoalView};
use crate::goals::domain::milestone::Milestone;
use crate::shared::visibility::Visibility;

/// Distingue o campo ausente (`None`) do `null` explícito (`Some(None)`).
fn explicit_null<'de, T, D>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateGoalRequest {
    pub title: String,
    pub description: Option<String>,
    pub deadline: Option<NaiveDate>,
    /// Padrão `planned`.
    pub status: Option<GoalStatus>,
    /// Até 20 etiquetas de até 50 caracteres; sem o campo, nenhuma.
    pub labels: Option<Vec<String>>,
    /// Padrão `personal`.
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateGoalRequest {
    pub title: Option<String>,
    /// `null` limpa a descrição.
    #[serde(default, deserialize_with = "explicit_null")]
    #[schema(value_type = Option<String>)]
    pub description: Option<Option<String>>,
    /// `null` limpa o prazo.
    #[serde(default, deserialize_with = "explicit_null")]
    #[schema(value_type = Option<NaiveDate>)]
    pub deadline: Option<Option<NaiveDate>>,
    pub status: Option<GoalStatus>,
    /// Troca a lista inteira; ausente, mantém.
    pub labels: Option<Vec<String>>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct GoalResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub title: String,
    pub description: Option<String>,
    pub deadline: Option<NaiveDate>,
    pub status: GoalStatus,
    pub labels: Vec<String>,
    /// De 0 a 100, calculado dos marcos (RN-15).
    pub progress_percent: u8,
    pub milestone_count: u32,
    pub completed_milestone_count: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<GoalView> for GoalResponse {
    fn from(view: GoalView) -> Self {
        let progress_percent = view.progress_percent();
        let goal = view.goal;
        Self {
            id: goal.id,
            owner_id: goal.owner_id,
            visibility: goal.visibility,
            title: goal.title,
            description: goal.description,
            deadline: goal.deadline,
            status: goal.status,
            labels: goal.labels,
            progress_percent,
            milestone_count: view.milestone_count,
            completed_milestone_count: view.completed_milestone_count,
            created_at: goal.created_at,
            updated_at: goal.updated_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct GoalPage {
    pub items: Vec<GoalResponse>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Copy, Default, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SortParam {
    Deadline,
    #[default]
    CreatedAt,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct GoalListQuery {
    /// Filtro por status.
    pub status: Option<GoalStatus>,
    /// Busca por parte do título.
    pub q: Option<String>,
    /// Filtro por uma etiqueta, comparação exata.
    pub label: Option<String>,
    /// `true` traz só as metas com prazo; `false`, só as sem prazo; ausente, todas.
    pub has_deadline: Option<bool>,
    /// `deadline` (crescente, sem prazo no fim) ou `created_at` (mais novas primeiro, padrão).
    pub sort: Option<SortParam>,
    pub cursor: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateMilestoneRequest {
    pub title: String,
    /// Sem posição, o marco entra no fim.
    pub position: Option<i32>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateMilestoneRequest {
    pub title: Option<String>,
    pub position: Option<i32>,
    /// `true` conclui o marco; `false` o reabre.
    pub completed: Option<bool>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MilestoneResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub goal_id: Uuid,
    pub title: String,
    pub position: i32,
    pub completed: bool,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Milestone> for MilestoneResponse {
    fn from(milestone: Milestone) -> Self {
        Self {
            id: milestone.id,
            owner_id: milestone.owner_id,
            visibility: milestone.visibility,
            goal_id: milestone.goal_id,
            title: milestone.title,
            position: milestone.position,
            completed: milestone.completed_at.is_some(),
            completed_at: milestone.completed_at,
            created_at: milestone.created_at,
            updated_at: milestone.updated_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct MilestonePage {
    pub items: Vec<MilestoneResponse>,
    /// Sempre nulo: os marcos de uma meta vêm todos de uma vez.
    pub next_cursor: Option<String>,
}
