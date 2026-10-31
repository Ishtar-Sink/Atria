//! Estado compartilhado por todos os handlers.

use std::sync::Arc;
use std::time::Duration;

use axum::extract::FromRef;
use sqlx::PgPool;

use crate::http::Config;
use crate::shared::clock::Clock;
use crate::shared::crypto::FieldCipher;
use crate::shared::ids::IdGenerator;
use crate::storage::FileStorage;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Arc<Config>,
    pub clock: Arc<dyn Clock>,
    pub ids: Arc<dyn IdGenerator>,
    pub cipher: Arc<FieldCipher>,
    pub storage: Arc<dyn FileStorage>,
    pub http_client: reqwest::Client,
}

impl FromRef<AppState> for PgPool {
    fn from_ref(state: &AppState) -> Self {
        state.pool.clone()
    }
}

impl FromRef<AppState> for Arc<Config> {
    fn from_ref(state: &AppState) -> Self {
        state.config.clone()
    }
}

/// Cliente HTTP de saída (oEmbed), com tempo limite e identificação própria.
pub fn build_http_client() -> Result<reqwest::Client, reqwest::Error> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent(concat!("atria/", env!("CARGO_PKG_VERSION")))
        .build()
}
