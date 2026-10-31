//! Corpos de requisição e resposta do Acervo, em `snake_case` ([project/naming-convention-06]).

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::library::application::HighlightView;
use crate::library::domain::article::{Article, ReadingStatus};
use crate::library::domain::book::{Book, BookStatus};
use crate::library::domain::highlight::{HighlightColor, HighlightRect};
use crate::library::domain::item_note::ItemNote;
use crate::library::domain::reading_session::ReadingSession;
use crate::library::domain::video::{Video, VideoStatus};
use crate::shared::visibility::Visibility;

/// Distingue campo ausente (`None`, não muda) de `null` (`Some(None)`, limpa o campo).
fn nullable<'de, T, D>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Option::<T>::deserialize(deserializer).map(Some)
}

// ---- Listagens ----------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct BookListQuery {
    /// Cursor opaco devolvido em `next_cursor`.
    pub cursor: Option<String>,
    /// De 1 a 100; padrão 50.
    pub limit: Option<u32>,
    /// Busca por texto, sem diferenciar acento.
    pub q: Option<String>,
    pub tag: Option<String>,
    pub visibility: Option<Visibility>,
    pub reading_status: Option<BookStatus>,
}

#[derive(Debug, Clone, Default, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct VideoListQuery {
    /// Cursor opaco devolvido em `next_cursor`.
    pub cursor: Option<String>,
    /// De 1 a 100; padrão 50.
    pub limit: Option<u32>,
    /// Busca por texto (título, canal e tags), sem diferenciar acento.
    pub q: Option<String>,
    pub tag: Option<String>,
    pub visibility: Option<Visibility>,
    pub watch_status: Option<VideoStatus>,
}

#[derive(Debug, Clone, Default, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct ArticleListQuery {
    /// Cursor opaco devolvido em `next_cursor`.
    pub cursor: Option<String>,
    /// De 1 a 100; padrão 50.
    pub limit: Option<u32>,
    /// Busca por texto, sem diferenciar acento.
    pub q: Option<String>,
    pub tag: Option<String>,
    pub visibility: Option<Visibility>,
    pub reading_status: Option<ReadingStatus>,
}

#[derive(Debug, Clone, Default, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct FileQuery {
    /// `true` responde com `Content-Disposition: attachment`.
    pub download: Option<bool>,
}

// ---- Livros -------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateBookRequest {
    /// Obrigatório, até 300 caracteres.
    pub title: String,
    pub author: Option<String>,
    pub publisher: Option<String>,
    /// Maior que zero.
    pub page_count: Option<i32>,
    pub tags: Option<Vec<String>>,
    /// Padrão `want_to_read`.
    pub reading_status: Option<BookStatus>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateBookRequest {
    pub title: Option<String>,
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<String>)]
    pub author: Option<Option<String>>,
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<String>)]
    pub publisher: Option<Option<String>>,
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<i32>)]
    pub page_count: Option<Option<i32>>,
    pub tags: Option<Vec<String>>,
    pub reading_status: Option<BookStatus>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BookResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub title: String,
    pub author: Option<String>,
    pub publisher: Option<String>,
    pub page_count: Option<i32>,
    pub tags: Vec<String>,
    pub reading_status: BookStatus,
    pub cover_file_id: Option<Uuid>,
    pub pdf_file_id: Option<Uuid>,
    /// Soma das páginas das sessões, inclusive o que passa do total.
    pub pages_read_total: i64,
    /// De 0 a 100, com uma casa decimal; ausente sem `page_count`.
    pub progress_percent: Option<f64>,
}

impl From<Book> for BookResponse {
    fn from(book: Book) -> Self {
        Self {
            progress_percent: book.progress_percent(),
            id: book.id,
            owner_id: book.owner_id,
            visibility: book.visibility,
            created_at: book.created_at,
            updated_at: book.updated_at,
            title: book.title,
            author: book.author,
            publisher: book.publisher,
            page_count: book.page_count,
            tags: book.tags,
            reading_status: book.reading_status,
            cover_file_id: book.cover_file_id,
            pdf_file_id: book.pdf_file_id,
            pages_read_total: book.pages_read_total,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct BookPage {
    pub items: Vec<BookResponse>,
    pub next_cursor: Option<String>,
}

// ---- Sessões de leitura -------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateReadingSessionRequest {
    pub read_on: NaiveDate,
    /// Maior que zero; pode passar do total do livro.
    pub pages_read: i32,
    pub from_page: Option<i32>,
    pub to_page: Option<i32>,
    pub observation: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateReadingSessionRequest {
    pub read_on: Option<NaiveDate>,
    pub pages_read: Option<i32>,
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<i32>)]
    pub from_page: Option<Option<i32>>,
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<i32>)]
    pub to_page: Option<Option<i32>>,
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<String>)]
    pub observation: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ReadingSessionResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub book_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub read_on: NaiveDate,
    pub pages_read: i32,
    pub from_page: Option<i32>,
    pub to_page: Option<i32>,
    pub observation: Option<String>,
}

