//! Envio do e-mail de redefinição por SMTP com `lettre`.

use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

use crate::auth::application::ports::{Mail, MailError, MailFuture, MailSender, SmtpSettings};

/// Porta do SMTP com TLS implícito; as demais usam STARTTLS.
const IMPLICIT_TLS_PORT: u16 = 465;

#[derive(Debug, Default, Clone, Copy)]
pub struct SmtpMailSender;

impl MailSender for SmtpMailSender {
    fn send<'a>(&'a self, smtp: &'a SmtpSettings, mail: &'a Mail) -> MailFuture<'a> {
        Box::pin(deliver(smtp, mail))
    }
}

async fn deliver(smtp: &SmtpSettings, mail: &Mail) -> Result<(), MailError> {
    let from = smtp.from.as_deref().ok_or(MailError::MissingSender)?;
    let message = Message::builder()
        .from(from.parse().map_err(|_| MailError::InvalidAddress)?)
        .to(mail.to.parse().map_err(|_| MailError::InvalidAddress)?)
        .subject(mail.subject.as_str())
        .header(ContentType::TEXT_PLAIN)
        .body(mail.body.clone())
        .map_err(|_| MailError::InvalidAddress)?;
    let builder = if smtp.port == IMPLICIT_TLS_PORT {
        AsyncSmtpTransport::<Tokio1Executor>::relay(&smtp.host)
    } else {
        AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&smtp.host)
    }
    .map_err(|_| MailError::Transport)?;
    let builder = builder.port(smtp.port);
    let transport = match (&smtp.user, &smtp.password) {
        (Some(user), Some(password)) => builder
            .credentials(Credentials::new(user.clone(), password.clone()))
            .build(),
        _ => builder.build(),
    };
    transport
        .send(message)
        .await
        .map(|_| ())
        .map_err(|_| MailError::Transport)
}
