//! Portas da aplicação: o repositório de notas e o gancho de exclusão (CB-06).

use std::future::Future;

use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::notes::domain::error::NoteError;
use crate::notes::domain::note::Note;
use crate::shared::pagination::Cursor;
use crate::shared::visibility::Visibility;

/// Gancho chamado depois de excluir uma entidade, com `(owner_id, entity_type, entity_id)`.
///
/// A grafia tem de ser idêntica à de `links` (TASK-15) e dos outros contextos que
/// excluem entidades: a `Extension` do axum casa pelo tipo, e um alias escrito de outro
/// jeito vira outro tipo, então o gancho simplesmente não seria encontrado.
pub type EntityDeletedHook = std::sync::Arc<
    dyn Fn(
            uuid::Uuid,
            &'static str,
            uuid::Uuid,
        ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>>
        + Send
        + Sync,
>;

/// Ordenação da listagem, sempre decrescente e desempatada pelo id.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum NoteSort {
    #[default]
    UpdatedAt,
    CreatedAt,
}

/// Filtro da listagem: a posição vem do cursor opaco da TASK-04.
#[derive(Debug, Clone)]
pub struct NoteListFilter {
    pub visibility: Option<Visibility>,
    pub sort: NoteSort,
    pub after: Option<Cursor>,
    pub limit: u32,
}

/// Toda operação recebe o dono: o filtro por dono está na própria query
/// ([project/security-04]), além da Row Level Security.
pub trait NoteRepository: Send + Sync {
    fn insert(&self, note: &Note) -> impl Future<Output = Result<(), NoteError>> + Send;

    fn update(&self, note: &Note) -> impl Future<Output = Result<(), NoteError>> + Send;

    fn find_live(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> impl Future<Output = Result<Option<Note>, NoteError>> + Send;

    /// Até `limit` notas depois do cursor, na ordem pedida.
    fn list_live(
        &self,
        owner_id: Uuid,
        filter: &NoteListFilter,
    ) -> impl Future<Output = Result<Vec<Note>, NoteError>> + Send;

    /// Marca `deleted_at`; devolve `false` se a nota não existe ou já foi excluída.
    fn soft_delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        deleted_at: DateTime<Utc>,
    ) -> impl Future<Output = Result<bool, NoteError>> + Send;

    fn all_live_for_owner(
        &self,
        owner_id: Uuid,
    ) -> impl Future<Output = Result<Vec<Note>, NoteError>> + Send;
}
