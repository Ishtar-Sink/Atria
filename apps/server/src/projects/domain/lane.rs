//! Raia do quadro: padrão do sistema (`system_key`, nome traduzido pelo frontend) ou
//! criada pela pessoa, com cor HEX livre (PD-12) e a marcação "conta como concluída" (PD-43).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::error::ProjectError;
use crate::shared::visibility::Visibility;

pub type LaneId = Uuid;

pub const LANE_NAME_MAX_CHARS: usize = 100;

/// Cor da raia: HEX `#rrggbb` livre (PD-12), sempre guardada em minúsculas.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LaneColor(String);

impl LaneColor {
    pub fn parse(text: &str) -> Result<Self, ProjectError> {
        let digits = text.strip_prefix('#').unwrap_or_default();
        if digits.len() != 6 || !digits.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(ProjectError::invalid("color", "invalid"));
        }
        Ok(Self(text.to_ascii_lowercase()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Raias que todo projeto novo recebe, nesta ordem (RF-55).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, ToSchema)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "text", rename_all = "snake_case")]
pub enum SystemLane {
    Waiting,
    InProgress,
    Done,
}

impl SystemLane {
    pub const DEFAULTS: [SystemLane; 3] = [Self::Waiting, Self::InProgress, Self::Done];

    /// HEX dos tokens `--warning`, `--primary` e `--success` do tema claro (protótipo).
    pub fn default_color(self) -> LaneColor {
        let hex = match self {
            Self::Waiting => "#92400e",
            Self::InProgress => "#6d28d9",
            Self::Done => "#047857",
        };
        LaneColor(hex.to_owned())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Lane {
    pub id: LaneId,
    pub project_id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub system_key: Option<SystemLane>,
    pub name: Option<String>,
    pub color: LaneColor,
    /// Os cartões desta raia entram no progresso do projeto (PD-43).
    pub counts_as_done: bool,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Nome da raia: 1 a 100 caracteres, sem espaços nas pontas.
pub fn validate_lane_name(name: &str) -> Result<String, ProjectError> {
    let name = name.trim();
    if name.is_empty() {
        return Err(ProjectError::invalid("name", "required"));
    }
    if name.chars().count() > LANE_NAME_MAX_CHARS {
        return Err(ProjectError::invalid("name", "too_long"));
    }
    Ok(name.to_owned())
}

impl Lane {
    /// Renomear nunca apaga o `system_key` da raia padrão.
    pub fn rename(&mut self, name: &str, now: DateTime<Utc>) -> Result<(), ProjectError> {
        self.name = Some(validate_lane_name(name)?);
        self.updated_at = now;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn system_lane() -> Lane {
        let now = DateTime::<Utc>::from_timestamp(1_793_534_400, 0).unwrap();
        Lane {
            id: Uuid::from_u128(1),
            project_id: Uuid::from_u128(2),
            owner_id: Uuid::from_u128(3),
            visibility: Visibility::Personal,
            system_key: Some(SystemLane::Waiting),
            name: None,
            color: LaneColor::parse("#92400e").unwrap(),
            counts_as_done: false,
            position: 0,
            created_at: now,
            updated_at: now,
        }
    }

    #[test]
    fn lane_color_accepts_only_hex_rrggbb() {
        let color = LaneColor::parse("#1A2b3C").unwrap();
        assert_eq!(color.as_str(), "#1a2b3c");
        for color in ["neutral", "#fff", "#12345g", "123456", "#1234567", ""] {
            assert!(
                matches!(LaneColor::parse(color), Err(ProjectError::Validation(_))),
                "{color}"
            );
        }
    }

    #[test]
    fn renaming_system_lane_keeps_system_key() {
        let mut lane = system_lane();
        let later = lane.updated_at + chrono::Duration::minutes(5);

        lane.rename("  A fazer  ", later).unwrap();

        assert_eq!(lane.name.as_deref(), Some("A fazer"));
        assert_eq!(lane.system_key, Some(SystemLane::Waiting));
        assert_eq!(lane.updated_at, later);
    }

    #[test]
    fn lane_name_limited_to_100_chars() {
        let mut lane = system_lane();
        let now = lane.updated_at;

        assert!(lane.rename(&"é".repeat(100), now).is_ok());
        assert!(matches!(
            lane.rename(&"é".repeat(101), now),
            Err(ProjectError::Validation(_))
        ));
        assert!(matches!(
            lane.rename("   ", now),
            Err(ProjectError::Validation(_))
        ));
    }
}
