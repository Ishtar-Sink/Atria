//! Repositório PostgreSQL das notas de item, dos destaques e da posição de leitura
//! (queries checadas na compilação).

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use sqlx::types::Json;
use uuid::Uuid;

use super::infra;
use crate::http::AppState;
use crate::library::application::ports::ItemRepository;
use crate::library::domain::ItemRef;
use crate::library::domain::error::LibraryError;
use crate::library::domain::highlight::{Highlight, HighlightColor, HighlightRect};
use crate::library::domain::item_note::ItemNote;
use crate::shared::db::begin_for_user;

/// As três chaves estrangeiras de `item_notes`; só uma vem preenchida.
fn note_keys(item: ItemRef) -> (Option<Uuid>, Option<Uuid>, Option<Uuid>) {
    match item {
        ItemRef::Book(id) => (Some(id), None, None),
        ItemRef::Article(id) => (None, Some(id), None),
        ItemRef::Video(id) => (None, None, Some(id)),
    }
}

fn item_from_keys(
    book: Option<Uuid>,
    article: Option<Uuid>,
    video: Option<Uuid>,
) -> Option<ItemRef> {
    match (book, article, video) {
        (Some(id), None, None) => Some(ItemRef::Book(id)),
        (None, Some(id), None) => Some(ItemRef::Article(id)),
        (None, None, Some(id)) => Some(ItemRef::Video(id)),
        _ => None,
    }
}

