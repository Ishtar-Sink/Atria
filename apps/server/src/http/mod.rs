//! Servidor HTTP: ponto de integração dos contextos (estado, roteador, sessão,
//! CSRF, cabeçalhos de segurança, IP do cliente, `/healthz` e frontend embutido).

pub mod client_ip;
pub mod config;
pub mod contexts;
pub mod csrf;
pub mod healthz;
pub mod openapi;
pub mod router;
pub mod security_headers;
pub mod session;
pub mod state;
pub mod static_files;
#[cfg(test)]
pub mod test_support;
#[cfg(test)]
mod tests;

pub use config::Config;
pub use router::build_router;
pub use session::{CurrentUser, end_user_session, start_user_session};
pub use state::AppState;
