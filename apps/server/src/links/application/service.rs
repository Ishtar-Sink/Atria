//! Casos de uso das ligações, sempre filtrando pelo dono ([project/security-04]).

use std::sync::Arc;

use chrono::{DateTime, SecondsFormat, Utc};
use uuid::Uuid;

use crate::links::application::ports::{LinkListFilter, LinkRepository};
use crate::links::domain::error::LinkError;
use crate::links::domain::link::{EntityRef, EntityType, Link};
use crate::shared::clock::{Clock, SystemClock};
use crate::shared::ids::{IdGenerator, UuidV7Ids};
use crate::shared::pagination::Cursor;
use crate::shared::visibility::Visibility;

/// Chave do cursor: o instante com microssegundos, a precisão do `TIMESTAMPTZ`.
pub fn sort_key(link: &Link) -> String {
    link.created_at.to_rfc3339_opts(SecondsFormat::Micros, true)
}

/// Lê a chave de um cursor; um cursor de outra listagem é recusado.
pub fn parse_sort_key(cursor: &Cursor) -> Result<DateTime<Utc>, LinkError> {
    DateTime::parse_from_rfc3339(&cursor.sort_key)
        .map(|instant| instant.with_timezone(&Utc))
        .map_err(|_| LinkError::InvalidCursor)
}

#[derive(Debug, Clone)]
pub struct CreateLink {
    pub a: EntityRef,
    pub b: EntityRef,
    pub visibility: Visibility,
}

#[derive(Debug, Clone)]
pub struct ListLinks {
    pub entity: EntityRef,
    pub linked_type: Option<EntityType>,
    pub after: Option<Cursor>,
    pub limit: u32,
}

#[derive(Debug, Clone)]
pub struct LinkPage {
    pub items: Vec<Link>,
    pub next_cursor: Option<Cursor>,
}

pub struct LinkService<R> {
    repository: R,
    clock: Arc<dyn Clock>,
    ids: Arc<dyn IdGenerator>,
}

impl<R: LinkRepository> LinkService<R> {
    pub fn new(repository: R, clock: Arc<dyn Clock>, ids: Arc<dyn IdGenerator>) -> Self {
        Self {
            repository,
            clock,
            ids,
        }
    }

    /// Serviço com relógio e ids de produção, para o gancho de exclusão.
    pub fn for_pool(repository: R) -> Self {
        Self::new(repository, Arc::new(SystemClock), Arc::new(UuidV7Ids))
    }

    pub async fn create(&self, owner_id: Uuid, input: CreateLink) -> Result<Link, LinkError> {
        let link = Link::new(
            self.ids.new_id(),
            owner_id,
            input.a,
            input.b,
            input.visibility,
            self.clock.now(),
        )?;
        self.repository.insert(&link).await?;
        Ok(link)
    }

    pub async fn list_for_entity(
        &self,
        owner_id: Uuid,
        query: ListLinks,
    ) -> Result<LinkPage, LinkError> {
        if let Some(cursor) = &query.after {
            parse_sort_key(cursor)?;
        }
        let limit = query.limit.max(1);
        // Um item a mais diz se existe próxima página sem uma contagem à parte.
        let filter = LinkListFilter {
            entity: query.entity,
            linked_type: query.linked_type,
            after: query.after,
            limit: limit + 1,
        };
        let mut items = self.repository.list_for_entity(owner_id, &filter).await?;
        let has_more = items.len() > limit as usize;
        items.truncate(limit as usize);
        let next_cursor = match items.last() {
            Some(last) if has_more => Some(Cursor::new(sort_key(last), last.id)),
            _ => None,
        };
        Ok(LinkPage { items, next_cursor })
    }

    pub async fn delete(&self, owner_id: Uuid, id: Uuid) -> Result<(), LinkError> {
        if self.repository.delete(owner_id, id).await? {
            Ok(())
        } else {
            Err(LinkError::NotFound)
        }
    }

    pub async fn remove_for_entity(
        &self,
        owner_id: Uuid,
        entity_type: EntityType,
        entity_id: Uuid,
    ) -> Result<u64, LinkError> {
        let entity = EntityRef::new(entity_type, entity_id);
        self.repository.delete_for_entity(owner_id, &entity).await
    }
}
