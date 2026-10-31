//! Inscrição e remoção no Web Push (RF-42).

use uuid::Uuid;

use crate::reminders::application::ports::SubscriptionRepository;
use crate::reminders::domain::error::RemindersError;
use crate::reminders::domain::push_subscription::{NewPushSubscription, PushSubscription};
use crate::shared::clock::Clock;
use crate::shared::ids::IdGenerator;

pub struct SubscriptionService<'a> {
    pub repository: &'a dyn SubscriptionRepository,
    pub clock: &'a dyn Clock,
    pub ids: &'a dyn IdGenerator,
}

impl SubscriptionService<'_> {
    /// Só aceita a inscrição com o Web Push disponível: ligado pelo admin e com a
    /// chave VAPID configurada.
    pub async fn subscribe(
        &self,
        owner_id: Uuid,
        web_push_available: bool,
        subscription: NewPushSubscription,
    ) -> Result<PushSubscription, RemindersError> {
        if !web_push_available {
            return Err(RemindersError::WebPushDisabled);
        }
        self.repository
            .upsert(self.ids.new_id(), owner_id, subscription, self.clock.now())
            .await
    }

    pub async fn unsubscribe(&self, owner_id: Uuid, id: Uuid) -> Result<(), RemindersError> {
        self.repository.delete(owner_id, id).await
    }
}
