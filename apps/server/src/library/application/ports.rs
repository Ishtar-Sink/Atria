//! Portas da aplicação: repositórios, busca de miniatura e o gancho de exclusão (CB-06).

use std::future::Future;
use std::pin::Pin;

use axum::body::Bytes;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::library::domain::ItemRef;
use crate::library::domain::article::{Article, ReadingStatus};
use crate::library::domain::book::{Book, BookStatus};
use crate::library::domain::error::LibraryError;
use crate::library::domain::highlight::Highlight;
use crate::library::domain::item_note::ItemNote;
use crate::library::domain::library_file::LibraryFile;
use crate::library::domain::reading_session::ReadingSession;
use crate::library::domain::video::{Video, VideoStatus};
use crate::shared::visibility::Visibility;

/// Gancho chamado depois de excluir uma entidade, com `(owner_id, entity_type, entity_id)`.
///
/// A grafia tem de ser idêntica à de `links` (TASK-15) e dos outros contextos que
/// excluem entidades: a `Extension` do axum casa pelo tipo, e um alias escrito de outro
/// jeito vira outro tipo, então o gancho simplesmente não seria encontrado.
pub type EntityDeletedHook = std::sync::Arc<
    dyn Fn(
            uuid::Uuid,
            &'static str,
            uuid::Uuid,
        ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>>
        + Send
        + Sync,
>;

/// Filtro das listagens de livros, artigos e vídeos; ordem fixa por criação
/// decrescente, desempatada pelo id.
#[derive(Debug, Clone, Default)]
pub struct ListFilter {
    pub text: Option<String>,
    pub tag: Option<String>,
    pub visibility: Option<Visibility>,
    pub reading_status: Option<ReadingStatus>,
    pub book_status: Option<BookStatus>,
    pub video_status: Option<VideoStatus>,
    pub after: Option<(DateTime<Utc>, Uuid)>,
    pub limit: i64,
}

/// Toda operação recebe o dono: o filtro por dono está na própria query
/// ([project/security-04]), além da Row Level Security.
pub trait BookRepository: Send + Sync {
    fn insert(&self, book: &Book) -> impl Future<Output = Result<(), LibraryError>> + Send;

    /// Grava os campos editáveis (não a posição de leitura); `false` se o livro não existe.
    fn update(&self, book: &Book) -> impl Future<Output = Result<bool, LibraryError>> + Send;

    fn find(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> impl Future<Output = Result<Option<Book>, LibraryError>> + Send;

    fn list(
        &self,
        owner_id: Uuid,
        filter: &ListFilter,
    ) -> impl Future<Output = Result<Vec<Book>, LibraryError>> + Send;

    fn soft_delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        at: DateTime<Utc>,
    ) -> impl Future<Output = Result<bool, LibraryError>> + Send;

    fn insert_session(
        &self,
        session: &ReadingSession,
    ) -> impl Future<Output = Result<(), LibraryError>> + Send;

    fn update_session(
        &self,
        session: &ReadingSession,
    ) -> impl Future<Output = Result<bool, LibraryError>> + Send;

    fn find_session(
        &self,
        owner_id: Uuid,
        book_id: Uuid,
        id: Uuid,
    ) -> impl Future<Output = Result<Option<ReadingSession>, LibraryError>> + Send;

    fn delete_session(
        &self,
        owner_id: Uuid,
        book_id: Uuid,
        id: Uuid,
    ) -> impl Future<Output = Result<bool, LibraryError>> + Send;

    fn list_sessions(
        &self,
        owner_id: Uuid,
        book_id: Uuid,
    ) -> impl Future<Output = Result<Vec<ReadingSession>, LibraryError>> + Send;
}

pub trait ArticleRepository: Send + Sync {
    fn insert(&self, article: &Article) -> impl Future<Output = Result<(), LibraryError>> + Send;

    fn update(&self, article: &Article) -> impl Future<Output = Result<bool, LibraryError>> + Send;

    fn find(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> impl Future<Output = Result<Option<Article>, LibraryError>> + Send;

    fn list(
        &self,
        owner_id: Uuid,
        filter: &ListFilter,
    ) -> impl Future<Output = Result<Vec<Article>, LibraryError>> + Send;

    fn soft_delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        at: DateTime<Utc>,
    ) -> impl Future<Output = Result<bool, LibraryError>> + Send;
}

pub trait VideoRepository: Send + Sync {
    fn insert(&self, video: &Video) -> impl Future<Output = Result<(), LibraryError>> + Send;

    fn update(&self, video: &Video) -> impl Future<Output = Result<bool, LibraryError>> + Send;

    fn find(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> impl Future<Output = Result<Option<Video>, LibraryError>> + Send;

    fn list(
        &self,
        owner_id: Uuid,
        filter: &ListFilter,
    ) -> impl Future<Output = Result<Vec<Video>, LibraryError>> + Send;

    fn soft_delete(
        &self,
        owner_id: Uuid,
        id: Uuid,
        at: DateTime<Utc>,
    ) -> impl Future<Output = Result<bool, LibraryError>> + Send;
}

/// Notas de item, destaques e posição de leitura, compartilhados por livro, artigo e
/// vídeo (a posição e os destaques valem só para livro e artigo).
pub trait ItemRepository: Send + Sync {
    /// PDF atual do item: `None` se o item não existe (ou foi excluído) e
    /// `Some(None)` se existe sem PDF.
    fn item_pdf(
        &self,
        owner_id: Uuid,
        item: ItemRef,
    ) -> impl Future<Output = Result<Option<Option<Uuid>>, LibraryError>> + Send;

    fn insert_note(&self, note: &ItemNote)
    -> impl Future<Output = Result<(), LibraryError>> + Send;

    fn update_note(
        &self,
        note: &ItemNote,
    ) -> impl Future<Output = Result<bool, LibraryError>> + Send;

    fn find_note(
        &self,
        owner_id: Uuid,
        item: ItemRef,
        id: Uuid,
    ) -> impl Future<Output = Result<Option<ItemNote>, LibraryError>> + Send;

    fn delete_note(
        &self,
        owner_id: Uuid,
        item: ItemRef,
        id: Uuid,
    ) -> impl Future<Output = Result<bool, LibraryError>> + Send;

    fn list_notes(
        &self,
        owner_id: Uuid,
        item: ItemRef,
    ) -> impl Future<Output = Result<Vec<ItemNote>, LibraryError>> + Send;

    fn insert_highlight(
        &self,
        highlight: &Highlight,
    ) -> impl Future<Output = Result<(), LibraryError>> + Send;

    fn list_highlights(
        &self,
        owner_id: Uuid,
        item: ItemRef,
    ) -> impl Future<Output = Result<Vec<Highlight>, LibraryError>> + Send;

    /// `Some(página)` ou `Some(None)` sem posição gravada; `None` se o item não existe.
    fn get_position(
        &self,
        owner_id: Uuid,
        item: ItemRef,
    ) -> impl Future<Output = Result<Option<Option<i32>>, LibraryError>> + Send;

    fn set_position(
        &self,
        owner_id: Uuid,
        item: ItemRef,
        page: i32,
    ) -> impl Future<Output = Result<bool, LibraryError>> + Send;
}

/// Dados de um arquivo novo; o hash vem do storage ao gravar.
#[derive(Debug, Clone)]
pub struct NewFile {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub kind: crate::library::domain::library_file::FileKind,
    pub content_type: &'static str,
    pub created_at: DateTime<Utc>,
}

/// Metadados em PostgreSQL e conteúdo no storage, juntos.
pub trait FileStore: Send + Sync {
    fn save(
        &self,
        new: &NewFile,
        bytes: Bytes,
    ) -> impl Future<Output = Result<LibraryFile, LibraryError>> + Send;

    /// O arquivo e o conteúdo, só se for do dono e não estiver excluído.
    fn load(
        &self,
        owner_id: Uuid,
        id: Uuid,
    ) -> impl Future<Output = Result<Option<(LibraryFile, Bytes)>, LibraryError>> + Send;

    /// Marca `deleted_at` e remove o conteúdo do storage.
    fn discard(
        &self,
        owner_id: Uuid,
        id: Uuid,
        at: DateTime<Utc>,
    ) -> impl Future<Output = Result<(), LibraryError>> + Send;
}

/// Resultado da busca de miniatura por oEmbed.
#[derive(Debug, Clone)]
pub struct FetchedThumbnail {
    pub title: Option<String>,
    pub bytes: Bytes,
}

/// Falha na busca da miniatura; o motivo não leva a URL do vídeo ([project/security-13]).
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum ThumbnailError {
    #[error("falha de rede ao buscar a miniatura")]
    Network,
    #[error("resposta inválida do provedor")]
    Invalid,
}

pub type ThumbnailFuture<'a> =
    Pin<Box<dyn Future<Output = Result<Option<FetchedThumbnail>, ThumbnailError>> + Send + 'a>>;

/// Sem `async_trait`: devolve future em caixa para ser usado como `Arc<dyn ThumbnailFetcher>`
/// e trocado por um falso nos testes.
pub trait ThumbnailFetcher: Send + Sync {
    fn fetch<'a>(&'a self, video_url: &'a reqwest::Url) -> ThumbnailFuture<'a>;
}

/// Resultado da busca global.
#[derive(Debug, Clone, PartialEq)]
pub struct LibrarySearchHit {
    pub entity_type: &'static str,
    pub id: Uuid,
    pub title: String,
    pub rank: f64,
}

pub type SearchFuture<'a> =
    Pin<Box<dyn Future<Output = Result<Vec<LibrarySearchHit>, LibraryError>> + Send + 'a>>;

pub trait SearchRepository: Send + Sync {
    fn search<'a>(&'a self, owner_id: Uuid, query: &'a str, limit: i64) -> SearchFuture<'a>;
}
