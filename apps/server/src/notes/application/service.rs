//! Casos de uso de notas e o leitor usado pela busca em memória (TASK-16).

use std::sync::Arc;

use chrono::{DateTime, SecondsFormat, Utc};
use uuid::Uuid;

use super::ports::{NoteListFilter, NoteRepository, NoteSort};
use crate::notes::domain::error::NoteError;
use crate::notes::domain::note::{NewNote, Note, NoteChanges};
use crate::shared::clock::Clock;
use crate::shared::ids::IdGenerator;
use crate::shared::pagination::Cursor;
use crate::shared::visibility::Visibility;

/// Dados de uma nota nova vindos da borda.
#[derive(Debug, Clone)]
pub struct CreateNote {
    pub title: String,
    pub body: String,
    pub visibility: Visibility,
}

/// Pedido de listagem; o `limit` já vem limitado pela borda.
#[derive(Debug, Clone)]
pub struct ListNotes {
    pub visibility: Option<Visibility>,
    pub sort: NoteSort,
    pub after: Option<Cursor>,
    pub limit: u32,
}

#[derive(Debug, Clone)]
pub struct NotePage {
    pub items: Vec<Note>,
    pub next_cursor: Option<Cursor>,
}

/// Chave do cursor: o instante com microssegundos, a precisão do `TIMESTAMPTZ`.
pub fn sort_key(note: &Note, sort: NoteSort) -> String {
    let instant = match sort {
        NoteSort::UpdatedAt => note.updated_at,
        NoteSort::CreatedAt => note.created_at,
    };
    instant.to_rfc3339_opts(SecondsFormat::Micros, true)
}

/// Lê a chave de um cursor; um cursor de outra listagem é recusado.
pub fn parse_sort_key(cursor: &Cursor) -> Result<DateTime<Utc>, NoteError> {
    DateTime::parse_from_rfc3339(&cursor.sort_key)
        .map(|instant| instant.with_timezone(&Utc))
        .map_err(|_| NoteError::InvalidCursor)
}

pub struct NoteService<R> {
    repository: R,
    clock: Arc<dyn Clock>,
    ids: Arc<dyn IdGenerator>,
}

impl<R: NoteRepository> NoteService<R> {
    pub fn new(repository: R, clock: Arc<dyn Clock>, ids: Arc<dyn IdGenerator>) -> Self {
        Self {
            repository,
            clock,
            ids,
        }
    }

    pub async fn create(&self, owner_id: Uuid, input: CreateNote) -> Result<Note, NoteError> {
        let new = NewNote {
            id: self.ids.new_id(),
            owner_id,
            visibility: input.visibility,
            title: input.title,
            body: input.body,
        };
        let note = Note::new(new, self.clock.now())?;
        self.repository.insert(&note).await?;
        Ok(note)
    }

    pub async fn get(&self, owner_id: Uuid, id: Uuid) -> Result<Note, NoteError> {
        self.repository
            .find_live(owner_id, id)
            .await?
            .ok_or(NoteError::NotFound)
    }

    pub async fn list(&self, owner_id: Uuid, query: ListNotes) -> Result<NotePage, NoteError> {
        if let Some(cursor) = &query.after {
            parse_sort_key(cursor)?;
        }
        let limit = query.limit.max(1);
        // Um item a mais diz se existe próxima página sem uma contagem à parte.
        let filter = NoteListFilter {
            visibility: query.visibility,
            sort: query.sort,
            after: query.after,
            limit: limit + 1,
        };
        let mut items = self.repository.list_live(owner_id, &filter).await?;
        let has_more = items.len() > limit as usize;
        items.truncate(limit as usize);
        let next_cursor = match items.last() {
            Some(last) if has_more => Some(Cursor::new(sort_key(last, query.sort), last.id)),
            _ => None,
        };
        Ok(NotePage { items, next_cursor })
    }

    pub async fn edit(
        &self,
        owner_id: Uuid,
        id: Uuid,
        changes: NoteChanges,
    ) -> Result<Note, NoteError> {
        let mut note = self.get(owner_id, id).await?;
        note.edit(changes, self.clock.now())?;
        self.repository.update(&note).await?;
        Ok(note)
    }

    pub async fn delete(&self, owner_id: Uuid, id: Uuid) -> Result<(), NoteError> {
        let mut note = self.get(owner_id, id).await?;
        let now = self.clock.now();
        note.delete(now)?;
        if !self.repository.soft_delete(owner_id, note.id, now).await? {
            return Err(NoteError::NotFound);
        }
        Ok(())
    }
}

/// Nota em claro entregue à busca, só do próprio dono e não excluída.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecryptedNote {
    pub id: Uuid,
    pub title: String,
    pub body: String,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<Note> for DecryptedNote {
    fn from(note: Note) -> Self {
        Self {
            id: note.id,
            title: note.title,
            body: note.body,
            visibility: note.visibility,
            created_at: note.created_at,
            updated_at: note.updated_at,
        }
    }
}

/// Serviço da busca: ela nunca lê a tabela `notes` ([project/architecture-04]).
pub struct NoteReader<R> {
    repository: R,
}

impl<R: NoteRepository> NoteReader<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn decrypted_notes_for_owner(
        &self,
        owner_id: Uuid,
    ) -> Result<Vec<DecryptedNote>, NoteError> {
        let notes = self.repository.all_live_for_owner(owner_id).await?;
        Ok(notes
            .into_iter()
            .filter(|note| note.owner_id == owner_id && !note.is_deleted())
            .map(DecryptedNote::from)
            .collect())
    }
}
