//! Entidade `JournalEntry`: entrada do Diário com data, hora, texto e emoções com
//! intensidade opcional (RF-44, RF-45). Várias entradas no mesmo dia são aceitas.

use std::collections::HashSet;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::error::JournalError;
use crate::shared::visibility::Visibility;

pub const TEXT_MAX_CHARS: usize = 100_000;
pub const INTENSITY_MIN: u8 = 1;
pub const INTENSITY_MAX: u8 = 5;

/// Emoção marcada numa entrada, com intensidade opcional de 1 a 5.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EntryEmotion {
    pub emotion_id: Uuid,
    pub intensity: Option<u8>,
}

impl EntryEmotion {
    /// Recebe a intensidade como veio da borda, para recusar qualquer valor fora da faixa.
    pub fn new(emotion_id: Uuid, intensity: Option<i64>) -> Result<Self, JournalError> {
        let intensity = intensity
            .map(|value| {
                u8::try_from(value)
                    .ok()
                    .filter(|value| (INTENSITY_MIN..=INTENSITY_MAX).contains(value))
                    .ok_or(JournalError::InvalidIntensity)
            })
            .transpose()?;
        Ok(Self {
            emotion_id,
            intensity,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JournalEntry {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub occurred_at: DateTime<Utc>,
    pub text: String,
    pub emotions: Vec<EntryEmotion>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Dados de uma entrada nova; o id e o instante vêm dos geradores injetáveis.
#[derive(Debug, Clone)]
pub struct NewJournalEntry {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub occurred_at: DateTime<Utc>,
    pub text: String,
    pub emotions: Vec<EntryEmotion>,
}

/// Mudanças parciais de uma edição; `emotions` substitui a lista inteira.
#[derive(Debug, Clone, Default)]
pub struct JournalEntryChanges {
    pub occurred_at: Option<DateTime<Utc>>,
    pub text: Option<String>,
    pub emotions: Option<Vec<EntryEmotion>>,
    pub visibility: Option<Visibility>,
}

// O texto não é aparado: espaços e quebras de linha fazem parte da entrada.
fn validate_text(text: String) -> Result<String, JournalError> {
    if text.trim().is_empty() {
        return Err(JournalError::TextRequired);
    }
    if text.chars().count() > TEXT_MAX_CHARS {
        return Err(JournalError::TextTooLong);
    }
    Ok(text)
}

fn validate_emotions(emotions: Vec<EntryEmotion>) -> Result<Vec<EntryEmotion>, JournalError> {
    let mut seen = HashSet::with_capacity(emotions.len());
    if emotions
        .iter()
        .any(|emotion| !seen.insert(emotion.emotion_id))
    {
        return Err(JournalError::DuplicateEmotion);
    }
    Ok(emotions)
}

impl JournalEntry {
    pub fn new(new: NewJournalEntry, now: DateTime<Utc>) -> Result<Self, JournalError> {
        let text = validate_text(new.text)?;
        let emotions = validate_emotions(new.emotions)?;
        Ok(Self {
            id: new.id,
            owner_id: new.owner_id,
            visibility: new.visibility,
            occurred_at: new.occurred_at,
            text,
            emotions,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        })
    }

    pub fn is_deleted(&self) -> bool {
        self.deleted_at.is_some()
    }

    pub fn has_emotion(&self, emotion_id: Uuid) -> bool {
        self.emotions
            .iter()
            .any(|emotion| emotion.emotion_id == emotion_id)
    }

    /// Aplica a edição inteira ou nada: a validação vem antes de qualquer mudança.
    pub fn edit(
        &mut self,
        changes: JournalEntryChanges,
        now: DateTime<Utc>,
    ) -> Result<(), JournalError> {
        if self.is_deleted() {
            return Err(JournalError::EntryNotFound);
        }
        let text = changes.text.map(validate_text).transpose()?;
        let emotions = changes.emotions.map(validate_emotions).transpose()?;
        if let Some(text) = text {
            self.text = text;
        }
        if let Some(emotions) = emotions {
            self.emotions = emotions;
        }
        if let Some(occurred_at) = changes.occurred_at {
            self.occurred_at = occurred_at;
        }
        if let Some(visibility) = changes.visibility {
            self.visibility = visibility;
        }
        self.updated_at = now;
        Ok(())
    }

    /// Exclusão lógica, para a lixeira ([project/database-08]).
    pub fn delete(&mut self, now: DateTime<Utc>) -> Result<(), JournalError> {
        if self.is_deleted() {
            return Err(JournalError::EntryNotFound);
        }
        self.deleted_at = Some(now);
        self.updated_at = now;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use chrono::FixedOffset;

    use super::*;

    fn instant(text: &str) -> DateTime<Utc> {
        text.parse().unwrap()
    }

    fn emotion(id: u128, intensity: Option<i64>) -> EntryEmotion {
        EntryEmotion::new(Uuid::from_u128(id), intensity).unwrap()
    }

    fn new_entry(text: &str, emotions: Vec<EntryEmotion>) -> NewJournalEntry {
        NewJournalEntry {
            id: Uuid::from_u128(10),
            owner_id: Uuid::from_u128(1),
            visibility: Visibility::Personal,
            occurred_at: instant("2026-11-05T08:00:00Z"),
            text: text.to_owned(),
            emotions,
        }
    }

    fn entry() -> JournalEntry {
        JournalEntry::new(
            new_entry("Dia cheio", vec![emotion(100, Some(4))]),
            instant("2026-11-05T12:00:00Z"),
        )
        .unwrap()
    }

    #[test]
    fn text_is_required() {
        let now = instant("2026-11-05T12:00:00Z");

        assert!(matches!(
            JournalEntry::new(new_entry("", vec![]), now),
            Err(JournalError::TextRequired)
        ));
        assert!(matches!(
            JournalEntry::new(new_entry(" \n\t", vec![]), now),
            Err(JournalError::TextRequired)
        ));
        let mut existing = entry();
        let blank = JournalEntryChanges {
            text: Some("  ".to_owned()),
            ..JournalEntryChanges::default()
        };
        assert!(matches!(
            existing.edit(blank, now),
            Err(JournalError::TextRequired)
        ));
        assert_eq!(existing.text, "Dia cheio");
    }

    #[test]
    fn text_longer_than_100000_chars_is_rejected() {
        let now = instant("2026-11-05T12:00:00Z");
        let limit = "é".repeat(TEXT_MAX_CHARS);
        let over = "é".repeat(TEXT_MAX_CHARS + 1);

        assert!(JournalEntry::new(new_entry(&limit, vec![]), now).is_ok());
        assert!(matches!(
            JournalEntry::new(new_entry(&over, vec![]), now),
            Err(JournalError::TextTooLong)
        ));
        let mut existing = entry();
        let changes = JournalEntryChanges {
            text: Some(over),
            ..JournalEntryChanges::default()
        };
        assert!(matches!(
            existing.edit(changes, now),
            Err(JournalError::TextTooLong)
        ));
    }

    #[test]
    fn intensity_must_be_between_1_and_5() {
        let id = Uuid::from_u128(100);

        for value in [1, 3, 5] {
            assert_eq!(
                EntryEmotion::new(id, Some(value)).unwrap().intensity,
                Some(u8::try_from(value).unwrap())
            );
        }
        for value in [0, 6, -1, 300] {
            assert!(
                matches!(
                    EntryEmotion::new(id, Some(value)),
                    Err(JournalError::InvalidIntensity)
                ),
                "{value}"
            );
        }
    }

    #[test]
    fn intensity_is_optional() {
        let marked = EntryEmotion::new(Uuid::from_u128(100), None).unwrap();

        assert_eq!(marked.intensity, None);
        let created = JournalEntry::new(
            new_entry("Sem intensidade", vec![marked]),
            instant("2026-11-05T12:00:00Z"),
        )
        .unwrap();
        assert_eq!(created.emotions, [marked]);
    }

    #[test]
    fn entry_rejects_duplicate_emotion() {
        let now = instant("2026-11-05T12:00:00Z");
        let repeated = vec![emotion(100, Some(2)), emotion(100, None)];

        assert!(matches!(
            JournalEntry::new(new_entry("Repetida", repeated.clone()), now),
            Err(JournalError::DuplicateEmotion)
        ));
        let mut existing = entry();
        let changes = JournalEntryChanges {
            emotions: Some(repeated),
            ..JournalEntryChanges::default()
        };
        assert!(matches!(
            existing.edit(changes, now),
            Err(JournalError::DuplicateEmotion)
        ));
        assert_eq!(existing.emotions, [emotion(100, Some(4))]);
    }

    #[test]
    fn entry_accepts_many_emotions() {
        let emotions = vec![
            emotion(100, Some(4)),
            emotion(101, None),
            emotion(102, Some(1)),
        ];

        let created = JournalEntry::new(
            new_entry("Várias", emotions.clone()),
            instant("2026-11-05T12:00:00Z"),
        )
        .unwrap();

        assert_eq!(created.emotions, emotions);
        assert!(created.has_emotion(Uuid::from_u128(101)));
        assert!(!created.has_emotion(Uuid::from_u128(103)));
    }

    #[test]
    fn occurred_at_is_kept_in_utc() {
        let local: DateTime<FixedOffset> = "2026-11-05T21:30:00-03:00".parse().unwrap();
        let mut new = new_entry("À noite", vec![]);
        new.occurred_at = local.with_timezone(&Utc);

        let created = JournalEntry::new(new, instant("2026-11-06T01:00:00Z")).unwrap();

        assert_eq!(created.occurred_at, instant("2026-11-06T00:30:00Z"));
        assert_eq!(created.occurred_at.timezone(), Utc);
    }

    #[test]
    fn edit_changes_updated_at_with_injected_clock() {
        let mut existing = entry();
        let later = instant("2026-11-06T08:30:00Z");
        let changes = JournalEntryChanges {
            occurred_at: Some(instant("2026-11-05T09:15:00Z")),
            text: Some("Texto revisto".to_owned()),
            emotions: Some(vec![emotion(101, None)]),
            visibility: Some(Visibility::Shared),
        };

        existing.edit(changes, later).unwrap();

        assert_eq!(existing.text, "Texto revisto");
        assert_eq!(existing.occurred_at, instant("2026-11-05T09:15:00Z"));
        assert_eq!(existing.emotions, [emotion(101, None)]);
        assert_eq!(existing.visibility, Visibility::Shared);
        assert_eq!(existing.created_at, instant("2026-11-05T12:00:00Z"));
        assert_eq!(existing.updated_at, later);
    }

    #[test]
    fn delete_sets_deleted_at_with_injected_clock() {
        let mut existing = entry();
        let later = instant("2026-11-07T09:00:00Z");

        existing.delete(later).unwrap();

        assert!(existing.is_deleted());
        assert_eq!(existing.deleted_at, Some(later));
        assert_eq!(existing.updated_at, later);
        assert!(matches!(
            existing.delete(later),
            Err(JournalError::EntryNotFound)
        ));
        assert!(matches!(
            existing.edit(JournalEntryChanges::default(), later),
            Err(JournalError::EntryNotFound)
        ));
    }
}
