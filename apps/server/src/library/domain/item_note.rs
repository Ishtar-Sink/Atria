//! `ItemNote`: nota do próprio item (livro, artigo ou vídeo), com trecho, página e
//! comentário (RN-21, RN-24, CB-20). Nunca aparece em Notas.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::error::LibraryError;
use super::{ItemRef, optional_text, positive_page};

pub const NOTE_TEXT_MAX_CHARS: usize = 5000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ItemNote {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub item: ItemRef,
    pub quote: Option<String>,
    pub page: Option<i32>,
    pub comment: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewItemNote {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub item: ItemRef,
    pub quote: Option<String>,
    pub page: Option<i32>,
    pub comment: Option<String>,
}

/// Mudanças parciais: `Some(None)` limpa um campo opcional.
#[derive(Debug, Clone, Default)]
pub struct ItemNoteChanges {
    pub quote: Option<Option<String>>,
    pub page: Option<Option<i32>>,
    pub comment: Option<Option<String>>,
}

struct Fields {
    quote: Option<String>,
    page: Option<i32>,
    comment: Option<String>,
}

/// Exige o trecho ou o comentário: uma nota de página escaneada guarda só a página e o
/// comentário (CB-20), e um trecho pode vir sem comentário (RN-24).
fn validate(
    quote: Option<String>,
    page: Option<i32>,
    comment: Option<String>,
) -> Result<Fields, LibraryError> {
    let quote = optional_text(quote, "quote", NOTE_TEXT_MAX_CHARS)?;
    let comment = optional_text(comment, "comment", NOTE_TEXT_MAX_CHARS)?;
    let page = page.map(|page| positive_page(page, "page")).transpose()?;
    if quote.is_none() && comment.is_none() {
        return Err(LibraryError::validation("comment", "required"));
    }
    Ok(Fields {
        quote,
        page,
        comment,
    })
}

impl ItemNote {
    pub fn new(new: NewItemNote, now: DateTime<Utc>) -> Result<Self, LibraryError> {
        let fields = validate(new.quote, new.page, new.comment)?;
        Ok(Self {
            id: new.id,
            owner_id: new.owner_id,
            item: new.item,
            quote: fields.quote,
            page: fields.page,
            comment: fields.comment,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn apply(
        &mut self,
        changes: ItemNoteChanges,
        now: DateTime<Utc>,
    ) -> Result<(), LibraryError> {
        let fields = validate(
            changes.quote.unwrap_or_else(|| self.quote.clone()),
            changes.page.unwrap_or(self.page),
            changes.comment.unwrap_or_else(|| self.comment.clone()),
        )?;
        self.quote = fields.quote;
        self.page = fields.page;
        self.comment = fields.comment;
        self.updated_at = now;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> DateTime<Utc> {
        "2026-11-01T12:00:00Z".parse().unwrap()
    }

    fn new_note(quote: Option<&str>, page: Option<i32>, comment: Option<&str>) -> NewItemNote {
        NewItemNote {
            id: Uuid::from_u128(1),
            owner_id: Uuid::from_u128(2),
            item: ItemRef::Book(Uuid::from_u128(3)),
            quote: quote.map(str::to_owned),
            page,
            comment: comment.map(str::to_owned),
        }
    }

    #[test]
    fn item_note_requires_quote_or_comment() {
        assert!(ItemNote::new(new_note(None, Some(3), None), now()).is_err());
        assert!(ItemNote::new(new_note(Some("  "), None, Some("")), now()).is_err());
        assert!(ItemNote::new(new_note(None, None, Some("só comentário")), now()).is_ok());
    }

    #[test]
    fn item_note_with_quote_and_page_without_comment_is_valid() {
        let note = ItemNote::new(new_note(Some("um trecho"), Some(31), None), now()).unwrap();

        assert_eq!(note.quote.as_deref(), Some("um trecho"));
        assert_eq!(note.page, Some(31));
        assert_eq!(note.comment, None);
    }

    #[test]
    fn item_note_with_page_and_comment_without_quote_is_valid() {
        let note = ItemNote::new(new_note(None, Some(9), Some("página escaneada")), now()).unwrap();

        assert_eq!(note.quote, None);
        assert_eq!(note.page, Some(9));
    }

    #[test]
    fn item_note_page_must_be_positive_and_text_limited() {
        assert!(ItemNote::new(new_note(Some("a"), Some(0), None), now()).is_err());
        let long = "x".repeat(5001);
        assert!(ItemNote::new(new_note(Some(&long), None, None), now()).is_err());
    }

    #[test]
    fn apply_cannot_remove_both_quote_and_comment() {
        let mut note = ItemNote::new(new_note(Some("trecho"), None, Some("c")), now()).unwrap();

        note.apply(
            ItemNoteChanges {
                comment: Some(None),
                ..ItemNoteChanges::default()
            },
            now(),
        )
        .unwrap();
        let result = note.apply(
            ItemNoteChanges {
                quote: Some(None),
                ..ItemNoteChanges::default()
            },
            now(),
        );

        assert!(result.is_err());
        assert_eq!(note.quote.as_deref(), Some("trecho"));
    }
}
