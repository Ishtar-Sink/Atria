//! Erros do contexto de tarefas, com códigos estáveis em inglês ([project/language-08]).

use std::error::Error as StdError;

/// Problema de validação de um campo, sem depender do formato HTTP.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FieldIssue {
    pub field: &'static str,
    pub code: &'static str,
}

#[derive(Debug, thiserror::Error)]
pub enum TasksError {
    #[error("tarefa não encontrada")]
    NotFound,
    #[error("a data não é uma ocorrência da tarefa")]
    OccurrenceNotFound,
    #[error("a tarefa recorrente exige a data da ocorrência")]
    OccurrenceDateRequired,
    #[error("a ocorrência é anterior a hoje")]
    OccurrenceInPast,
    #[error("a tarefa pontual não tem data de ocorrência")]
    OccurrenceDateNotAllowed,
    #[error("a tarefa já está concluída")]
    AlreadyCompleted,
    #[error("a tarefa não está concluída")]
    NotCompleted,
    #[error("dados inválidos")]
    Validation(Vec<FieldIssue>),
    #[error("falha no armazenamento das tarefas")]
    Storage(#[source] Box<dyn StdError + Send + Sync>),
}

impl TasksError {
    pub fn invalid(field: &'static str, code: &'static str) -> Self {
        Self::Validation(vec![FieldIssue { field, code }])
    }

    pub fn storage(cause: impl StdError + Send + Sync + 'static) -> Self {
        Self::Storage(Box::new(cause))
    }

    /// Código estável devolvido pela API.
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFound => "not_found",
            Self::OccurrenceNotFound => "occurrence_not_found",
            Self::OccurrenceDateRequired => "occurrence_date_required",
            Self::OccurrenceInPast => "occurrence_in_past",
            Self::OccurrenceDateNotAllowed | Self::Validation(_) => "validation_failed",
            Self::AlreadyCompleted => "task_already_completed",
            Self::NotCompleted => "task_not_completed",
            Self::Storage(_) => "internal_error",
        }
    }
}