impl From<ReadingSession> for ReadingSessionResponse {
    fn from(session: ReadingSession) -> Self {
        Self {
            id: session.id,
            owner_id: session.owner_id,
            book_id: session.book_id,
            created_at: session.created_at,
            updated_at: session.updated_at,
            read_on: session.read_on,
            pages_read: session.pages_read,
            from_page: session.from_page,
            to_page: session.to_page,
            observation: session.observation,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ReadingSessionList {
    pub items: Vec<ReadingSessionResponse>,
}

// ---- Artigos ------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateArticleRequest {
    /// Obrigatório, até 300 caracteres.
    pub title: String,
    /// `http` ou `https`, até 2048 caracteres.
    pub url: Option<String>,
    pub author: Option<String>,
    pub source: Option<String>,
    pub tags: Option<Vec<String>>,
    pub reading_status: Option<ReadingStatus>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateArticleRequest {
    pub title: Option<String>,
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<String>)]
    pub url: Option<Option<String>>,
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<String>)]
    pub author: Option<Option<String>>,
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<String>)]
    pub source: Option<Option<String>>,
    pub tags: Option<Vec<String>>,
    pub reading_status: Option<ReadingStatus>,
    pub visibility: Option<Visibility>,
}

/// Artigo sem progresso: só o status de leitura (RN-22).
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ArticleResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub title: String,
    pub url: Option<String>,
    pub author: Option<String>,
    pub source: Option<String>,
    pub tags: Vec<String>,
    pub reading_status: ReadingStatus,
    /// Capa enviada por upload; a tela a exibe em 16:9 (dica: o servidor não recorta).
    pub cover_file_id: Option<Uuid>,
    pub pdf_file_id: Option<Uuid>,
}

impl From<Article> for ArticleResponse {
    fn from(article: Article) -> Self {
        Self {
            id: article.id,
            owner_id: article.owner_id,
            visibility: article.visibility,
            created_at: article.created_at,
            updated_at: article.updated_at,
            title: article.title,
            url: article.url,
            author: article.author,
            source: article.source,
            tags: article.tags,
            reading_status: article.reading_status,
            cover_file_id: article.cover_file_id,
            pdf_file_id: article.pdf_file_id,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ArticlePage {
    pub items: Vec<ArticleResponse>,
    pub next_cursor: Option<String>,
}

// ---- Vídeos -------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateVideoRequest {
    /// `http` ou `https`; só YouTube e Vimeo em `https` têm miniatura automática.
    pub url: String,
    pub title: Option<String>,
    /// Canal digitado, até 300 caracteres.
    pub channel: Option<String>,
    /// Padrão `to_watch`.
    pub watch_status: Option<VideoStatus>,
    pub tags: Option<Vec<String>>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateVideoRequest {
    pub url: Option<String>,
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<String>)]
    pub title: Option<Option<String>>,
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<String>)]
    pub channel: Option<Option<String>>,
    pub watch_status: Option<VideoStatus>,
    pub tags: Option<Vec<String>>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct VideoResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub url: String,
    pub title: Option<String>,
    pub channel: Option<String>,
    pub watch_status: VideoStatus,
    pub tags: Vec<String>,
    pub thumbnail_file_id: Option<Uuid>,
}

impl From<Video> for VideoResponse {
    fn from(video: Video) -> Self {
        Self {
            id: video.id,
            owner_id: video.owner_id,
            visibility: video.visibility,
            created_at: video.created_at,
            updated_at: video.updated_at,
            url: video.url,
            title: video.title,
            channel: video.channel,
            watch_status: video.watch_status,
            tags: video.tags,
            thumbnail_file_id: video.thumbnail_file_id,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct VideoPage {
    pub items: Vec<VideoResponse>,
    pub next_cursor: Option<String>,
}

// ---- Notas de item, posição e destaques --------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateItemNoteRequest {
    /// Trecho citado, até 5000 caracteres.
    pub quote: Option<String>,
    /// Página citada, maior que zero.
    pub page: Option<i32>,
    /// Comentário, até 5000 caracteres. Trecho ou comentário é obrigatório.
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateItemNoteRequest {
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<String>)]
    pub quote: Option<Option<String>>,
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<i32>)]
    pub page: Option<Option<i32>>,
    #[serde(default, deserialize_with = "nullable")]
    #[schema(value_type = Option<String>)]
    pub comment: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ItemNoteResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub quote: Option<String>,
    pub page: Option<i32>,
    pub comment: Option<String>,
}

impl From<ItemNote> for ItemNoteResponse {
    fn from(note: ItemNote) -> Self {
        Self {
            id: note.id,
            owner_id: note.owner_id,
            created_at: note.created_at,
            updated_at: note.updated_at,
            quote: note.quote,
            page: note.page,
            comment: note.comment,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ItemNoteList {
    pub items: Vec<ItemNoteResponse>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct ReadingPositionRequest {
    /// Última página lida, maior que zero; sobrescreve a anterior mesmo se for menor.
    pub page: i32,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct ReadingPositionResponse {
    /// Nula enquanto não houver posição gravada.
    pub page: Option<i32>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateHighlightRequest {
    /// Tem de ser o PDF atual do item.
    pub file_id: Uuid,
    pub page: i32,
    pub color: HighlightColor,
    pub text: String,
    /// De 1 a 50 retângulos, em frações da página.
    pub rects: Vec<HighlightRect>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct HighlightResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub file_id: Uuid,
    pub page: i32,
    pub color: HighlightColor,
    pub text: String,
    pub rects: Vec<HighlightRect>,
    /// `false` quando o destaque é de um PDF que foi trocado.
    pub is_current_file: bool,
}

impl From<HighlightView> for HighlightResponse {
    fn from(view: HighlightView) -> Self {
        let highlight = view.highlight;
        Self {
            id: highlight.id,
            owner_id: highlight.owner_id,
            created_at: highlight.created_at,
            file_id: highlight.file_id,
            page: highlight.page,
            color: highlight.color,
            text: highlight.text,
            rects: highlight.rects,
            is_current_file: view.is_current_file,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct HighlightList {
    pub items: Vec<HighlightResponse>,
}
