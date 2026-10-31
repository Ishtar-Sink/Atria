//! Domínio do contexto `auth`: contas, papéis, convites, redefinição de senha,
//! TOTP, preferências e configurações da instância. Sem axum nem sqlx.

pub mod error;
pub mod instance_settings;
pub mod invite;
pub mod password_reset;
pub mod preferences;
pub mod throttle;
pub mod totp;
pub mod user;
