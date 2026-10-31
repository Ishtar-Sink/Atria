//! Erros tipados do contexto de ligações ([project/code-style-03]).

/// Falha de infraestrutura (banco), guardada sem acoplar o domínio ao `sqlx`.
pub type InfrastructureError = Box<dyn std::error::Error + Send + Sync>;

#[derive(Debug, thiserror::Error)]
pub enum LinkError {
    #[error("ligação não encontrada")]
    NotFound,
    #[error("não é possível ligar uma entidade a ela mesma")]
    SelfLink,
    #[error("tipo de entidade desconhecido")]
    UnknownEntityType,
    #[error("a ligação já existe")]
    AlreadyExists,
    #[error("cursor de paginação inválido")]
    InvalidCursor,
    #[error("falha de infraestrutura")]
    Infrastructure(#[source] InfrastructureError),
}

impl LinkError {
    pub fn infrastructure(cause: impl Into<InfrastructureError>) -> Self {
        Self::Infrastructure(cause.into())
    }
}
