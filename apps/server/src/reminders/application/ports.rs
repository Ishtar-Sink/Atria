//! Portas do contexto: repositórios, fila de disparo, envio por Web Push e a
//! política da instância. Os métodos devolvem `BoxFuture` para as portas serem
//! usadas como `dyn` (um `async fn` em trait não é compatível com `dyn`).

use std::future::Future;
use std::pin::Pin;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::reminders::domain::error::RemindersError;
use crate::reminders::domain::push_subscription::{NewPushSubscription, PushSubscription};
use crate::reminders::domain::reminder::{
    PushStatus, Reminder, ReminderKind, Schedule, ValidReminder,
};
use crate::shared::pagination::Cursor;
use crate::shared::visibility::Visibility;

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// Gancho chamado depois de excluir uma entidade, com `(owner_id, entity_type,
/// entity_id)`, para o contexto `links` remover as ligações dela (CB-06). A grafia
/// tem de ser idêntica à da TASK-15 (`links::EntityDeletedHook`): a `Extension` do
/// axum casa pelo tipo, e só a mesma assinatura produz o mesmo tipo nos contextos.
pub type EntityDeletedHook = std::sync::Arc<
    dyn Fn(
            uuid::Uuid,
            &'static str,
            uuid::Uuid,
        ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>>
        + Send
        + Sync,
>;

/// Diz se o admin ligou o Web Push na instância (RF-42). A implementação real fica
/// no contexto `auth`; a ausência dela vale como desligada.
pub trait WebPushPolicy: Send + Sync {
    fn is_enabled(&self) -> BoxFuture<'_, bool>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum PushSendError {
    /// O serviço de push respondeu 404 ou 410: a inscrição não vale mais.
    #[error("inscrição expirada")]
    Gone,
    #[error("falha no envio do Web Push")]
    Failed,
}

/// Envia uma mensagem já serializada para uma inscrição.
pub trait PushSender: Send + Sync {
    fn send<'a>(
        &'a self,
        subscription: &'a PushSubscription,
        payload: &'a [u8],
        ttl_seconds: u32,
    ) -> BoxFuture<'a, Result<(), PushSendError>>;
}

/// Lembrete com o próximo disparo agendado.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReminderRecord {
    pub reminder: Reminder,
    pub next_fire_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ReminderFilter {
    pub kind: Option<ReminderKind>,
    pub visibility: Option<Visibility>,
    pub query: Option<String>,
    pub cursor: Option<Cursor>,
    pub limit: u32,
}

/// Dados de um lembrete novo ou editado, já com o próximo disparo calculado.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReminderWrite {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub data: ValidReminder,
    pub now: DateTime<Utc>,
    pub next_fire_at: Option<DateTime<Utc>>,
}

/// Lembretes do dono; criar, editar e excluir atualizam a fila de disparo na mesma
/// transação. Registro de outro dono ou excluído é `NotFound`.
pub trait ReminderRepository: Send + Sync {
    fn create(&self, write: ReminderWrite)
    -> BoxFuture<'_, Result<ReminderRecord, RemindersError>>;
    fn get(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> BoxFuture<'_, Result<ReminderRecord, RemindersError>>;
    fn update(&self, write: ReminderWrite)
    -> BoxFuture<'_, Result<ReminderRecord, RemindersError>>;
    fn delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> BoxFuture<'_, Result<(), RemindersError>>;
    fn list(
        &self,
        owner_id: Uuid,
        filter: ReminderFilter,
    ) -> BoxFuture<'_, Result<Vec<ReminderRecord>, RemindersError>>;
    /// Todos os lembretes vivos do dono, para calcular os próximos disparos.
    fn all_live(&self, owner_id: Uuid) -> BoxFuture<'_, Result<Vec<Reminder>, RemindersError>>;
}

pub trait SubscriptionRepository: Send + Sync {
    /// Cria a inscrição ou, se o endpoint já é do dono, troca as chaves.
    fn upsert(
        &self,
        id: Uuid,
        owner_id: Uuid,
        subscription: NewPushSubscription,
        now: DateTime<Utc>,
    ) -> BoxFuture<'_, Result<PushSubscription, RemindersError>>;
    fn delete(&self, owner_id: Uuid, id: Uuid) -> BoxFuture<'_, Result<(), RemindersError>>;
}

/// Linha vencida da fila de disparo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DueReminder {
    pub reminder_id: Uuid,
    pub owner_id: Uuid,
}

/// Fila de disparo: o próximo disparo de cada lembrete, de todos os usuários.
pub trait ScheduleQueue: Send + Sync {
    fn due(
        &self,
        now: DateTime<Utc>,
        limit: u32,
    ) -> BoxFuture<'_, Result<Vec<DueReminder>, RemindersError>>;
    /// Trava a linha na transação do dono; `None` se outro disparo já a pegou ou se
    /// ela não está mais vencida.
    fn claim(
        &self,
        due: DueReminder,
        now: DateTime<Utc>,
    ) -> BoxFuture<'_, Result<Option<Box<dyn ClaimedReminder>>, RemindersError>>;
}

/// Lembrete travado para o disparo, dentro da transação do dono.
pub trait ClaimedReminder: Send {
    fn reminder_id(&self) -> Uuid;
    fn next_fire_at(&self) -> DateTime<Utc>;
    /// Título e agendamento do lembrete; `None` se ele foi excluído.
    fn reminder(&self) -> Option<(&str, &Schedule)>;
    /// Grava a entrega da ocorrência; `false` se ela já tinha sido entregue.
    fn record_delivery(
        &mut self,
        id: Uuid,
        fire_at: DateTime<Utc>,
        now: DateTime<Utc>,
    ) -> BoxFuture<'_, Result<bool, RemindersError>>;
    fn set_push_status(
        &mut self,
        fire_at: DateTime<Utc>,
        status: PushStatus,
    ) -> BoxFuture<'_, Result<(), RemindersError>>;
    fn subscriptions(&mut self) -> BoxFuture<'_, Result<Vec<PushSubscription>, RemindersError>>;
    fn remove_subscription(&mut self, id: Uuid) -> BoxFuture<'_, Result<(), RemindersError>>;
    /// Grava o próximo disparo (ou tira o lembrete da fila) e confirma a transação.
    fn finish(
        self: Box<Self>,
        next_fire_at: Option<DateTime<Utc>>,
    ) -> BoxFuture<'static, Result<(), RemindersError>>;
}
