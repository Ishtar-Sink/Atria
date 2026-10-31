//! Casos de uso de metas e marcos.

use std::sync::Arc;

use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};
use uuid::Uuid;

use super::ports::{GoalPosition, GoalQuery, GoalRepository, GoalSort, NO_DEADLINE};
use crate::goals::domain::error::GoalsError;
use crate::goals::domain::goal::{
    Goal, GoalPatch, GoalStatus, GoalView, LABEL_MAX_CHARS, validate_description, validate_labels,
    validate_title,
};
use crate::goals::domain::milestone::{Milestone, MilestonePatch, validate_position};
use crate::shared::clock::Clock;
use crate::shared::ids::IdGenerator;
use crate::shared::pagination::{Cursor, Page};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone)]
pub struct NewGoal {
    pub title: String,
    pub description: Option<String>,
    pub deadline: Option<NaiveDate>,
    pub status: GoalStatus,
    pub labels: Vec<String>,
    pub visibility: Visibility,
}

#[derive(Debug, Clone)]
pub struct NewMilestone {
    pub title: String,
    pub position: Option<i32>,
    pub visibility: Visibility,
}

#[derive(Debug, Clone, Default)]
pub struct GoalFilter {
    pub status: Option<GoalStatus>,
    pub text: Option<String>,
    pub label: Option<String>,
    pub has_deadline: Option<bool>,
    pub sort: GoalSort,
    pub cursor: Option<Cursor>,
    pub limit: u32,
}

/// Ids excluídos, para o handler chamar o gancho depois do commit.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeletedGoal {
    pub goal_id: Uuid,
    pub milestone_ids: Vec<Uuid>,
}

pub struct GoalsService<R: GoalRepository> {
    pub repo: R,
    pub clock: Arc<dyn Clock>,
    pub ids: Arc<dyn IdGenerator>,
}

fn position_of(view: &GoalView, sort: GoalSort) -> Cursor {
    let goal = &view.goal;
    match sort {
        GoalSort::Deadline => Cursor::new(
            goal.deadline
                .unwrap_or(NO_DEADLINE)
                .format("%Y-%m-%d")
                .to_string(),
            goal.id,
        ),
        GoalSort::CreatedAt => Cursor::new(
            goal.created_at.to_rfc3339_opts(SecondsFormat::Micros, true),
            goal.id,
        ),
    }
}

fn parse_position(sort: GoalSort, cursor: &Cursor) -> Result<GoalPosition, GoalsError> {
    let invalid = || GoalsError::invalid("cursor", "invalid");
    match sort {
        GoalSort::Deadline => {
            let date =
                NaiveDate::parse_from_str(&cursor.sort_key, "%Y-%m-%d").map_err(|_| invalid())?;
            Ok(GoalPosition::Deadline(date, cursor.id))
        }
        GoalSort::CreatedAt => {
            let instant = DateTime::parse_from_rfc3339(&cursor.sort_key)
                .map_err(|_| invalid())?
                .with_timezone(&Utc);
            Ok(GoalPosition::CreatedAt(instant, cursor.id))
        }
    }
}

/// Etiqueta do filtro: sem espaços nas pontas, não vazia e com até 50 caracteres.
fn validate_label_filter(label: &str) -> Result<String, GoalsError> {
    if label.is_empty() || label != label.trim() {
        return Err(GoalsError::invalid("label", "required"));
    }
    if label.chars().count() > LABEL_MAX_CHARS {
        return Err(GoalsError::invalid("label", "too_long"));
    }
    Ok(label.to_owned())
}

impl<R: GoalRepository> GoalsService<R> {
    pub async fn create_goal(&self, owner: Uuid, new: NewGoal) -> Result<GoalView, GoalsError> {
        let title = validate_title(&new.title)?;
        if let Some(description) = &new.description {
            validate_description(description)?;
        }
        let labels = validate_labels(&new.labels)?;
        let now = self.clock.now();
        let goal = Goal {
            id: self.ids.new_id(),
            owner_id: owner,
            visibility: new.visibility,
            title,
            description: new.description,
            deadline: new.deadline,
            status: new.status,
            labels,
            created_at: now,
            updated_at: now,
        };
        self.repo.insert_goal(&goal).await
    }

    pub async fn list_goals(
        &self,
        owner: Uuid,
        filter: GoalFilter,
    ) -> Result<Page<GoalView>, GoalsError> {
        let after = filter
            .cursor
            .as_ref()
            .map(|cursor| parse_position(filter.sort, cursor))
            .transpose()?;
        let label = filter
            .label
            .as_deref()
            .map(validate_label_filter)
            .transpose()?;
        let limit = filter.limit.max(1);
        let query = GoalQuery {
            status: filter.status,
            text: filter.text,
            label,
            has_deadline: filter.has_deadline,
            sort: filter.sort,
            after,
            limit: limit + 1,
        };
        let mut items = self.repo.list_goals(owner, &query).await?;
        let has_more = items.len() > limit as usize;
        items.truncate(limit as usize);
        let next_cursor = match items.last() {
            Some(last) if has_more => Some(position_of(last, filter.sort).encode()),
            _ => None,
        };
        Ok(Page { items, next_cursor })
    }

    pub async fn get_goal(&self, owner: Uuid, id: Uuid) -> Result<GoalView, GoalsError> {
        self.repo.get_goal(owner, id).await
    }

    pub async fn update_goal(
        &self,
        owner: Uuid,
        id: Uuid,
        patch: GoalPatch,
    ) -> Result<GoalView, GoalsError> {
        let patch = patch.validated()?;
        self.repo
            .update_goal(owner, id, &patch, self.clock.now())
            .await
    }

    pub async fn delete_goal(&self, owner: Uuid, id: Uuid) -> Result<DeletedGoal, GoalsError> {
        let milestone_ids = self.repo.delete_goal(owner, id, self.clock.now()).await?;
        Ok(DeletedGoal {
            goal_id: id,
            milestone_ids,
        })
    }

    pub async fn list_milestones(
        &self,
        owner: Uuid,
        goal_id: Uuid,
    ) -> Result<Vec<Milestone>, GoalsError> {
        self.repo.list_milestones(owner, goal_id).await
    }

    pub async fn create_milestone(
        &self,
        owner: Uuid,
        goal_id: Uuid,
        new: NewMilestone,
    ) -> Result<Milestone, GoalsError> {
        let title = validate_title(&new.title)?;
        let position = new.position.map(validate_position).transpose()?;
        let now = self.clock.now();
        let milestone = Milestone {
            id: self.ids.new_id(),
            owner_id: owner,
            visibility: new.visibility,
            goal_id,
            title,
            position: position.unwrap_or(0),
            completed_at: None,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        };
        self.repo.insert_milestone(&milestone, position).await
    }

    pub async fn update_milestone(
        &self,
        owner: Uuid,
        goal_id: Uuid,
        id: Uuid,
        patch: MilestonePatch,
    ) -> Result<Milestone, GoalsError> {
        let patch = patch.validated()?;
        self.repo
            .update_milestone(owner, goal_id, id, &patch, self.clock.now())
            .await
    }

    pub async fn delete_milestone(
        &self,
        owner: Uuid,
        goal_id: Uuid,
        id: Uuid,
    ) -> Result<(), GoalsError> {
        self.repo
            .delete_milestone(owner, goal_id, id, self.clock.now())
            .await
    }
}
