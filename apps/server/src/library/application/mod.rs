//! Casos de uso do Acervo. O que livros e artigos têm em comum (notas, posição de
//! leitura e destaques) fica em `ItemOps`, reaproveitado por `books`, `articles` e `videos`.

pub mod articles;
pub mod books;
pub mod files;
pub mod ports;
pub mod search;
pub mod videos;

pub(crate) use self::files::FileService;

use std::sync::Arc;

use chrono::{DateTime, SecondsFormat, Utc};
use uuid::Uuid;

use self::ports::{ItemRepository, ListFilter};
use super::domain::ItemRef;
use super::domain::error::LibraryError;
use super::domain::highlight::{Highlight, HighlightColor, NewHighlight};
use super::domain::item_note::{ItemNote, ItemNoteChanges, NewItemNote};
use super::domain::positive_page;
use crate::shared::clock::Clock;
use crate::shared::ids::IdGenerator;
use crate::shared::pagination::Cursor;
use crate::shared::visibility::Visibility;

/// Relógio e gerador de ids injetados ([project/testing-07]).
#[derive(Clone)]
pub struct Env {
    pub clock: Arc<dyn Clock>,
    pub ids: Arc<dyn IdGenerator>,
}

/// Pedido de listagem já com o cursor decodificado e o limite validado.
#[derive(Debug, Clone, Default)]
pub struct ListQuery {
    pub text: Option<String>,
    pub tag: Option<String>,
    pub visibility: Option<Visibility>,
    pub reading_status: Option<super::domain::article::ReadingStatus>,
    /// Filtro de status do livro (PD-35).
    pub book_status: Option<super::domain::book::BookStatus>,
    /// Filtro de status do vídeo (PD-35).
    pub video_status: Option<super::domain::video::VideoStatus>,
    pub cursor: Option<Cursor>,
    pub limit: u32,
}

/// Página de resultados com o cursor da próxima, se houver.
#[derive(Debug, Clone)]
pub struct Listed<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<Cursor>,
}

impl ListQuery {
    /// Pede uma linha a mais que o limite para saber se há próxima página.
    pub(crate) fn to_filter(&self) -> Result<ListFilter, LibraryError> {
        let after = self
            .cursor
            .as_ref()
            .map(|cursor| {
                DateTime::parse_from_rfc3339(&cursor.sort_key)
                    .map(|at| (at.with_timezone(&Utc), cursor.id))
                    .map_err(|_| LibraryError::InvalidCursor)
            })
            .transpose()?;
        let text = self
            .text
            .as_deref()
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(str::to_owned);
        Ok(ListFilter {
            text,
            tag: self.tag.clone().filter(|tag| !tag.trim().is_empty()),
            visibility: self.visibility,
            reading_status: self.reading_status,
            book_status: self.book_status,
            video_status: self.video_status,
            after,
            limit: i64::from(self.limit) + 1,
        })
    }
}

/// Corta a linha extra da consulta e monta o cursor da próxima página.
pub(crate) fn finish_page<T>(
    mut rows: Vec<T>,
    limit: u32,
    key: impl Fn(&T) -> (DateTime<Utc>, Uuid),
) -> Listed<T> {
    let limit = limit as usize;
    if rows.len() <= limit {
        return Listed {
            items: rows,
            next_cursor: None,
        };
    }
    rows.truncate(limit);
    let next_cursor = rows.last().map(|row| {
        let (created_at, id) = key(row);
        Cursor::new(created_at.to_rfc3339_opts(SecondsFormat::Micros, true), id)
    });
    Listed {
        items: rows,
        next_cursor,
    }
}

/// Dados de uma nota de item vindos do pedido.
#[derive(Debug, Clone)]
pub struct NoteInput {
    pub quote: Option<String>,
    pub page: Option<i32>,
    pub comment: Option<String>,
}

/// Dados de um destaque vindos do pedido.
#[derive(Debug, Clone)]
pub struct HighlightInput {
    pub file_id: Uuid,
    pub page: i32,
    pub color: super::domain::highlight::HighlightColor,
    pub text: String,
    pub rects: Vec<super::domain::highlight::HighlightRect>,
}

/// Destaque com a marcação de ser do PDF atual do item (CB-19).
#[derive(Debug, Clone)]
pub struct HighlightView {
    pub highlight: Highlight,
    pub is_current_file: bool,
}

/// Notas de item, posição de leitura e destaques.
pub struct ItemOps<I> {
    items: I,
    env: Env,
}

impl<I: ItemRepository> ItemOps<I> {
    pub fn new(items: I, env: Env) -> Self {
        Self { items, env }
    }

    /// PDF atual do item; 404 do tipo do item se ele não existe.
    pub(crate) async fn ensure_item(
        &self,
        owner_id: Uuid,
        item: ItemRef,
    ) -> Result<Option<Uuid>, LibraryError> {
        self.items
            .item_pdf(owner_id, item)
            .await?
            .ok_or_else(|| item.not_found())
    }

