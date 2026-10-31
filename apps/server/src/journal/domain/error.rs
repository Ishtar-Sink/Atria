//! Erros tipados do contexto do diário ([project/code-style-03]).

/// Falha de infraestrutura (banco, cifra), guardada sem acoplar o domínio ao `sqlx`.
pub type InfrastructureError = Box<dyn std::error::Error + Send + Sync>;

#[derive(Debug, thiserror::Error)]
pub enum JournalError {
    #[error("entrada do diário não encontrada")]
    EntryNotFound,
    #[error("emoção não encontrada")]
    EmotionNotFound,
    #[error("emoção desconhecida, de outra pessoa ou excluída")]
    UnknownEmotion,
    #[error("o texto da entrada é obrigatório")]
    TextRequired,
    #[error("o texto da entrada passa do limite de caracteres")]
    TextTooLong,
    #[error("a intensidade vai de 1 a 5")]
    InvalidIntensity,
    #[error("a mesma emoção aparece duas vezes na entrada")]
    DuplicateEmotion,
    #[error("já existe uma emoção com esse nome")]
    EmotionNameTaken,
    #[error("o nome da emoção precisa ter de 1 a 50 caracteres")]
    InvalidEmotionName,
    #[error("cursor de paginação inválido")]
    InvalidCursor,
    #[error("falha de infraestrutura")]
    Infrastructure(#[source] InfrastructureError),
}

impl JournalError {
    pub fn infrastructure(cause: impl Into<InfrastructureError>) -> Self {
        Self::Infrastructure(cause.into())
    }
}
