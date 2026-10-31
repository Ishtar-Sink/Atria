//! Marco de uma meta: título, ordem e conclusão.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::error::GoalsError;
use super::goal::validate_title;
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Milestone {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub goal_id: Uuid,
    pub title: String,
    pub position: i32,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

impl Milestone {
    #[cfg(test)]
    pub fn is_completed(&self) -> bool {
        self.completed_at.is_some()
    }
}

/// Valida a posição de um marco (0 ou mais).
pub fn validate_position(position: i32) -> Result<i32, GoalsError> {
    if position < 0 {
        return Err(GoalsError::invalid("position", "invalid"));
    }
    Ok(position)
}

/// Mudança parcial de um marco.
#[derive(Debug, Clone, Default)]
pub struct MilestonePatch {
    pub title: Option<String>,
    pub position: Option<i32>,
    pub completed: Option<bool>,
    pub visibility: Option<Visibility>,
}

impl MilestonePatch {
    pub fn validated(mut self) -> Result<Self, GoalsError> {
        self.title = self.title.map(|title| validate_title(&title)).transpose()?;
        self.position = self.position.map(validate_position).transpose()?;
        Ok(self)
    }
}
