//! Entidade `Note`: nota independente com título e corpo (RF-43).

use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::error::NoteError;
use crate::shared::visibility::Visibility;

pub const TITLE_MAX_CHARS: usize = 200;
pub const BODY_MAX_CHARS: usize = 100_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Note {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub title: String,
    pub body: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Dados de uma nota nova; o id e o instante vêm dos geradores injetáveis.
#[derive(Debug, Clone)]
pub struct NewNote {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub title: String,
    pub body: String,
}

/// Mudanças parciais de uma edição: só os campos presentes mudam.
#[derive(Debug, Clone, Default)]
pub struct NoteChanges {
    pub title: Option<String>,
    pub body: Option<String>,
    pub visibility: Option<Visibility>,
}

fn validate_title(title: &str) -> Result<String, NoteError> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err(NoteError::TitleRequired);
    }
    if trimmed.chars().count() > TITLE_MAX_CHARS {
        return Err(NoteError::TitleTooLong);
    }
    Ok(trimmed.to_owned())
}

// O corpo não é aparado: espaços e quebras de linha fazem parte do texto.
fn validate_body(body: String) -> Result<String, NoteError> {
    if body.chars().count() > BODY_MAX_CHARS {
        return Err(NoteError::BodyTooLong);
    }
    Ok(body)
}

impl Note {
    pub fn new(new: NewNote, now: DateTime<Utc>) -> Result<Self, NoteError> {
        let title = validate_title(&new.title)?;
        let body = validate_body(new.body)?;
        Ok(Self {
            id: new.id,
            owner_id: new.owner_id,
            visibility: new.visibility,
            title,
            body,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        })
    }

    pub fn is_deleted(&self) -> bool {
        self.deleted_at.is_some()
    }

    /// Aplica a edição inteira ou nada: a validação vem antes de qualquer mudança.
    pub fn edit(&mut self, changes: NoteChanges, now: DateTime<Utc>) -> Result<(), NoteError> {
        if self.is_deleted() {
            return Err(NoteError::Deleted);
        }
        let title = changes.title.as_deref().map(validate_title).transpose()?;
        let body = changes.body.map(validate_body).transpose()?;
        if let Some(title) = title {
            self.title = title;
        }
        if let Some(body) = body {
            self.body = body;
        }
        if let Some(visibility) = changes.visibility {
            self.visibility = visibility;
        }
        self.updated_at = now;
        Ok(())
    }

    /// Exclusão lógica, para a lixeira ([project/database-08]).
    pub fn delete(&mut self, now: DateTime<Utc>) -> Result<(), NoteError> {
        if self.is_deleted() {
            return Err(NoteError::Deleted);
        }
        self.deleted_at = Some(now);
        self.updated_at = now;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn instant(text: &str) -> DateTime<Utc> {
        text.parse().unwrap()
    }

    fn new_note(title: &str, body: &str) -> NewNote {
        NewNote {
            id: Uuid::from_u128(10),
            owner_id: Uuid::from_u128(1),
            visibility: Visibility::Personal,
            title: title.to_owned(),
            body: body.to_owned(),
        }
    }

    fn note() -> Note {
        Note::new(new_note("Ideias", "corpo"), instant("2026-11-01T12:00:00Z")).unwrap()
    }

    #[test]
    fn title_is_required() {
        let now = instant("2026-11-01T12:00:00Z");

        assert!(matches!(
            Note::new(new_note("", "corpo"), now),
            Err(NoteError::TitleRequired)
        ));
        assert!(matches!(
            Note::new(new_note("   \n", "corpo"), now),
            Err(NoteError::TitleRequired)
        ));
        let mut existing = note();
        let blank = NoteChanges {
            title: Some(" ".to_owned()),
            ..NoteChanges::default()
        };
        assert!(matches!(
            existing.edit(blank, now),
            Err(NoteError::TitleRequired)
        ));
        assert_eq!(existing.title, "Ideias");
    }

    #[test]
    fn title_is_trimmed() {
        let created = Note::new(
            new_note("  Ideias de projeto \t", "corpo"),
            instant("2026-11-01T12:00:00Z"),
        )
        .unwrap();

        assert_eq!(created.title, "Ideias de projeto");
    }

    #[test]
    fn title_longer_than_200_chars_is_rejected() {
        let now = instant("2026-11-01T12:00:00Z");
        let limit = "é".repeat(TITLE_MAX_CHARS);
        let over = "é".repeat(TITLE_MAX_CHARS + 1);

        assert!(Note::new(new_note(&limit, ""), now).is_ok());
        assert!(matches!(
            Note::new(new_note(&over, ""), now),
            Err(NoteError::TitleTooLong)
        ));
    }

    #[test]
    fn body_longer_than_100000_chars_is_rejected() {
        let now = instant("2026-11-01T12:00:00Z");
        let limit = "a".repeat(BODY_MAX_CHARS);
        let over = "a".repeat(BODY_MAX_CHARS + 1);

        assert!(Note::new(new_note("Título", &limit), now).is_ok());
        assert!(matches!(
            Note::new(new_note("Título", &over), now),
            Err(NoteError::BodyTooLong)
        ));
        let mut existing = note();
        let changes = NoteChanges {
            body: Some(over),
            ..NoteChanges::default()
        };
        assert!(matches!(
            existing.edit(changes, now),
            Err(NoteError::BodyTooLong)
        ));
    }

    #[test]
    fn empty_body_is_accepted() {
        let created = Note::new(new_note("Título", ""), instant("2026-11-01T12:00:00Z")).unwrap();

        assert_eq!(created.body, "");
    }

    #[test]
    fn edit_changes_updated_at_with_injected_clock() {
        let mut existing = note();
        let later = instant("2026-11-02T08:30:00Z");
        let changes = NoteChanges {
            title: Some(" Novo título ".to_owned()),
            body: Some("novo corpo".to_owned()),
            visibility: Some(Visibility::Shared),
        };

        existing.edit(changes, later).unwrap();

        assert_eq!(existing.title, "Novo título");
        assert_eq!(existing.body, "novo corpo");
        assert_eq!(existing.visibility, Visibility::Shared);
        assert_eq!(existing.created_at, instant("2026-11-01T12:00:00Z"));
        assert_eq!(existing.updated_at, later);
    }

    #[test]
    fn delete_sets_deleted_at_with_injected_clock() {
        let mut existing = note();
        let later = instant("2026-11-03T09:00:00Z");

        existing.delete(later).unwrap();

        assert!(existing.is_deleted());
        assert_eq!(existing.deleted_at, Some(later));
        assert!(matches!(existing.delete(later), Err(NoteError::Deleted)));
    }

    #[test]
    fn deleted_note_cannot_be_edited() {
        let mut existing = note();
        existing.delete(instant("2026-11-03T09:00:00Z")).unwrap();
        let changes = NoteChanges {
            title: Some("Outro".to_owned()),
            ..NoteChanges::default()
        };

        assert!(matches!(
            existing.edit(changes, instant("2026-11-04T09:00:00Z")),
            Err(NoteError::Deleted)
        ));
        assert_eq!(existing.title, "Ideias");
    }
}
