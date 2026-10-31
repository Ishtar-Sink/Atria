//! Portas da aplicação: os repositórios de entradas e de emoções e o gancho de
//! exclusão (CB-06).

use std::future::Future;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::journal::domain::emotion::{Emotion, SystemEmotion};
use crate::journal::domain::error::JournalError;
use crate::journal::domain::journal_entry::JournalEntry;
use crate::shared::pagination::Cursor;
use crate::shared::visibility::Visibility;

/// Gancho chamado depois de excluir uma entidade, com `(owner_id, entity_type, entity_id)`.
///
/// A grafia tem de ser idêntica à de `links` (TASK-15) e dos outros contextos que
/// excluem entidades: a `Extension` do axum casa pelo tipo, e um alias escrito de outro
/// jeito pode virar outro tipo, então o gancho simplesmente não seria encontrado.
pub type EntityDeletedHook = std::sync::Arc<
    dyn Fn(
            uuid::Uuid,
            &'static str,
            uuid::Uuid,
        ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>>
        + Send
        + Sync,
>;

/// Emoção de uma entrada como a pessoa a vê: com a chave, o nome e se já foi excluída
/// da lista, para as entradas antigas continuarem mostrando a emoção.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EntryEmotionView {
    pub emotion_id: Uuid,
    pub intensity: Option<u8>,
    pub system_key: Option<SystemEmotion>,
    pub name: Option<String>,
    pub deleted: bool,
}

/// Entrada lida do repositório, com os dados das emoções ligadas.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct JournalEntryView {
    pub entry: JournalEntry,
    pub emotions: Vec<EntryEmotionView>,
}

/// Filtro da listagem: período em `occurred_at` (`from` incluso, `to` excluso), emoção
/// e visibilidade; a posição vem do cursor opaco da TASK-04.
#[derive(Debug, Clone, Default)]
pub struct EntryListFilter {
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub emotion_id: Option<Uuid>,
    pub visibility: Option<Visibility>,
    pub after: Option<Cursor>,
    pub limit: u32,
}

/// Toda operação recebe o dono: o filtro por dono está na própria query
/// ([project/security-04]), além da Row Level Security.
pub trait JournalEntryRepository: Send + Sync {
    /// Grava a entrada e as emoções dela na mesma transação.
    fn insert(&self, entry: &JournalEntry)
    -> impl Future<Output = Result<(), JournalError>> + Send;

    /// Atualiza a entrada e substitui as emoções dela na mesma transação.
    fn update(&self, entry: &JournalEntry)
    -> impl Future<Output = Result<(), JournalError>> + Send;

    fn find_live(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> impl Future<Output = Result<Option<JournalEntryView>, JournalError>> + Send;

    /// Até `limit` entradas depois do cursor, da mais recente para a mais antiga.
    fn list_live(
        &self,
        owner_id: Uuid,
        filter: &EntryListFilter,
    ) -> impl Future<Output = Result<Vec<JournalEntryView>, JournalError>> + Send;

    /// Marca `deleted_at`; devolve `false` se a entrada não existe ou já foi excluída.
    fn soft_delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        deleted_at: DateTime<Utc>,
    ) -> impl Future<Output = Result<bool, JournalError>> + Send;

    fn all_live_for_owner(
        &self,
        owner_id: Uuid,
    ) -> impl Future<Output = Result<Vec<JournalEntryView>, JournalError>> + Send;
}

pub trait EmotionRepository: Send + Sync {
    /// Emoções não excluídas, na ordem em que foram criadas.
    fn list_live(
        &self,
        owner_id: Uuid,
    ) -> impl Future<Output = Result<Vec<Emotion>, JournalError>> + Send;

    fn find_live(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> impl Future<Output = Result<Option<Emotion>, JournalError>> + Send;

    /// Conta também as excluídas: excluir a lista inteira não a faz ser semeada de novo.
    fn count_all_including_deleted(
        &self,
        owner_id: Uuid,
    ) -> impl Future<Output = Result<i64, JournalError>> + Send;

    /// Grava todas numa só transação; uma emoção padrão já existente é ignorada.
    fn insert_many(
        &self,
        owner_id: Uuid,
        emotions: &[Emotion],
    ) -> impl Future<Output = Result<(), JournalError>> + Send;

    fn insert(&self, emotion: &Emotion) -> impl Future<Output = Result<(), JournalError>> + Send;

    fn update(&self, emotion: &Emotion) -> impl Future<Output = Result<(), JournalError>> + Send;

    /// Marca `deleted_at`; devolve `false` se a emoção não existe ou já foi excluída.
    fn soft_delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        deleted_at: DateTime<Utc>,
    ) -> impl Future<Output = Result<bool, JournalError>> + Send;

    /// Dos `ids` pedidos, os que existem, são do dono e não foram excluídos.
    fn find_live_ids_for_owner(
        &self,
        owner_id: Uuid,
        ids: &[Uuid],
    ) -> impl Future<Output = Result<Vec<Uuid>, JournalError>> + Send;
}
