//! Erro tipado do contexto; a conversão em `problem+json` fica em `interface`.

use crate::shared::error::FieldError;

#[derive(Debug, thiserror::Error)]
pub enum ProjectError {
    /// Também para o projeto de outro usuário: a existência não vaza.
    #[error("project_not_found")]
    ProjectNotFound,
    #[error("lane_not_found")]
    LaneNotFound,
    #[error("card_not_found")]
    CardNotFound,
    /// Um projeto nunca fica sem raia (RN-16, CB-08).
    #[error("last_lane")]
    LastLane,
    /// Excluir raia com cartões pede a raia de destino (CB-07).
    #[error("lane_has_cards")]
    LaneHasCards,
    #[error("invalid_target_lane")]
    InvalidTargetLane,
    #[error("invalid_lane_order")]
    InvalidLaneOrder,
    #[error("validation_failed")]
    Validation(Vec<FieldError>),
    #[error("internal_error: {0}")]
    Internal(String),
}

impl ProjectError {
    pub fn invalid(field: &str, code: &str) -> Self {
        Self::Validation(vec![FieldError::new(field, code)])
    }

    pub fn internal(error: impl std::fmt::Display) -> Self {
        Self::Internal(error.to_string())
    }
}
