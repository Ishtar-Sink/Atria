//! Repositório PostgreSQL de livros e sessões de leitura, e a busca do Acervo.
//!
//! As queries são checadas na compilação ([project/stack-04]), com os dados offline
//! em `.sqlx`, e nenhum SQL é montado com dado do usuário.

use std::sync::Arc;

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::infra;
use crate::http::AppState;
use crate::library::application::ports::{
    BookRepository, LibrarySearchHit, ListFilter, SearchFuture, SearchRepository,
};
use crate::library::application::search::LibrarySearch;
use crate::library::domain::book::{Book, BookStatus};
use crate::library::domain::error::LibraryError;
use crate::library::domain::reading_session::ReadingSession;
use crate::shared::db::begin_for_user;
use crate::shared::visibility::Visibility;

// O total lido é calculado das sessões na própria leitura: nunca é gravado.
struct BookRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    title: String,
    author: Option<String>,
    publisher: Option<String>,
    page_count: Option<i32>,
    tags: Vec<String>,
    reading_status: String,
    cover_file_id: Option<Uuid>,
    pdf_file_id: Option<Uuid>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    pages_read_total: i64,
}

impl BookRow {
    fn into_book(self) -> Result<Book, LibraryError> {
        let row = self;
        Ok(Book {
            reading_status: BookStatus::parse(&row.reading_status).map_err(|_| {
                LibraryError::infrastructure("status de leitura desconhecido no banco")
            })?,
            id: row.id,
            owner_id: row.owner_id,
            visibility: row.visibility,
            title: row.title,
            author: row.author,
            publisher: row.publisher,
            page_count: row.page_count,
            tags: row.tags,
            cover_file_id: row.cover_file_id,
            pdf_file_id: row.pdf_file_id,
            pages_read_total: row.pages_read_total,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

struct SessionRow {
    id: Uuid,
    owner_id: Uuid,
    book_id: Uuid,
    read_on: NaiveDate,
    pages_read: i32,
    from_page: Option<i32>,
    to_page: Option<i32>,
    observation: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<SessionRow> for ReadingSession {
    fn from(row: SessionRow) -> Self {
        Self {
            id: row.id,
            owner_id: row.owner_id,
            book_id: row.book_id,
            read_on: row.read_on,
            pages_read: row.pages_read,
            from_page: row.from_page,
            to_page: row.to_page,
            observation: row.observation,
            created_at: row.created_at,
            updated_at: row.updated_at,
        }
    }
}

#[derive(Clone)]
pub struct PgBookRepository {
    pool: PgPool,
}

impl PgBookRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn from_state(state: &AppState) -> Self {
        Self::new(state.pool.clone())
    }
}

impl BookRepository for PgBookRepository {
    async fn insert(&self, book: &Book) -> Result<(), LibraryError> {
        let mut tx = begin_for_user(&self.pool, book.owner_id)
            .await
            .map_err(infra)?;
        sqlx::query!(
            "INSERT INTO books (id, owner_id, visibility, title, author, publisher, page_count, \
             tags, cover_file_id, pdf_file_id, created_at, updated_at, reading_status) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
            book.id,
            book.owner_id,
            book.visibility as _,
            &book.title,
            &book.author as _,
            &book.publisher as _,
            book.page_count,
            &book.tags,
            book.cover_file_id,
            book.pdf_file_id,
            book.created_at as _,
            book.updated_at as _,
            book.reading_status.as_str()
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)
    }

    async fn update(&self, book: &Book) -> Result<bool, LibraryError> {
        let mut tx = begin_for_user(&self.pool, book.owner_id)
            .await
            .map_err(infra)?;
        let result = sqlx::query!(
            "UPDATE books SET visibility = $3, title = $4, author = $5, publisher = $6, \
             page_count = $7, tags = $8, cover_file_id = $9, pdf_file_id = $10, updated_at = $11, \
             reading_status = $12 \
             WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL",
            book.owner_id,
            book.id,
            book.visibility as _,
            &book.title,
            &book.author as _,
            &book.publisher as _,
            book.page_count,
            &book.tags,
            book.cover_file_id,
            book.pdf_file_id,
            book.updated_at as _,
            book.reading_status.as_str()
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(result.rows_affected() == 1)
    }

    async fn find(&self, owner_id: Uuid, id: Uuid) -> Result<Option<Book>, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let row = sqlx::query_as!(BookRow, "SELECT b.id, b.owner_id, b.visibility AS \"visibility: _\", b.title, b.author, b.publisher, \
     b.page_count, b.tags, b.reading_status, b.cover_file_id, b.pdf_file_id, b.created_at AS \"created_at: _\", b.updated_at AS \"updated_at: _\", \
     COALESCE((SELECT SUM(s.pages_read) FROM reading_sessions s \
               WHERE s.book_id = b.id AND s.owner_id = b.owner_id), 0)::bigint AS \"pages_read_total!\" \
     FROM books b WHERE b.owner_id = $1 AND b.id = $2 AND b.deleted_at IS NULL", owner_id, id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        row.map(BookRow::into_book).transpose()
    }

    async fn list(&self, owner_id: Uuid, filter: &ListFilter) -> Result<Vec<Book>, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let rows = sqlx::query_as!(BookRow, "SELECT b.id, b.owner_id, b.visibility AS \"visibility: _\", b.title, b.author, b.publisher, \
     b.page_count, b.tags, b.reading_status, b.cover_file_id, b.pdf_file_id, b.created_at AS \"created_at: _\", b.updated_at AS \"updated_at: _\", \
     COALESCE((SELECT SUM(s.pages_read) FROM reading_sessions s \
               WHERE s.book_id = b.id AND s.owner_id = b.owner_id), 0)::bigint AS \"pages_read_total!\" \
     FROM books b WHERE b.owner_id = $1 AND b.deleted_at IS NULL \
       AND ($2::text IS NULL OR b.visibility = $2) \
       AND ($3::text IS NULL OR $3 = ANY(b.tags)) \
       AND ($4::text IS NULL OR b.search_vector @@ websearch_to_tsquery('portuguese', library_unaccent($4))) \
       AND ($5::timestamptz IS NULL OR (b.created_at, b.id) < ($5, $6)) \
       AND ($8::text IS NULL OR b.reading_status = $8) \
     ORDER BY b.created_at DESC, b.id DESC LIMIT $7", owner_id, filter.visibility as _, &filter.tag as _, &filter.text as _, filter.after.map(|(at, _)| at) as _, filter.after.map(|(_, id)| id), filter.limit, filter.book_status.map(BookStatus::as_str))
            .fetch_all(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        rows.into_iter().map(BookRow::into_book).collect()
    }

    async fn soft_delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        at: DateTime<Utc>,
    ) -> Result<bool, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let result = sqlx::query!(
            "UPDATE books SET deleted_at = $3, updated_at = $3 \
             WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL",
            owner_id,
            id,
            at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(result.rows_affected() == 1)
    }

    async fn insert_session(&self, session: &ReadingSession) -> Result<(), LibraryError> {
        let mut tx = begin_for_user(&self.pool, session.owner_id)
            .await
            .map_err(infra)?;
        sqlx::query!(
            "INSERT INTO reading_sessions (id, owner_id, book_id, read_on, pages_read, from_page, \
             to_page, observation, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
            session.id,
            session.owner_id,
            session.book_id,
            session.read_on as _,
            session.pages_read,
            session.from_page,
            session.to_page,
            &session.observation as _,
            session.created_at as _,
            session.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)
    }

    async fn update_session(&self, session: &ReadingSession) -> Result<bool, LibraryError> {
        let mut tx = begin_for_user(&self.pool, session.owner_id)
            .await
            .map_err(infra)?;
        let result = sqlx::query!(
            "UPDATE reading_sessions SET read_on = $4, pages_read = $5, from_page = $6, \
             to_page = $7, observation = $8, updated_at = $9 \
             WHERE owner_id = $1 AND book_id = $2 AND id = $3",
            session.owner_id,
            session.book_id,
            session.id,
            session.read_on as _,
            session.pages_read,
            session.from_page,
            session.to_page,
            &session.observation as _,
            session.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(result.rows_affected() == 1)
    }

    async fn find_session(
        &self,
        owner_id: Uuid,
        book_id: Uuid,
        id: Uuid,
    ) -> Result<Option<ReadingSession>, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let row = sqlx::query_as!(SessionRow, "SELECT id, owner_id, book_id, read_on AS \"read_on: _\", pages_read, from_page, \
     to_page, observation, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM reading_sessions \
     WHERE owner_id = $1 AND book_id = $2 AND id = $3", owner_id, book_id, id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(row.map(ReadingSession::from))
    }

    async fn delete_session(
        &self,
        owner_id: Uuid,
        book_id: Uuid,
        id: Uuid,
    ) -> Result<bool, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let result = sqlx::query!(
            "DELETE FROM reading_sessions WHERE owner_id = $1 AND book_id = $2 AND id = $3",
            owner_id,
            book_id,
            id
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(result.rows_affected() == 1)
    }

    async fn list_sessions(
        &self,
        owner_id: Uuid,
        book_id: Uuid,
    ) -> Result<Vec<ReadingSession>, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let rows = sqlx::query_as!(SessionRow, "SELECT id, owner_id, book_id, read_on AS \"read_on: _\", pages_read, from_page, \
     to_page, observation, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM reading_sessions \
     WHERE owner_id = $1 AND book_id = $2 ORDER BY read_on DESC, created_at DESC, id DESC", owner_id, book_id)
            .fetch_all(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(rows.into_iter().map(ReadingSession::from).collect())
    }
}

/// Busca sobre o `tsvector` das três entidades, sempre filtrada pelo dono.
#[derive(Clone)]
pub struct PgLibrarySearch {
    pool: PgPool,
}

impl PgLibrarySearch {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn entity_type(raw: &str) -> &'static str {
    match raw {
        "book" => "book",
        "article" => "article",
        _ => "video",
    }
}

impl SearchRepository for PgLibrarySearch {
    fn search<'a>(&'a self, owner_id: Uuid, query: &'a str, limit: i64) -> SearchFuture<'a> {
        Box::pin(async move {
            let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
            let rows = sqlx::query!(
                r#"SELECT entity_type AS "entity_type!", id AS "id!", title AS "title!",
                          rank AS "rank!" FROM (
                     SELECT 'book'::text AS entity_type, b.id, b.title,
                            ts_rank(b.search_vector, q.query)::float8 AS rank
                       FROM books b, websearch_to_tsquery('portuguese', library_unaccent($2)) AS q(query)
                      WHERE b.owner_id = $1 AND b.deleted_at IS NULL AND b.search_vector @@ q.query
                     UNION ALL
                     SELECT 'article'::text, a.id, a.title, ts_rank(a.search_vector, q.query)::float8
                       FROM articles a, websearch_to_tsquery('portuguese', library_unaccent($2)) AS q(query)
                      WHERE a.owner_id = $1 AND a.deleted_at IS NULL AND a.search_vector @@ q.query
                     UNION ALL
                     SELECT 'video'::text, v.id, COALESCE(v.title, v.url),
                            ts_rank(v.search_vector, q.query)::float8
                       FROM videos v, websearch_to_tsquery('portuguese', library_unaccent($2)) AS q(query)
                      WHERE v.owner_id = $1 AND v.deleted_at IS NULL AND v.search_vector @@ q.query
                   ) hits ORDER BY rank DESC, title, id LIMIT $3"#,
                owner_id,
                query,
                limit
            )
            .fetch_all(&mut *tx)
            .await
            .map_err(infra)?;
            tx.commit().await.map_err(infra)?;
            Ok(rows
                .into_iter()
                .map(|row| LibrarySearchHit {
                    entity_type: entity_type(&row.entity_type),
                    id: row.id,
                    title: row.title,
                    rank: row.rank,
                })
                .collect())
        })
    }
}

impl LibrarySearch {
    /// Busca montada com o banco do servidor, para a TASK-16.
    pub fn from_state(state: &AppState) -> Self {
        Self::new(Arc::new(PgLibrarySearch::new(state.pool.clone())))
    }
}
