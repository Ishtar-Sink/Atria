//! Portas do contexto: o repositório de tarefas e o gancho de exclusão.

use std::collections::HashMap;
use std::future::Future;

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::shared::recurrence::RecurrenceRule;
use crate::tasks::domain::{CompletionLog, Schedule, Task, TasksError};

/// Gancho chamado depois do commit de uma exclusão, com `(owner_id, entity_type,
/// entity_id)`, para o contexto `links` remover as ligações (CB-06).
///
/// A grafia tem de ser idêntica à da TASK-15 (`links`) e à dos outros contextos que
/// excluem entidades: a `Extension` do axum casa pelo tipo, e um alias escrito de
/// outro jeito seria outro tipo, e o gancho nunca seria encontrado.
pub type EntityDeletedHook = std::sync::Arc<
    dyn Fn(
            uuid::Uuid,
            &'static str,
            uuid::Uuid,
        ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>>
        + Send
        + Sync,
>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskStatus {
    Open,
    Completed,
}

/// Filtros da listagem, com a posição do cursor (`created_at`, `id`).
#[derive(Debug, Clone, Default)]
pub struct TaskFilter {
    pub status: Option<TaskStatus>,
    pub recurring: Option<bool>,
    pub due_from: Option<NaiveDate>,
    pub due_to: Option<NaiveDate>,
    pub query: Option<String>,
    /// Etiqueta exata que a tarefa precisa ter.
    pub label: Option<String>,
    pub after: Option<(DateTime<Utc>, Uuid)>,
    pub limit: u32,
}

/// Tarefa pontual com data, para a listagem de ocorrências.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DatedTask {
    pub task_id: Uuid,
    pub due_on: NaiveDate,
    pub completed: bool,
}

pub trait TasksRepository: Send + Sync {
    type Tx<'a>: TasksTransaction
    where
        Self: 'a;

    /// Abre a transação já identificando o dono para a RLS.
    fn begin(
        &self,
        owner_id: Uuid,
    ) -> impl Future<Output = Result<Self::Tx<'_>, TasksError>> + Send;
}

/// Operações dentro de uma transação; toda query filtra pelo dono da transação.
pub trait TasksTransaction: Send {
    fn insert_task(&mut self, task: &Task) -> impl Future<Output = Result<(), TasksError>> + Send;

    fn find_task(
        &mut self,
        id: Uuid,
    ) -> impl Future<Output = Result<Option<Task>, TasksError>> + Send;

    fn update_task(&mut self, task: &Task) -> impl Future<Output = Result<(), TasksError>> + Send;

    /// Exclusão lógica; `false` quando a tarefa não existe para o dono.
    fn soft_delete_task(
        &mut self,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Result<bool, TasksError>> + Send;

    fn list_tasks(
        &mut self,
        filter: &TaskFilter,
    ) -> impl Future<Output = Result<Vec<Task>, TasksError>> + Send;

    /// Regra vigente de cada tarefa recorrente da lista.
    fn current_rules(
        &mut self,
        task_ids: &[Uuid],
    ) -> impl Future<Output = Result<HashMap<Uuid, RecurrenceRule>, TasksError>> + Send;

    fn load_schedule(
        &mut self,
        task_id: Uuid,
    ) -> impl Future<Output = Result<Schedule, TasksError>> + Send;

    /// Substitui os segmentos da tarefa pelos da agenda.
    fn save_schedule(
        &mut self,
        task_id: Uuid,
        schedule: &Schedule,
        now: DateTime<Utc>,
    ) -> impl Future<Output = Result<(), TasksError>> + Send;

    /// Todas as tarefas recorrentes do dono, com a agenda.
    fn recurring_schedules(
        &mut self,
    ) -> impl Future<Output = Result<Vec<(Uuid, Schedule)>, TasksError>> + Send;

    /// Conclusões da tarefa a partir de `from`.
    fn load_completions(
        &mut self,
        task_id: Uuid,
        from: NaiveDate,
    ) -> impl Future<Output = Result<CompletionLog, TasksError>> + Send;

    /// Grava a conclusão; repetir a mesma data não falha.
    fn insert_completion(
        &mut self,
        task_id: Uuid,
        occurrence_date: NaiveDate,
        completed_at: DateTime<Utc>,
    ) -> impl Future<Output = Result<(), TasksError>> + Send;

    fn delete_completion(
        &mut self,
        task_id: Uuid,
        occurrence_date: NaiveDate,
    ) -> impl Future<Output = Result<(), TasksError>> + Send;

    /// Descarta as conclusões anteriores a `today`: a recorrente não guarda histórico.
    fn discard_completions_before(
        &mut self,
        task_id: Uuid,
        today: NaiveDate,
    ) -> impl Future<Output = Result<(), TasksError>> + Send;

    fn dated_tasks_between(
        &mut self,
        from: NaiveDate,
        to: NaiveDate,
    ) -> impl Future<Output = Result<Vec<DatedTask>, TasksError>> + Send;

    fn commit(self) -> impl Future<Output = Result<(), TasksError>> + Send;
}
