//! `Book` e o progresso de leitura (RN-14, CB-05).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::error::LibraryError;
use super::{FIELD_MAX_CHARS, normalize_tags, optional_text, required_title};
use crate::shared::visibility::Visibility;

/// Status de leitura do livro (PD-35): Quero ler, Lendo e Lido.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum BookStatus {
    #[default]
    WantToRead,
    Reading,
    Read,
}

impl BookStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::WantToRead => "want_to_read",
            Self::Reading => "reading",
            Self::Read => "read",
        }
    }

    pub fn parse(text: &str) -> Result<Self, LibraryError> {
        match text {
            "want_to_read" => Ok(Self::WantToRead),
            "reading" => Ok(Self::Reading),
            "read" => Ok(Self::Read),
            _ => Err(LibraryError::validation("reading_status", "invalid")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Book {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub title: String,
    pub author: Option<String>,
    pub publisher: Option<String>,
    pub page_count: Option<i32>,
    pub tags: Vec<String>,
    pub reading_status: BookStatus,
    pub cover_file_id: Option<Uuid>,
    pub pdf_file_id: Option<Uuid>,
    /// Soma das páginas das sessões, calculada na leitura; nunca gravada.
    pub pages_read_total: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewBook {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub title: String,
    pub author: Option<String>,
    pub publisher: Option<String>,
    pub page_count: Option<i32>,
    pub tags: Vec<String>,
    pub reading_status: BookStatus,
}

/// Mudanças parciais: `Some(None)` limpa um campo opcional.
#[derive(Debug, Clone, Default)]
pub struct BookChanges {
    pub title: Option<String>,
    pub author: Option<Option<String>>,
    pub publisher: Option<Option<String>>,
    pub page_count: Option<Option<i32>>,
    pub tags: Option<Vec<String>>,
    pub reading_status: Option<BookStatus>,
    pub visibility: Option<Visibility>,
}

fn validate_page_count(page_count: Option<i32>) -> Result<Option<i32>, LibraryError> {
    match page_count {
        Some(count) if count <= 0 => {
            Err(LibraryError::validation("page_count", "must_be_positive"))
        }
        other => Ok(other),
    }
}

/// `progress_percent = (min(lidas, total) * 1000 / total) / 10`, em inteiros, com
/// uma casa decimal: 55 de 200 páginas dão 27.5.
pub fn progress_percent(pages_read_total: i64, page_count: i32) -> f64 {
    let total = i64::from(page_count.max(1));
    let tenths = pages_read_total.max(0).min(total) * 1000 / total;
    tenths as f64 / 10.0
}

impl Book {
    pub fn new(new: NewBook, now: DateTime<Utc>) -> Result<Self, LibraryError> {
        Ok(Self {
            id: new.id,
            owner_id: new.owner_id,
            visibility: new.visibility,
            title: required_title(&new.title)?,
            author: optional_text(new.author, "author", FIELD_MAX_CHARS)?,
            publisher: optional_text(new.publisher, "publisher", FIELD_MAX_CHARS)?,
            page_count: validate_page_count(new.page_count)?,
            tags: normalize_tags(new.tags)?,
            reading_status: new.reading_status,
            cover_file_id: None,
            pdf_file_id: None,
            pages_read_total: 0,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn apply(&mut self, changes: BookChanges, now: DateTime<Utc>) -> Result<(), LibraryError> {
        if let Some(title) = changes.title {
            self.title = required_title(&title)?;
        }
        if let Some(author) = changes.author {
            self.author = optional_text(author, "author", FIELD_MAX_CHARS)?;
        }
        if let Some(publisher) = changes.publisher {
            self.publisher = optional_text(publisher, "publisher", FIELD_MAX_CHARS)?;
        }
        if let Some(page_count) = changes.page_count {
            self.page_count = validate_page_count(page_count)?;
        }
        if let Some(tags) = changes.tags {
            self.tags = normalize_tags(tags)?;
        }
        if let Some(status) = changes.reading_status {
            self.reading_status = status;
        }
        if let Some(visibility) = changes.visibility {
            self.visibility = visibility;
        }
        self.updated_at = now;
        Ok(())
    }

    /// Só livros têm progresso (RN-14, RN-22); sem total de páginas não há como calcular.
    pub fn progress_percent(&self) -> Option<f64> {
        self.page_count
            .map(|count| progress_percent(self.pages_read_total, count))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn new_book(title: &str, page_count: Option<i32>) -> NewBook {
        NewBook {
            id: Uuid::from_u128(1),
            owner_id: Uuid::from_u128(2),
            visibility: Visibility::Personal,
            title: title.to_owned(),
            author: None,
            publisher: None,
            page_count,
            tags: Vec::new(),
            reading_status: BookStatus::default(),
        }
    }

    fn now() -> DateTime<Utc> {
        "2026-11-01T12:00:00Z".parse().unwrap()
    }

    #[test]
    fn progress_is_sum_of_pages_over_total() {
        let mut book = Book::new(new_book("Livro", Some(200)), now()).unwrap();
        book.pages_read_total = 100;

        assert_eq!(book.progress_percent(), Some(50.0));
    }

    #[test]
    fn progress_has_one_decimal_27_5() {
        assert_eq!(progress_percent(55, 200), 27.5);
        assert_eq!(progress_percent(1, 3), 33.3);
    }

    #[test]
    fn progress_is_capped_at_100_percent() {
        assert_eq!(progress_percent(250, 100), 100.0);
        assert_eq!(progress_percent(100, 100), 100.0);
    }

    #[test]
    fn progress_is_absent_without_page_count() {
        let book = Book::new(new_book("Livro", None), now()).unwrap();

        assert_eq!(book.progress_percent(), None);
    }

    #[test]
    fn page_count_must_be_positive() {
        assert!(Book::new(new_book("Livro", Some(0)), now()).is_err());
        assert!(Book::new(new_book("Livro", Some(-5)), now()).is_err());
        let mut book = Book::new(new_book("Livro", Some(10)), now()).unwrap();
        let changes = BookChanges {
            page_count: Some(Some(0)),
            ..BookChanges::default()
        };

        assert!(book.apply(changes, now()).is_err());
    }

    #[test]
    fn title_is_required() {
        assert!(matches!(
            Book::new(new_book("   ", None), now()),
            Err(LibraryError::Validation {
                field: "title",
                code: "required"
            })
        ));
        let too_long = "a".repeat(301);
        assert!(Book::new(new_book(&too_long, None), now()).is_err());
    }

    #[test]
    fn apply_clears_optional_fields() {
        let mut new = new_book("Livro", Some(10));
        new.author = Some("Autora".to_owned());
        let mut book = Book::new(new, now()).unwrap();

        book.apply(
            BookChanges {
                author: Some(None),
                title: Some(" Novo ".to_owned()),
                ..BookChanges::default()
            },
            now(),
        )
        .unwrap();

        assert_eq!(book.author, None);
        assert_eq!(book.title, "Novo");
    }

    #[test]
    fn pd35_book_status_accepts_only_known_values() {
        assert_eq!(
            BookStatus::parse("want_to_read").unwrap(),
            BookStatus::WantToRead
        );
        assert_eq!(BookStatus::parse("reading").unwrap(), BookStatus::Reading);
        assert_eq!(BookStatus::parse("read").unwrap(), BookStatus::Read);
        for invalid in ["wishlist", "finished", "to_read", "Read"] {
            assert!(BookStatus::parse(invalid).is_err(), "{invalid}");
        }
        assert!(serde_json::from_str::<BookStatus>("\"wishlist\"").is_err());
        assert_eq!(BookStatus::default(), BookStatus::WantToRead);
        let book = Book::new(new_book("Livro", None), now()).unwrap();
        assert_eq!(book.reading_status, BookStatus::WantToRead);
    }
}
