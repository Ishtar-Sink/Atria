//! Repositório PostgreSQL de vídeos (queries checadas na compilação).

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use super::infra;
use crate::http::AppState;
use crate::library::application::ports::{ListFilter, VideoRepository};
use crate::library::domain::error::LibraryError;
use crate::library::domain::video::{Video, VideoStatus};
use crate::shared::db::begin_for_user;
use crate::shared::visibility::Visibility;

struct VideoRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    url: String,
    title: Option<String>,
    channel: Option<String>,
    watch_status: String,
    tags: Vec<String>,
    thumbnail_file_id: Option<Uuid>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl VideoRow {
    fn into_video(self) -> Result<Video, LibraryError> {
        let row = self;
        Ok(Video {
            watch_status: VideoStatus::parse(&row.watch_status).map_err(|_| {
                LibraryError::infrastructure("status de exibição desconhecido no banco")
            })?,
            channel: row.channel,
            id: row.id,
            owner_id: row.owner_id,
            visibility: row.visibility,
            url: row.url,
            title: row.title,
            tags: row.tags,
            thumbnail_file_id: row.thumbnail_file_id,
            created_at: row.created_at,
            updated_at: row.updated_at,
        })
    }
}

#[derive(Clone)]
pub struct PgVideoRepository {
    pool: PgPool,
}

impl PgVideoRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn from_state(state: &AppState) -> Self {
        Self::new(state.pool.clone())
    }
}

impl VideoRepository for PgVideoRepository {
    async fn insert(&self, video: &Video) -> Result<(), LibraryError> {
        let mut tx = begin_for_user(&self.pool, video.owner_id)
            .await
            .map_err(infra)?;
        sqlx::query!(
            "INSERT INTO videos (id, owner_id, visibility, url, title, tags, thumbnail_file_id, \
             created_at, updated_at, channel, watch_status) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
            video.id,
            video.owner_id,
            video.visibility as _,
            &video.url,
            &video.title as _,
            &video.tags,
            video.thumbnail_file_id,
            video.created_at as _,
            video.updated_at as _,
            &video.channel as _,
            video.watch_status.as_str()
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)
    }

    async fn update(&self, video: &Video) -> Result<bool, LibraryError> {
        let mut tx = begin_for_user(&self.pool, video.owner_id)
            .await
            .map_err(infra)?;
        let result = sqlx::query!(
            "UPDATE videos SET visibility = $3, url = $4, title = $5, tags = $6, \
             thumbnail_file_id = $7, updated_at = $8, channel = $9, watch_status = $10 \
             WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL",
            video.owner_id,
            video.id,
            video.visibility as _,
            &video.url,
            &video.title as _,
            &video.tags,
            video.thumbnail_file_id,
            video.updated_at as _,
            &video.channel as _,
            video.watch_status.as_str()
        )
        .execute(&mut *tx)
        .await
        .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        Ok(result.rows_affected() == 1)
    }

    async fn find(&self, owner_id: Uuid, id: Uuid) -> Result<Option<Video>, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let row = sqlx::query_as!(VideoRow, "SELECT id, owner_id, visibility AS \"visibility: _\", url, title, channel, watch_status, tags, \
     thumbnail_file_id, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM videos \
     WHERE owner_id = $1 AND id = $2 AND deleted_at IS NULL", owner_id, id)
            .fetch_optional(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        row.map(VideoRow::into_video).transpose()
    }

    async fn list(&self, owner_id: Uuid, filter: &ListFilter) -> Result<Vec<Video>, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let rows = sqlx::query_as!(VideoRow, "SELECT id, owner_id, visibility AS \"visibility: _\", url, title, channel, watch_status, tags, \
     thumbnail_file_id, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM videos \
     WHERE owner_id = $1 AND deleted_at IS NULL \
       AND ($2::text IS NULL OR visibility = $2) \
       AND ($3::text IS NULL OR $3 = ANY(tags)) \
       AND ($4::text IS NULL OR search_vector @@ websearch_to_tsquery('portuguese', library_unaccent($4))) \
       AND ($5::timestamptz IS NULL OR (created_at, id) < ($5, $6)) \
       AND ($8::text IS NULL OR watch_status = $8) \
     ORDER BY created_at DESC, id DESC LIMIT $7", owner_id, filter.visibility as _, &filter.tag as _, &filter.text as _, filter.after.map(|(at, _)| at) as _, filter.after.map(|(_, id)| id), filter.limit, filter.video_status.map(VideoStatus::as_str))
            .fetch_all(&mut *tx)
            .await
            .map_err(infra)?;
        tx.commit().await.map_err(infra)?;
        rows.into_iter().map(VideoRow::into_video).collect()
    }

    async fn soft_delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        at: DateTime<Utc>,
    ) -> Result<bool, LibraryError> {
        let mut tx = begin_for_user(&self.pool, owner_id).await.map_err(infra)?;
        let result = sqlx::query!(
            "UPDATE videos SET deleted_at = $3, updated_at = $3 \
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
