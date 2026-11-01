//! Corpos de requisição e resposta do Diário, em `snake_case`
//! ([project/naming-convention-06]).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::journal::application::ports::{EntryEmotionView, JournalEntryView};
use crate::journal::domain::emotion::{Emotion, EmotionIcon, SystemEmotion};
use crate::shared::visibility::Visibility;

/// Chave de uma emoção padrão; o nome exibido vem da tradução do frontend
/// ([project/language-06]).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SystemEmotionKey {
    Joy,
    Sadness,
    Anger,
    Fear,
    Anxiety,
    Calm,
    Gratitude,
}

impl From<SystemEmotion> for SystemEmotionKey {
    fn from(key: SystemEmotion) -> Self {
        match key {
            SystemEmotion::Joy => Self::Joy,
            SystemEmotion::Sadness => Self::Sadness,
            SystemEmotion::Anger => Self::Anger,
            SystemEmotion::Fear => Self::Fear,
            SystemEmotion::Anxiety => Self::Anxiety,
            SystemEmotion::Calm => Self::Calm,
            SystemEmotion::Gratitude => Self::Gratitude,
        }
    }
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct EntryEmotionRequest {
    pub emotion_id: Uuid,
    /// Opcional, de 1 a 5.
    pub intensity: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateJournalEntryRequest {
    /// Data e hora em RFC 3339, com o fuso (ex.: `2026-11-05T08:00:00-03:00`).
    pub occurred_at: DateTime<Utc>,
    /// Obrigatório, até 100 000 caracteres.
    pub text: String,
    /// Zero ou mais emoções da lista da pessoa, sem repetir.
    pub emotions: Vec<EntryEmotionRequest>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateJournalEntryRequest {
    pub occurred_at: Option<DateTime<Utc>>,
    pub text: Option<String>,
    /// Substitui a lista inteira de emoções da entrada.
    pub emotions: Option<Vec<EntryEmotionRequest>>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Default, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct JournalEntryListQuery {
    /// Cursor opaco devolvido em `next_cursor`.
    pub cursor: Option<String>,
    /// De 1 a 100; padrão 50.
    pub limit: Option<u32>,
    /// Início do período em `occurred_at`, incluso.
    pub from: Option<DateTime<Utc>>,
    /// Fim do período em `occurred_at`, excluso.
    pub to: Option<DateTime<Utc>>,
    /// Só as entradas marcadas com esta emoção.
    pub emotion_id: Option<Uuid>,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct EntryEmotionResponse {
    pub emotion_id: Uuid,
    pub system_key: Option<SystemEmotionKey>,
    /// Nulo numa emoção padrão não renomeada.
    pub name: Option<String>,
    pub intensity: Option<u8>,
    /// A emoção foi excluída da lista, mas continua nesta entrada.
    pub deleted: bool,
}

impl From<EntryEmotionView> for EntryEmotionResponse {
    fn from(view: EntryEmotionView) -> Self {
        Self {
            emotion_id: view.emotion_id,
            system_key: view.system_key.map(SystemEmotionKey::from),
            name: view.name,
            intensity: view.intensity,
            deleted: view.deleted,
        }
    }
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct JournalEntryResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Sempre em UTC; a conversão para o fuso da pessoa é da apresentação.
    pub occurred_at: DateTime<Utc>,
    pub text: String,
    pub emotions: Vec<EntryEmotionResponse>,
}

impl From<JournalEntryView> for JournalEntryResponse {
    fn from(view: JournalEntryView) -> Self {
        let entry = view.entry;
        Self {
            id: entry.id,
            owner_id: entry.owner_id,
            visibility: entry.visibility,
            created_at: entry.created_at,
            updated_at: entry.updated_at,
            occurred_at: entry.occurred_at,
            text: entry.text,
            emotions: view
                .emotions
                .into_iter()
                .map(EntryEmotionResponse::from)
                .collect(),
        }
    }
}

/// Página de entradas no formato de paginação comum ([project/api-04]).
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct JournalEntryPage {
    pub items: Vec<JournalEntryResponse>,
    pub next_cursor: Option<String>,
}

/// Ícone de uma emoção, de um conjunto fixo (RF-19); uma chave fora dele falha na
/// leitura do corpo e vira 422 `validation_failed`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum EmotionIconKey {
    Sun,
    Rain,
    Flame,
    Bolt,
    Wind,
    Leaf,
    Heart,
    Star,
    Moon,
    Cloud,
    Sparkles,
    Smile,
}

impl From<EmotionIcon> for EmotionIconKey {
    fn from(icon: EmotionIcon) -> Self {
        match icon {
            EmotionIcon::Sun => Self::Sun,
            EmotionIcon::Rain => Self::Rain,
            EmotionIcon::Flame => Self::Flame,
            EmotionIcon::Bolt => Self::Bolt,
            EmotionIcon::Wind => Self::Wind,
            EmotionIcon::Leaf => Self::Leaf,
            EmotionIcon::Heart => Self::Heart,
            EmotionIcon::Star => Self::Star,
            EmotionIcon::Moon => Self::Moon,
            EmotionIcon::Cloud => Self::Cloud,
            EmotionIcon::Sparkles => Self::Sparkles,
            EmotionIcon::Smile => Self::Smile,
        }
    }
}

impl From<EmotionIconKey> for EmotionIcon {
    fn from(key: EmotionIconKey) -> Self {
        match key {
            EmotionIconKey::Sun => Self::Sun,
            EmotionIconKey::Rain => Self::Rain,
            EmotionIconKey::Flame => Self::Flame,
            EmotionIconKey::Bolt => Self::Bolt,
            EmotionIconKey::Wind => Self::Wind,
            EmotionIconKey::Leaf => Self::Leaf,
            EmotionIconKey::Heart => Self::Heart,
            EmotionIconKey::Star => Self::Star,
            EmotionIconKey::Moon => Self::Moon,
            EmotionIconKey::Cloud => Self::Cloud,
            EmotionIconKey::Sparkles => Self::Sparkles,
            EmotionIconKey::Smile => Self::Smile,
        }
    }
}

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateEmotionRequest {
    /// De 1 a 50 caracteres depois de aparado, sem repetir outro nome da lista.
    pub name: String,
    /// Ícone do conjunto fixo; ausente, a tela mostra o ícone neutro.
    pub icon: Option<EmotionIconKey>,
    pub visibility: Option<Visibility>,
}

/// Edição parcial: o campo ausente fica como está.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateEmotionRequest {
    pub name: Option<String>,
    pub icon: Option<EmotionIconKey>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct EmotionResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub system_key: Option<SystemEmotionKey>,
    /// Nulo numa emoção padrão não renomeada: o frontend traduz pela `system_key`.
    pub name: Option<String>,
    /// Nulo: a tela usa o ícone pela `system_key` ou o neutro (CB-09).
    pub icon: Option<EmotionIconKey>,
}

impl From<Emotion> for EmotionResponse {
    fn from(emotion: Emotion) -> Self {
        Self {
            id: emotion.id,
            owner_id: emotion.owner_id,
            visibility: emotion.visibility,
            created_at: emotion.created_at,
            updated_at: emotion.updated_at,
            system_key: emotion.system_key.map(SystemEmotionKey::from),
            name: emotion.name,
            icon: emotion.icon.map(EmotionIconKey::from),
        }
    }
}

/// A lista inteira de emoções da pessoa: ela é curta, então não é paginada.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct EmotionList {
    pub items: Vec<EmotionResponse>,
}
