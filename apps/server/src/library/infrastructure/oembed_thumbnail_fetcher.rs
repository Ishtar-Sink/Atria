//! Busca da miniatura de vídeo por oEmbed, só de YouTube e Vimeo (CB-12): `https`,
//! tempo limite de 3 s e tamanho máximo. A URL do vídeo nunca vai para o log
//! ([project/security-13]).

use std::time::Duration;

use axum::body::Bytes;
use reqwest::Url;
use serde::Deserialize;

use crate::library::application::ports::{
    FetchedThumbnail, ThumbnailError, ThumbnailFetcher, ThumbnailFuture,
};
use crate::library::domain::library_file::{FileKind, THUMBNAIL_MAX_BYTES, detect};
use crate::library::domain::video::oembed_endpoint;

const TIMEOUT: Duration = Duration::from_secs(3);
const OEMBED_MAX_BYTES: usize = 256 * 1024;

#[derive(Deserialize)]
struct OembedDocument {
    title: Option<String>,
    thumbnail_url: Option<String>,
}

#[derive(Clone)]
pub struct OembedThumbnailFetcher {
    client: reqwest::Client,
}

impl OembedThumbnailFetcher {
    pub fn new(client: reqwest::Client) -> Self {
        Self { client }
    }

    async fn download(&self, url: Url, max_bytes: usize) -> Result<Vec<u8>, ThumbnailError> {
        let mut response = self
            .client
            .get(url)
            .timeout(TIMEOUT)
            .send()
            .await
            .map_err(|_| ThumbnailError::Network)?;
        if !response.status().is_success() {
            return Err(ThumbnailError::Invalid);
        }
        let mut body = Vec::new();
        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|_| ThumbnailError::Network)?
        {
            if body.len() + chunk.len() > max_bytes {
                return Err(ThumbnailError::Invalid);
            }
            body.extend_from_slice(&chunk);
        }
        Ok(body)
    }

    async fn fetch_thumbnail(
        &self,
        video_url: &Url,
    ) -> Result<Option<FetchedThumbnail>, ThumbnailError> {
        let Some(endpoint) = oembed_endpoint(video_url) else {
            return Ok(None);
        };
        let body = self.download(endpoint, OEMBED_MAX_BYTES).await?;
        let document: OembedDocument =
            serde_json::from_slice(&body).map_err(|_| ThumbnailError::Invalid)?;
        let Some(thumbnail_url) = document.thumbnail_url else {
            return Ok(None);
        };
        let thumbnail_url = Url::parse(&thumbnail_url).map_err(|_| ThumbnailError::Invalid)?;
        if thumbnail_url.scheme() != "https" {
            return Err(ThumbnailError::Invalid);
        }
        let bytes = self.download(thumbnail_url, THUMBNAIL_MAX_BYTES).await?;
        // Só uma imagem é aceita; o tipo é detectado de novo ao gravar o arquivo.
        detect(&bytes)
            .filter(|found| found.kind == FileKind::Image)
            .ok_or(ThumbnailError::Invalid)?;
        Ok(Some(FetchedThumbnail {
            title: document.title,
            bytes: Bytes::from(bytes),
        }))
    }
}

impl ThumbnailFetcher for OembedThumbnailFetcher {
    fn fetch<'a>(&'a self, video_url: &'a Url) -> ThumbnailFuture<'a> {
        Box::pin(self.fetch_thumbnail(video_url))
    }
}
