//! Erros tipados do Acervo ([project/code-style-03]); só a camada `interface` os
//! converte em `problem+json`.

/// Falha de infraestrutura (banco, storage), guardada sem acoplar o domínio ao `sqlx`.
pub type InfrastructureError = Box<dyn std::error::Error + Send + Sync>;

#[derive(Debug, thiserror::Error)]
pub enum LibraryError {
    #[error("livro não encontrado")]
    BookNotFound,
    #[error("artigo não encontrado")]
    ArticleNotFound,
    #[error("vídeo não encontrado")]
    VideoNotFound,
    #[error("arquivo não encontrado")]
    FileNotFound,
    #[error("sessão de leitura não encontrada")]
    ReadingSessionNotFound,
    #[error("nota do item não encontrada")]
    ItemNoteNotFound,
    #[error("destaque não encontrado")]
    HighlightNotFound,
    #[error("o item não tem capa")]
    CoverNotFound,
    #[error("o item não tem PDF anexado")]
    PdfRequired,
    #[error("o destaque não é do PDF atual do item")]
    HighlightFileMismatch,
    #[error("tipo de arquivo não aceito")]
    UnsupportedFileType,
    #[error("arquivo acima do limite de tamanho")]
    FileTooLarge,
    #[error("campo inválido: {field} ({code})")]
    Validation {
        field: &'static str,
        code: &'static str,
    },
    #[error("cursor de paginação inválido")]
    InvalidCursor,
    #[error("falha de infraestrutura")]
    Infrastructure(#[source] InfrastructureError),
}

impl LibraryError {
    pub fn validation(field: &'static str, code: &'static str) -> Self {
        Self::Validation { field, code }
    }

    pub fn infrastructure(cause: impl Into<InfrastructureError>) -> Self {
        Self::Infrastructure(cause.into())
    }
}
