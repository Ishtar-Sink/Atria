//! Documento OpenAPI do contexto, gerado do código ([project/api-02]).

use utoipa::OpenApi;

use super::dto::{
    CreateEmotionRequest, CreateJournalEntryRequest, EmotionList, EmotionResponse,
    EntryEmotionRequest, EntryEmotionResponse, JournalEntryPage, JournalEntryResponse,
    SystemEmotionKey, UpdateEmotionRequest, UpdateJournalEntryRequest,
};
use super::handlers;
use crate::shared::error::{FieldError, ProblemDetails};
use crate::shared::visibility::Visibility;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::create_entry,
        handlers::list_entries,
        handlers::get_entry,
        handlers::update_entry,
        handlers::delete_entry,
        handlers::list_emotions,
        handlers::create_emotion,
        handlers::update_emotion,
        handlers::delete_emotion,
    ),
    components(schemas(
        CreateEmotionRequest,
        CreateJournalEntryRequest,
        EmotionList,
        EmotionResponse,
        EntryEmotionRequest,
        EntryEmotionResponse,
        FieldError,
        JournalEntryPage,
        JournalEntryResponse,
        ProblemDetails,
        SystemEmotionKey,
        UpdateEmotionRequest,
        UpdateJournalEntryRequest,
        Visibility,
    )),
    tags((name = "journal", description = "Diário com emoções, criptografado em repouso"))
)]
pub struct JournalApi;
