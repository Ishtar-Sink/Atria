//! Erros tipados do contexto de notas ([project/code-style-03]).

/// Falha de infraestrutura (banco, cifra), guardada sem acoplar o domínio ao `sqlx`.
pub type InfrastructureError = Box<dyn std::error::Error + Send + Sync>;

#[derive(Debug, thiserror::Error)]
pub enum NoteError {
    #[error("nota não encontrada")]
    NotFound,
    #[error("o título é obrigatório")]
    TitleRequired,
    #[error("o título passa do limite de caracteres")]
    TitleTooLong,
    #[error("o corpo passa do limite de caracteres")]
    BodyTooLong,
    #[error("a nota foi excluída")]
    Deleted,
    #[error("cursor de paginação inválido")]
    InvalidCursor,
    #[error("falha de infraestrutura")]
    Infrastructure(#[source] InfrastructureError),
}

impl NoteError {
    pub fn infrastructure(cause: impl Into<InfrastructureError>) -> Self {
        Self::Infrastructure(cause.into())
    }
}