struct NoteRow {
    id: Uuid,
    owner_id: Uuid,
    book_id: Option<Uuid>,
    article_id: Option<Uuid>,
    video_id: Option<Uuid>,
    quote: Option<String>,
    page: Option<i32>,
    comment: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl NoteRow {
    fn into_note(self) -> Result<ItemNote, LibraryError> {
        let item = item_from_keys(self.book_id, self.article_id, self.video_id)
            .ok_or_else(|| LibraryError::infrastructure("nota de item sem um único pai"))?;
        Ok(ItemNote {
            id: self.id,
            owner_id: self.owner_id,
            item,
            quote: self.quote,
            page: self.page,
            comment: self.comment,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

struct HighlightRow {
    id: Uuid,
    owner_id: Uuid,
    book_id: Option<Uuid>,
    article_id: Option<Uuid>,
    file_id: Uuid,
    page: i32,
    color: String,
    text: String,
    rects: Json<Vec<HighlightRect>>,
    created_at: DateTime<Utc>,
}

impl HighlightRow {
    fn into_highlight(self) -> Result<Highlight, LibraryError> {
        let item = item_from_keys(self.book_id, self.article_id, None)
            .ok_or_else(|| LibraryError::infrastructure("destaque sem um único pai"))?;
        let color = HighlightColor::parse(&self.color)
            .map_err(|_| LibraryError::infrastructure("cor de destaque desconhecida no banco"))?;
        Ok(Highlight {
            id: self.id,
            owner_id: self.owner_id,
            item,
            file_id: self.file_id,
            page: self.page,
            color,
            text: self.text,
            rects: self.rects.0,
            created_at: self.created_at,
        })
    }
}

#[derive(Clone)]
pub struct PgItemRepository {
    pool: PgPool,
}

impl PgItemRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn from_state(state: &AppState) -> Self {
        Self::new(state.pool.clone())
    }
}

impl ItemRepository for PgItemRepository {
    async fn item_pdf(
        &self,
        owner_id: Uuid,
        item: ItemRef,
    ) -> Result<Option<Option<Uuid>>, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let row = match item {
            ItemRef::Book(id) => {
                sqlx::query_scalar!(
                    "SELECT pdf_file_id FROM books \
                     WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL",
                    owner_id,
                    id
                )
                .fetch_optional(&mut *tx)
                .await
            }
            ItemRef::Article(id) => {
                sqlx::query_scalar!(
                    "SELECT pdf_file_id FROM articles \
                     WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL",
                    owner_id,
                    id
                )
                .fetch_optional(&mut *tx)
                .await
            }
            // Vídeo não tem PDF: a consulta só confirma que ele existe.
            ItemRef::Video(id) => {
                sqlx::query_scalar!(
                    r#"SELECT NULL::uuid AS "pdf_file_id?" FROM videos
                       WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL"#,
                    owner_id,
                    id
                )
                .fetch_optional(&mut *tx)
                .await
            }
        }
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(row)
    }

    async fn insert_note(&self, note: &ItemNote) -> Result<(), LibraryError> {
        let (book, article, video) = note_keys(note.item);
        let mut tx = begin_for_user(&self.pool, note.owner_id)
            .await
            .map_err(infra)?;
        sqlx::query!(
            "INSERT INTO item_notes (id, owner_id, book_id, article_id, video_id, quote, page, \
             comment, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
            note.id,
            note.owner_id,
            book,
            article,
            video,
            &note.quote as _,
            note.page,
            &note.comment as _,
            note.created_at as _,
            note.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)
    }

    async fn update_note(&self, note: &ItemNote) -> Result<bool, LibraryError> {
        let mut tx = begin_for_user(&self.pool, note.owner_id)
            .await
            .map_err(infra)?;
        let result = sqlx::query!(
            "UPDATE item_notes SET quote = $3, page = $4, comment = $5, updated_at = $6 \
             WHERE owner_id = $1 AND id = $2",
            note.owner_id,
            note.id,
            &note.quote as _,
            note.page,
            &note.comment as _,
            note.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(result.rows_affected() == 1)
    }

    async fn find_note(
        &self,
        owner_id: Uuid,
        item: ItemRef,
        id: Uuid,
    ) -> Result<Option<ItemNote>, LibraryError> {
        let (book, article, video) = note_keys(item);
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let row = sqlx::query_as!(
            NoteRow,
            "SELECT id, owner_id, book_id, article_id, video_id, quote, page, comment, \
     created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM item_notes \
     WHERE owner_id = $1 AND id = $2 AND book_id IS NOT DISTINCT FROM $3 \
       AND article_id IS NOT DISTINCT FROM $4 AND video_id IS NOT DISTINCT FROM $5",
            owner_id,
            id,
            book,
            article,
            video
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        row.map(NoteRow::into_note).transpose()
    }

    async fn delete_note(
        &self,
        owner_id: Uuid,
        item: ItemRef,
        id: Uuid,
    ) -> Result<bool, LibraryError> {
        let (book, article, video) = note_keys(item);
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let result = sqlx::query!("DELETE FROM item_notes WHERE owner_id = $1 AND id = $2 AND book_id IS NOT DISTINCT FROM $3 \
             AND article_id IS NOT DISTINCT FROM $4 AND video_id IS NOT DISTINCT FROM $5", owner_id, id, book, article, video)
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(result.rows_affected() == 1)
    }

    async fn list_notes(
        &self,
        owner_id: Uuid,
        item: ItemRef,
    ) -> Result<Vec<ItemNote>, LibraryError> {
        let (book, article, video) = note_keys(item);
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let rows = sqlx::query_as!(
            NoteRow,
            "SELECT id, owner_id, book_id, article_id, video_id, quote, page, comment, \
     created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM item_notes \
     WHERE owner_id = $1 AND book_id IS NOT DISTINCT FROM $2 \
       AND article_id IS NOT DISTINCT FROM $3 AND video_id IS NOT DISTINCT FROM $4 \
     ORDER BY created_at DESC, id DESC",
            owner_id,
            book,
            article,
            video
        )
        .fetch_all(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        rows.into_iter().map(NoteRow::into_note).collect()
    }

    async fn insert_highlight(&self, highlight: &Highlight) -> Result<(), LibraryError> {
        let (book, article, _) = note_keys(highlight.item);
        let mut tx = begin_for_user(&self.pool, highlight.owner_id)
            .await
            .map_err(infra)?;
        sqlx::query!("INSERT INTO highlights (id, owner_id, book_id, article_id, file_id, page, color, text, \
             rects, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)", highlight.id, highlight.owner_id, book, article, highlight.file_id, highlight.page, highlight.color.as_str(), &highlight.text, Json(&highlight.rects) as _, highlight.created_at as _)
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)
    }

    async fn list_highlights(
        &self,
        owner_id: Uuid,
        item: ItemRef,
    ) -> Result<Vec<Highlight>, LibraryError> {
        let (book, article, _) = note_keys(item);
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let rows = sqlx::query_as!(HighlightRow, "SELECT id, owner_id, book_id, article_id, file_id, page, color, \
     text, rects AS \"rects: _\", created_at AS \"created_at: _\" FROM highlights \
     WHERE owner_id = $1 AND book_id IS NOT DISTINCT FROM $2 AND article_id IS NOT DISTINCT FROM $3 \
     ORDER BY page, created_at, id", owner_id, book, article)
            .fetch_all(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        rows.into_iter().map(HighlightRow::into_highlight).collect()
    }

    async fn get_position(
        &self,
        owner_id: Uuid,
        item: ItemRef,
    ) -> Result<Option<Option<i32>>, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let row = match item {
            ItemRef::Book(id) => {
                sqlx::query_scalar!(
                    "SELECT last_read_page FROM books \
                     WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL",
                    owner_id,
                    id
                )
                .fetch_optional(&mut *tx)
                .await
            }
            ItemRef::Article(id) => {
                sqlx::query_scalar!(
                    "SELECT last_read_page FROM articles \
                     WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL",
                    owner_id,
                    id
                )
                .fetch_optional(&mut *tx)
                .await
            }
            ItemRef::Video(_) => return Ok(None),
        }
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(row)
    }

    async fn set_position(
        &self,
        owner_id: Uuid,
        item: ItemRef,
        page: i32,
    ) -> Result<bool, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let result = match item {
            ItemRef::Book(id) => {
                sqlx::query!(
                    "UPDATE books SET last_read_page = $3 \
                     WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL",
                    owner_id,
                    id,
                    page
                )
                .execute(&mut *tx)
                .await
            }
            ItemRef::Article(id) => {
                sqlx::query!(
                    "UPDATE articles SET last_read_page = $3 \
                     WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL",
                    owner_id,
                    id,
                    page
                )
                .execute(&mut *tx)
                .await
            }
            ItemRef::Video(_) => return Ok(false),
        }
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(result.rows_affected() == 1)
    }
}
