//! Portas da aplicação: o repositório de ligações.

use std::future::Future;

use uuid::Uuid;

use crate::links::domain::error::LinkError;
use crate::links::domain::link::{EntityRef, EntityType, Link};
use crate::shared::pagination::Cursor;

/// Filtro da listagem por entidade; a posição vem do cursor opaco.
#[derive(Debug, Clone)]
pub struct LinkListFilter {
    pub entity: EntityRef,
    pub linked_type: Option<EntityType>,
    pub after: Option<Cursor>,
    pub limit: u32,
}

/// Toda operação recebe o dono: o filtro por dono está na própria query
/// ([project/security-04]), além da Row Level Security.
pub trait LinkRepository: Send + Sync {
    /// Grava a ligação; `AlreadyExists` se o par normalizado já existe.
    fn insert(&self, link: &Link) -> impl Future<Output = Result<(), LinkError>> + Send;

    /// Até `limit` ligações da entidade (como origem ou destino) depois do cursor.
    fn list_for_entity(
        &self,
        owner_id: Uuid,
        filter: &LinkListFilter,
    ) -> impl Future<Output = Result<Vec<Link>, LinkError>> + Send;

    /// Exclusão física; `false` se a ligação não existe.
    fn delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> impl Future<Output = Result<bool, LinkError>> + Send;

    /// Remove as ligações em que a entidade é origem ou destino; devolve quantas.
    fn delete_for_entity(
        &self,
        owner_id: Uuid,
        entity: &EntityRef,
    ) -> impl Future<Output = Result<u64, LinkError>> + Send;
}
