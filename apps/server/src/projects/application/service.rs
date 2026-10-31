//! Casos de uso de projetos, raias, cartões e o resumo da Visão geral.

use std::sync::Arc;

use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};
use uuid::Uuid;

use super::ports::{ProjectListItem, ProjectPosition, ProjectQuery, ProjectRepository};
use crate::projects::domain::card::{Card, CardId, CardPriority, ChecklistItem, build_checklist};
use crate::projects::domain::error::ProjectError;
use crate::projects::domain::lane::{Lane, LaneColor, LaneId};
use crate::projects::domain::project::{CardPatch, NewCard, Project};
use crate::projects::domain::summary::ProjectSummary;
use crate::shared::clock::Clock;
use crate::shared::ids::IdGenerator;
use crate::shared::pagination::{Cursor, Page};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone)]
pub struct NewProject {
    pub name: String,
    pub description: Option<String>,
    pub visibility: Visibility,
}

#[derive(Debug, Clone, Default)]
pub struct ProjectPatch {
    pub name: Option<String>,
    pub description: Option<Option<String>>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Default)]
pub struct ProjectFilter {
    pub text: Option<String>,
    pub visibility: Option<Visibility>,
    pub cursor: Option<Cursor>,
    pub limit: u32,
}

#[derive(Debug, Clone)]
pub struct NewLane {
    pub name: String,
    /// `#rrggbb`, validada aqui.
    pub color: String,
    pub counts_as_done: bool,
    pub position: Option<i32>,
}

#[derive(Debug, Clone, Default)]
pub struct LanePatch {
    pub name: Option<String>,
    pub color: Option<String>,
    pub counts_as_done: Option<bool>,
}

/// Item de checklist da entrada: texto e se já está feito.
#[derive(Debug, Clone)]
pub struct ChecklistInput {
    pub text: String,
    pub done: bool,
}

#[derive(Debug, Clone)]
pub struct NewCardInput {
    pub lane_id: LaneId,
    pub title: String,
    pub description: Option<String>,
    /// `low`, `medium` ou `high`.
    pub priority: Option<String>,
    pub labels: Vec<String>,
    pub due_date: Option<NaiveDate>,
    pub checklist: Vec<ChecklistInput>,
    pub position: Option<i32>,
}

#[derive(Debug, Clone, Default)]
pub struct CardPatchInput {
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub priority: Option<Option<String>>,
    pub labels: Option<Vec<String>>,
    pub due_date: Option<Option<NaiveDate>>,
    pub checklist: Option<Vec<ChecklistInput>>,
}

/// Ids excluídos, para o handler chamar o gancho depois do commit.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeletedProject {
    pub project_id: Uuid,
    pub card_ids: Vec<Uuid>,
}

pub struct ProjectService<R: ProjectRepository> {
    pub repo: R,
    pub clock: Arc<dyn Clock>,
    pub ids: Arc<dyn IdGenerator>,
}

fn cursor_for(item: &ProjectListItem) -> Cursor {
    Cursor::new(
        item.project
            .created_at
            .to_rfc3339_opts(SecondsFormat::Micros, true),
        item.project.id,
    )
}

fn position_of(cursor: &Cursor) -> Result<ProjectPosition, ProjectError> {
    let created_at = DateTime::parse_from_rfc3339(&cursor.sort_key)
        .map_err(|_| ProjectError::invalid("cursor", "invalid"))?
        .with_timezone(&Utc);
    Ok(ProjectPosition {
        created_at,
        id: cursor.id,
    })
}

fn parse_priority(priority: Option<String>) -> Result<Option<CardPriority>, ProjectError> {
    priority.as_deref().map(CardPriority::parse).transpose()
}

impl<R: ProjectRepository> ProjectService<R> {
    fn checklist(&self, items: &[ChecklistInput]) -> Result<Vec<ChecklistItem>, ProjectError> {
        let pairs: Vec<(&str, bool)> = items.iter().map(|i| (i.text.as_str(), i.done)).collect();
        build_checklist(&pairs, || self.ids.new_id())
    }

    pub async fn create_project(
        &self,
        owner: Uuid,
        new: NewProject,
    ) -> Result<Project, ProjectError> {
        let project = Project::new(
            self.ids.new_id(),
            owner,
            new.visibility,
            &new.name,
            new.description,
            self.clock.now(),
            || self.ids.new_id(),
        )?;
        self.repo.insert_with_lanes(&project).await?;
        Ok(project)
    }

