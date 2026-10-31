//! `Highlight`: trecho destacado no PDF, com cor e retângulos normalizados na página
//! (RF-69). O destaque guarda o arquivo em que foi feito (CB-19).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::error::LibraryError;
use super::{ItemRef, positive_page};

pub const HIGHLIGHT_TEXT_MAX_CHARS: usize = 5000;
pub const RECTS_MAX: usize = 50;
// Tolerância de ponto flutuante nas bordas do quadrado unitário.
const EPSILON: f64 = 1e-6;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum HighlightColor {
    Accent,
    Primary,
    Success,
    Warning,
    Info,
}

impl HighlightColor {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Accent => "accent",
            Self::Primary => "primary",
            Self::Success => "success",
            Self::Warning => "warning",
            Self::Info => "info",
        }
    }

    pub fn parse(text: &str) -> Result<Self, LibraryError> {
        match text {
            "accent" => Ok(Self::Accent),
            "primary" => Ok(Self::Primary),
            "success" => Ok(Self::Success),
            "warning" => Ok(Self::Warning),
            "info" => Ok(Self::Info),
            _ => Err(LibraryError::validation("color", "invalid")),
        }
    }
}

/// Retângulo em frações da página (0 a 1).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, ToSchema)]
pub struct HighlightRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl HighlightRect {
    fn is_within_unit_square(&self) -> bool {
        let finite = [self.x, self.y, self.width, self.height]
            .iter()
            .all(|value| value.is_finite());
        finite
            && self.x >= -EPSILON
            && self.y >= -EPSILON
            && self.width > 0.0
            && self.height > 0.0
            && self.x + self.width <= 1.0 + EPSILON
            && self.y + self.height <= 1.0 + EPSILON
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Highlight {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub item: ItemRef,
    pub file_id: Uuid,
    pub page: i32,
    pub color: HighlightColor,
    pub text: String,
    pub rects: Vec<HighlightRect>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct NewHighlight {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub item: ItemRef,
    pub file_id: Uuid,
    pub page: i32,
    pub color: HighlightColor,
    pub text: String,
    pub rects: Vec<HighlightRect>,
}

fn validate_rects(rects: &[HighlightRect]) -> Result<(), LibraryError> {
    if rects.is_empty() || rects.len() > RECTS_MAX {
        return Err(LibraryError::validation("rects", "out_of_range"));
    }
    if !rects.iter().all(HighlightRect::is_within_unit_square) {
        return Err(LibraryError::validation("rects", "invalid"));
    }
    Ok(())
}

impl Highlight {
    pub fn new(new: NewHighlight, now: DateTime<Utc>) -> Result<Self, LibraryError> {
        validate_rects(&new.rects)?;
        let text = new.text.trim().to_owned();
        if text.is_empty() {
            return Err(LibraryError::validation("text", "required"));
        }
        if text.chars().count() > HIGHLIGHT_TEXT_MAX_CHARS {
            return Err(LibraryError::validation("text", "too_long"));
        }
        Ok(Self {
            id: new.id,
            owner_id: new.owner_id,
            item: new.item,
            file_id: new.file_id,
            page: positive_page(new.page, "page")?,
            color: new.color,
            text,
            rects: new.rects,
            created_at: now,
        })
    }

    /// `true` quando o destaque foi feito no PDF atual do item; senão ele é de um
    /// arquivo trocado e continua listado, marcado como de outro arquivo (CB-19).
    pub fn is_from_current_file(&self, current_pdf: Option<Uuid>) -> bool {
        current_pdf == Some(self.file_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now() -> DateTime<Utc> {
        "2026-11-01T12:00:00Z".parse().unwrap()
    }

    fn rect(x: f64, y: f64, width: f64, height: f64) -> HighlightRect {
        HighlightRect {
            x,
            y,
            width,
            height,
        }
    }

    fn new_highlight(rects: Vec<HighlightRect>) -> NewHighlight {
        NewHighlight {
            id: Uuid::from_u128(1),
            owner_id: Uuid::from_u128(2),
            item: ItemRef::Book(Uuid::from_u128(3)),
            file_id: Uuid::from_u128(4),
            page: 42,
            color: HighlightColor::Accent,
            text: "trecho destacado".to_owned(),
            rects,
        }
    }

    #[test]
    fn highlight_color_accepts_only_palette() {
        for color in ["accent", "primary", "success", "warning", "info"] {
            assert_eq!(HighlightColor::parse(color).unwrap().as_str(), color);
        }
        assert!(HighlightColor::parse("red").is_err());
        assert!(serde_json::from_str::<HighlightColor>("\"Accent\"").is_err());
    }

    #[test]
    fn highlight_rects_must_be_within_unit_square() {
        let ok = vec![rect(0.12, 0.40, 0.60, 0.03)];
        assert!(Highlight::new(new_highlight(ok), now()).is_ok());
        for bad in [
            rect(-0.1, 0.2, 0.3, 0.1),
            rect(0.8, 0.2, 0.3, 0.1),
            rect(0.1, 0.95, 0.3, 0.1),
            rect(0.1, 0.1, 0.0, 0.1),
            rect(0.1, 0.1, f64::NAN, 0.1),
        ] {
            assert!(
                Highlight::new(new_highlight(vec![bad]), now()).is_err(),
                "{bad:?}"
            );
        }
    }

    #[test]
    fn highlight_requires_1_to_50_rects() {
        let one = rect(0.1, 0.1, 0.1, 0.1);

        assert!(Highlight::new(new_highlight(Vec::new()), now()).is_err());
        assert!(Highlight::new(new_highlight(vec![one; 50]), now()).is_ok());
        assert!(Highlight::new(new_highlight(vec![one; 51]), now()).is_err());
    }

    #[test]
    fn highlight_is_from_current_file_only_when_file_matches() {
        let highlight =
            Highlight::new(new_highlight(vec![rect(0.1, 0.1, 0.1, 0.1)]), now()).unwrap();

        assert!(highlight.is_from_current_file(Some(Uuid::from_u128(4))));
        assert!(!highlight.is_from_current_file(Some(Uuid::from_u128(5))));
        assert!(!highlight.is_from_current_file(None));
    }

    #[test]
    fn highlight_text_and_page_are_validated() {
        let mut blank = new_highlight(vec![rect(0.1, 0.1, 0.1, 0.1)]);
        blank.text = "  ".to_owned();
        let mut page = new_highlight(vec![rect(0.1, 0.1, 0.1, 0.1)]);
        page.page = 0;

        assert!(Highlight::new(blank, now()).is_err());
        assert!(Highlight::new(page, now()).is_err());
    }
}
