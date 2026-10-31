//! Contexto de lembretes: lembretes pontuais e recorrentes, os próximos disparos
//! para a aba aberta notificar e o Web Push opcional (RF-40, RF-41, RF-42).

pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod interface;
#[cfg(test)]
mod tests;

use std::sync::Arc;
use std::time::Duration;

use crate::http::AppState;
use crate::reminders::application::dispatcher::Dispatcher;
use crate::reminders::application::ports::PushSender;
use crate::reminders::infrastructure::pg_schedule::PgScheduleQueue;
use crate::reminders::infrastructure::web_push_sender::{WebPushSender, vapid_key};

// Interface pública do contexto para a integração do servidor (TASK-18); até lá,
// os reexports não têm uso dentro do crate.
#[allow(unused_imports)]
pub use crate::reminders::application::ports::{EntityDeletedHook, WebPushPolicy};
#[allow(unused_imports)]
pub use crate::reminders::interface::openapi::RemindersApi;

/// Intervalo entre as rodadas de disparo.
const DISPATCH_INTERVAL: Duration = Duration::from_secs(30);

pub fn router() -> axum::Router<AppState> {
    interface::router()
}

pub fn migrator() -> sqlx::migrate::Migrator {
    sqlx::migrate!("src/reminders/migrations")
}

/// Laço de disparo, iniciado pela integração do servidor (TASK-18). Uma rodada com
/// erro só é registrada no log: o laço nunca encerra por ela.
pub async fn run_dispatcher(state: AppState, policy: Arc<dyn WebPushPolicy>) {
    let dispatcher = Dispatcher {
        queue: Arc::new(PgScheduleQueue::new(state.pool.clone())),
        sender: push_sender(&state),
        policy: Some(policy),
        ids: state.ids.clone(),
    };
    let mut interval = tokio::time::interval(DISPATCH_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        interval.tick().await;
        if let Err(error) = dispatcher.dispatch_due(state.clock.now()).await {
            tracing::warn!(error = %error, "falha na rodada de disparo dos lembretes");
        }
    }
}

/// Sem chave VAPID (ou com ela ilegível), o Web Push fica desligado e o lembrete
/// continua aparecendo no app.
fn push_sender(state: &AppState) -> Option<Arc<dyn PushSender>> {
    match vapid_key(&state.config) {
        Ok(Some(key)) => Some(Arc::new(WebPushSender::new(
            key,
            state.config.public_url.clone(),
        ))),
        Ok(None) => None,
        Err(error) => {
            tracing::warn!(error = %error, "chave VAPID indisponível; Web Push desligado");
            None
        }
    }
}
