//! Ligação bidirecional entre duas entidades (RF-18, RN-10): uma linha por ligação,
//! com os lados normalizados, vista pelos dois lados.

use std::str::FromStr;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::error::LinkError;
use crate::shared::visibility::Visibility;

/// Tipos ligáveis; a lista é a mesma do `CHECK` da migração ([project/security-09]).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum EntityType {
    Account,
    Transaction,
    Transfer,
    Goal,
    Milestone,
    Task,
    Reminder,
    Note,
    JournalEntry,
    Book,
    Article,
    Video,
    Project,
    ProjectCard,
}

impl EntityType {
    pub const ALL: [EntityType; 14] = [
        Self::Account,
        Self::Transaction,
        Self::Transfer,
        Self::Goal,
        Self::Milestone,
        Self::Task,
        Self::Reminder,
        Self::Note,
        Self::JournalEntry,
        Self::Book,
        Self::Article,
        Self::Video,
        Self::Project,
        Self::ProjectCard,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Account => "account",
            Self::Transaction => "transaction",
            Self::Transfer => "transfer",
            Self::Goal => "goal",
            Self::Milestone => "milestone",
            Self::Task => "task",
            Self::Reminder => "reminder",
            Self::Note => "note",
            Self::JournalEntry => "journal_entry",
            Self::Book => "book",
            Self::Article => "article",
            Self::Video => "video",
            Self::Project => "project",
            Self::ProjectCard => "project_card",
        }
    }
}

impl FromStr for EntityType {
    type Err = LinkError;

    fn from_str(text: &str) -> Result<Self, Self::Err> {
        Self::ALL
            .into_iter()
            .find(|kind| kind.as_str() == text)
            .ok_or(LinkError::UnknownEntityType)
    }
}

/// Um lado da ligação.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EntityRef {
    pub entity_type: EntityType,
    pub entity_id: Uuid,
}

impl EntityRef {
    pub fn new(entity_type: EntityType, entity_id: Uuid) -> Self {
        Self {
            entity_type,
            entity_id,
        }
    }

    /// Chave de ordenação igual à do banco: o texto do tipo e depois o id.
    fn key(&self) -> (&'static str, Uuid) {
        (self.entity_type.as_str(), self.entity_id)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Link {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub source: EntityRef,
    pub target: EntityRef,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Link {
    /// Normaliza os lados (o menor par tipo-id vira a origem) e recusa lados iguais.
    pub fn new(
        id: Uuid,
        owner_id: Uuid,
        a: EntityRef,
        b: EntityRef,
        visibility: Visibility,
        now: DateTime<Utc>,
    ) -> Result<Self, LinkError> {
        if a == b {
            return Err(LinkError::SelfLink);
        }
        let (source, target) = if a.key() < b.key() { (a, b) } else { (b, a) };
        Ok(Self {
            id,
            owner_id,
            visibility,
            source,
            target,
            created_at: now,
            updated_at: now,
        })
    }

    /// O lado oposto à entidade consultada; `None` se ela não participa da ligação.
    pub fn other_side(&self, entity: &EntityRef) -> Option<EntityRef> {
        if self.source == *entity {
            Some(self.target)
        } else if self.target == *entity {
            Some(self.source)
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> DateTime<Utc> {
        "2026-11-01T12:00:00Z".parse().unwrap()
    }

    fn entity(kind: EntityType, n: u128) -> EntityRef {
        EntityRef::new(kind, Uuid::from_u128(n))
    }

    fn link(a: EntityRef, b: EntityRef) -> Result<Link, LinkError> {
        Link::new(
            Uuid::from_u128(99),
            Uuid::from_u128(1),
            a,
            b,
            Visibility::Personal,
            now(),
        )
    }

    #[test]
    fn link_to_itself_is_rejected() {
        let a = entity(EntityType::Note, 1);
        assert!(matches!(link(a, a), Err(LinkError::SelfLink)));
    }

    #[test]
    fn unknown_entity_type_is_rejected() {
        assert!(matches!(
            "spaceship".parse::<EntityType>(),
            Err(LinkError::UnknownEntityType)
        ));
        assert!(matches!(
            "Note".parse::<EntityType>(),
            Err(LinkError::UnknownEntityType)
        ));
    }

    #[test]
    fn link_sides_are_normalized() {
        let note = entity(EntityType::Note, 1);
        let goal = entity(EntityType::Goal, 2);
        let created = link(note, goal).unwrap();
        // "goal" < "note": a meta é a origem.
        assert_eq!(created.source, goal);
        assert_eq!(created.target, note);
        // Mesmo tipo: desempata pelo id.
        let low = entity(EntityType::Task, 1);
        let high = entity(EntityType::Task, 2);
        let same_type = link(high, low).unwrap();
        assert_eq!((same_type.source, same_type.target), (low, high));
    }

    #[test]
    fn reversed_input_produces_same_normalized_link() {
        let note = entity(EntityType::Note, 1);
        let goal = entity(EntityType::Goal, 2);
        assert_eq!(link(note, goal).unwrap(), link(goal, note).unwrap());
    }

    #[test]
    fn linked_side_is_the_opposite_of_queried_entity() {
        let note = entity(EntityType::Note, 1);
        let goal = entity(EntityType::Goal, 2);
        let other = entity(EntityType::Book, 3);
        let created = link(note, goal).unwrap();
        assert_eq!(created.other_side(&note), Some(goal));
        assert_eq!(created.other_side(&goal), Some(note));
        assert_eq!(created.other_side(&other), None);
    }

    #[test]
    fn linkable_types_match_the_database_check() {
        let names: Vec<&str> = EntityType::ALL.iter().map(|k| k.as_str()).collect();
        assert_eq!(names.len(), 14);
        let migration = include_str!("../migrations/20261101150001_create-links.sql");
        for name in &names {
            assert!(migration.contains(&format!("'{name}'")), "{name}");
            assert_eq!(name.parse::<EntityType>().unwrap().as_str(), *name);
        }
        let mut sorted = names.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), 14);
    }
}
