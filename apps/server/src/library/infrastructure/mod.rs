//! Infraestrutura do Acervo: PostgreSQL com `sqlx`, storage de arquivos e oEmbed.

pub mod oembed_thumbnail_fetcher;
pub mod pg_articles;
pub mod pg_books;
pub mod pg_files;
pub mod pg_item_notes;
pub mod pg_videos;

use crate::library::domain::error::LibraryError;

/// Converte uma falha de banco ou de storage no erro de infraestrutura do domínio.
pub(crate) fn infra(error: impl std::error::Error + Send + Sync + 'static) -> LibraryError {
    LibraryError::infrastructure(error)
}
