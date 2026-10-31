//! Corpos de requisição e resposta de notas, em `snake_case` ([project/naming-convention-06]).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::notes::domain::note::Note;
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateNoteRequest {
    /// Obrigatório, até 200 caracteres depois de aparado.
    pub title: String,
    /// Até 100 000 caracteres; vazio é aceito.
    pub body: String,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateNoteRequest {
    pub title: Option<String>,
    pub body: Option<String>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum NoteSortParam {
    #[default]
    UpdatedAt,
    CreatedAt,
}

#[derive(Debug, Clone, Default, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct NoteListQuery {
    /// Cursor opaco devolvido em `next_cursor`.
    pub cursor: Option<String>,
    /// De 1 a 100; padrão 50.
    pub limit: Option<u32>,
    pub visibility: Option<Visibility>,
    pub sort: Option<NoteSortParam>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct NoteResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub title: String,
    pub body: String,
}

impl From<Note> for NoteResponse {
    fn from(note: Note) -> Self {
        Self {
            id: note.id,
            owner_id: note.owner_id,
            visibility: note.visibility,
            created_at: note.created_at,
            updated_at: note.updated_at,
            title: note.title,
            body: note.body,
        }
    }
}

/// Página de notas no formato de paginação comum ([project/api-04]).
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct NotePage {
    pub items: Vec<NoteResponse>,
    pub next_cursor: Option<String>,
}
