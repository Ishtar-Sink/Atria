//! Casos de uso das entradas do Diário e o leitor usado pela busca em memória
//! (TASK-16) e pelo relatório do Diário (TASK-17).

use std::sync::Arc;

use chrono::{DateTime, SecondsFormat, Utc};
use uuid::Uuid;

use super::ports::{
    EmotionRepository, EntryEmotionView, EntryListFilter, JournalEntryRepository, JournalEntryView,
};
use crate::journal::domain::error::JournalError;
use crate::journal::domain::journal_entry::{
    EntryEmotion, JournalEntry, JournalEntryChanges, NewJournalEntry,
};
use crate::shared::clock::Clock;
use crate::shared::ids::IdGenerator;
use crate::shared::pagination::Cursor;
use crate::shared::visibility::Visibility;

/// Emoção marcada como veio da borda; a intensidade é validada no domínio.
#[derive(Debug, Clone, Copy)]
pub struct EntryEmotionInput {
    pub emotion_id: Uuid,
    pub intensity: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct CreateJournalEntry {
    pub occurred_at: DateTime<Utc>,
    pub text: String,
    pub emotions: Vec<EntryEmotionInput>,
    pub visibility: Visibility,
}

#[derive(Debug, Clone, Default)]
pub struct EditJournalEntry {
    pub occurred_at: Option<DateTime<Utc>>,
    pub text: Option<String>,
    pub emotions: Option<Vec<EntryEmotionInput>>,
    pub visibility: Option<Visibility>,
}

/// Pedido de listagem; o `limit` já vem limitado pela borda.
#[derive(Debug, Clone)]
pub struct ListJournalEntries {
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub emotion_id: Option<Uuid>,
    pub visibility: Option<Visibility>,
    pub after: Option<Cursor>,
    pub limit: u32,
}

#[derive(Debug, Clone)]
pub struct JournalEntryPage {
    pub items: Vec<JournalEntryView>,
    pub next_cursor: Option<Cursor>,
}

/// Chave do cursor: `occurred_at` com microssegundos, a precisão do `TIMESTAMPTZ`.
pub fn sort_key(entry: &JournalEntry) -> String {
    entry
        .occurred_at
        .to_rfc3339_opts(SecondsFormat::Micros, true)
}

/// Lê a chave de um cursor; um cursor de outra listagem é recusado.
pub fn parse_sort_key(cursor: &Cursor) -> Result<DateTime<Utc>, JournalError> {
    DateTime::parse_from_rfc3339(&cursor.sort_key)
        .map(|instant| instant.with_timezone(&Utc))
        .map_err(|_| JournalError::InvalidCursor)
}

fn to_domain(inputs: Vec<EntryEmotionInput>) -> Result<Vec<EntryEmotion>, JournalError> {
    inputs
        .into_iter()
        .map(|input| EntryEmotion::new(input.emotion_id, input.intensity))
        .collect()
}

pub struct JournalEntryService<E, M> {
    entries: E,
    emotions: M,
    clock: Arc<dyn Clock>,
    ids: Arc<dyn IdGenerator>,
}

impl<E: JournalEntryRepository, M: EmotionRepository> JournalEntryService<E, M> {
    pub fn new(entries: E, emotions: M, clock: Arc<dyn Clock>, ids: Arc<dyn IdGenerator>) -> Self {
        Self {
            entries,
            emotions,
            clock,
            ids,
        }
    }

    pub async fn create(
        &self,
        owner_id: Uuid,
        input: CreateJournalEntry,
    ) -> Result<JournalEntryView, JournalError> {
        let new = NewJournalEntry {
            id: self.ids.new_id(),
            owner_id,
            visibility: input.visibility,
            occurred_at: input.occurred_at,
            text: input.text,
            emotions: to_domain(input.emotions)?,
        };
        let entry = JournalEntry::new(new, self.clock.now())?;
        let ids: Vec<Uuid> = entry.emotions.iter().map(|e| e.emotion_id).collect();
        self.ensure_usable_emotions(owner_id, &ids).await?;
        self.entries.insert(&entry).await?;
        self.get(owner_id, entry.id).await
    }

    pub async fn get(&self, owner_id: Uuid, id: Uuid) -> Result<JournalEntryView, JournalError> {
        self.entries
            .find_live(owner_id, id)
            .await?
            .ok_or(JournalError::EntryNotFound)
    }

