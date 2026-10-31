//! Disparo dos lembretes vencidos: cada ocorrência é entregue uma única vez e, com o
//! Web Push ligado, enviada a cada inscrição do dono (RF-42, CT-25).

use std::sync::Arc;

use chrono::{DateTime, Duration, Utc};

use crate::reminders::application::ports::{
    ClaimedReminder, PushSendError, PushSender, ScheduleQueue, WebPushPolicy,
};
use crate::reminders::domain::error::RemindersError;
use crate::reminders::domain::firing::{next_fire_after, next_fire_from};
use crate::reminders::domain::reminder::{PushStatus, Schedule};
use crate::shared::ids::IdGenerator;

/// Atraso máximo de uma ocorrência ainda enviada; mais velha, ela é pulada.
pub const MAX_DELAY_MINUTES: i64 = 15;
/// Validade da mensagem no serviço de push: o mesmo atraso máximo.
pub const PUSH_TTL_SECONDS: u32 = 15 * 60;
/// Lembretes vencidos tratados por rodada.
const BATCH_SIZE: u32 = 200;
/// Ocorrências de um mesmo lembrete tratadas por rodada.
const MAX_OCCURRENCES_PER_ROUND: u32 = 16;

pub struct Dispatcher {
    pub queue: Arc<dyn ScheduleQueue>,
    /// `None` sem chave VAPID configurada: o Web Push fica desligado.
    pub sender: Option<Arc<dyn PushSender>>,
    pub policy: Option<Arc<dyn WebPushPolicy>>,
    pub ids: Arc<dyn IdGenerator>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct DispatchReport {
    pub delivered: u32,
    pub pushed: u32,
}

impl Dispatcher {
    pub async fn dispatch_due(&self, now: DateTime<Utc>) -> Result<DispatchReport, RemindersError> {
        let push_enabled = self.push_enabled().await;
        let mut report = DispatchReport::default();
        for due in self.queue.due(now, BATCH_SIZE).await? {
            let Some(claim) = self.queue.claim(due, now).await? else {
                continue;
            };
            let outcome = self.dispatch_one(claim, now, push_enabled).await;
            match outcome {
                Ok(one) => {
                    report.delivered += one.delivered;
                    report.pushed += one.pushed;
                }
                // Um lembrete com problema não impede os outros de dispararem.
                Err(error) => tracing::warn!(
                    reminder_id = %due.reminder_id,
                    error = %error,
                    "falha ao disparar o lembrete"
                ),
            }
        }
        Ok(report)
    }

    async fn push_enabled(&self) -> bool {
        match (&self.sender, &self.policy) {
            (Some(_), Some(policy)) => policy.is_enabled().await,
            _ => false,
        }
    }

    async fn dispatch_one(
        &self,
        mut claim: Box<dyn ClaimedReminder>,
        now: DateTime<Utc>,
        push_enabled: bool,
    ) -> Result<DispatchReport, RemindersError> {
        let Some((title, schedule)) = claim
            .reminder()
            .map(|(title, schedule)| (title.to_owned(), schedule.clone()))
        else {
            return claim.finish(None).await.map(|()| DispatchReport::default());
        };
        let mut report = DispatchReport::default();
        let mut next = Some(claim.next_fire_at());
        for _ in 0..MAX_OCCURRENCES_PER_ROUND {
            let Some(fire_at) = next.filter(|fire_at| *fire_at <= now) else {
                break;
            };
            let late = now - fire_at > max_delay();
            if claim
                .record_delivery(self.ids.new_id(), fire_at, now)
                .await?
            {
                report.delivered += 1;
                if push_enabled && !late {
                    report.pushed += self.push(&mut *claim, &title, fire_at).await?;
                }
            }
            next = following(&schedule, fire_at, now, late);
        }
        claim.finish(next).await?;
        Ok(report)
    }

    async fn push(
        &self,
        claim: &mut dyn ClaimedReminder,
        title: &str,
        fire_at: DateTime<Utc>,
    ) -> Result<u32, RemindersError> {
        let Some(sender) = &self.sender else {
            return Ok(0);
        };
        let subscriptions = claim.subscriptions().await?;
        if subscriptions.is_empty() {
            return Ok(0);
        }
        let payload = payload(claim.reminder_id(), title, fire_at);
        let (mut sent, mut failed) = (0u32, false);
        for subscription in &subscriptions {
            match sender
                .send(subscription, payload.as_bytes(), PUSH_TTL_SECONDS)
                .await
            {
                Ok(()) => sent += 1,
                Err(PushSendError::Gone) => claim.remove_subscription(subscription.id).await?,
                Err(PushSendError::Failed) => {
                    failed = true;
                    tracing::warn!(
                        subscription_id = %subscription.id,
                        "falha ao enviar o Web Push"
                    );
                }
            }
        }
        let status = match (sent, failed) {
            (0, true) => PushStatus::Failed,
            (0, false) => PushStatus::Skipped,
            _ => PushStatus::Sent,
        };
        claim.set_push_status(fire_at, status).await?;
        Ok(sent)
    }
}

fn max_delay() -> Duration {
    Duration::minutes(MAX_DELAY_MINUTES)
}

/// Depois de uma ocorrência atrasada demais, as outras já perdidas são puladas de
/// uma vez: o disparo segue da primeira ainda dentro do atraso máximo.
fn following(
    schedule: &Schedule,
    fire_at: DateTime<Utc>,
    now: DateTime<Utc>,
    late: bool,
) -> Option<DateTime<Utc>> {
    if late {
        next_fire_from(schedule, now - max_delay()).filter(|next| *next > fire_at)
    } else {
        next_fire_after(schedule, fire_at)
    }
}

fn payload(reminder_id: uuid::Uuid, title: &str, fire_at: DateTime<Utc>) -> String {
    serde_json::json!({
        "reminder_id": reminder_id,
        "title": title,
        "fire_at": fire_at,
    })
    .to_string()
}
