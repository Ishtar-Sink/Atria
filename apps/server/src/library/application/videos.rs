//! Casos de uso de vídeos: cadastro com miniatura por oEmbed (CB-12) e envio manual.
//! Notas vêm de `ItemOps` com `ItemRef::Video`.

use std::sync::Arc;

use axum::body::Bytes;
use uuid::Uuid;

use super::ports::{FileStore, ThumbnailFetcher, VideoRepository};
use super::{Env, FileService, ListQuery, Listed, finish_page};
use crate::library::domain::error::LibraryError;
use crate::library::domain::library_file::FileKind;
use crate::library::domain::video::{NewVideo, Video, VideoChanges, VideoStatus, oembed_endpoint};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone)]
pub struct CreateVideo {
    pub visibility: Visibility,
    pub url: String,
    pub title: Option<String>,
    pub channel: Option<String>,
    pub watch_status: VideoStatus,
    pub tags: Vec<String>,
}

pub struct VideoService<V, F> {
    videos: V,
    files: FileService<F>,
    fetcher: Arc<dyn ThumbnailFetcher>,
    env: Env,
}

impl<V: VideoRepository, F: FileStore> VideoService<V, F> {
    pub fn new(
        videos: V,
        files: FileService<F>,
        fetcher: Arc<dyn ThumbnailFetcher>,
        env: Env,
    ) -> Self {
        Self {
            videos,
            files,
            fetcher,
            env,
        }
    }

    /// Cria o vídeo. A miniatura só é buscada para provedor permitido e, em qualquer
    /// erro, o vídeo nasce sem ela (CB-12): a pessoa a envia à mão depois.
    pub async fn create(&self, owner_id: Uuid, input: CreateVideo) -> Result<Video, LibraryError> {
        let mut video = Video::new(
            NewVideo {
                id: self.env.ids.new_id(),
                owner_id,
                visibility: input.visibility,
                url: input.url,
                title: input.title,
                channel: input.channel,
                watch_status: input.watch_status,
                tags: input.tags,
            },
            self.env.clock.now(),
        )?;
        self.attach_fetched_thumbnail(&mut video).await;
        self.videos.insert(&video).await?;
        Ok(video)
    }

    async fn attach_fetched_thumbnail(&self, video: &mut Video) {
        let Ok(url) = reqwest::Url::parse(&video.url) else {
            return;
        };
        if oembed_endpoint(&url).is_none() {
            return;
        }
        let Ok(Some(fetched)) = self.fetcher.fetch(&url).await else {
            return;
        };
        if let Ok(file) = self
            .files
            .store_thumbnail(video.owner_id, fetched.bytes)
            .await
        {
            video.thumbnail_file_id = Some(file.id);
        }
        if video.title.is_none() {
            let title = fetched.title.map(|title| title.trim().to_owned());
            video.title = title.filter(|title| !title.is_empty() && title.chars().count() <= 300);
        }
    }

    pub async fn get(&self, owner_id: Uuid, id: Uuid) -> Result<Video, LibraryError> {
        self.videos
            .find(owner_id, id)
            .await?
            .ok_or(LibraryError::VideoNotFound)
    }

    pub async fn list(
        &self,
        owner_id: Uuid,
        query: ListQuery,
    ) -> Result<Listed<Video>, LibraryError> {
        let rows = self.videos.list(owner_id, &query.to_filter()?).await?;
        Ok(finish_page(rows, query.limit, |video| {
            (video.created_at, video.id)
        }))
    }

    pub async fn update(
        &self,
        owner_id: Uuid,
        id: Uuid,
        changes: VideoChanges,
    ) -> Result<Video, LibraryError> {
        let mut video = self.get(owner_id, id).await?;
        video.apply(changes, self.env.clock.now())?;
        if !self.videos.update(&video).await? {
            return Err(LibraryError::VideoNotFound);
        }
        Ok(video)
    }

    /// Exclusão lógica; a notificação ao contexto de ligações é do handler (CB-06).
    pub async fn delete(&self, owner_id: Uuid, id: Uuid) -> Result<(), LibraryError> {
        let at = self.env.clock.now();
        if self.videos.soft_delete(owner_id, id, at).await? {
            return Ok(());
        }
        Err(LibraryError::VideoNotFound)
    }

    /// Envio manual da miniatura, que substitui a anterior.
    pub async fn set_thumbnail(
        &self,
        owner_id: Uuid,
        id: Uuid,
        bytes: Bytes,
    ) -> Result<Video, LibraryError> {
        // O vídeo vem antes do arquivo: quem não é o dono recebe 404, não 415.
        let mut video = self.get(owner_id, id).await?;
        let file = self
            .files
            .store_upload(owner_id, bytes, FileKind::Image)
            .await?;
        let old = video.thumbnail_file_id.replace(file.id);
        video.updated_at = self.env.clock.now();
        if !self.videos.update(&video).await? {
            self.files.discard(owner_id, file.id).await;
            return Err(LibraryError::VideoNotFound);
        }
        if let Some(old) = old {
            self.files.discard(owner_id, old).await;
        }
        Ok(video)
    }
}