    pub async fn list_projects(
        &self,
        owner: Uuid,
        filter: ProjectFilter,
    ) -> Result<Page<ProjectListItem>, ProjectError> {
        let after = filter.cursor.as_ref().map(position_of).transpose()?;
        let limit = filter.limit.max(1);
        let query = ProjectQuery {
            text: filter.text,
            visibility: filter.visibility,
            after,
            limit: limit + 1,
        };
        let mut items = self.repo.list_live(owner, &query).await?;
        let has_more = items.len() > limit as usize;
        items.truncate(limit as usize);
        let next_cursor = match items.last() {
            Some(last) if has_more => Some(cursor_for(last).encode()),
            _ => None,
        };
        Ok(Page { items, next_cursor })
    }

    pub async fn get_project(&self, owner: Uuid, id: Uuid) -> Result<Project, ProjectError> {
        self.repo.find_live(owner, id).await
    }

    pub async fn update_project(
        &self,
        owner: Uuid,
        id: Uuid,
        patch: ProjectPatch,
    ) -> Result<Project, ProjectError> {
        let now = self.clock.now();
        self.repo
            .mutate(owner, id, now, move |project| {
                project.update(
                    patch.name.as_deref(),
                    patch.description,
                    patch.visibility,
                    now,
                )?;
                Ok(project.clone())
            })
            .await
    }

    pub async fn delete_project(
        &self,
        owner: Uuid,
        id: Uuid,
    ) -> Result<DeletedProject, ProjectError> {
        let card_ids = self.repo.soft_delete(owner, id, self.clock.now()).await?;
        Ok(DeletedProject {
            project_id: id,
            card_ids,
        })
    }

    /// `today` vem do frontend, no fuso da pessoa; sem ele vale a data UTC do relógio.
    pub async fn summary(
        &self,
        owner: Uuid,
        id: Uuid,
        today: Option<NaiveDate>,
    ) -> Result<ProjectSummary, ProjectError> {
        let today = today.unwrap_or_else(|| self.clock.now().date_naive());
        let project = self.repo.find_live(owner, id).await?;
        Ok(ProjectSummary::build(&project, today))
    }

    pub async fn list_lanes(&self, owner: Uuid, id: Uuid) -> Result<Vec<Lane>, ProjectError> {
        Ok(self.repo.find_live(owner, id).await?.lanes)
    }

    pub async fn create_lane(
        &self,
        owner: Uuid,
        project_id: Uuid,
        new: NewLane,
    ) -> Result<Lane, ProjectError> {
        let color = LaneColor::parse(&new.color)?;
        let lane_id = self.ids.new_id();
        let now = self.clock.now();
        self.repo
            .mutate(owner, project_id, now, move |project| {
                project.add_lane(
                    lane_id,
                    &new.name,
                    color,
                    new.counts_as_done,
                    new.position,
                    now,
                )?;
                find_lane(project, lane_id)
            })
            .await
    }

    pub async fn update_lane(
        &self,
        owner: Uuid,
        project_id: Uuid,
        lane_id: LaneId,
        patch: LanePatch,
    ) -> Result<Lane, ProjectError> {
        let color = patch.color.as_deref().map(LaneColor::parse).transpose()?;
        let now = self.clock.now();
        self.repo
            .mutate(owner, project_id, now, move |project| {
                project.update_lane(
                    lane_id,
                    patch.name.as_deref(),
                    color,
                    patch.counts_as_done,
                    now,
                )?;
                find_lane(project, lane_id)
            })
            .await
    }

    pub async fn delete_lane(
        &self,
        owner: Uuid,
        project_id: Uuid,
        lane_id: LaneId,
        move_cards_to: Option<LaneId>,
    ) -> Result<(), ProjectError> {
        let now = self.clock.now();
        self.repo
            .mutate(owner, project_id, now, move |project| {
                project.delete_lane(lane_id, move_cards_to, now)
            })
            .await
    }

