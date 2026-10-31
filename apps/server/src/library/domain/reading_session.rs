//! `ReadingSession`: páginas lidas num dia, com intervalo de páginas opcional (RF-48,
//! RF-67). Passar do total do livro é aceito; o progresso é que para em 100% (CB-05).

use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

use super::error::LibraryError;
use super::optional_text;

pub const OBSERVATION_MAX_CHARS: usize = 2000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReadingSession {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub book_id: Uuid,
    pub read_on: NaiveDate,
    pub pages_read: i32,
    pub from_page: Option<i32>,
    pub to_page: Option<i32>,
    pub observation: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewReadingSession {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub book_id: Uuid,
    pub read_on: NaiveDate,
    pub pages_read: i32,
    pub from_page: Option<i32>,
    pub to_page: Option<i32>,
    pub observation: Option<String>,
}

/// Mudanças parciais: `Some(None)` limpa um campo opcional.
#[derive(Debug, Clone, Default)]
pub struct SessionChanges {
    pub read_on: Option<NaiveDate>,
    pub pages_read: Option<i32>,
    pub from_page: Option<Option<i32>>,
    pub to_page: Option<Option<i32>>,
    pub observation: Option<Option<String>>,
}

fn validate_pages(pages_read: i32) -> Result<i32, LibraryError> {
    if pages_read <= 0 {
        return Err(LibraryError::validation("pages_read", "must_be_positive"));
    }
    Ok(pages_read)
}

/// O intervalo vem inteiro ou não vem: páginas positivas e `to_page` depois de `from_page`.
fn validate_range(
    from_page: Option<i32>,
    to_page: Option<i32>,
) -> Result<(Option<i32>, Option<i32>), LibraryError> {
    match (from_page, to_page) {
        (None, None) => Ok((None, None)),
        (Some(from), Some(to)) => {
            if from <= 0 {
                return Err(LibraryError::validation("from_page", "must_be_positive"));
            }
            if to <= from {
                return Err(LibraryError::validation(
                    "to_page",
                    "must_be_after_from_page",
                ));
            }
            Ok((Some(from), Some(to)))
        }
        (Some(_), None) => Err(LibraryError::validation("to_page", "required")),
        (None, Some(_)) => Err(LibraryError::validation("from_page", "required")),
    }
}

impl ReadingSession {
    pub fn new(new: NewReadingSession, now: DateTime<Utc>) -> Result<Self, LibraryError> {
        let (from_page, to_page) = validate_range(new.from_page, new.to_page)?;
        Ok(Self {
            id: new.id,
            owner_id: new.owner_id,
            book_id: new.book_id,
            read_on: new.read_on,
            pages_read: validate_pages(new.pages_read)?,
            from_page,
            to_page,
            observation: optional_text(new.observation, "observation", OBSERVATION_MAX_CHARS)?,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn apply(
        &mut self,
        changes: SessionChanges,
        now: DateTime<Utc>,
    ) -> Result<(), LibraryError> {
        let (from_page, to_page) = validate_range(
            changes.from_page.unwrap_or(self.from_page),
            changes.to_page.unwrap_or(self.to_page),
        )?;
        if let Some(read_on) = changes.read_on {
            self.read_on = read_on;
        }
        if let Some(pages_read) = changes.pages_read {
            self.pages_read = validate_pages(pages_read)?;
        }
        if let Some(observation) = changes.observation {
            self.observation = optional_text(observation, "observation", OBSERVATION_MAX_CHARS)?;
        }
        self.from_page = from_page;
        self.to_page = to_page;
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

    fn new_session(pages: i32, from: Option<i32>, to: Option<i32>) -> NewReadingSession {
        NewReadingSession {
            id: Uuid::from_u128(1),
            owner_id: Uuid::from_u128(2),
            book_id: Uuid::from_u128(3),
            read_on: "2026-10-26".parse().unwrap(),
            pages_read: pages,
            from_page: from,
            to_page: to,
            observation: None,
        }
    }

    #[test]
    fn session_pages_must_be_positive() {
        assert!(ReadingSession::new(new_session(0, None, None), now()).is_err());
        assert!(ReadingSession::new(new_session(-1, None, None), now()).is_err());
        assert!(ReadingSession::new(new_session(1, None, None), now()).is_ok());
    }

    #[test]
    fn session_range_requires_to_after_from() {
        assert!(ReadingSession::new(new_session(22, Some(40), Some(62)), now()).is_ok());
        assert!(ReadingSession::new(new_session(5, Some(62), Some(40)), now()).is_err());
        assert!(ReadingSession::new(new_session(5, Some(40), Some(40)), now()).is_err());
        assert!(ReadingSession::new(new_session(5, Some(40), None), now()).is_err());
        assert!(ReadingSession::new(new_session(5, None, Some(40)), now()).is_err());
    }

    #[test]
    fn session_beyond_total_is_accepted() {
        // O domínio da sessão não conhece o total do livro: CB-05.
        assert!(ReadingSession::new(new_session(100_000, None, None), now()).is_ok());
    }

    #[test]
    fn pd60_session_with_only_pages_and_date_is_valid() {
        let session = ReadingSession::new(new_session(50, None, None), now()).unwrap();

        assert_eq!(session.pages_read, 50);
        assert_eq!(session.from_page, None);
        assert_eq!(session.to_page, None);
    }

    #[test]
    fn apply_edits_pages_and_observation() {
        let mut session = ReadingSession::new(new_session(20, None, None), now()).unwrap();

        session
            .apply(
                SessionChanges {
                    pages_read: Some(25),
                    observation: Some(Some("  boa  ".to_owned())),
                    ..SessionChanges::default()
                },
                now(),
            )
            .unwrap();

        assert_eq!(session.pages_read, 25);
        assert_eq!(session.observation.as_deref(), Some("boa"));
        assert!(
            session
                .apply(
                    SessionChanges {
                        pages_read: Some(0),
                        ..SessionChanges::default()
                    },
                    now()
                )
                .is_err()
        );
    }
}
