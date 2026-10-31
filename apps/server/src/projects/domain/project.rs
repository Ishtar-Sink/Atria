//! Agregação `Project`: dona das raias e dos cartões vivos, para que as regras de raia
//! (RN-16, CB-07, CB-08) rodem juntas, numa transação com o projeto travado.

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use super::card::{
    Card, CardId, CardPriority, ChecklistItem, move_card, validate_card_description,
    validate_card_title, validate_checklist, validate_labels,
};
use super::error::ProjectError;
use super::lane::{Lane, LaneColor, LaneId, SystemLane, validate_lane_name};
use crate::shared::visibility::Visibility;

pub const NAME_MAX_CHARS: usize = 200;
pub const DESCRIPTION_MAX_CHARS: usize = 10_000;

/// Nome do projeto: 1 a 200 caracteres, sem espaços nas pontas.
pub fn validate_name(name: &str) -> Result<String, ProjectError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(ProjectError::invalid("name", "required"));
    }
    if name.chars().count() > NAME_MAX_CHARS {
        return Err(ProjectError::invalid("name", "too_long"));
    }
    Ok(name.to_owned())
}

pub fn validate_description(description: &str) -> Result<(), ProjectError> {
    if description.chars().count() > DESCRIPTION_MAX_CHARS {
        return Err(ProjectError::invalid("description", "too_long"));
    }
    Ok(())
}

fn to_position(index: usize) -> i32 {
    i32::try_from(index).unwrap_or(i32::MAX)
}

/// Cartão novo, criado direto na raia escolhida (PD-45).
#[derive(Debug, Clone, Default)]
pub struct NewCard {
    pub lane_id: LaneId,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<CardPriority>,
    pub labels: Vec<String>,
    pub due_date: Option<NaiveDate>,
    pub checklist: Vec<ChecklistItem>,
    pub position: Option<i32>,
}

/// Alterações parciais de um cartão; os campos anuláveis distinguem ausente de `null`.
/// O cartão não muda de raia por aqui: veja `Project::move_card_to`.
#[derive(Debug, Clone, Default)]
pub struct CardPatch {
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub priority: Option<Option<CardPriority>>,
    pub labels: Option<Vec<String>>,
    pub due_date: Option<Option<NaiveDate>>,
    /// Substitui a lista inteira.
    pub checklist: Option<Vec<ChecklistItem>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Project {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub name: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Ordenadas por `position`, de 0 a n-1.
    pub lanes: Vec<Lane>,
    /// Cartões vivos; as posições valem dentro da raia.
    pub cards: Vec<Card>,
}

impl Project {
    /// Projeto novo com as raias padrão `waiting`, `in_progress` e `done` (RF-55).
    pub fn new(
        id: Uuid,
        owner_id: Uuid,
        visibility: Visibility,
        name: &str,
        description: Option<String>,
        now: DateTime<Utc>,
        mut next_id: impl FnMut() -> Uuid,
    ) -> Result<Self, ProjectError> {
        let name = validate_name(name)?;
        if let Some(description) = &description {
            validate_description(description)?;
        }
        let lanes = SystemLane::DEFAULTS
            .iter()
            .enumerate()
            .map(|(index, key)| Lane {
                id: next_id(),
                project_id: id,
                owner_id,
                visibility,
                system_key: Some(*key),
                name: None,
                color: key.default_color(),
                counts_as_done: *key == SystemLane::Done,
                position: to_position(index),
                created_at: now,
                updated_at: now,
            })
            .collect();
        Ok(Self {
            id,
            owner_id,
            visibility,
            name,
            description,
            created_at: now,
            updated_at: now,
            lanes,
            cards: Vec::new(),
        })
    }

    pub fn lane_ids(&self) -> Vec<LaneId> {
        self.lanes.iter().map(|l| l.id).collect()
    }

    /// Cartões da raia, por posição.
    pub fn cards_in(&self, lane_id: LaneId) -> Vec<&Card> {
        let mut cards: Vec<&Card> = self.cards.iter().filter(|c| c.lane_id == lane_id).collect();
        cards.sort_by_key(|c| c.position);
        cards
    }

    fn has_lane(&self, lane_id: LaneId) -> bool {
        self.lanes.iter().any(|l| l.id == lane_id)
    }