    pub async fn reorder_lanes(
        &self,
        owner: Uuid,
        project_id: Uuid,
        lane_ids: Vec<LaneId>,
    ) -> Result<Vec<Lane>, ProjectError> {
        let now = self.clock.now();
        self.repo
            .mutate(owner, project_id, now, move |project| {
                project.reorder_lanes(&lane_ids, now)?;
                Ok(project.lanes.clone())
            })
            .await
    }

    /// Cartões vivos, por posição da raia e do cartão.
    pub async fn list_cards(
        &self,
        owner: Uuid,
        project_id: Uuid,
    ) -> Result<Vec<Card>, ProjectError> {
        let project = self.repo.find_live(owner, project_id).await?;
        let mut cards = Vec::with_capacity(project.cards.len());
        for lane in &project.lanes {
            cards.extend(project.cards_in(lane.id).into_iter().cloned());
        }
        Ok(cards)
    }

    pub async fn get_card(
        &self,
        owner: Uuid,
        project_id: Uuid,
        card_id: CardId,
    ) -> Result<Card, ProjectError> {
        let project = self.repo.find_live(owner, project_id).await?;
        project
            .cards
            .into_iter()
            .find(|c| c.id == card_id)
            .ok_or(ProjectError::CardNotFound)
    }

    /// Lê o cartão só pelo id (aba Conexões): acha o projeto dele e reaproveita `get_card`.
    pub async fn get_card_by_id(&self, owner: Uuid, card_id: CardId) -> Result<Card, ProjectError> {
        let project_id = self.repo.find_card_project(owner, card_id).await?;
        self.get_card(owner, project_id, card_id).await
    }

    pub async fn create_card(
        &self,
        owner: Uuid,
        project_id: Uuid,
        new: NewCardInput,
    ) -> Result<Card, ProjectError> {
        let priority = parse_priority(new.priority)?;
        let checklist = self.checklist(&new.checklist)?;
        let card_id = self.ids.new_id();
        let now = self.clock.now();
        let card = NewCard {
            lane_id: new.lane_id,
            title: new.title,
            description: new.description,
            priority,
            labels: new.labels,
            due_date: new.due_date,
            checklist,
            position: new.position,
        };
        self.repo
            .mutate(owner, project_id, now, move |project| {
                project.add_card(card_id, card, now)?;
                find_card(project, card_id)
            })
            .await
    }

    pub async fn update_card(
        &self,
        owner: Uuid,
        project_id: Uuid,
        card_id: CardId,
        patch: CardPatchInput,
    ) -> Result<Card, ProjectError> {
        let priority = patch.priority.map(parse_priority).transpose()?;
        let checklist = patch
            .checklist
            .as_deref()
            .map(|items| self.checklist(items))
            .transpose()?;
        let patch = CardPatch {
            title: patch.title,
            description: patch.description,
            priority,
            labels: patch.labels,
            due_date: patch.due_date,
            checklist,
        };
        let now = self.clock.now();
        self.repo
            .mutate(owner, project_id, now, move |project| {
                project.update_card(card_id, patch, now)?;
                find_card(project, card_id)
            })
            .await
    }

    pub async fn move_card(
        &self,
        owner: Uuid,
        project_id: Uuid,
        card_id: CardId,
        lane_id: LaneId,
        position: Option<i32>,
    ) -> Result<Card, ProjectError> {
        let now = self.clock.now();
        self.repo
            .mutate(owner, project_id, now, move |project| {
                project.move_card_to(card_id, lane_id, position, now)?;
                find_card(project, card_id)
            })
            .await
    }

    pub async fn delete_card(
        &self,
        owner: Uuid,
        project_id: Uuid,
        card_id: CardId,
    ) -> Result<(), ProjectError> {
        let now = self.clock.now();
        self.repo
            .mutate(owner, project_id, now, move |project| {
                project.delete_card(card_id, now)
            })
            .await
    }
}

fn find_lane(project: &Project, lane_id: LaneId) -> Result<Lane, ProjectError> {
    project
        .lanes
        .iter()
        .find(|l| l.id == lane_id)
        .cloned()
        .ok_or(ProjectError::LaneNotFound)
}

fn find_card(project: &Project, card_id: CardId) -> Result<Card, ProjectError> {
    project
        .cards
        .iter()
        .find(|c| c.id == card_id)
        .cloned()
        .ok_or(ProjectError::CardNotFound)
}
