//! Cartão do quadro: próprio do projeto, sem vínculo direto com Tarefas (RN-20).

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use super::error::ProjectError;
use super::lane::LaneId;
use crate::shared::visibility::Visibility;

pub type CardId = Uuid;

pub const CARD_TITLE_MAX_CHARS: usize = 300;
pub const CARD_DESCRIPTION_MAX_CHARS: usize = 10_000;
pub const LABELS_MAX: usize = 20;
pub const LABEL_MAX_CHARS: usize = 50;
pub const CHECKLIST_MAX_ITEMS: usize = 100;
pub const CHECKLIST_TEXT_MAX_CHARS: usize = 300;

/// Prioridade do cartão; sem prioridade é `None` (PD-46).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CardPriority {
    Low,
    Medium,
    High,
}

impl CardPriority {
    pub fn parse(text: &str) -> Result<Self, ProjectError> {
        match text {
            "low" => Ok(Self::Low),
            "medium" => Ok(Self::Medium),
            "high" => Ok(Self::High),
            _ => Err(ProjectError::invalid("priority", "invalid")),
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
        }
    }

    /// Ordem da Visão geral: alta primeiro, sem prioridade por último.
    pub fn rank(priority: Option<Self>) -> u8 {
        match priority {
            Some(Self::High) => 0,
            Some(Self::Medium) => 1,
            Some(Self::Low) => 2,
            None => 3,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChecklistItem {
    pub id: Uuid,
    pub text: String,
    pub done: bool,
    pub position: i32,
}

/// Etiquetas: sem espaços nas pontas, sem vazias, sem repetidas (ignorando maiúsculas),
/// até 20 de até 50 caracteres.
pub fn validate_labels(labels: &[String]) -> Result<Vec<String>, ProjectError> {
    if labels.len() > LABELS_MAX {
        return Err(ProjectError::invalid("labels", "too_many"));
    }
    let mut cleaned: Vec<String> = Vec::with_capacity(labels.len());
    for label in labels {
        let label = label.trim();
        if label.is_empty() {
            return Err(ProjectError::invalid("labels", "required"));
        }
        if label.chars().count() > LABEL_MAX_CHARS {
            return Err(ProjectError::invalid("labels", "too_long"));
        }
        if cleaned
            .iter()
            .any(|l| l.to_lowercase() == label.to_lowercase())
        {
            return Err(ProjectError::invalid("labels", "duplicated"));
        }
        cleaned.push(label.to_owned());
    }
    Ok(cleaned)
}

/// Valida um checklist já montado e renumera as posições pelo índice da lista.
pub fn validate_checklist(items: Vec<ChecklistItem>) -> Result<Vec<ChecklistItem>, ProjectError> {
    if items.len() > CHECKLIST_MAX_ITEMS {
        return Err(ProjectError::invalid("checklist", "too_many"));
    }
    items
        .into_iter()
        .enumerate()
        .map(|(index, mut item)| {
            let text = item.text.trim();
            if text.is_empty() {
                return Err(ProjectError::invalid("checklist", "required"));
            }
            if text.chars().count() > CHECKLIST_TEXT_MAX_CHARS {
                return Err(ProjectError::invalid("checklist", "too_long"));
            }
            item.text = text.to_owned();
            item.position = i32::try_from(index).unwrap_or(i32::MAX);
            Ok(item)
        })
        .collect()
}

/// Monta o checklist de `(texto, feito)` na ordem dada, com um id novo por item.
pub fn build_checklist(
    items: &[(&str, bool)],
    mut next_id: impl FnMut() -> Uuid,
) -> Result<Vec<ChecklistItem>, ProjectError> {
    let items = items
        .iter()
        .map(|(text, done)| ChecklistItem {
            id: next_id(),
            text: (*text).to_owned(),
            done: *done,
            position: 0,
        })
        .collect();
    validate_checklist(items)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Card {
    pub id: CardId,
    pub project_id: Uuid,
    pub lane_id: LaneId,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<CardPriority>,
    pub labels: Vec<String>,
    pub due_date: Option<NaiveDate>,
    pub checklist: Vec<ChecklistItem>,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Card {
    /// `(feitos, total)` do checklist.
    pub fn checklist_progress(&self) -> (u32, u32) {
        let total = u32::try_from(self.checklist.len()).unwrap_or(u32::MAX);
        let done = self.checklist.iter().filter(|i| i.done).count();
        (u32::try_from(done).unwrap_or(u32::MAX), total)
    }
}

/// Título obrigatório, sem espaços nas pontas e com até 300 caracteres.
pub fn validate_card_title(title: &str) -> Result<String, ProjectError> {
    let title = title.trim();
    if title.is_empty() {
        return Err(ProjectError::invalid("title", "required"));
    }
    if title.chars().count() > CARD_TITLE_MAX_CHARS {
        return Err(ProjectError::invalid("title", "too_long"));
    }
    Ok(title.to_owned())
}

pub fn validate_card_description(description: &str) -> Result<(), ProjectError> {
    if description.chars().count() > CARD_DESCRIPTION_MAX_CHARS {
        return Err(ProjectError::invalid("description", "too_long"));
    }
    Ok(())
}

/// Reatribui 0..n às posições dos cartões da raia, na ordem dada, e devolve os que mudaram.
fn reindex(cards: &mut [Card], ordered: &[CardId], now: DateTime<Utc>) {
    for (index, id) in ordered.iter().enumerate() {
        let position = i32::try_from(index).unwrap_or(i32::MAX);
        if let Some(card) = cards.iter_mut().find(|c| c.id == *id)
            && card.position != position
        {
            card.position = position;
            card.updated_at = now;
        }
    }
}

/// Ids dos cartões da raia, por posição (e id, para desempatar).
fn lane_order(cards: &[Card], lane_id: LaneId) -> Vec<CardId> {
    let mut in_lane: Vec<&Card> = cards.iter().filter(|c| c.lane_id == lane_id).collect();
    in_lane.sort_by_key(|c| (c.position, c.id));
    in_lane.iter().map(|c| c.id).collect()
}

/// Move o cartão para `to_lane`, na `position` pedida (sem posição, no fim), e reindexa
/// as raias de origem e de destino em 0..n. Só os cartões de `cards` participam.
pub fn move_card(
    cards: &mut [Card],
    card_id: CardId,
    to_lane: LaneId,
    position: Option<i32>,
    now: DateTime<Utc>,
) -> Result<(), ProjectError> {
    let source = cards
        .iter()
        .find(|c| c.id == card_id)
        .ok_or(ProjectError::CardNotFound)?
        .lane_id;
    let mut target_order = lane_order(cards, to_lane);
    target_order.retain(|id| *id != card_id);
    let index = match position {
        Some(p) if p < 0 => return Err(ProjectError::invalid("position", "invalid")),
        Some(p) => usize::try_from(p)
            .unwrap_or(usize::MAX)
            .min(target_order.len()),
        None => target_order.len(),
    };
    target_order.insert(index, card_id);
    if let Some(card) = cards.iter_mut().find(|c| c.id == card_id)
        && card.lane_id != to_lane
    {
        card.lane_id = to_lane;
        card.updated_at = now;
    }
    reindex(cards, &target_order, now);
    if source != to_lane {
        let source_order = lane_order(cards, source);
        reindex(cards, &source_order, now);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> DateTime<Utc> {
        DateTime::<Utc>::from_timestamp(1_793_534_400, 0).unwrap()
    }

    fn card(n: u128, lane: u128, position: i32) -> Card {
        Card {
            id: Uuid::from_u128(n),
            project_id: Uuid::from_u128(900),
            lane_id: Uuid::from_u128(lane),
            owner_id: Uuid::from_u128(901),
            visibility: Visibility::Personal,
            title: format!("c{n}"),
            description: None,
            priority: None,
            labels: Vec::new(),
            due_date: None,
            checklist: Vec::new(),
            position,
            created_at: now(),
            updated_at: now(),
        }
    }

    fn layout(cards: &[Card], lane: u128) -> Vec<u128> {
        let mut in_lane: Vec<&Card> = cards
            .iter()
            .filter(|c| c.lane_id == Uuid::from_u128(lane))
            .collect();
        in_lane.sort_by_key(|c| c.position);
        in_lane.iter().map(|c| c.id.as_u128()).collect()
    }

    #[test]
    fn card_title_is_required() {
        assert!(matches!(
            validate_card_title("   "),
            Err(ProjectError::Validation(_))
        ));
        assert!(matches!(
            validate_card_title(&"a".repeat(301)),
            Err(ProjectError::Validation(_))
        ));
        assert_eq!(validate_card_title("  Ok ").unwrap(), "Ok");
    }

    #[test]
    fn moving_card_reindexes_source_and_target_lanes() {
        let mut cards = vec![
            card(1, 10, 0),
            card(2, 10, 1),
            card(3, 10, 2),
            card(4, 20, 0),
            card(5, 20, 1),
        ];

        move_card(
            &mut cards,
            Uuid::from_u128(2),
            Uuid::from_u128(20),
            Some(1),
            now(),
        )
        .unwrap();

        assert_eq!(layout(&cards, 10), [1, 3]);
        assert_eq!(layout(&cards, 20), [4, 2, 5]);
        let positions: Vec<i32> = {
            let mut p: Vec<i32> = cards
                .iter()
                .filter(|c| c.lane_id.as_u128() == 10)
                .map(|c| c.position)
                .collect();
            p.sort();
            p
        };
        assert_eq!(positions, [0, 1]);
        let moved = cards.iter().find(|c| c.id.as_u128() == 2).unwrap();
        assert_eq!(moved.lane_id, Uuid::from_u128(20));
        assert_eq!(moved.position, 1);
    }

    #[test]
    fn moving_card_within_same_lane_reorders() {
        let mut cards = vec![card(1, 10, 0), card(2, 10, 1), card(3, 10, 2)];

        move_card(
            &mut cards,
            Uuid::from_u128(1),
            Uuid::from_u128(10),
            Some(2),
            now(),
        )
        .unwrap();
        assert_eq!(layout(&cards, 10), [2, 3, 1]);

        move_card(
            &mut cards,
            Uuid::from_u128(1),
            Uuid::from_u128(10),
            Some(0),
            now(),
        )
        .unwrap();
        assert_eq!(layout(&cards, 10), [1, 2, 3]);

        // Sem posição, vai para o fim; posição além do fim também.
        move_card(
            &mut cards,
            Uuid::from_u128(1),
            Uuid::from_u128(10),
            None,
            now(),
        )
        .unwrap();
        assert_eq!(layout(&cards, 10), [2, 3, 1]);
        move_card(
            &mut cards,
            Uuid::from_u128(2),
            Uuid::from_u128(10),
            Some(99),
            now(),
        )
        .unwrap();
        assert_eq!(layout(&cards, 10), [3, 1, 2]);
    }

    #[test]
    fn card_priority_accepts_low_medium_high() {
        for (text, expected) in [
            ("low", CardPriority::Low),
            ("medium", CardPriority::Medium),
            ("high", CardPriority::High),
        ] {
            assert_eq!(CardPriority::parse(text).unwrap(), expected);
            assert_eq!(expected.as_str(), text);
        }
        for text in ["", "urgent", "High", "none"] {
            assert!(
                matches!(CardPriority::parse(text), Err(ProjectError::Validation(_))),
                "{text}"
            );
        }
    }

    #[test]
    fn card_labels_are_trimmed_deduplicated_and_limited() {
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
                matches!(validate_labels(&invalid), Err(ProjectError::Validation(_))),
                "{invalid:?}"
            );
        }
        assert!(validate_labels(&(0..20).map(|i| format!("l{i}")).collect::<Vec<_>>()).is_ok());
    }

    #[test]
    fn checklist_items_get_positions_in_given_order() {
        let mut n = 0u128;
        let items = build_checklist(&[("b", false), ("a", true), (" c ", false)], || {
            n += 1;
            Uuid::from_u128(n)
        })
        .unwrap();

        assert_eq!(
            items.iter().map(|i| i.text.as_str()).collect::<Vec<_>>(),
            ["b", "a", "c"]
        );
        assert_eq!(
            items.iter().map(|i| i.position).collect::<Vec<_>>(),
            [0, 1, 2]
        );
        assert!(items[1].done && !items[0].done);
    }

    #[test]
    fn checklist_item_text_is_required() {
        let build = |text: &str| build_checklist(&[(text, false)], Uuid::now_v7);

        assert!(matches!(build("  "), Err(ProjectError::Validation(_))));
        assert!(matches!(
            build(&"a".repeat(301)),
            Err(ProjectError::Validation(_))
        ));
        assert!(build(&"a".repeat(300)).is_ok());
        let many: Vec<(&str, bool)> = (0..101).map(|_| ("x", false)).collect();
        assert!(matches!(
            build_checklist(&many, Uuid::now_v7),
            Err(ProjectError::Validation(_))
        ));
    }

    #[test]
    fn checklist_progress_counts_done_items() {
        let mut c = card(1, 10, 0);
        assert_eq!(c.checklist_progress(), (0, 0));
        c.checklist =
            build_checklist(&[("a", true), ("b", false), ("c", true)], Uuid::now_v7).unwrap();

        assert_eq!(c.checklist_progress(), (2, 3));
    }
}