    fn renumber_lanes(&mut self, now: DateTime<Utc>) {
        for (index, lane) in self.lanes.iter_mut().enumerate() {
            let position = to_position(index);
            if lane.position != position {
                lane.position = position;
                lane.updated_at = now;
            }
        }
    }

    pub fn update(
        &mut self,
        name: Option<&str>,
        description: Option<Option<String>>,
        visibility: Option<Visibility>,
        now: DateTime<Utc>,
    ) -> Result<(), ProjectError> {
        let name = name.map(validate_name).transpose()?;
        if let Some(Some(description)) = &description {
            validate_description(description)?;
        }
        if let Some(name) = name {
            self.name = name;
        }
        if let Some(description) = description {
            self.description = description;
        }
        if let Some(visibility) = visibility {
            self.visibility = visibility;
            for lane in &mut self.lanes {
                lane.visibility = visibility;
            }
            for card in &mut self.cards {
                card.visibility = visibility;
            }
        }
        self.updated_at = now;
        Ok(())
    }

    /// Nova raia na posição pedida (sem posição, no fim; além do fim, no fim).
    pub fn add_lane(
        &mut self,
        id: LaneId,
        name: &str,
        color: LaneColor,
        counts_as_done: bool,
        position: Option<i32>,
        now: DateTime<Utc>,
    ) -> Result<(), ProjectError> {
        let name = validate_lane_name(name)?;
        let index = match position {
            Some(p) if p < 0 => return Err(ProjectError::invalid("position", "invalid")),
            Some(p) => usize::try_from(p)
                .unwrap_or(usize::MAX)
                .min(self.lanes.len()),
            None => self.lanes.len(),
        };
        self.lanes.insert(
            index,
            Lane {
                id,
                project_id: self.id,
                owner_id: self.owner_id,
                visibility: self.visibility,
                system_key: None,
                name: Some(name),
                color,
                counts_as_done,
                position: to_position(index),
                created_at: now,
                updated_at: now,
            },
        );
        self.renumber_lanes(now);
        Ok(())
    }

    pub fn update_lane(
        &mut self,
        lane_id: LaneId,
        name: Option<&str>,
        color: Option<LaneColor>,
        counts_as_done: Option<bool>,
        now: DateTime<Utc>,
    ) -> Result<(), ProjectError> {
        let lane = self
            .lanes
            .iter_mut()
            .find(|l| l.id == lane_id)
            .ok_or(ProjectError::LaneNotFound)?;
        if let Some(name) = name {
            lane.rename(name, now)?;
        }
        if let Some(color) = color {
            lane.color = color;
            lane.updated_at = now;
        }
        if let Some(counts_as_done) = counts_as_done {
            lane.counts_as_done = counts_as_done;
            lane.updated_at = now;
        }
        Ok(())
    }

    /// Exclui a raia. A última raia nunca sai (CB-08, RN-16); com cartões, o destino é
    /// obrigatório (CB-07) e os cartões vão para o fim dele.
    pub fn delete_lane(
        &mut self,
        lane_id: LaneId,
        move_cards_to: Option<LaneId>,
        now: DateTime<Utc>,
    ) -> Result<(), ProjectError> {
        if !self.has_lane(lane_id) {
            return Err(ProjectError::LaneNotFound);
        }
        if self.lanes.len() == 1 {
            return Err(ProjectError::LastLane);
        }
        if let Some(target) = move_cards_to
            && (target == lane_id || !self.has_lane(target))
        {
            return Err(ProjectError::InvalidTargetLane);
        }
        let moving: Vec<CardId> = self.cards_in(lane_id).iter().map(|c| c.id).collect();
        if !moving.is_empty() {
            let target = move_cards_to.ok_or(ProjectError::LaneHasCards)?;
            for card_id in moving {
                move_card(&mut self.cards, card_id, target, None, now)?;
            }
        }
        self.lanes.retain(|l| l.id != lane_id);
        self.renumber_lanes(now);
        Ok(())
    }

