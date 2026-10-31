//! Corpos da API de lembretes, em `snake_case`.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::reminders::application::ports::ReminderRecord;
use crate::reminders::application::reminders::UpcomingFire;
use crate::reminders::domain::push_subscription::PushSubscription;
use crate::reminders::domain::reminder::ReminderKind;
use crate::shared::recurrence::RecurrenceRule;
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ReminderKindDto {
    OneOff,
    Recurring,
}

impl From<ReminderKind> for ReminderKindDto {
    fn from(kind: ReminderKind) -> Self {
        match kind {
            ReminderKind::OneOff => Self::OneOff,
            ReminderKind::Recurring => Self::Recurring,
        }
    }
}

impl From<ReminderKindDto> for ReminderKind {
    fn from(kind: ReminderKindDto) -> Self {
        match kind {
            ReminderKindDto::OneOff => Self::OneOff,
            ReminderKindDto::Recurring => Self::Recurring,
        }
    }
}

/// Lembrete novo: pontual com `remind_at` e `timezone`, ou recorrente com `rule`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateReminderBody {
    pub title: String,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub visibility: Option<Visibility>,
    /// Fuso do lembrete; no recorrente, vale o da regra.
    #[serde(default)]
    #[schema(example = "America/Sao_Paulo")]
    pub timezone: Option<String>,
    #[serde(default)]
    pub remind_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub rule: Option<RecurrenceRule>,
}

/// Edição parcial; `notes: null` apaga as notas.
#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct PatchReminderBody {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default, deserialize_with = "present")]
    #[schema(value_type = Option<String>)]
    pub notes: Option<Option<String>>,
    #[serde(default)]
    pub visibility: Option<Visibility>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub remind_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub rule: Option<RecurrenceRule>,
}

/// Distingue o campo ausente (`None`) do campo `null` (`Some(None)`).
fn present<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ReminderResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub title: String,
    pub notes: Option<String>,
    pub kind: ReminderKindDto,
    pub timezone: String,
    pub remind_at: Option<DateTime<Utc>>,
    pub rule: Option<RecurrenceRule>,
    /// Próximo disparo em UTC; `null` quando não há mais nenhum.
    pub next_fire_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<ReminderRecord> for ReminderResponse {
    fn from(record: ReminderRecord) -> Self {
        let reminder = record.reminder;
        Self {
            id: reminder.id,
            owner_id: reminder.owner_id,
            visibility: reminder.visibility,
            title: reminder.title,
            notes: reminder.notes,
            kind: reminder.schedule.kind().into(),
            timezone: reminder.timezone,
            remind_at: reminder.schedule.remind_at(),
            rule: reminder.schedule.rule().cloned(),
            next_fire_at: record.next_fire_at,
            created_at: reminder.created_at,
            updated_at: reminder.updated_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ReminderPageResponse {
    pub items: Vec<ReminderResponse>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct ListRemindersQuery {
    pub kind: Option<ReminderKindDto>,
    pub visibility: Option<Visibility>,
    /// Busca no título.
    pub q: Option<String>,
    pub cursor: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct UpcomingQuery {
    /// Início do intervalo, inclusive, em RFC 3339.
    pub from: DateTime<Utc>,
    /// Fim do intervalo, exclusivo; até 31 dias depois de `from`.
    pub to: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct UpcomingFireResponse {
    pub reminder_id: Uuid,
    pub title: String,
    pub fire_at: DateTime<Utc>,
}

impl From<UpcomingFire> for UpcomingFireResponse {
    fn from(fire: UpcomingFire) -> Self {
        Self {
            reminder_id: fire.reminder_id,
            title: fire.title,
            fire_at: fire.fire_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct UpcomingResponse {
    pub items: Vec<UpcomingFireResponse>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct PublicKeyResponse {
    /// Chave pública VAPID em base64url, o `applicationServerKey` do navegador.
    pub public_key: String,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct SubscriptionKeysBody {
    pub p256dh: String,
    pub auth: String,
}

/// Inscrição do navegador, no formato do `PushSubscription.toJSON()`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
pub struct CreateSubscriptionBody {
    pub endpoint: String,
    pub keys: SubscriptionKeysBody,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct SubscriptionResponse {
    pub id: Uuid,
    pub endpoint: String,
    pub created_at: DateTime<Utc>,
}

impl From<PushSubscription> for SubscriptionResponse {
    fn from(subscription: PushSubscription) -> Self {
        Self {
            id: subscription.id,
            endpoint: subscription.endpoint,
            created_at: subscription.created_at,
        }
    }
}
