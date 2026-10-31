//! Documento OpenAPI do contexto, gerado do código ([project/api-02]).

use utoipa::OpenApi;

use super::dto::{CreateNoteRequest, NotePage, NoteResponse, NoteSortParam, UpdateNoteRequest};
use super::handlers;
use crate::shared::error::{FieldError, ProblemDetails};
use crate::shared::visibility::Visibility;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::create_note,
        handlers::list_notes,
        handlers::get_note,
        handlers::update_note,
        handlers::delete_note,
    ),
    components(schemas(
        CreateNoteRequest,
        FieldError,
        NotePage,
        NoteResponse,
        NoteSortParam,
        ProblemDetails,
        UpdateNoteRequest,
        Visibility,
    )),
    tags((name = "notes", description = "Notas independentes, criptografadas em repouso"))
)]
pub struct NotesApi;
