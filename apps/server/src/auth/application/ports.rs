//! Portas do contexto: o que a aplicação precisa do mundo de fora. O Argon2 e o SMTP
//! ficam em `infrastructure`; os testes trocam o envio de e-mail por uma versão em memória.

use std::future::Future;
use std::pin::Pin;

use crate::auth::domain::error::AuthError;

/// Hash de senha ([project/security-01]).
pub trait PasswordHasher: Send + Sync {
    fn hash(&self, password: &str) -> Result<String, AuthError>;
    fn verify(&self, password: &str, hash: &str) -> bool;
    /// Gasta o mesmo tempo de uma verificação quando a conta não existe.
    fn verify_dummy(&self, password: &str);
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Mail {
    pub to: String,
    pub subject: String,
    pub body: String,
}

/// SMTP efetivo: configurações da instância sobre as variáveis `ATRIA_SMTP_*`; a
/// senha vem só do ambiente.
#[derive(Clone, PartialEq, Eq)]
pub struct SmtpSettings {
    pub host: String,
    pub port: u16,
    pub user: Option<String>,
    pub password: Option<String>,
    pub from: Option<String>,
}

impl std::fmt::Debug for SmtpSettings {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SmtpSettings")
            .field("host", &self.host)
            .field("port", &self.port)
            .field("from", &self.from)
            .finish_non_exhaustive()
    }
}

#[derive(Debug, thiserror::Error)]
pub enum MailError {
    #[error("remetente do SMTP não configurado")]
    MissingSender,
    #[error("endereço de e-mail inválido")]
    InvalidAddress,
    #[error("falha no envio por SMTP")]
    Transport,
}

pub type MailFuture<'a> = Pin<Box<dyn Future<Output = Result<(), MailError>> + Send + 'a>>;

/// Sem `async_trait`: devolve a future em caixa para ser usado como `Arc<dyn MailSender>`.
pub trait MailSender: Send + Sync {
    fn send<'a>(&'a self, smtp: &'a SmtpSettings, mail: &'a Mail) -> MailFuture<'a>;
}
