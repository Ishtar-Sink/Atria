//! Casos de uso de tarefas: cadastro, edição, mudança de regra, exclusão, conclusão,
//! reabertura e listagem de ocorrências.

use std::sync::Arc;

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::shared::clock::Clock;
use crate::shared::ids::IdGenerator;
use crate::shared::recurrence::RecurrenceRule;
use crate::shared::visibility::Visibility;
use crate::tasks::application::ports::{TaskFilter, TasksRepository, TasksTransaction};
use crate::tasks::domain::task::{
    normalize_description, normalize_label_filter, normalize_title, validate_labels,
};
use crate::tasks::domain::{CompletionTarget, Schedule, Task, TasksError};

/// Maior intervalo da listagem de ocorrências, em dias.
pub const MAX_OCCURRENCE_RANGE_DAYS: i64 = 366;

#[derive(Debug, Clone)]
pub struct NewTask {
    pub title: String,
    pub description: Option<String>,
    pub due_on: Option<NaiveDate>,
    pub visibility: Visibility,
    pub recurrence: Option<RecurrenceRule>,
    pub labels: Vec<String>,
}

/// Campos de uma edição parcial; `Some(None)` limpa o campo.
#[derive(Debug, Clone, Default)]
pub struct TaskChanges {
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub due_on: Option<Option<NaiveDate>>,
    pub visibility: Option<Visibility>,
    pub recurrence: Option<RecurrenceRule>,
    pub effective_from: Option<NaiveDate>,
    /// `None` mantém as etiquetas; `Some` troca a lista inteira.
    pub labels: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TaskView {
    pub task: Task,
    pub recurrence: Option<RecurrenceRule>,
}

#[derive(Debug, Clone)]
pub struct TaskPage {
    pub items: Vec<TaskView>,
    pub next: Option<(DateTime<Utc>, Uuid)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CompletionView {
    pub task_id: Uuid,
    pub occurrence_date: Option<NaiveDate>,
    pub completed: bool,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OccurrenceView {
    pub task_id: Uuid,
    pub occurrence_date: NaiveDate,
    pub completed: bool,
}

pub struct TasksService<R> {
    repository: R,
    clock: Arc<dyn Clock>,
    ids: Arc<dyn IdGenerator>,
}

impl<R: TasksRepository> TasksService<R> {
    pub fn new(repository: R, clock: Arc<dyn Clock>, ids: Arc<dyn IdGenerator>) -> Self {
        Self {
            repository,
            clock,
            ids,
        }
    }

    pub async fn create(&self, owner_id: Uuid, input: NewTask) -> Result<TaskView, TasksError> {
        let now = self.clock.now();
        let title = normalize_title(&input.title)?;
        let description = normalize_description(input.description.as_deref())?;
        let labels = validate_labels(&input.labels)?;
        let schedule = match &input.recurrence {
            Some(rule) => Some(new_schedule(rule.clone(), now)?),
            None => None,
        };
        if schedule.is_some() && input.due_on.is_some() {
            return Err(TasksError::invalid("due_on", "not_allowed"));
        }
        let task = Task {
            id: self.ids.new_id(),
            owner_id,
            visibility: input.visibility,
            title,
            description,
            due_on: input.due_on,
            is_recurring: schedule.is_some(),
            completed_at: None,
            labels,
            created_at: now,
            updated_at: now,
        };
        let mut tx = self.repository.begin(owner_id).await?;
        tx.insert_task(&task).await?;
        if let Some(schedule) = &schedule {
            tx.save_schedule(task.id, schedule, now).await?;
        }
        tx.commit().await?;
        Ok(TaskView {
            task,
            recurrence: input.recurrence,
        })
    }

    pub async fn get(&self, owner_id: Uuid, id: Uuid) -> Result<TaskView, TasksError> {
        let mut tx = self.repository.begin(owner_id).await?;
        let task = find(&mut tx, id).await?;
        let view = with_rule(&mut tx, task).await?;
        tx.commit().await?;
        Ok(view)
    }

    pub async fn list(
        &self,
        owner_id: Uuid,
        mut filter: TaskFilter,
    ) -> Result<TaskPage, TasksError> {
        filter.label = filter
            .label
            .as_deref()
            .map(normalize_label_filter)
            .transpose()?;
        let limit = filter.limit as usize;
        let mut tx = self.repository.begin(owner_id).await?;
        let mut tasks = tx
            .list_tasks(&TaskFilter {
                limit: filter.limit + 1,
                ..filter
            })
            .await?;
        let next = (tasks.len() > limit)
            .then(|| tasks.get(limit - 1).map(|task| (task.created_at, task.id)))
            .flatten();
        tasks.truncate(limit);
        let recurring: Vec<Uuid> = tasks
            .iter()
            .filter(|task| task.is_recurring)
            .map(|task| task.id)
            .collect();
        let mut rules = tx.current_rules(&recurring).await?;
        tx.commit().await?;
        let items = tasks
            .into_iter()
            .map(|task| TaskView {
                recurrence: rules.remove(&task.id),
                task,
            })
            .collect();
        Ok(TaskPage { items, next })
    }

    pub async fn update(
        &self,
        owner_id: Uuid,
        id: Uuid,
        changes: TaskChanges,
    ) -> Result<TaskView, TasksError> {
        let now = self.clock.now();
        let mut tx = self.repository.begin(owner_id).await?;
        let mut task = find(&mut tx, id).await?;
        apply_changes(&mut task, &changes)?;
        task.updated_at = now;
        tx.update_task(&task).await?;
        if let Some(rule) = changes.recurrence {
            let mut schedule = tx.load_schedule(id).await?;
            let today = today_in(&rule, now);
            schedule.change_rule(rule, changes.effective_from.unwrap_or(today), today)?;
            tx.save_schedule(id, &schedule, now).await?;
        }
        let view = with_rule(&mut tx, task).await?;
        tx.commit().await?;
        Ok(view)
    }

    /// Exclusão lógica, confirmada antes de voltar: o gancho roda depois disso.
    pub async fn delete(&self, owner_id: Uuid, id: Uuid) -> Result<(), TasksError> {
        let mut tx = self.repository.begin(owner_id).await?;
        if !tx.soft_delete_task(id, self.clock.now()).await? {
            return Err(TasksError::NotFound);
        }
        tx.commit().await
    }

    /// Conclui a tarefa pontual ou a ocorrência da recorrente; repetir não falha.
    pub async fn complete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        occurrence_date: Option<NaiveDate>,
    ) -> Result<CompletionView, TasksError> {
        let now = self.clock.now();
        let mut tx = self.repository.begin(owner_id).await?;
        let mut task = find(&mut tx, id).await?;
        let view = match task.completion_target(occurrence_date)? {
            CompletionTarget::Task => {
                if task.completed_at.is_none() {
                    task.complete(None, now)?;
                    tx.update_task(&task).await?;
                }
                whole_task_view(&task)
            }
            CompletionTarget::Occurrence(date) => {
                let schedule = tx.load_schedule(id).await?;
                let today = schedule.today(now);
                tx.discard_completions_before(id, today).await?;
                let mut log = tx.load_completions(id, today).await?;
                if log.complete(&schedule, date, today)? {
                    tx.insert_completion(id, date, now).await?;
                }
                occurrence_view(id, date, true, now)
            }
        };
        tx.commit().await?;
        Ok(view)
    }

    /// Reabre a tarefa pontual ou só a ocorrência daquela data; repetir não falha.
    pub async fn reopen(
        &self,
        owner_id: Uuid,
        id: Uuid,
        occurrence_date: Option<NaiveDate>,
    ) -> Result<CompletionView, TasksError> {
        let now = self.clock.now();
        let mut tx = self.repository.begin(owner_id).await?;
        let mut task = find(&mut tx, id).await?;
        let view = match task.completion_target(occurrence_date)? {
            CompletionTarget::Task => {
                if task.completed_at.is_some() {
                    task.reopen(None, now)?;
                    tx.update_task(&task).await?;
                }
                whole_task_view(&task)
            }
            CompletionTarget::Occurrence(date) => {
                let schedule = tx.load_schedule(id).await?;
                let today = schedule.today(now);
                tx.discard_completions_before(id, today).await?;
                let mut log = tx.load_completions(id, today).await?;
                if log.reopen(&schedule, date, today)? {
                    tx.delete_completion(id, date).await?;
                }
                occurrence_view(id, date, false, now)
            }
        };
        tx.commit().await?;
        Ok(view)
    }

    /// Ocorrências de `[from, to]`: as datas das pontuais e, nas recorrentes, as de
    /// hoje em diante, descartando as conclusões passadas.
    pub async fn occurrences(
        &self,
        owner_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<OccurrenceView>, TasksError> {
        validate_range(from, to)?;
        let now = self.clock.now();
        let mut tx = self.repository.begin(owner_id).await?;
        let mut items: Vec<OccurrenceView> = tx
            .dated_tasks_between(from, to)
            .await?
            .into_iter()
            .map(|dated| OccurrenceView {
                task_id: dated.task_id,
                occurrence_date: dated.due_on,
                completed: dated.completed,
            })
            .collect();
        for (task_id, schedule) in tx.recurring_schedules().await? {
            let today = schedule.today(now);
            tx.discard_completions_before(task_id, today).await?;
            let log = tx.load_completions(task_id, today).await?;
            items.extend(log.occurrences(&schedule, from, to, today).into_iter().map(
                |occurrence| OccurrenceView {
                    task_id,
                    occurrence_date: occurrence.occurrence_date,
                    completed: occurrence.completed,
                },
            ));
        }
        tx.commit().await?;
        items.sort_by_key(|item| (item.occurrence_date, item.task_id));
        Ok(items)
    }
}

async fn find<T: TasksTransaction>(tx: &mut T, id: Uuid) -> Result<Task, TasksError> {
    tx.find_task(id).await?.ok_or(TasksError::NotFound)
}

async fn with_rule<T: TasksTransaction>(tx: &mut T, task: Task) -> Result<TaskView, TasksError> {
    let recurrence = if task.is_recurring {
        tx.load_schedule(task.id).await?.current_rule().cloned()
    } else {
        None
    };
    Ok(TaskView { task, recurrence })
}

/// A agenda começa hoje, no fuso da regra: antes disso não há ocorrências.
fn new_schedule(rule: RecurrenceRule, now: DateTime<Utc>) -> Result<Schedule, TasksError> {
    let today = today_in(&rule, now);
    Schedule::start(rule, today)
}

fn today_in(rule: &RecurrenceRule, now: DateTime<Utc>) -> NaiveDate {
    rule.timezone.parse::<chrono_tz::Tz>().map_or_else(
        |_| now.date_naive(),
        |tz| now.with_timezone(&tz).date_naive(),
    )
}

fn apply_changes(task: &mut Task, changes: &TaskChanges) -> Result<(), TasksError> {
    if let Some(title) = &changes.title {
        task.title = normalize_title(title)?;
    }
    if let Some(description) = &changes.description {
        task.description = normalize_description(description.as_deref())?;
    }
    if let Some(due_on) = changes.due_on {
        if task.is_recurring && due_on.is_some() {
            return Err(TasksError::invalid("due_on", "not_allowed"));
        }
        task.due_on = due_on;
    }
    if let Some(visibility) = changes.visibility {
        task.visibility = visibility;
    }
    if let Some(labels) = &changes.labels {
        task.labels = validate_labels(labels)?;
    }
    if changes.recurrence.is_some() && !task.is_recurring {
        return Err(TasksError::invalid("recurrence", "not_recurring"));
    }
    if changes.effective_from.is_some() && changes.recurrence.is_none() {
        return Err(TasksError::invalid("recurrence", "required"));
    }
    Ok(())
}

fn validate_range(from: NaiveDate, to: NaiveDate) -> Result<(), TasksError> {
    if to < from {
        return Err(TasksError::invalid("to", "before_from"));
    }
    if (to - from).num_days() + 1 > MAX_OCCURRENCE_RANGE_DAYS {
        return Err(TasksError::invalid("to", "range_too_long"));
    }
    Ok(())
}

fn whole_task_view(task: &Task) -> CompletionView {
    CompletionView {
        task_id: task.id,
        occurrence_date: None,
        completed: task.completed_at.is_some(),
        completed_at: task.completed_at,
    }
}

fn occurrence_view(
    task_id: Uuid,
    date: NaiveDate,
    completed: bool,
    now: DateTime<Utc>,
) -> CompletionView {
    CompletionView {
        task_id,
        occurrence_date: Some(date),
        completed,
        completed_at: completed.then_some(now),
    }
}