    pub async fn list_notes(
        &self,
        owner_id: Uuid,
        item: ItemRef,
    ) -> Result<Vec<ItemNote>, LibraryError> {
        self.ensure_item(owner_id, item).await?;
        self.items.list_notes(owner_id, item).await
    }

    pub async fn create_note(
        &self,
        owner_id: Uuid,
        item: ItemRef,
        input: NoteInput,
    ) -> Result<ItemNote, LibraryError> {
        self.ensure_item(owner_id, item).await?;
        let note = ItemNote::new(
            NewItemNote {
                id: self.env.ids.new_id(),
                owner_id,
                item,
                quote: input.quote,
                page: input.page,
                comment: input.comment,
            },
            self.env.clock.now(),
        )?;
        self.items.insert_note(&note).await?;
        Ok(note)
    }

    pub async fn update_note(
        &self,
        owner_id: Uuid,
        item: ItemRef,
        id: Uuid,
        changes: ItemNoteChanges,
    ) -> Result<ItemNote, LibraryError> {
        self.ensure_item(owner_id, item).await?;
        let mut note = self
            .items
            .find_note(owner_id, item, id)
            .await?
            .ok_or(LibraryError::ItemNoteNotFound)?;
        note.apply(changes, self.env.clock.now())?;
        if !self.items.update_note(&note).await? {
            return Err(LibraryError::ItemNoteNotFound);
        }
        Ok(note)
    }

    pub async fn delete_note(
        &self,
        owner_id: Uuid,
        item: ItemRef,
        id: Uuid,
    ) -> Result<(), LibraryError> {
        self.ensure_item(owner_id, item).await?;
        if self.items.delete_note(owner_id, item, id).await? {
            return Ok(());
        }
        Err(LibraryError::ItemNoteNotFound)
    }

    pub async fn get_position(
        &self,
        owner_id: Uuid,
        item: ItemRef,
    ) -> Result<Option<i32>, LibraryError> {
        self.items
            .get_position(owner_id, item)
            .await?
            .ok_or_else(|| item.not_found())
    }

    /// Sobrescreve a última página lida, inclusive com uma anterior à gravada (CB-18).
    pub async fn set_position(
        &self,
        owner_id: Uuid,
        item: ItemRef,
        page: i32,
    ) -> Result<i32, LibraryError> {
        self.ensure_item(owner_id, item).await?;
        let page = positive_page(page, "page")?;
        if self.items.set_position(owner_id, item, page).await? {
            return Ok(page);
        }
        Err(item.not_found())
    }

    pub async fn list_highlights(
        &self,
        owner_id: Uuid,
        item: ItemRef,
    ) -> Result<Vec<HighlightView>, LibraryError> {
        let current = self.ensure_item(owner_id, item).await?;
        let highlights = self.items.list_highlights(owner_id, item).await?;
        Ok(highlights
            .into_iter()
            .map(|highlight| HighlightView {
                is_current_file: highlight.is_from_current_file(current),
                highlight,
            })
            .collect())
    }

    /// O destaque só é aceito no PDF atual do item.
    pub async fn create_highlight(
        &self,
        owner_id: Uuid,
        item: ItemRef,
        input: HighlightInput,
    ) -> Result<HighlightView, LibraryError> {
        let current = self.ensure_item(owner_id, item).await?;
        let Some(current) = current else {
            return Err(LibraryError::PdfRequired);
        };
        if current != input.file_id {
            return Err(LibraryError::HighlightFileMismatch);
        }
        let highlight = Highlight::new(
            NewHighlight {
                id: self.env.ids.new_id(),
                owner_id,
                item,
                file_id: input.file_id,
                page: input.page,
                color: input.color,
                text: input.text,
                rects: input.rects,
            },
            self.env.clock.now(),
        )?;
        self.items.insert_highlight(&highlight).await?;
        Ok(HighlightView {
            highlight,
            is_current_file: true,
        })
    }

    pub async fn update_highlight(
        &self,
        owner_id: Uuid,
        item: ItemRef,
        id: Uuid,
        color: HighlightColor,
    ) -> Result<HighlightView, LibraryError> {
        let current = self.ensure_item(owner_id, item).await?;
        let mut highlight = self
            .items
            .find_highlight(owner_id, item, id)
            .await?
            .ok_or(LibraryError::HighlightNotFound)?;
        highlight.recolor(color);
        if !self
            .items
            .update_highlight_color(&highlight, self.env.clock.now())
            .await?
        {
            return Err(LibraryError::HighlightNotFound);
        }
        Ok(HighlightView {
            is_current_file: highlight.is_from_current_file(current),
            highlight,
        })
    }

    /// Exclusão lógica: o destaque sai do leitor e das listas (RN-08).
    pub async fn delete_highlight(
        &self,
        owner_id: Uuid,
        item: ItemRef,
        id: Uuid,
    ) -> Result<(), LibraryError> {
        self.ensure_item(owner_id, item).await?;
        if self
            .items
            .soft_delete_highlight(owner_id, item, id, self.env.clock.now())
            .await?
        {
            return Ok(());
        }
        Err(LibraryError::HighlightNotFound)
    }
}
