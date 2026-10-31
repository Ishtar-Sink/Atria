//! `Video` e os provedores oEmbed permitidos (CB-12).

use chrono::{DateTime, Utc};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::error::LibraryError;
use super::{FIELD_MAX_CHARS, TITLE_MAX_CHARS, normalize_tags, optional_text, web_url};
use crate::shared::visibility::Visibility;

const YOUTUBE_OEMBED: &str = "https://www.youtube.com/oembed";
const VIMEO_OEMBED: &str = "https://vimeo.com/api/oembed.json";
const YOUTUBE_HOSTS: [&str; 4] = [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
];

/// Status de exibição do vídeo (PD-35): Para assistir, Assistindo e Assistido.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum VideoStatus {
    #[default]
    ToWatch,
    Watching,
    Watched,
}

impl VideoStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ToWatch => "to_watch",
            Self::Watching => "watching",
            Self::Watched => "watched",
        }
    }

    pub fn parse(text: &str) -> Result<Self, LibraryError> {
        match text {
            "to_watch" => Ok(Self::ToWatch),
            "watching" => Ok(Self::Watching),
            "watched" => Ok(Self::Watched),
            _ => Err(LibraryError::validation("watch_status", "invalid")),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Video {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub url: String,
    pub title: Option<String>,
    /// Canal digitado pela pessoa (PD-37); o oEmbed não o preenche.
    pub channel: Option<String>,
    pub watch_status: VideoStatus,
    pub tags: Vec<String>,
    pub thumbnail_file_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewVideo {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub url: String,
    pub title: Option<String>,
    pub channel: Option<String>,
    pub watch_status: VideoStatus,
    pub tags: Vec<String>,
}

/// Mudanças parciais: `Some(None)` limpa o título ou o canal.
#[derive(Debug, Clone, Default)]
pub struct VideoChanges {
    pub url: Option<String>,
    pub title: Option<Option<String>>,
    pub channel: Option<Option<String>>,
    pub watch_status: Option<VideoStatus>,
    pub tags: Option<Vec<String>>,
    pub visibility: Option<Visibility>,
}

/// Endereço do oEmbed do provedor permitido (YouTube e Vimeo), só para URL `https`.
/// Qualquer outro endereço não tem busca de miniatura.
pub fn oembed_endpoint(video_url: &Url) -> Option<Url> {
    if video_url.scheme() != "https" {
        return None;
    }
    let host = video_url.host_str()?;
    let base = if YOUTUBE_HOSTS.contains(&host) {
        YOUTUBE_OEMBED
    } else if host == "vimeo.com" {
        VIMEO_OEMBED
    } else {
        return None;
    };
    let params = [("format", "json"), ("url", video_url.as_str())];
    Url::parse_with_params(base, params).ok()
}

impl Video {
    pub fn new(new: NewVideo, now: DateTime<Utc>) -> Result<Self, LibraryError> {
        Ok(Self {
            id: new.id,
            owner_id: new.owner_id,
            visibility: new.visibility,
            url: web_url(&new.url)?.to_string(),
            title: optional_text(new.title, "title", TITLE_MAX_CHARS)?,
            channel: optional_text(new.channel, "channel", FIELD_MAX_CHARS)?,
            watch_status: new.watch_status,
            tags: normalize_tags(new.tags)?,
            thumbnail_file_id: None,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn apply(&mut self, changes: VideoChanges, now: DateTime<Utc>) -> Result<(), LibraryError> {
        if let Some(url) = changes.url {
            self.url = web_url(&url)?.to_string();
        }
        if let Some(title) = changes.title {
            self.title = optional_text(title, "title", TITLE_MAX_CHARS)?;
        }
        if let Some(channel) = changes.channel {
            self.channel = optional_text(channel, "channel", FIELD_MAX_CHARS)?;
        }
        if let Some(status) = changes.watch_status {
            self.watch_status = status;
        }
        if let Some(tags) = changes.tags {
            self.tags = normalize_tags(tags)?;
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

    fn endpoint(url: &str) -> Option<Url> {
        oembed_endpoint(&Url::parse(url).unwrap())
    }

    #[test]
    fn youtube_and_vimeo_urls_have_oembed_endpoint() {
        for url in [
            "https://www.youtube.com/watch?v=abc",
            "https://youtube.com/watch?v=abc",
            "https://m.youtube.com/watch?v=abc",
            "https://youtu.be/abc",
        ] {
            let found = endpoint(url).unwrap();
            assert_eq!(found.host_str(), Some("www.youtube.com"), "{url}");
            assert_eq!(found.path(), "/oembed");
            let pairs: Vec<_> = found.query_pairs().collect();
            assert_eq!(pairs[0], ("format".into(), "json".into()));
            assert_eq!(pairs[1].0, "url");
            assert_eq!(pairs[1].1, Url::parse(url).unwrap().as_str());
        }
        let vimeo = endpoint("https://vimeo.com/12345").unwrap();
        assert_eq!(vimeo.host_str(), Some("vimeo.com"));
        assert_eq!(vimeo.path(), "/api/oembed.json");
    }

    #[test]
    fn other_hosts_have_no_oembed_endpoint() {
        assert!(endpoint("https://example.com/video").is_none());
        assert!(endpoint("https://youtube.com.evil.test/watch?v=a").is_none());
        assert!(endpoint("https://notyoutube.com/watch?v=a").is_none());
        assert!(endpoint("https://player.vimeo.com/video/1").is_none());
    }

    #[test]
    fn non_https_url_has_no_oembed_endpoint() {
        assert!(endpoint("http://www.youtube.com/watch?v=abc").is_none());
        assert!(endpoint("http://vimeo.com/123").is_none());
    }

    #[test]
    fn video_requires_web_url() {
        let new = |url: &str| NewVideo {
            id: Uuid::from_u128(1),
            owner_id: Uuid::from_u128(2),
            visibility: Visibility::Personal,
            url: url.to_owned(),
            title: None,
            channel: None,
            watch_status: VideoStatus::default(),
            tags: Vec::new(),
        };
        let now = "2026-11-01T12:00:00Z".parse().unwrap();

        assert!(Video::new(new("https://youtu.be/abc"), now).is_ok());
        assert!(Video::new(new("javascript:alert(1)"), now).is_err());
    }

    #[test]
    fn pd35_video_status_accepts_only_known_values() {
        assert_eq!(
            VideoStatus::parse("to_watch").unwrap(),
            VideoStatus::ToWatch
        );
        assert_eq!(
            VideoStatus::parse("watching").unwrap(),
            VideoStatus::Watching
        );
        assert_eq!(VideoStatus::parse("watched").unwrap(), VideoStatus::Watched);
        for invalid in ["to_read", "done", "Watched"] {
            assert!(VideoStatus::parse(invalid).is_err(), "{invalid}");
        }
        assert!(serde_json::from_str::<VideoStatus>("\"done\"").is_err());
        assert_eq!(VideoStatus::default(), VideoStatus::ToWatch);
    }

    #[test]
    fn pd37_video_channel_is_optional_and_limited_to_300_chars() {
        let new = |channel: Option<String>| NewVideo {
            id: Uuid::from_u128(1),
            owner_id: Uuid::from_u128(2),
            visibility: Visibility::Personal,
            url: "https://youtu.be/abc".to_owned(),
            title: None,
            channel,
            watch_status: VideoStatus::default(),
            tags: Vec::new(),
        };
        let now = "2026-11-01T12:00:00Z".parse().unwrap();

        let blank = Video::new(new(Some("   ".to_owned())), now).unwrap();
        let named = Video::new(new(Some(" Canal ".to_owned())), now).unwrap();
        let max = Video::new(new(Some("a".repeat(300))), now);
        let too_long = Video::new(new(Some("a".repeat(301))), now);

        assert_eq!(Video::new(new(None), now).unwrap().channel, None);
        assert_eq!(blank.channel, None);
        assert_eq!(named.channel.as_deref(), Some("Canal"));
        assert!(max.is_ok());
        assert!(too_long.is_err());
    }
}
