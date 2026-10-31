//! Casos de uso de artigos: cadastro e PDF. Notas, posição e destaques vêm de
//! `ItemOps` com `ItemRef::Article`.

use axum::body::Bytes;
use uuid::Uuid;

use super::ports::{ArticleRepository, FileStore};
use super::{Env, FileService, ListQuery, Listed, finish_page};
use crate::library::domain::article::{Article, ArticleChanges, NewArticle, ReadingStatus};
use crate::library::domain::error::LibraryError;
use crate::library::domain::library_file::{FileKind, LibraryFile};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone)]
pub struct CreateArticle {
    pub visibility: Visibility,
    pub title: String,
    pub url: Option<String>,
    pub author: Option<String>,
    pub source: Option<String>,
    pub tags: Vec<String>,
    pub reading_status: ReadingStatus,
}

pub struct ArticleService<A, F> {
    articles: A,
    files: FileService<F>,
    env: Env,
}

impl<A: ArticleRepository, F: FileStore> ArticleService<A, F> {
    pub fn new(articles: A, files: FileService<F>, env: Env) -> Self {
        Self {
            articles,
            files,
            env,
        }
    }

    pub async fn create(
        &self,
        owner_id: Uuid,
        input: CreateArticle,
    ) -> Result<Article, LibraryError> {
        let article = Article::new(
            NewArticle {
                id: self.env.ids.new_id(),
                owner_id,
                visibility: input.visibility,
                title: input.title,
                url: input.url,
                author: input.author,
                source: input.source,
                tags: input.tags,
                reading_status: input.reading_status,
            },
            self.env.clock.now(),
        )?;
        self.articles.insert(&article).await?;
        Ok(article)
    }

    pub async fn get(&self, owner_id: Uuid, id: Uuid) -> Result<Article, LibraryError> {
        self.articles
            .find(owner_id, id)
            .await?
            .ok_or(LibraryError::ArticleNotFound)
    }

    pub async fn list(
        &self,
        owner_id: Uuid,
        query: ListQuery,
    ) -> Result<Listed<Article>, LibraryError> {
        let rows = self.articles.list(owner_id, &query.to_filter()?).await?;
        Ok(finish_page(rows, query.limit, |article| {
            (article.created_at, article.id)
        }))
    }

    pub async fn update(
        &self,
        owner_id: Uuid,
        id: Uuid,
        changes: ArticleChanges,
    ) -> Result<Article, LibraryError> {
        let mut article = self.get(owner_id, id).await?;
        article.apply(changes, self.env.clock.now())?;
        if !self.articles.update(&article).await? {
            return Err(LibraryError::ArticleNotFound);
        }
        Ok(article)
    }

    /// Exclusão lógica; a notificação ao contexto de ligações é do handler (CB-06).
    pub async fn delete(&self, owner_id: Uuid, id: Uuid) -> Result<(), LibraryError> {
        let at = self.env.clock.now();
        if self.articles.soft_delete(owner_id, id, at).await? {
            return Ok(());
        }
        Err(LibraryError::ArticleNotFound)
    }

    /// Troca a capa (PD-36): só imagem; a antiga recebe `deleted_at` e perde o conteúdo.
    pub async fn set_cover(
        &self,
        owner_id: Uuid,
        id: Uuid,
        bytes: Bytes,
    ) -> Result<Article, LibraryError> {
        self.replace_file(owner_id, id, bytes, FileKind::Image)
            .await
    }

    /// Imagem da capa e seus metadados; 404 sem capa ou para quem não é o dono.
    pub async fn cover(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> Result<(LibraryFile, Bytes), LibraryError> {
        let article = self.get(owner_id, id).await?;
        let file_id = article.cover_file_id.ok_or(LibraryError::CoverNotFound)?;
        self.files.read(owner_id, file_id).await
    }

    /// Remove a capa e descarta o arquivo; sem capa, não há o que fazer e não é erro.
    pub async fn remove_cover(&self, owner_id: Uuid, id: Uuid) -> Result<(), LibraryError> {
        let mut article = self.get(owner_id, id).await?;
        let Some(old) = article.cover_file_id.take() else {
            return Ok(());
        };
        article.updated_at = self.env.clock.now();
        if !self.articles.update(&article).await? {
            return Err(LibraryError::ArticleNotFound);
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
    ) -> Result<Article, LibraryError> {
        self.replace_file(owner_id, id, bytes, FileKind::Pdf).await
    }

    async fn replace_file(
        &self,
        owner_id: Uuid,
        id: Uuid,
        bytes: Bytes,
        kind: FileKind,
    ) -> Result<Article, LibraryError> {
        // O artigo vem antes do arquivo: quem não é o dono recebe 404, não 415.
        let mut article = self.get(owner_id, id).await?;
        let file = self.files.store_upload(owner_id, bytes, kind).await?;
        let old = match kind {
            FileKind::Pdf => article.pdf_file_id.replace(file.id),
            FileKind::Image => article.cover_file_id.replace(file.id),
        };
        article.updated_at = self.env.clock.now();
        if !self.articles.update(&article).await? {
            self.files.discard(owner_id, file.id).await;
            return Err(LibraryError::ArticleNotFound);
        }
        if let Some(old) = old {
            self.files.discard(owner_id, old).await;
        }
        Ok(article)
    }
}
