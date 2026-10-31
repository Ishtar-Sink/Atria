//! Repositório PostgreSQL de artigos (queries checadas na compilação).

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::infra;
use crate::http::AppState;
use crate::library::application::ports::{ArticleRepository, ListFilter};
use crate::library::domain::article::{Article, ReadingStatus};
use crate::library::domain::error::LibraryError;
use crate::shared::db::begin_for_user;
use crate::shared::visibility::Visibility;

struct ArticleRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    title: String,
    url: Option<String>,
    author: Option<String>,
    source: Option<String>,
    tags: Vec<String>,
    reading_status: String,
    cover_file_id: Option<Uuid>,
    pdf_file_id: Option<Uuid>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl ArticleRow {
    fn into_article(self) -> Result<Article, LibraryError> {
        Ok(Article {
            reading_status: ReadingStatus::parse(&self.reading_status).map_err(|_| {
                LibraryError::infrastructure("status de leitura desconhecido no banco")
            })?,
            id: self.id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            title: self.title,
            url: self.url,
            author: self.author,
            source: self.source,
            tags: self.tags,
            cover_file_id: self.cover_file_id,
            pdf_file_id: self.pdf_file_id,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

#[derive(Clone)]
pub struct PgArticleRepository {
    pool: PgPool,
}

impl PgArticleRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn from_state(state: &AppState) -> Self {
        Self::new(state.pool.clone())
    }
}

impl ArticleRepository for PgArticleRepository {
    async fn insert(&self, article: &Article) -> Result<(), LibraryError> {
        let mut tx = begin_for_user(&self.pool, article.owner_id)
            .await
            .map_err(infra)?;
        sqlx::query!(
            "INSERT INTO articles (id, owner_id, visibility, title, url, author, source, tags, \
             reading_status, cover_file_id, pdf_file_id, created_at, updated_at) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
            article.id,
            article.owner_id,
            article.visibility as _,
            &article.title,
            &article.url as _,
            &article.author as _,
            &article.source as _,
            &article.tags,
            article.reading_status.as_str(),
            article.cover_file_id,
            article.pdf_file_id,
            article.created_at as _,
            article.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)
    }

    async fn update(&self, article: &Article) -> Result<bool, LibraryError> {
        let mut tx = begin_for_user(&self.pool, article.owner_id)
            .await
            .map_err(infra)?;
        let result = sqlx::query!("UPDATE articles SET visibility = $3, title = $4, url = $5, author = $6, source = $7, \
             tags = $8, reading_status = $9, cover_file_id = $10, pdf_file_id = $11, updated_at = $12 \
             WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL", article.owner_id, article.id, article.visibility as _, &article.title, &article.url as _, &article.author as _, &article.source as _, &article.tags, article.reading_status.as_str(), article.cover_file_id, article.pdf_file_id, article.updated_at as _)
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(result.rows_affected() == 1)
    }

    async fn find(&self, owner_id: Uuid, id: Uuid) -> Result<Option<Article>, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let row = sqlx::query_as!(ArticleRow, "SELECT id, owner_id, visibility AS \"visibility: _\", title, url, author, source, tags, \
     reading_status, cover_file_id, pdf_file_id, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM articles \
     WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL", owner_id, id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        row.map(ArticleRow::into_article).transpose()
    }

    async fn list(
        &self,
        owner_id: Uuid,
        filter: &ListFilter,
    ) -> Result<Vec<Article>, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let rows = sqlx::query_as!(ArticleRow, "SELECT id, owner_id, visibility AS \"visibility: _\", title, url, author, source, tags, \
     reading_status, cover_file_id, pdf_file_id, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM articles \
     WHERE owner_id = $1 AND deleted_at IS NULL \
       AND ($2::text IS NULL OR visibility = $2) \
       AND ($3::text IS NULL OR $3 = ANY(tags)) \
       AND ($4::text IS NULL OR search_vector @@ websearch_to_tsquery('portuguese', library_unaccent($4))) \
       AND ($5::text IS NULL OR reading_status = $5) \
       AND ($6::timestamptz IS NULL OR (created_at, id) < ($6, $7)) \
     ORDER BY created_at DESC, id DESC LIMIT $8", owner_id, filter.visibility as _, &filter.tag as _, &filter.text as _, filter.reading_status.map(ReadingStatus::as_str), filter.after.map(|(at, _)| at) as _, filter.after.map(|(_, id)| id), filter.limit)
            .fetch_all(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        rows.into_iter().map(ArticleRow::into_article).collect()
    }

    async fn soft_delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        at: DateTime<Utc>,
    ) -> Result<bool, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let result = sqlx::query!(
            "UPDATE articles SET deleted_at = $3, updated_at = $3 \
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
}
