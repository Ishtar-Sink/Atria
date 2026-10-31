//! Tarefa pontual ou recorrente (RF-38, RF-39). Uma tarefa se conclui; o aviso é
//! do contexto `reminders`, por isso a tarefa não tem notificação (RN-19).

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use crate::shared::visibility::Visibility;
use crate::tasks::domain::error::TasksError;

pub const TITLE_MAX_CHARS: usize = 200;
pub const DESCRIPTION_MAX_CHARS: usize = 10_000;
pub const LABELS_MAX: usize = 20;
pub const LABEL_MAX_CHARS: usize = 50;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Task {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub title: String,
    pub description: Option<String>,
    pub due_on: Option<NaiveDate>,
    pub is_recurring: bool,
    /// Só a tarefa pontual guarda a conclusão aqui; a recorrente conclui ocorrências.
    pub completed_at: Option<DateTime<Utc>>,
    /// Etiquetas já validadas por `validate_labels` (DEC-006).
    pub labels: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// O que uma conclusão ou reabertura atinge.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CompletionTarget {
    Task,
    Occurrence(NaiveDate),
}

impl Task {
    pub fn completion_target(
        &self,
        occurrence_date: Option<NaiveDate>,
    ) -> Result<CompletionTarget, TasksError> {
        match (self.is_recurring, occurrence_date) {
            (true, Some(date)) => Ok(CompletionTarget::Occurrence(date)),
            (true, None) => Err(TasksError::OccurrenceDateRequired),
            (false, Some(_)) => Err(TasksError::OccurrenceDateNotAllowed),
            (false, None) => Ok(CompletionTarget::Task),
        }
    }

    pub fn complete(
        &mut self,
        occurrence_date: Option<NaiveDate>,
        now: DateTime<Utc>,
    ) -> Result<(), TasksError> {
        self.ensure_whole_task(occurrence_date)?;
        if self.completed_at.is_some() {
            return Err(TasksError::AlreadyCompleted);
        }
        self.completed_at = Some(now);
        self.updated_at = now;
        Ok(())
    }

    pub fn reopen(
        &mut self,
        occurrence_date: Option<NaiveDate>,
        now: DateTime<Utc>,
    ) -> Result<(), TasksError> {
        self.ensure_whole_task(occurrence_date)?;
        if self.completed_at.is_none() {
            return Err(TasksError::NotCompleted);
        }
        self.completed_at = None;
        self.updated_at = now;
        Ok(())
    }

    fn ensure_whole_task(&self, occurrence_date: Option<NaiveDate>) -> Result<(), TasksError> {
        match self.completion_target(occurrence_date)? {
            CompletionTarget::Task => Ok(()),
            CompletionTarget::Occurrence(_) => Err(TasksError::OccurrenceDateRequired),
        }
    }
}

/// Título sem espaços nas pontas, com 1 a 200 caracteres.
pub fn normalize_title(title: &str) -> Result<String, TasksError> {
    let title = title.trim();
    if title.is_empty() {
        return Err(TasksError::invalid("title", "required"));
    }
    if title.chars().count() > TITLE_MAX_CHARS {
        return Err(TasksError::invalid("title", "too_long"));
    }
    Ok(title.to_owned())
}

/// Descrição vazia vira ausente; acima do limite é recusada.
pub fn normalize_description(description: Option<&str>) -> Result<Option<String>, TasksError> {
    let Some(text) = description.map(str::trim).filter(|text| !text.is_empty()) else {
        return Ok(None);
    };
    if text.chars().count() > DESCRIPTION_MAX_CHARS {
        return Err(TasksError::invalid("description", "too_long"));
    }
    Ok(Some(text.to_owned()))
}

/// Etiquetas: sem espaços nas pontas, sem vazias, sem repetidas (ignorando maiúsculas),
/// até 20 de até 50 caracteres. A regra é a do cartão de projeto, copiada e não
/// importada para não acoplar os contextos ([project/architecture-04]).
pub fn validate_labels(labels: &[String]) -> Result<Vec<String>, TasksError> {
    if labels.len() > LABELS_MAX {
        return Err(TasksError::invalid("labels", "too_many"));
    }
    let mut cleaned: Vec<String> = Vec::with_capacity(labels.len());
    for label in labels {
        let label = label.trim();
        if label.is_empty() {
            return Err(TasksError::invalid("labels", "required"));
        }
        if label.chars().count() > LABEL_MAX_CHARS {
            return Err(TasksError::invalid("labels", "too_long"));
        }
        if cleaned
            .iter()
            .any(|l| l.to_lowercase() == label.to_lowercase())
        {
            return Err(TasksError::invalid("labels", "duplicated"));
        }
        cleaned.push(label.to_owned());
    }
    Ok(cleaned)
}

