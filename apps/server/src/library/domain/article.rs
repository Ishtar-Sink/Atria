//! `Article` e o status de leitura (RN-22): sem barra de progresso.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::error::LibraryError;
use super::{FIELD_MAX_CHARS, normalize_tags, optional_text, required_title, web_url};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReadingStatus {
    #[default]
    ToRead,
    Reading,
    Read,
}

impl ReadingStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ToRead => "to_read",
            Self::Reading => "reading",
            Self::Read => "read",
        }
    }

    pub fn parse(text: &str) -> Result<Self, LibraryError> {
        match text {
            "to_read" => Ok(Self::ToRead),
            "reading" => Ok(Self::Reading),
            "read" => Ok(Self::Read),
            _ => Err(LibraryError::validation("reading_status", "invalid")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Article {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub title: String,
    pub url: Option<String>,
    pub author: Option<String>,
    pub source: Option<String>,
    pub tags: Vec<String>,
    pub reading_status: ReadingStatus,
    /// Capa enviada por upload (PD-36); formato de exibição 16:9, só como dica para a tela.
    pub cover_file_id: Option<Uuid>,
    pub pdf_file_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewArticle {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub title: String,
    pub url: Option<String>,
    pub author: Option<String>,
    pub source: Option<String>,
    pub tags: Vec<String>,
    pub reading_status: ReadingStatus,
}

/// Mudanças parciais: `Some(None)` limpa um campo opcional.
#[derive(Debug, Clone, Default)]
pub struct ArticleChanges {
    pub title: Option<String>,
    pub url: Option<Option<String>>,
    pub author: Option<Option<String>>,
    pub source: Option<Option<String>>,
    pub tags: Option<Vec<String>>,
    pub reading_status: Option<ReadingStatus>,
    pub visibility: Option<Visibility>,
}

fn validate_url(url: Option<String>) -> Result<Option<String>, LibraryError> {
    let Some(url) = url.filter(|url| !url.trim().is_empty()) else {
        return Ok(None);
    };
    web_url(&url).map(|parsed| Some(parsed.to_string()))
}

impl Article {
    pub fn new(new: NewArticle, now: DateTime<Utc>) -> Result<Self, LibraryError> {
        Ok(Self {
            id: new.id,
            owner_id: new.owner_id,
            visibility: new.visibility,
            title: required_title(&new.title)?,
            url: validate_url(new.url)?,
            author: optional_text(new.author, "author", FIELD_MAX_CHARS)?,
            source: optional_text(new.source, "source", FIELD_MAX_CHARS)?,
            tags: normalize_tags(new.tags)?,
            reading_status: new.reading_status,
            cover_file_id: None,
            pdf_file_id: None,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn apply(
        &mut self,
        changes: ArticleChanges,
        now: DateTime<Utc>,
    ) -> Result<(), LibraryError> {
        if let Some(title) = changes.title {
            self.title = required_title(&title)?;
        }
        if let Some(url) = changes.url {
            self.url = validate_url(url)?;
        }
        if let Some(author) = changes.author {
            self.author = optional_text(author, "author", FIELD_MAX_CHARS)?;
        }
        if let Some(source) = changes.source {
            self.source = optional_text(source, "source", FIELD_MAX_CHARS)?;
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
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> DateTime<Utc> {
        "2026-11-01T12:00:00Z".parse().unwrap()
    }

    fn new_article(url: Option<&str>) -> NewArticle {
        NewArticle {
            id: Uuid::from_u128(1),
            owner_id: Uuid::from_u128(2),
            visibility: Visibility::Personal,
            title: "Artigo".to_owned(),
            url: url.map(str::to_owned),
            author: None,
            source: None,
            tags: Vec::new(),
            reading_status: ReadingStatus::default(),
        }
    }

    #[test]
    fn reading_status_accepts_only_known_values() {
        assert_eq!(
            ReadingStatus::parse("to_read").unwrap(),
            ReadingStatus::ToRead
        );
        assert_eq!(
            ReadingStatus::parse("reading").unwrap(),
            ReadingStatus::Reading
        );
        assert_eq!(ReadingStatus::parse("read").unwrap(), ReadingStatus::Read);
        assert!(ReadingStatus::parse("abandoned").is_err());
        assert!(ReadingStatus::parse("Read").is_err());
        assert!(serde_json::from_str::<ReadingStatus>("\"done\"").is_err());
        assert_eq!(ReadingStatus::default(), ReadingStatus::ToRead);
    }

    #[test]
    fn new_article_starts_without_cover_or_pdf() {
        let article = Article::new(new_article(None), now()).unwrap();

        assert_eq!(article.cover_file_id, None);
        assert_eq!(article.pdf_file_id, None);
    }

    #[test]
    fn article_url_must_be_web_url_when_present() {
        assert!(Article::new(new_article(Some("https://example.com/a")), now()).is_ok());
        assert!(Article::new(new_article(None), now()).is_ok());
        assert!(Article::new(new_article(Some("javascript:x")), now()).is_err());
    }

    #[test]
    fn apply_updates_status_and_clears_url() {
        let mut article = Article::new(new_article(Some("https://example.com")), now()).unwrap();

        article
            .apply(
                ArticleChanges {
                    reading_status: Some(ReadingStatus::Read),
                    url: Some(None),
                    ..ArticleChanges::default()
                },
                now(),
            )
            .unwrap();

        assert_eq!(article.reading_status, ReadingStatus::Read);
        assert_eq!(article.url, None);
    }
}
