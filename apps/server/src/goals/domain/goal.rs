//! Meta com título, descrição, prazo opcional e status. O progresso é calculado a
//! partir dos marcos, nunca gravado (RN-15).

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::error::GoalsError;
#[cfg(test)]
use super::milestone::Milestone;
use crate::shared::visibility::Visibility;

pub const TITLE_MAX_CHARS: usize = 200;
pub const DESCRIPTION_MAX_CHARS: usize = 10_000;
pub const LABELS_MAX: usize = 20;
pub const LABEL_MAX_CHARS: usize = 50;

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, sqlx::Type, ToSchema,
)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "text", rename_all = "snake_case")]
pub enum GoalStatus {
    #[default]
    Planned,
    InProgress,
    Completed,
    Abandoned,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Goal {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub title: String,
    pub description: Option<String>,
    pub deadline: Option<NaiveDate>,
    pub status: GoalStatus,
    pub labels: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Meta lida do banco, com a contagem dos marcos ativos e dos concluídos.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GoalView {
    pub goal: Goal,
    pub milestone_count: u32,
    pub completed_milestone_count: u32,
}

impl GoalView {
    pub fn progress_percent(&self) -> u8 {
        progress_from_counts(
            self.goal.status,
            self.milestone_count,
            self.completed_milestone_count,
        )
    }
}

/// Título obrigatório, sem espaços nas pontas e com até 200 caracteres.
pub fn validate_title(title: &str) -> Result<String, GoalsError> {
    let title = title.trim();
    if title.is_empty() {
        return Err(GoalsError::invalid("title", "required"));
    }
    if title.chars().count() > TITLE_MAX_CHARS {
        return Err(GoalsError::invalid("title", "too_long"));
    }
    Ok(title.to_owned())
}

/// Etiquetas: sem espaços nas pontas, sem vazias, sem repetidas (ignorando maiúsculas),
/// até 20 de até 50 caracteres. Mesma regra do cartão (DEC-006), copiada para não
/// acoplar os contextos.
pub fn validate_labels(labels: &[String]) -> Result<Vec<String>, GoalsError> {
    if labels.len() > LABELS_MAX {
        return Err(GoalsError::invalid("labels", "too_many"));
    }
    let mut cleaned: Vec<String> = Vec::with_capacity(labels.len());
    for label in labels {
        let label = label.trim();
        if label.is_empty() {
            return Err(GoalsError::invalid("labels", "required"));
        }
        if label.chars().count() > LABEL_MAX_CHARS {
            return Err(GoalsError::invalid("labels", "too_long"));
        }
        if cleaned
            .iter()
            .any(|l| l.to_lowercase() == label.to_lowercase())
        {
            return Err(GoalsError::invalid("labels", "duplicated"));
        }
        cleaned.push(label.to_owned());
    }
    Ok(cleaned)
}

pub fn validate_description(description: &str) -> Result<(), GoalsError> {
    if description.chars().count() > DESCRIPTION_MAX_CHARS {
        return Err(GoalsError::invalid("description", "too_long"));
    }
    Ok(())
}

/// Progresso de 0 a 100: porcentagem de marcos concluídos, arredondada para baixo;
/// sem marcos, vale o status (RN-15).
pub fn progress_from_counts(status: GoalStatus, total: u32, completed: u32) -> u8 {
    if total == 0 {
        return if status == GoalStatus::Completed {
            100
        } else {
            0
        };
    }
    let completed = completed.min(total);
    u8::try_from(u64::from(completed) * 100 / u64::from(total)).unwrap_or(100)
}

/// Progresso a partir dos marcos; os excluídos não contam.
#[cfg(test)]
pub fn progress_percent(status: GoalStatus, milestones: &[Milestone]) -> u8 {
    let active = milestones.iter().filter(|m| m.deleted_at.is_none());
    let total = u32::try_from(active.clone().count()).unwrap_or(u32::MAX);
    let completed = u32::try_from(active.filter(|m| m.is_completed()).count()).unwrap_or(u32::MAX);
    progress_from_counts(status, total, completed)
}

/// Mudança parcial de uma meta; `Some(None)` limpa o campo opcional.
#[derive(Debug, Clone, Default)]
pub struct GoalPatch {
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub deadline: Option<Option<NaiveDate>>,
    pub status: Option<GoalStatus>,
    pub labels: Option<Vec<String>>,
    pub visibility: Option<Visibility>,
}

impl GoalPatch {
    pub fn validated(mut self) -> Result<Self, GoalsError> {
        self.title = self.title.map(|title| validate_title(&title)).transpose()?;
        if let Some(Some(description)) = &self.description {
            validate_description(description)?;
        }
        self.labels = self
            .labels
            .map(|labels| validate_labels(&labels))
            .transpose()?;
        Ok(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn milestone(completed: bool, deleted: bool) -> Milestone {
        let now: DateTime<Utc> = "2026-11-01T12:00:00Z".parse().unwrap();
        Milestone {
            id: Uuid::from_u128(1),
            owner_id: Uuid::from_u128(2),
            visibility: Visibility::Personal,
            goal_id: Uuid::from_u128(3),
            title: "marco".to_owned(),
            position: 0,
            completed_at: completed.then_some(now),
            created_at: now,
            updated_at: now,
            deleted_at: deleted.then_some(now),
        }
    }

    #[test]
    fn progress_with_milestones_is_percentage_of_completed() {
        let milestones = [
            milestone(true, false),
            milestone(false, false),
            milestone(false, false),
            milestone(false, false),
        ];

        assert_eq!(progress_percent(GoalStatus::Planned, &milestones), 25);
        assert_eq!(progress_from_counts(GoalStatus::Abandoned, 4, 4), 100);
    }

    #[test]
    fn progress_rounds_down() {
        assert_eq!(progress_from_counts(GoalStatus::InProgress, 3, 2), 66);
        assert_eq!(progress_from_counts(GoalStatus::InProgress, 3, 1), 33);
    }

    #[test]
    fn progress_without_milestones_follows_status() {
        assert_eq!(progress_from_counts(GoalStatus::Completed, 0, 0), 100);
        for status in [
            GoalStatus::Planned,
            GoalStatus::InProgress,
            GoalStatus::Abandoned,
        ] {
            assert_eq!(progress_from_counts(status, 0, 0), 0);
        }
    }

    #[test]
    fn deleted_milestones_do_not_count() {
        let milestones = [
            milestone(true, false),
            milestone(false, false),
            milestone(true, true),
            milestone(false, true),
        ];

        assert_eq!(progress_percent(GoalStatus::Planned, &milestones), 50);
        // Só marcos excluídos: vale o status.
        let only_deleted = [milestone(true, true)];
        assert_eq!(progress_percent(GoalStatus::Completed, &only_deleted), 100);
        assert_eq!(progress_percent(GoalStatus::Planned, &only_deleted), 0);
    }

    #[test]
    fn title_is_required_and_limited_to_200_chars() {
        assert_eq!(validate_title("  Correr 10 km ").unwrap(), "Correr 10 km");
        assert!(validate_title("   ").is_err());
        assert!(validate_title(&"a".repeat(200)).is_ok());
        assert!(validate_title(&"a".repeat(201)).is_err());
        assert!(validate_title(&"ã".repeat(200)).is_ok());
    }

    #[test]
    fn deadline_is_optional() {
        let patch = GoalPatch {
            deadline: Some(None),
            ..GoalPatch::default()
        }
        .validated()
        .unwrap();

        assert_eq!(patch.deadline, Some(None));
        assert!(GoalPatch::default().validated().unwrap().deadline.is_none());
        assert_eq!(GoalStatus::default(), GoalStatus::Planned);
    }

    #[test]
    fn goal_labels_are_trimmed_deduplicated_and_limited() {
        let labels = |items: &[&str]| items.iter().map(|l| (*l).to_owned()).collect::<Vec<_>>();

        assert_eq!(
            validate_labels(&labels(&[" casa ", "obra"])).unwrap(),
            ["casa", "obra"]
        );
        assert!(matches!(
            validate_labels(&labels(&["casa", "CASA"])),
            Err(GoalsError::Validation(_))
        ));
        assert!(matches!(
            validate_labels(&labels(&["  "])),
            Err(GoalsError::Validation(_))
        ));
        assert!(validate_labels(&["a".repeat(50)]).is_ok());
        assert!(matches!(
            validate_labels(&["a".repeat(51)]),
            Err(GoalsError::Validation(_))
        ));
        let many: Vec<String> = (0..21).map(|n| format!("e{n}")).collect();
        assert!(matches!(
            validate_labels(&many),
            Err(GoalsError::Validation(_))
        ));
        assert!(validate_labels(&many[..20]).is_ok());
    }
}
