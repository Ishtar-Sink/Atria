//! Erro tipado do contexto; a conversão em `problem+json` fica em `interface`.

use crate::shared::error::FieldError;

#[derive(Debug, thiserror::Error)]
pub enum GoalsError {
    /// Também para o dado de outro usuário: a existência não vaza.
    #[error("not_found")]
    NotFound,
    #[error("validation_failed")]
    Validation(Vec<FieldError>),
    #[error("internal_error: {0}")]
    Internal(String),
}

impl GoalsError {
    pub fn invalid(field: &str, code: &str) -> Self {
        Self::Validation(vec![FieldError::new(field, code)])
    }

    pub fn internal(error: impl std::fmt::Display) -> Self {
        Self::Internal(error.to_string())
    }
}