    /// A lista tem de trazer todas as raias do projeto, cada uma uma vez.
    pub fn reorder_lanes(
        &mut self,
        lane_ids: &[LaneId],
        now: DateTime<Utc>,
    ) -> Result<(), ProjectError> {
        let mut sorted = lane_ids.to_vec();
        sorted.sort();
        let mut current = self.lane_ids();
        current.sort();
        if sorted != current {
            return Err(ProjectError::InvalidLaneOrder);
        }
        let mut lanes = std::mem::take(&mut self.lanes);
        for id in lane_ids {
            if let Some(index) = lanes.iter().position(|l| l.id == *id) {
                self.lanes.push(lanes.swap_remove(index));
            }
        }
        self.renumber_lanes(now);
        Ok(())
    }

    /// `(cartões em raias que contam como concluídas, cartões vivos)` (PD-43).
    pub fn progress(&self) -> (u32, u32) {
        let done = self
            .cards
            .iter()
            .filter(|c| {
                self.lanes
                    .iter()
                    .any(|l| l.id == c.lane_id && l.counts_as_done)
            })
            .count();
        (
            u32::try_from(done).unwrap_or(u32::MAX),
            u32::try_from(self.cards.len()).unwrap_or(u32::MAX),
        )
    }

    /// Cartão novo na raia escolhida, na posição pedida (sem posição, no fim).
    pub fn add_card(
        &mut self,
        id: CardId,
        new: NewCard,
        now: DateTime<Utc>,
    ) -> Result<(), ProjectError> {
        let title = validate_card_title(&new.title)?;
        if let Some(description) = &new.description {
            validate_card_description(description)?;
        }
        let labels = validate_labels(&new.labels)?;
        let checklist = validate_checklist(new.checklist)?;
        if !self.has_lane(new.lane_id) {
            return Err(ProjectError::InvalidTargetLane);
        }
        let end = to_position(self.cards_in(new.lane_id).len());
        self.cards.push(Card {
            id,
            project_id: self.id,
            lane_id: new.lane_id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            title,
            description: new.description,
            priority: new.priority,
            labels,
            due_date: new.due_date,
            checklist,
            position: end,
            created_at: now,
            updated_at: now,
        });
        if new.position.is_some() {
            move_card(&mut self.cards, id, new.lane_id, new.position, now)?;
        }
        Ok(())
    }

    /// Edita os campos do cartão, sem movê-lo.
    pub fn update_card(
        &mut self,
        card_id: CardId,
        patch: CardPatch,
        now: DateTime<Utc>,
    ) -> Result<(), ProjectError> {
        let title = patch
            .title
            .as_deref()
            .map(validate_card_title)
            .transpose()?;
        if let Some(Some(description)) = &patch.description {
            validate_card_description(description)?;
        }
        let labels = patch.labels.as_deref().map(validate_labels).transpose()?;
        let checklist = patch.checklist.map(validate_checklist).transpose()?;
        let card = self
            .cards
            .iter_mut()
            .find(|c| c.id == card_id)
            .ok_or(ProjectError::CardNotFound)?;
        if let Some(title) = title {
            card.title = title;
        }
        if let Some(description) = patch.description {
            card.description = description;
        }
        if let Some(priority) = patch.priority {
            card.priority = priority;
        }
        if let Some(labels) = labels {
            card.labels = labels;
        }
        if let Some(due_date) = patch.due_date {
            card.due_date = due_date;
        }
        if let Some(checklist) = checklist {
            card.checklist = checklist;
        }
        card.updated_at = now;
        Ok(())
    }

    /// Move o cartão para outra raia do projeto (ou reordena na mesma).
    pub fn move_card_to(
        &mut self,
        card_id: CardId,
        lane_id: LaneId,
        position: Option<i32>,
        now: DateTime<Utc>,
    ) -> Result<(), ProjectError> {
        if !self.cards.iter().any(|c| c.id == card_id) {
            return Err(ProjectError::CardNotFound);
        }
        if !self.has_lane(lane_id) {
            return Err(ProjectError::InvalidTargetLane);
        }
        move_card(&mut self.cards, card_id, lane_id, position, now)
    }

