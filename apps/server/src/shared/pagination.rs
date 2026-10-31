//! Paginação por cursor opaco em base64url, igual em todas as listagens
//! ([project/api-04]).

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

pub const DEFAULT_LIMIT: u32 = 50;
pub const MAX_LIMIT: u32 = 100;

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
#[error("cursor inválido")]
pub struct InvalidCursor;

/// Posição na listagem: a chave de ordenação e o id desempatam a ordem.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Cursor {
    pub sort_key: String,
    pub id: Uuid,
}

impl Cursor {
    pub fn new(sort_key: impl Into<String>, id: Uuid) -> Self {
        Self {
            sort_key: sort_key.into(),
            id,
        }
    }

    pub fn encode(&self) -> String {
        let json = serde_json::to_vec(self).unwrap_or_default();
        URL_SAFE_NO_PAD.encode(json)
    }

    pub fn decode(text: &str) -> Result<Self, InvalidCursor> {
        let bytes = URL_SAFE_NO_PAD.decode(text).map_err(|_| InvalidCursor)?;
        serde_json::from_slice(&bytes).map_err(|_| InvalidCursor)
    }
}

#[derive(Debug, Clone, Default, Deserialize, IntoParams, ToSchema)]
#[into_params(parameter_in = Query)]
pub struct PageParams {
    pub cursor: Option<String>,
    pub limit: Option<u32>,
}

impl PageParams {
    pub fn limit(&self) -> u32 {
        self.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT)
    }

    pub fn cursor(&self) -> Result<Option<Cursor>, InvalidCursor> {
        self.cursor.as_deref().map(Cursor::decode).transpose()
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cursor() -> Cursor {
        Cursor::new("2026-11-01T12:00:00Z", Uuid::from_u128(42))
    }

    #[test]
    fn cursor_round_trips_as_base64url() {
        let encoded = cursor().encode();

        assert!(
            encoded
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
        );
        assert_eq!(Cursor::decode(&encoded), Ok(cursor()));
    }

    #[test]
    fn rejects_tampered_cursor() {
        let mut encoded = cursor().encode();
        encoded.insert(3, '!');

        assert_eq!(Cursor::decode(&encoded), Err(InvalidCursor));
        assert_eq!(
            Cursor::decode(&URL_SAFE_NO_PAD.encode("{}")),
            Err(InvalidCursor)
        );
        let params = PageParams {
            cursor: Some("nao-e-cursor".to_owned()),
            limit: None,
        };
        assert_eq!(params.cursor(), Err(InvalidCursor));
    }

    #[test]
    fn limit_is_clamped_between_1_and_100() {
        let with = |limit| PageParams {
            cursor: None,
            limit,
        };

        assert_eq!(with(None).limit(), 50);
        assert_eq!(with(Some(0)).limit(), 1);
        assert_eq!(with(Some(30)).limit(), 30);
        assert_eq!(with(Some(1000)).limit(), 100);
    }

    #[test]
    fn page_serializes_items_and_next_cursor() {
        let page = Page {
            items: vec![1, 2],
            next_cursor: Some(cursor().encode()),
        };

        let json = serde_json::to_value(&page).unwrap();

        assert_eq!(json["items"], serde_json::json!([1, 2]));
        assert_eq!(json["next_cursor"], cursor().encode());
    }
}
