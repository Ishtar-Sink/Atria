//! Erros do contexto de lembretes, com códigos estáveis em inglês; viram
//! `problem+json` só na camada `interface` ([project/code-style-03]).

/// Problema de validação de um campo, com código estável.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FieldIssue {
    pub field: &'static str,
    pub code: &'static str,
}

impl FieldIssue {
    pub const fn new(field: &'static str, code: &'static str) -> Self {
        Self { field, code }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RemindersError {
    #[error("lembrete ou inscrição não encontrado")]
    NotFound,
    #[error("dados inválidos")]
    Validation(Vec<FieldIssue>),
    #[error("Web Push desligado")]
    WebPushDisabled,
    #[error("falha no armazenamento")]
    Storage(#[source] Box<dyn std::error::Error + Send + Sync>),
}

impl RemindersError {
    pub fn invalid(field: &'static str, code: &'static str) -> Self {
        Self::Validation(vec![FieldIssue::new(field, code)])
    }

    pub fn storage(cause: impl std::error::Error + Send + Sync + 'static) -> Self {
        Self::Storage(Box::new(cause))
    }

    #[cfg(test)]
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFound => "not_found",
            Self::Validation(_) => "validation_failed",
            Self::WebPushDisabled => "web_push_disabled",
            Self::Storage(_) => "internal_error",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_stable() {
        assert_eq!(RemindersError::NotFound.code(), "not_found");
        assert_eq!(
            RemindersError::invalid("title", "required").code(),
            "validation_failed"
        );
        assert_eq!(RemindersError::WebPushDisabled.code(), "web_push_disabled");
    }
}
