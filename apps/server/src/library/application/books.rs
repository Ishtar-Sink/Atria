//! Casos de uso de livros: cadastro, sessões de leitura, capa e PDF. Notas, posição e
//! destaques vêm de `ItemOps` com `ItemRef::Book`.

use axum::body::Bytes;
use chrono::NaiveDate;
use uuid::Uuid;

use super::ports::{BookRepository, FileStore};
use super::{Env, FileService, ListQuery, Listed, finish_page};
use crate::library::domain::book::{Book, BookChanges, BookStatus, NewBook};
use crate::library::domain::error::LibraryError;
use crate::library::domain::library_file::{FileKind, LibraryFile};
use crate::library::domain::reading_session::{NewReadingSession, ReadingSession, SessionChanges};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone)]
pub struct CreateBook {
    pub visibility: Visibility,
    pub title: String,
    pub author: Option<String>,
    pub publisher: Option<String>,
    pub page_count: Option<i32>,
    pub tags: Vec<String>,
    pub reading_status: BookStatus,
}

#[derive(Debug, Clone)]
pub struct CreateSession {
    pub read_on: NaiveDate,
    pub pages_read: i32,
    pub from_page: Option<i32>,
    pub to_page: Option<i32>,
    pub observation: Option<String>,
}

pub struct BookService<B, F> {
    books: B,
    files: FileService<F>,
    env: Env,
}

impl<B: BookRepository, F: FileStore> BookService<B, F> {
    pub fn new(books: B, files: FileService<F>, env: Env) -> Self {
        Self { books, files, env }
    }

    pub async fn create(&self, owner_id: Uuid, input: CreateBook) -> Result<Book, LibraryError> {
        let book = Book::new(
            NewBook {
                id: self.env.ids.new_id(),
                owner_id,
                visibility: input.visibility,
                title: input.title,
                author: input.author,
                publisher: input.publisher,
                page_count: input.page_count,
                tags: input.tags,
                reading_status: input.reading_status,
            },
            self.env.clock.now(),
        )?;
        self.books.insert(&book).await?;
        Ok(book)
    }

    pub async fn get(&self, owner_id: Uuid, id: Uuid) -> Result<Book, LibraryError> {
        self.books
            .find(owner_id, id)
            .await?
            .ok_or(LibraryError::BookNotFound)
    }

    pub async fn list(
        &self,
        owner_id: Uuid,
        query: ListQuery,
    ) -> Result<Listed<Book>, LibraryError> {
        let rows = self.books.list(owner_id, &query.to_filter()?).await?;
        Ok(finish_page(rows, query.limit, |book| {
            (book.created_at, book.id)
        }))
    }

    pub async fn update(
        &self,
        owner_id: Uuid,
        id: Uuid,
        changes: BookChanges,
    ) -> Result<Book, LibraryError> {
        let mut book = self.get(owner_id, id).await?;
        book.apply(changes, self.env.clock.now())?;
        if !self.books.update(&book).await? {
            return Err(LibraryError::BookNotFound);
        }
        Ok(book)
    }

    /// Exclusão lógica; a notificação ao contexto de ligações é do handler (CB-06).
    pub async fn delete(&self, owner_id: Uuid, id: Uuid) -> Result<(), LibraryError> {
        let at = self.env.clock.now();
        if self.books.soft_delete(owner_id, id, at).await? {
            return Ok(());
        }
        Err(LibraryError::BookNotFound)
    }

    pub async fn list_sessions(
        &self,
        owner_id: Uuid,
        book_id: Uuid,
    ) -> Result<Vec<ReadingSession>, LibraryError> {
        self.get(owner_id, book_id).await?;
        self.books.list_sessions(owner_id, book_id).await
    }

