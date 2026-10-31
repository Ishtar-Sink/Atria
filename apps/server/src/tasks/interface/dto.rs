//! Corpos da API de tarefas, em `snake_case`.

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::shared::recurrence::RecurrenceRule;
use crate::shared::visibility::Visibility;
use crate::tasks::application::tasks::{CompletionView, OccurrenceView, TaskView};

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateTaskRequest {
    #[schema(example = "Pagar a conta de luz")]
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    /// Só na tarefa pontual.
    #[serde(default)]
    pub due_on: Option<NaiveDate>,
    #[serde(default)]
    pub visibility: Visibility,
    /// Com a regra, a tarefa é recorrente.
    #[serde(default)]
    pub recurrence: Option<RecurrenceRule>,
    /// Até 20 etiquetas de até 50 caracteres, sem repetidas; ausente, nenhuma.
    #[serde(default)]
    #[schema(example = json!(["casa", "obra"]))]
    pub labels: Option<Vec<String>>,
}

/// Edição parcial: campo ausente fica como está; `null` limpa os campos opcionais.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateTaskRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default, deserialize_with = "present")]
    #[schema(value_type = Option<String>)]
    pub description: Option<Option<String>>,
    #[serde(default, deserialize_with = "present")]
    #[schema(value_type = Option<NaiveDate>)]
    pub due_on: Option<Option<NaiveDate>>,
    #[serde(default)]
    pub visibility: Option<Visibility>,
    /// Regra nova da tarefa recorrente, valendo a partir de `effective_from`.
    #[serde(default)]
    pub recurrence: Option<RecurrenceRule>,
    /// Padrão: hoje, no fuso da regra nova.
    #[serde(default)]
    pub effective_from: Option<NaiveDate>,
    /// Troca a lista inteira de etiquetas; ausente, mantém.
    #[serde(default)]
    pub labels: Option<Vec<String>>,
}

/// Distingue o campo ausente (`None`) do `null` (`Some(None)`).
fn present<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CompletionRequest {
    /// Obrigatória na tarefa recorrente; ausente na pontual.
    #[serde(default)]
    pub occurrence_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Default, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct CompletionQuery {
    /// Obrigatória na tarefa recorrente.
    pub occurrence_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatusParam {
    Open,
    Completed,
}

#[derive(Debug, Clone, Default, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct TaskListQuery {
    pub status: Option<TaskStatusParam>,
    pub recurring: Option<bool>,
    pub due_from: Option<NaiveDate>,
    pub due_to: Option<NaiveDate>,
    /// Busca no título, sem diferenciar maiúsculas.
    pub q: Option<String>,
    /// Etiqueta exata que a tarefa precisa ter, com até 50 caracteres.
    pub label: Option<String>,
    pub cursor: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct OccurrencesQuery {
    pub from: NaiveDate,
    /// Até 366 dias depois de `from`, inclusive.
    pub to: NaiveDate,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct TaskResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub title: String,
    pub description: Option<String>,
    pub due_on: Option<NaiveDate>,
    pub is_recurring: bool,
    /// Só na tarefa pontual.
    pub completed_at: Option<DateTime<Utc>>,
    /// Regra vigente da tarefa recorrente.
    pub recurrence: Option<RecurrenceRule>,
    pub labels: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<TaskView> for TaskResponse {
    fn from(view: TaskView) -> Self {
        let task = view.task;
        Self {
            id: task.id,
            owner_id: task.owner_id,
            visibility: task.visibility,
            title: task.title,
            description: task.description,
            due_on: task.due_on,
            is_recurring: task.is_recurring,
            completed_at: task.completed_at,
            recurrence: view.recurrence,
            labels: task.labels,
            created_at: task.created_at,
            updated_at: task.updated_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct TaskPageResponse {
    pub items: Vec<TaskResponse>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct CompletionResponse {
    pub task_id: Uuid,
    /// Data da ocorrência na tarefa recorrente; nula na pontual.
    pub occurrence_date: Option<NaiveDate>,
    pub completed: bool,
    pub completed_at: Option<DateTime<Utc>>,
}

impl From<CompletionView> for CompletionResponse {
    fn from(view: CompletionView) -> Self {
        Self {
            task_id: view.task_id,
            occurrence_date: view.occurrence_date,
            completed: view.completed,
            completed_at: view.completed_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OccurrenceResponse {
    pub task_id: Uuid,
    pub occurrence_date: NaiveDate,
    pub completed: bool,
}

impl From<OccurrenceView> for OccurrenceResponse {
    fn from(view: OccurrenceView) -> Self {
        Self {
            task_id: view.task_id,
            occurrence_date: view.occurrence_date,
            completed: view.completed,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OccurrenceListResponse {
    pub items: Vec<OccurrenceResponse>,
}