    pub async fn list(
        &self,
        owner_id: Uuid,
        query: ListJournalEntries,
    ) -> Result<JournalEntryPage, JournalError> {
        if let Some(cursor) = &query.after {
            parse_sort_key(cursor)?;
        }
        let limit = query.limit.max(1);
        // Um item a mais diz se existe próxima página sem uma contagem à parte.
        let filter = EntryListFilter {
            from: query.from,
            to: query.to,
            emotion_id: query.emotion_id,
            visibility: query.visibility,
            after: query.after,
            limit: limit + 1,
        };
        let mut items = self.entries.list_live(owner_id, &filter).await?;
        let has_more = items.len() > limit as usize;
        items.truncate(limit as usize);
        let next_cursor = match items.last() {
            Some(last) if has_more => Some(Cursor::new(sort_key(&last.entry), last.entry.id)),
            _ => None,
        };
        Ok(JournalEntryPage { items, next_cursor })
    }

    pub async fn edit(
        &self,
        owner_id: Uuid,
        id: Uuid,
        input: EditJournalEntry,
    ) -> Result<JournalEntryView, JournalError> {
        let mut entry = self.get(owner_id, id).await?.entry;
        let changes = JournalEntryChanges {
            occurred_at: input.occurred_at,
            text: input.text,
            emotions: input.emotions.map(to_domain).transpose()?,
            visibility: input.visibility,
        };
        // Uma emoção excluída que a entrada já tinha continua valendo nela; só as
        // novas precisam estar na lista atual da pessoa.
        let added: Vec<Uuid> = changes
            .emotions
            .iter()
            .flatten()
            .map(|emotion| emotion.emotion_id)
            .filter(|emotion_id| !entry.has_emotion(*emotion_id))
            .collect();
        entry.edit(changes, self.clock.now())?;
        self.ensure_usable_emotions(owner_id, &added).await?;
        self.entries.update(&entry).await?;
        self.get(owner_id, id).await
    }

    pub async fn delete(&self, owner_id: Uuid, id: Uuid) -> Result<(), JournalError> {
        let mut entry = self.get(owner_id, id).await?.entry;
        let now = self.clock.now();
        entry.delete(now)?;
        if !self.entries.soft_delete(owner_id, entry.id, now).await? {
            return Err(JournalError::EntryNotFound);
        }
        Ok(())
    }

    /// Toda emoção existe, é do dono e não foi excluída; senão, `UnknownEmotion`.
    async fn ensure_usable_emotions(
        &self,
        owner_id: Uuid,
        ids: &[Uuid],
    ) -> Result<(), JournalError> {
        if ids.is_empty() {
            return Ok(());
        }
        let found = self.emotions.find_live_ids_for_owner(owner_id, ids).await?;
        if ids.iter().all(|id| found.contains(id)) {
            Ok(())
        } else {
            Err(JournalError::UnknownEmotion)
        }
    }
}

/// Entrada em claro entregue à busca e aos relatórios, só do próprio dono e não
/// excluída.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecryptedJournalEntry {
    pub id: Uuid,
    pub occurred_at: DateTime<Utc>,
    pub text: String,
    pub emotions: Vec<EntryEmotionView>,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<JournalEntryView> for DecryptedJournalEntry {
    fn from(view: JournalEntryView) -> Self {
        let entry = view.entry;
        Self {
            id: entry.id,
            occurred_at: entry.occurred_at,
            text: entry.text,
            emotions: view.emotions,
            visibility: entry.visibility,
            created_at: entry.created_at,
            updated_at: entry.updated_at,
        }
    }
}

/// Serviço da busca e dos relatórios: eles nunca leem as tabelas do diário
/// ([project/architecture-04]).
pub struct JournalReader<R> {
    repository: R,
}

impl<R: JournalEntryRepository> JournalReader<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn decrypted_entries_for_owner(
        &self,
        owner_id: Uuid,
    ) -> Result<Vec<DecryptedJournalEntry>, JournalError> {
        let views = self.repository.all_live_for_owner(owner_id).await?;
        Ok(views
            .into_iter()
            .filter(|view| view.entry.owner_id == owner_id && !view.entry.is_deleted())
            .map(DecryptedJournalEntry::from)
            .collect())
    }
}