    pub async fn create_session(
        &self,
        owner_id: Uuid,
        book_id: Uuid,
        input: CreateSession,
    ) -> Result<ReadingSession, LibraryError> {
        self.get(owner_id, book_id).await?;
        let session = ReadingSession::new(
            NewReadingSession {
                id: self.env.ids.new_id(),
                owner_id,
                book_id,
                read_on: input.read_on,
                pages_read: input.pages_read,
                from_page: input.from_page,
                to_page: input.to_page,
                observation: input.observation,
            },
            self.env.clock.now(),
        )?;
        self.books.insert_session(&session).await?;
        Ok(session)
    }

    pub async fn update_session(
        &self,
        owner_id: Uuid,
        book_id: Uuid,
        id: Uuid,
        changes: SessionChanges,
    ) -> Result<ReadingSession, LibraryError> {
        self.get(owner_id, book_id).await?;
        let mut session = self
            .books
            .find_session(owner_id, book_id, id)
            .await?
            .ok_or(LibraryError::ReadingSessionNotFound)?;
        session.apply(changes, self.env.clock.now())?;
        if !self.books.update_session(&session).await? {
            return Err(LibraryError::ReadingSessionNotFound);
        }
        Ok(session)
    }

    pub async fn delete_session(
        &self,
        owner_id: Uuid,
        book_id: Uuid,
        id: Uuid,
    ) -> Result<(), LibraryError> {
        self.get(owner_id, book_id).await?;
        if self.books.delete_session(owner_id, book_id, id).await? {
            return Ok(());
        }
        Err(LibraryError::ReadingSessionNotFound)
    }

    pub async fn set_cover(
        &self,
        owner_id: Uuid,
        id: Uuid,
        bytes: Bytes,
    ) -> Result<Book, LibraryError> {
        self.replace_file(owner_id, id, bytes, FileKind::Image)
            .await
    }

    /// Imagem da capa e seus metadados; 404 sem capa ou para quem não é o dono.
    pub async fn cover(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> Result<(LibraryFile, Bytes), LibraryError> {
        let book = self.get(owner_id, id).await?;
        let file_id = book.cover_file_id.ok_or(LibraryError::CoverNotFound)?;
        self.files.read(owner_id, file_id).await
    }

    /// Remove a capa e descarta o arquivo; sem capa, não há o que fazer e não é erro.
    pub async fn remove_cover(&self, owner_id: Uuid, id: Uuid) -> Result<(), LibraryError> {
        let mut book = self.get(owner_id, id).await?;
        let Some(old) = book.cover_file_id.take() else {
            return Ok(());
        };
        book.updated_at = self.env.clock.now();
        if !self.books.update(&book).await? {
            return Err(LibraryError::BookNotFound);
        }
        self.files.discard(owner_id, old).await;
        Ok(())
    }

    /// Troca o PDF: o antigo recebe `deleted_at` e perde o conteúdo, e os destaques
    /// continuam ligados a ele (CB-19).
    pub async fn set_pdf(
        &self,
        owner_id: Uuid,
        id: Uuid,
        bytes: Bytes,
    ) -> Result<Book, LibraryError> {
        self.replace_file(owner_id, id, bytes, FileKind::Pdf).await
    }

    async fn replace_file(
        &self,
        owner_id: Uuid,
        id: Uuid,
        bytes: Bytes,
        kind: FileKind,
    ) -> Result<Book, LibraryError> {
        // O livro vem antes do arquivo: quem não é o dono recebe 404, não 415.
        let mut book = self.get(owner_id, id).await?;
        let file = self.files.store_upload(owner_id, bytes, kind).await?;
        let old = match kind {
            FileKind::Pdf => book.pdf_file_id.replace(file.id),
            FileKind::Image => book.cover_file_id.replace(file.id),
        };
        book.updated_at = self.env.clock.now();
        if !self.books.update(&book).await? {
            self.files.discard(owner_id, file.id).await;
            return Err(LibraryError::BookNotFound);
        }
        if let Some(old) = old {
            self.files.discard(owner_id, old).await;
        }
        Ok(book)
    }
}