    pub fn delete_card(&mut self, card_id: CardId, now: DateTime<Utc>) -> Result<(), ProjectError> {
        let lane_id = self
            .cards
            .iter()
            .find(|c| c.id == card_id)
            .ok_or(ProjectError::CardNotFound)?
            .lane_id;
        self.cards.retain(|c| c.id != card_id);
        let order: Vec<CardId> = self.cards_in(lane_id).iter().map(|c| c.id).collect();
        for (index, id) in order.iter().enumerate() {
            if let Some(card) = self.cards.iter_mut().find(|c| c.id == *id) {
                let position = to_position(index);
                if card.position != position {
                    card.position = position;
                    card.updated_at = now;
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> DateTime<Utc> {
        DateTime::<Utc>::from_timestamp(1_793_534_400, 0).unwrap()
    }

    fn project() -> Project {
        let mut n = 100u128;
        Project::new(
            Uuid::from_u128(1),
            Uuid::from_u128(2),
            Visibility::Personal,
            "Casa nova",
            None,
            now(),
            || {
                n += 1;
                Uuid::from_u128(n)
            },
        )
        .unwrap()
    }

    fn new_card(lane_id: LaneId, title: &str) -> NewCard {
        NewCard {
            lane_id,
            title: title.to_owned(),
            ..NewCard::default()
        }
    }

    fn with_cards(count: usize, lane_index: usize) -> Project {
        let mut p = project();
        let lane = p.lanes[lane_index].id;
        for i in 0..count {
            p.add_card(
                Uuid::from_u128(500 + i as u128),
                new_card(lane, &format!("c{i}")),
                now(),
            )
            .unwrap();
        }
        p
    }

    #[test]
    fn new_project_has_default_lanes_waiting_in_progress_done() {
        let p = project();

        let keys: Vec<_> = p.lanes.iter().map(|l| l.system_key).collect();
        assert_eq!(
            keys,
            [
                Some(SystemLane::Waiting),
                Some(SystemLane::InProgress),
                Some(SystemLane::Done)
            ]
        );
        assert_eq!(
            p.lanes.iter().map(|l| l.position).collect::<Vec<_>>(),
            [0, 1, 2]
        );
        assert!(p.lanes.iter().all(|l| l.name.is_none()));
        assert_eq!(
            p.lanes.iter().map(|l| l.color.as_str()).collect::<Vec<_>>(),
            ["#92400e", "#6d28d9", "#047857"]
        );
    }

    #[test]
    fn new_project_marks_only_done_lane_as_counting_done() {
        let p = project();

        assert_eq!(
            p.lanes.iter().map(|l| l.counts_as_done).collect::<Vec<_>>(),
            [false, false, true]
        );
    }

    #[test]
    fn toggling_counts_as_done_changes_progress() {
        let mut p = with_cards(2, 0);
        let ids = p.lane_ids();
        p.add_card(Uuid::from_u128(700), new_card(ids[2], "feito"), now())
            .unwrap();
        assert_eq!(p.progress(), (1, 3));

        p.update_lane(ids[0], None, None, Some(true), now())
            .unwrap();
        assert_eq!(p.progress(), (3, 3));
        p.update_lane(ids[2], None, None, Some(false), now())
            .unwrap();
        assert_eq!(p.progress(), (2, 3));
    }

    #[test]
    fn progress_counts_cards_in_lanes_marked_done() {
        let mut p = project();
        let ids = p.lane_ids();
        assert_eq!(p.progress(), (0, 0));
        for (n, lane) in [ids[0], ids[1], ids[2], ids[2]].into_iter().enumerate() {
            p.add_card(Uuid::from_u128(800 + n as u128), new_card(lane, "c"), now())
                .unwrap();
        }

        assert_eq!(p.progress(), (2, 4));
    }

    #[test]
    fn card_is_created_in_chosen_lane() {
        let mut p = project();
        let ids = p.lane_ids();

        p.add_card(Uuid::from_u128(900), new_card(ids[1], "direto"), now())
            .unwrap();

        assert_eq!(p.cards_in(ids[1]).len(), 1);
        assert!(p.cards_in(ids[0]).is_empty());
    }

    #[test]
    fn card_in_lane_of_other_project_is_rejected() {
        let mut p = project();

        let result = p.add_card(
            Uuid::from_u128(901),
            new_card(Uuid::from_u128(9999), "x"),
            now(),
        );

        assert!(matches!(result, Err(ProjectError::InvalidTargetLane)));
        assert!(p.cards.is_empty());
    }

    #[test]
    fn name_is_required() {
        let build = |name: &str| {
            Project::new(
                Uuid::from_u128(1),
                Uuid::from_u128(2),
                Visibility::Personal,
                name,
                None,
                now(),
                Uuid::now_v7,
            )
        };

        assert!(matches!(build("  "), Err(ProjectError::Validation(_))));
        assert!(matches!(
            build(&"a".repeat(201)),
            Err(ProjectError::Validation(_))
        ));
        assert_eq!(build(" Casa ").unwrap().name, "Casa");
    }

    #[test]
    fn cannot_delete_last_lane() {
        let mut p = project();
        let ids = p.lane_ids();
        p.delete_lane(ids[0], None, now()).unwrap();
        p.delete_lane(ids[1], None, now()).unwrap();

        let result = p.delete_lane(ids[2], None, now());

        assert!(matches!(result, Err(ProjectError::LastLane)));
        assert_eq!(p.lanes.len(), 1);
    }

    #[test]
    fn deleting_lane_with_cards_requires_target() {
        let mut p = with_cards(2, 0);
        let ids = p.lane_ids();

        let result = p.delete_lane(ids[0], None, now());

        assert!(matches!(result, Err(ProjectError::LaneHasCards)));
        assert_eq!(p.lanes.len(), 3);
        assert_eq!(p.cards.len(), 2);
    }

    #[test]
    fn target_lane_must_differ_and_belong_to_project() {
        let mut p = with_cards(1, 0);
        let ids = p.lane_ids();

        let same = p.delete_lane(ids[0], Some(ids[0]), now());
        let foreign = p.delete_lane(ids[0], Some(Uuid::from_u128(9999)), now());
        let missing = p.delete_lane(Uuid::from_u128(9999), Some(ids[1]), now());

        assert!(matches!(same, Err(ProjectError::InvalidTargetLane)));
        assert!(matches!(foreign, Err(ProjectError::InvalidTargetLane)));
        assert!(matches!(missing, Err(ProjectError::LaneNotFound)));
        assert_eq!(p.lanes.len(), 3);
    }

    #[test]
    fn deleting_lane_moves_cards_to_end_of_target() {
        let mut p = with_cards(2, 0);
        let ids = p.lane_ids();
        p.add_card(Uuid::from_u128(600), new_card(ids[1], "já lá"), now())
            .unwrap();

        p.delete_lane(ids[0], Some(ids[1]), now()).unwrap();

        let titles: Vec<_> = p.cards_in(ids[1]).iter().map(|c| c.title.clone()).collect();
        let positions: Vec<_> = p.cards_in(ids[1]).iter().map(|c| c.position).collect();
        assert_eq!(titles, ["já lá", "c0", "c1"]);
        assert_eq!(positions, [0, 1, 2]);
        assert_eq!(p.lane_ids(), [ids[1], ids[2]]);
        assert_eq!(
            p.lanes.iter().map(|l| l.position).collect::<Vec<_>>(),
            [0, 1]
        );
    }

    #[test]
    fn reorder_must_contain_all_lanes_exactly_once() {
        let mut p = project();
        let ids = p.lane_ids();

        let missing = p.reorder_lanes(&[ids[0], ids[1]], now());
        let repeated = p.reorder_lanes(&[ids[0], ids[0], ids[1]], now());
        let foreign = p.reorder_lanes(&[ids[0], ids[1], Uuid::from_u128(9999)], now());
        let extra = p.reorder_lanes(&[ids[0], ids[1], ids[2], ids[0]], now());

        for result in [missing, repeated, foreign, extra] {
            assert!(matches!(result, Err(ProjectError::InvalidLaneOrder)));
        }
        assert_eq!(p.lane_ids(), ids);
    }

    #[test]
    fn reorder_assigns_positions_in_given_order() {
        let mut p = project();
        let ids = p.lane_ids();
        let later = now() + chrono::Duration::minutes(1);

        p.reorder_lanes(&[ids[2], ids[0], ids[1]], later).unwrap();

        assert_eq!(p.lane_ids(), [ids[2], ids[0], ids[1]]);
        assert_eq!(
            p.lanes.iter().map(|l| l.position).collect::<Vec<_>>(),
            [0, 1, 2]
        );
    }
}
