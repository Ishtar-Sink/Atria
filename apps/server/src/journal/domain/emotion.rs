//! Entidade `Emotion`: a lista de emoções da pessoa, editável (RF-46), que nasce com
//! as sete emoções padrão do sistema.

use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::error::JournalError;
use crate::shared::visibility::Visibility;

pub const NAME_MAX_CHARS: usize = 50;

/// Emoção padrão. O nome exibido vem da tradução do frontend ([project/language-06]):
/// por isso a emoção padrão guarda só a chave, com o nome nulo até ser renomeada.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SystemEmotion {
    Joy,
    Sadness,
    Anger,
    Fear,
    Anxiety,
    Calm,
    Gratitude,
}

impl SystemEmotion {
    pub const ALL: [Self; 7] = [
        Self::Joy,
        Self::Sadness,
        Self::Anger,
        Self::Fear,
        Self::Anxiety,
        Self::Calm,
        Self::Gratitude,
    ];

    /// Chave estável, a mesma do `CHECK` da coluna `emotions.system_key`.
    pub fn key(self) -> &'static str {
        match self {
            Self::Joy => "joy",
            Self::Sadness => "sadness",
            Self::Anger => "anger",
            Self::Fear => "fear",
            Self::Anxiety => "anxiety",
            Self::Calm => "calm",
            Self::Gratitude => "gratitude",
        }
    }

    pub fn from_key(key: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|emotion| emotion.key() == key)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Emotion {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub system_key: Option<SystemEmotion>,
    pub name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

/// Apara o nome e confere o limite de 1 a 50 caracteres.
pub fn validate_name(name: &str) -> Result<String, JournalError> {
    let trimmed = name.trim();
    let length = trimmed.chars().count();
    if length == 0 || length > NAME_MAX_CHARS {
        return Err(JournalError::InvalidEmotionName);
    }
    Ok(trimmed.to_owned())
}

impl Emotion {
    /// Emoção criada pela pessoa, sempre com nome.
    pub fn custom(
        id: Uuid,
        owner_id: Uuid,
        visibility: Visibility,
        name: &str,
        now: DateTime<Utc>,
    ) -> Result<Self, JournalError> {
        Ok(Self {
            id,
            owner_id,
            visibility,
            system_key: None,
            name: Some(validate_name(name)?),
            created_at: now,
            updated_at: now,
            deleted_at: None,
        })
    }

    pub fn system(id: Uuid, owner_id: Uuid, key: SystemEmotion, now: DateTime<Utc>) -> Self {
        Self {
            id,
            owner_id,
            visibility: Visibility::Personal,
            system_key: Some(key),
            name: None,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        }
    }

    /// A lista padrão da pessoa, uma emoção por `SystemEmotion::ALL`.
    pub fn default_list(
        owner_id: Uuid,
        now: DateTime<Utc>,
        mut new_id: impl FnMut() -> Uuid,
    ) -> Vec<Self> {
        SystemEmotion::ALL
            .into_iter()
            .map(|key| Self::system(new_id(), owner_id, key, now))
            .collect()
    }

    pub fn is_deleted(&self) -> bool {
        self.deleted_at.is_some()
    }

    /// Renomear uma emoção padrão mantém a chave: as entradas antigas continuam
    /// apontando para a mesma emoção.
    pub fn rename(&mut self, name: &str, now: DateTime<Utc>) -> Result<(), JournalError> {
        if self.is_deleted() {
            return Err(JournalError::EmotionNotFound);
        }
        self.name = Some(validate_name(name)?);
        self.updated_at = now;
        Ok(())
    }

    /// Exclusão lógica: a emoção some da lista, mas continua nas entradas antigas.
    pub fn delete(&mut self, now: DateTime<Utc>) -> Result<(), JournalError> {
        if self.is_deleted() {
            return Err(JournalError::EmotionNotFound);
        }
        self.deleted_at = Some(now);
        self.updated_at = now;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn instant(text: &str) -> DateTime<Utc> {
        text.parse().unwrap()
    }

    fn owner() -> Uuid {
        Uuid::from_u128(1)
    }

    #[test]
    fn emotion_name_is_trimmed_and_limited_to_50_chars() {
        let now = instant("2026-11-01T12:00:00Z");
        let custom = |name: &str| {
            Emotion::custom(
                Uuid::from_u128(10),
                owner(),
                Visibility::Personal,
                name,
                now,
            )
        };

        assert_eq!(
            custom("  Saudade \t").unwrap().name.as_deref(),
            Some("Saudade")
        );
        assert!(custom(&"é".repeat(NAME_MAX_CHARS)).is_ok());
        assert!(matches!(
            custom(&"é".repeat(NAME_MAX_CHARS + 1)),
            Err(JournalError::InvalidEmotionName)
        ));
        assert!(matches!(
            custom("   "),
            Err(JournalError::InvalidEmotionName)
        ));
    }

    #[test]
    fn default_list_has_seven_system_emotions() {
        let now = instant("2026-11-01T12:00:00Z");
        let mut next = 100u128;
        let list = Emotion::default_list(owner(), now, || {
            next += 1;
            Uuid::from_u128(next)
        });

        assert_eq!(list.len(), 7);
        let keys: Vec<&str> = list
            .iter()
            .map(|emotion| emotion.system_key.unwrap().key())
            .collect();
        assert_eq!(
            keys,
            [
                "joy",
                "sadness",
                "anger",
                "fear",
                "anxiety",
                "calm",
                "gratitude"
            ]
        );
        assert!(list.iter().all(|emotion| emotion.name.is_none()
            && emotion.owner_id == owner()
            && emotion.created_at == now
            && !emotion.is_deleted()));
        assert_eq!(
            SystemEmotion::from_key("anxiety"),
            Some(SystemEmotion::Anxiety)
        );
        assert_eq!(SystemEmotion::from_key("boredom"), None);
    }

    #[test]
    fn renaming_system_emotion_keeps_system_key() {
        let created = instant("2026-11-01T12:00:00Z");
        let later = instant("2026-11-02T09:00:00Z");
        let mut emotion =
            Emotion::system(Uuid::from_u128(10), owner(), SystemEmotion::Calm, created);

        emotion.rename(" Serenidade ", later).unwrap();

        assert_eq!(emotion.system_key, Some(SystemEmotion::Calm));
        assert_eq!(emotion.name.as_deref(), Some("Serenidade"));
        assert_eq!(emotion.updated_at, later);
        assert!(matches!(
            emotion.rename("", later),
            Err(JournalError::InvalidEmotionName)
        ));
        assert_eq!(emotion.name.as_deref(), Some("Serenidade"));
    }

    #[test]
    fn deleted_emotion_cannot_be_renamed_or_deleted_again() {
        let now = instant("2026-11-01T12:00:00Z");
        let mut emotion = Emotion::system(Uuid::from_u128(10), owner(), SystemEmotion::Fear, now);

        emotion.delete(now).unwrap();

        assert_eq!(emotion.deleted_at, Some(now));
        assert!(matches!(
            emotion.delete(now),
            Err(JournalError::EmotionNotFound)
        ));
        assert!(matches!(
            emotion.rename("Medo", now),
            Err(JournalError::EmotionNotFound)
        ));
    }
}
