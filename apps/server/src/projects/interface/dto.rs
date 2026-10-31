//! Corpos de requisição e resposta em `snake_case`.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::projects::application::ports::ProjectListItem;
use crate::projects::application::service::{CardPatchInput, ChecklistInput};
use crate::projects::domain::card::{Card, ChecklistItem};
use crate::projects::domain::lane::{Lane, SystemLane};
use crate::projects::domain::project::Project;
use crate::projects::domain::summary::{
    InProgressCard, LaneSummary, ProjectSummary, SummaryProgress, UpcomingCard,
};
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
pub struct CreateProjectRequest {
    pub name: String,
    pub description: Option<String>,
    /// Padrão `personal`.
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateProjectRequest {
    pub name: Option<String>,
    /// `null` limpa a descrição.
    #[serde(default, deserialize_with = "explicit_null")]
    #[schema(value_type = Option<String>)]
    pub description: Option<Option<String>>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct ProjectListQuery {
    pub cursor: Option<String>,
    /// De 1 a 100; padrão 50.
    pub limit: Option<u32>,
    /// Busca por parte do nome.
    pub q: Option<String>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ProgressResponse {
    pub done_cards: u32,
    pub total_cards: u32,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct LaneResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub project_id: Uuid,
    /// Raias padrão: `waiting`, `in_progress` ou `done`; a tradução do nome é do frontend.
    pub system_key: Option<SystemLane>,
    pub name: Option<String>,
    /// HEX `#rrggbb`.
    pub color: String,
    pub counts_as_done: bool,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Lane> for LaneResponse {
    fn from(lane: Lane) -> Self {
        Self {
            id: lane.id,
            owner_id: lane.owner_id,
            visibility: lane.visibility,
            project_id: lane.project_id,
            system_key: lane.system_key,
            name: lane.name,
            color: lane.color.as_str().to_owned(),
            counts_as_done: lane.counts_as_done,
            position: lane.position,
            created_at: lane.created_at,
            updated_at: lane.updated_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ProjectResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub name: String,
    pub description: Option<String>,
    pub progress: ProgressResponse,
    pub lanes: Vec<LaneResponse>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ProjectResponse {
    fn build(project: Project, done_cards: u32, total_cards: u32) -> Self {
        Self {
            id: project.id,
            owner_id: project.owner_id,
            visibility: project.visibility,
            name: project.name,
            description: project.description,
            progress: ProgressResponse {
                done_cards,
                total_cards,
            },
            lanes: project.lanes.into_iter().map(LaneResponse::from).collect(),
            created_at: project.created_at,
            updated_at: project.updated_at,
        }
    }
}

impl From<Project> for ProjectResponse {
    fn from(project: Project) -> Self {
        let (done, total) = project.progress();
        Self::build(project, done, total)
    }
}

impl From<ProjectListItem> for ProjectResponse {
    fn from(item: ProjectListItem) -> Self {
        Self::build(item.project, item.done_cards, item.total_cards)
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ProjectPage {
    pub items: Vec<ProjectResponse>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct LanePage {
    pub items: Vec<LaneResponse>,
    /// Sempre nulo: as raias de um projeto vêm todas de uma vez.
    pub next_cursor: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateLaneRequest {
    pub name: String,
    /// HEX `#rrggbb`.
    pub color: String,
    /// Padrão `false`.
    pub counts_as_done: Option<bool>,
    /// Sem posição, a raia entra no fim.
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateLaneRequest {
    pub name: Option<String>,
    pub color: Option<String>,
    pub counts_as_done: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct ReorderLanesRequest {
    /// Todas as raias do projeto, cada uma uma vez, na nova ordem.
    pub lane_ids: Vec<Uuid>,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct DeleteLaneQuery {
    /// Raia que recebe os cartões; obrigatória quando a raia excluída tem cartões.
    pub move_cards_to: Option<Uuid>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct ChecklistItemRequest {
    pub text: String,
    /// Padrão `false`.
    pub done: Option<bool>,
}

impl From<ChecklistItemRequest> for ChecklistInput {
    fn from(item: ChecklistItemRequest) -> Self {
        Self {
            text: item.text,
            done: item.done.unwrap_or(false),
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateCardRequest {
    pub lane_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    /// `low`, `medium` ou `high`; ausente é sem prioridade.
    pub priority: Option<String>,
    pub labels: Option<Vec<String>>,
    pub due_date: Option<NaiveDate>,
    pub checklist: Option<Vec<ChecklistItemRequest>>,
    /// Sem posição, o cartão entra no fim da raia.
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateCardRequest {
    pub title: Option<String>,
    /// `null` limpa a descrição.
    #[serde(default, deserialize_with = "explicit_null")]
    #[schema(value_type = Option<String>)]
    pub description: Option<Option<String>>,
    /// `null` limpa a prioridade.
    #[serde(default, deserialize_with = "explicit_null")]
    #[schema(value_type = Option<String>)]
    pub priority: Option<Option<String>>,
    pub labels: Option<Vec<String>>,
    /// `null` limpa o prazo.
    #[serde(default, deserialize_with = "explicit_null")]
    #[schema(value_type = Option<NaiveDate>)]
    pub due_date: Option<Option<NaiveDate>>,
    /// Substitui o checklist inteiro.
    pub checklist: Option<Vec<ChecklistItemRequest>>,
}

impl From<UpdateCardRequest> for CardPatchInput {
    fn from(body: UpdateCardRequest) -> Self {
        Self {
            title: body.title,
            description: body.description,
            priority: body.priority,
            labels: body.labels,
            due_date: body.due_date,
            checklist: body
                .checklist
                .map(|items| items.into_iter().map(ChecklistInput::from).collect()),
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct MoveCardRequest {
    pub lane_id: Uuid,
    /// Sem posição, o cartão vai para o fim da raia.
    pub position: Option<i32>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ChecklistItemResponse {
    pub id: Uuid,
    pub text: String,
    pub done: bool,
    pub position: i32,
}

impl From<ChecklistItem> for ChecklistItemResponse {
    fn from(item: ChecklistItem) -> Self {
        Self {
            id: item.id,
            text: item.text,
            done: item.done,
            position: item.position,
        }
    }
}

/// A tarefa ligada ao cartão não vem aqui: é uma ligação, lida em `GET /links`.
#[derive(Debug, Serialize, ToSchema)]
pub struct CardResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub project_id: Uuid,
    pub lane_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    /// `low`, `medium` ou `high`.
    pub priority: Option<String>,
    pub labels: Vec<String>,
    pub due_date: Option<NaiveDate>,
    pub checklist: Vec<ChecklistItemResponse>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Card> for CardResponse {
    fn from(card: Card) -> Self {
        Self {
            id: card.id,
            owner_id: card.owner_id,
            visibility: card.visibility,
            project_id: card.project_id,
            lane_id: card.lane_id,
            title: card.title,
            description: card.description,
            priority: card.priority.map(|p| p.as_str().to_owned()),
            labels: card.labels,
            due_date: card.due_date,
            checklist: card
                .checklist
                .into_iter()
                .map(ChecklistItemResponse::from)
                .collect(),
            position: card.position,
            created_at: card.created_at,
            updated_at: card.updated_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CardPage {
    pub items: Vec<CardResponse>,
    /// Sempre nulo: os cartões de um projeto vêm todos de uma vez.
    pub next_cursor: Option<String>,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct ProjectSummaryQuery {
    /// Data de hoje no fuso da pessoa (`AAAA-MM-DD`); sem ela vale a data UTC do servidor.
    pub today: Option<NaiveDate>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct LaneSummaryResponse {
    pub lane_id: Uuid,
    pub system_key: Option<SystemLane>,
    pub name: Option<String>,
    pub color: String,
    pub counts_as_done: bool,
    pub card_count: u32,
}

impl From<LaneSummary> for LaneSummaryResponse {
    fn from(lane: LaneSummary) -> Self {
        Self {
            lane_id: lane.lane_id,
            system_key: lane.system_key,
            name: lane.name,
            color: lane.color,
            counts_as_done: lane.counts_as_done,
            card_count: lane.card_count,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UpcomingCardResponse {
    pub card_id: Uuid,
    pub lane_id: Uuid,
    pub title: String,
    pub due_date: NaiveDate,
    /// O servidor só marca o atraso.
    pub overdue: bool,
}

impl From<UpcomingCard> for UpcomingCardResponse {
    fn from(card: UpcomingCard) -> Self {
        Self {
            card_id: card.card_id,
            lane_id: card.lane_id,
            title: card.title,
            due_date: card.due_date,
            overdue: card.overdue,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct InProgressCardResponse {
    pub card_id: Uuid,
    pub lane_id: Uuid,
    pub title: String,
    pub priority: Option<String>,
    pub due_date: Option<NaiveDate>,
    pub checklist_done: u32,
    pub checklist_total: u32,
}

impl From<InProgressCard> for InProgressCardResponse {
    fn from(card: InProgressCard) -> Self {
        Self {
            card_id: card.card_id,
            lane_id: card.lane_id,
            title: card.title,
            priority: card.priority.map(|p| p.as_str().to_owned()),
            due_date: card.due_date,
            checklist_done: card.checklist_done,
            checklist_total: card.checklist_total,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ProjectSummaryResponse {
    pub progress: ProgressResponse,
    pub lanes: Vec<LaneSummaryResponse>,
    pub upcoming_due: Vec<UpcomingCardResponse>,
    pub in_progress: Vec<InProgressCardResponse>,
}

impl From<SummaryProgress> for ProgressResponse {
    fn from(progress: SummaryProgress) -> Self {
        Self {
            done_cards: progress.done_cards,
            total_cards: progress.total_cards,
        }
    }
}

impl From<ProjectSummary> for ProjectSummaryResponse {
    fn from(summary: ProjectSummary) -> Self {
        Self {
            progress: summary.progress.into(),
            lanes: summary.lanes.into_iter().map(Into::into).collect(),
            upcoming_due: summary.upcoming_due.into_iter().map(Into::into).collect(),
            in_progress: summary.in_progress.into_iter().map(Into::into).collect(),
        }
    }
}