/// Etiqueta do filtro da listagem: sem espaços nas pontas, não vazia, até 50 caracteres.
pub fn normalize_label_filter(label: &str) -> Result<String, TasksError> {
    let label = label.trim();
    if label.is_empty() {
        return Err(TasksError::invalid("label", "required"));
    }
    if label.chars().count() > LABEL_MAX_CHARS {
        return Err(TasksError::invalid("label", "too_long"));
    }
    Ok(label.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn instant(text: &str) -> DateTime<Utc> {
        text.parse().unwrap()
    }

    fn task(is_recurring: bool) -> Task {
        Task {
            id: Uuid::from_u128(1),
            owner_id: Uuid::from_u128(2),
            visibility: Visibility::Personal,
            title: "Pagar a conta de luz".to_owned(),
            description: None,
            due_on: Some("2026-11-05".parse().unwrap()),
            is_recurring,
            completed_at: None,
            labels: Vec::new(),
            created_at: instant("2026-11-01T12:00:00Z"),
            updated_at: instant("2026-11-01T12:00:00Z"),
        }
    }

    #[test]
    fn one_off_task_completes_and_reopens() {
        let mut task = task(false);
        let done_at = instant("2026-11-02T10:00:00Z");

        task.complete(None, done_at).unwrap();
        assert_eq!(task.completed_at, Some(done_at));
        assert_eq!(task.updated_at, done_at);

        let reopened_at = instant("2026-11-03T10:00:00Z");
        task.reopen(None, reopened_at).unwrap();
        assert_eq!(task.completed_at, None);
        assert_eq!(task.updated_at, reopened_at);
    }

    #[test]
    fn completing_completed_task_is_refused() {
        let mut task = task(false);
        task.complete(None, instant("2026-11-02T10:00:00Z"))
            .unwrap();

        let again = task.complete(None, instant("2026-11-02T11:00:00Z"));

        assert!(matches!(again, Err(TasksError::AlreadyCompleted)));
        assert_eq!(task.completed_at, Some(instant("2026-11-02T10:00:00Z")));
        let mut open = self::task(false);
        assert!(matches!(
            open.reopen(None, instant("2026-11-02T10:00:00Z")),
            Err(TasksError::NotCompleted)
        ));
    }

    #[test]
    fn one_off_task_refuses_occurrence_date() {
        let mut task = task(false);
        let date = Some("2026-11-05".parse().unwrap());

        assert!(matches!(
            task.complete(date, instant("2026-11-02T10:00:00Z")),
            Err(TasksError::OccurrenceDateNotAllowed)
        ));
        assert!(matches!(
            self::task(true).completion_target(None),
            Err(TasksError::OccurrenceDateRequired)
        ));
        assert_eq!(
            self::task(true).completion_target(date).unwrap(),
            CompletionTarget::Occurrence("2026-11-05".parse().unwrap())
        );
        assert_eq!(task.completed_at, None);
    }

    #[test]
    fn title_and_description_are_validated() {
        assert_eq!(normalize_title("  Ler  ").unwrap(), "Ler");
        assert!(matches!(
            normalize_title("   "),
            Err(TasksError::Validation(_))
        ));
        assert!(normalize_title(&"a".repeat(201)).is_err());
        assert_eq!(normalize_description(Some("  ")).unwrap(), None);
        assert!(normalize_description(Some(&"a".repeat(10_001))).is_err());
    }

    #[test]
    fn task_labels_are_trimmed_deduplicated_and_limited() {
        let labels = |items: &[&str]| items.iter().map(|s| (*s).to_owned()).collect::<Vec<_>>();

        assert_eq!(
            validate_labels(&labels(&[" casa ", "obra"])).unwrap(),
            ["casa", "obra"]
        );
        for invalid in [
            labels(&["casa", "CASA"]),
            labels(&["  "]),
            labels(&[&"a".repeat(51)]),
            (0..21).map(|i| format!("l{i}")).collect(),
        ] {
            assert!(
                matches!(validate_labels(&invalid), Err(TasksError::Validation(_))),
                "{invalid:?}"
            );
        }
        assert!(validate_labels(&(0..20).map(|i| format!("l{i}")).collect::<Vec<_>>()).is_ok());
        assert!(validate_labels(&[]).unwrap().is_empty());
    }
}
