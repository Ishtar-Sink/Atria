//! Erros do contexto. A conversão em `problem+json` fica na camada `interface`
//! ([project/code-style-03]); os códigos são estáveis e em inglês ([project/language-08]).

use crate::shared::error::FieldError;

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("credenciais inválidas")]
    InvalidCredentials,
    #[error("código TOTP obrigatório")]
    TotpRequired,
    #[error("código TOTP inválido")]
    InvalidTotpCode,
    #[error("convite inválido")]
    InviteInvalid,
    #[error("convite obrigatório")]
    InviteRequired,
    #[error("token de redefinição inválido")]
    ResetTokenInvalid,
    #[error("o assistente de primeira execução já foi concluído")]
    SetupAlreadyDone,
    #[error("o assistente de primeira execução ainda não foi concluído")]
    SetupRequired,
    #[error("sem autenticação")]
    Unauthenticated,
    #[error("sem permissão")]
    Forbidden,
    #[error("o 2FA já está ativo")]
    TotpAlreadyEnabled,
    #[error("o 2FA não foi iniciado")]
    TotpNotStarted,
    #[error("usuário não encontrado")]
    UserNotFound,
    #[error("tentativas demais; tente de novo em {retry_after_seconds} s")]
    TooManyAttempts { retry_after_seconds: i64 },
    #[error("dados inválidos")]
    Validation(Vec<FieldError>),
    #[error("falha interna: {0}")]
    Internal(String),
}

impl AuthError {
    /// Erro de validação de um único campo.
    pub fn invalid_field(field: &str, code: &str) -> Self {
        Self::Validation(vec![FieldError::new(field, code)])
    }
}
