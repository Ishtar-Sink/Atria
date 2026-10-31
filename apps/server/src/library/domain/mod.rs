//! Domínio do Acervo: regras puras, sem `sqlx`, `axum` nem storage.

pub mod article;
pub mod book;
pub mod error;
pub mod highlight;
pub mod item_note;
pub mod library_file;
pub mod reading_session;
pub mod video;

use uuid::Uuid;

use self::error::LibraryError;

pub const TITLE_MAX_CHARS: usize = 300;
pub const FIELD_MAX_CHARS: usize = 300;
pub const URL_MAX_CHARS: usize = 2048;
pub const TAG_MAX_CHARS: usize = 50;
pub const TAGS_MAX: usize = 30;

/// Item do Acervo a que uma nota, um destaque ou a posição de leitura pertence.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ItemRef {
    Book(Uuid),
    Article(Uuid),
    Video(Uuid),
}

impl ItemRef {
    /// O erro 404 do tipo do item.
    pub fn not_found(self) -> LibraryError {
        match self {
            Self::Book(_) => LibraryError::BookNotFound,
            Self::Article(_) => LibraryError::ArticleNotFound,
            Self::Video(_) => LibraryError::VideoNotFound,
        }
    }
}

/// Título obrigatório, aparado e com no máximo 300 caracteres.
pub(crate) fn required_title(title: &str) -> Result<String, LibraryError> {
    let trimmed = title.trim();
    if trimmed.is_empty() {
        return Err(LibraryError::validation("title", "required"));
    }
    if trimmed.chars().count() > TITLE_MAX_CHARS {
        return Err(LibraryError::validation("title", "too_long"));
    }
    Ok(trimmed.to_owned())
}

/// Texto opcional: aparado, vazio vira ausente, com limite de caracteres.
pub(crate) fn optional_text(
    value: Option<String>,
    field: &'static str,
    max_chars: usize,
) -> Result<Option<String>, LibraryError> {
    let Some(value) = value else {
        return Ok(None);
    };
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    if trimmed.chars().count() > max_chars {
        return Err(LibraryError::validation(field, "too_long"));
    }
    Ok(Some(trimmed.to_owned()))
}

/// Tags aparadas, sem vazias nem repetidas, na ordem recebida.
pub(crate) fn normalize_tags(tags: Vec<String>) -> Result<Vec<String>, LibraryError> {
    let mut normalized: Vec<String> = Vec::with_capacity(tags.len());
    for tag in tags {
        let tag = tag.trim().to_owned();
        if tag.is_empty() || normalized.contains(&tag) {
            continue;
        }
        if tag.chars().count() > TAG_MAX_CHARS {
            return Err(LibraryError::validation("tags", "too_long"));
        }
        normalized.push(tag);
    }
    if normalized.len() > TAGS_MAX {
        return Err(LibraryError::validation("tags", "too_many"));
    }
    Ok(normalized)
}

/// Página positiva (`last_read_page`, página da nota ou do destaque).
pub(crate) fn positive_page(page: i32, field: &'static str) -> Result<i32, LibraryError> {
    if page <= 0 {
        return Err(LibraryError::validation(field, "must_be_positive"));
    }
    Ok(page)
}

/// URL `http` ou `https` com até 2048 caracteres.
pub(crate) fn web_url(raw: &str) -> Result<reqwest::Url, LibraryError> {
    let trimmed = raw.trim();
    if trimmed.chars().count() > URL_MAX_CHARS {
        return Err(LibraryError::validation("url", "too_long"));
    }
    let url =
        reqwest::Url::parse(trimmed).map_err(|_| LibraryError::validation("url", "invalid"))?;
    if !matches!(url.scheme(), "http" | "https") || url.host_str().is_none() {
        return Err(LibraryError::validation("url", "invalid"));
    }
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tags_are_trimmed_and_deduplicated() {
        let tags = normalize_tags(vec![" a ".into(), "a".into(), "".into(), "b".into()]).unwrap();

        assert_eq!(tags, ["a", "b"]);
    }

    #[test]
    fn web_url_accepts_only_http_and_https() {
        assert!(web_url("https://example.com/a").is_ok());
        assert!(web_url("http://example.com").is_ok());
        assert!(web_url("javascript:alert(1)").is_err());
        assert!(web_url("ftp://example.com").is_err());
        assert!(web_url("nao é url").is_err());
    }

    #[test]
    fn optional_text_blank_becomes_none() {
        assert_eq!(optional_text(Some("  ".into()), "x", 5).unwrap(), None);
        assert!(optional_text(Some("abcdef".into()), "x", 5).is_err());
    }
}
