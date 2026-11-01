//! Casos de uso da lista de emoções (RF-46), com a semeadura da lista padrão.

use std::sync::Arc;

use uuid::Uuid;

use super::ports::EmotionRepository;
use crate::journal::domain::emotion::{Emotion, EmotionIcon};
use crate::journal::domain::error::JournalError;
use crate::shared::clock::Clock;
use crate::shared::ids::IdGenerator;
use crate::shared::visibility::Visibility;

pub struct EmotionService<M> {
    repository: M,
    clock: Arc<dyn Clock>,
    ids: Arc<dyn IdGenerator>,
}

impl<M: EmotionRepository> EmotionService<M> {
    pub fn new(repository: M, clock: Arc<dyn Clock>, ids: Arc<dyn IdGenerator>) -> Self {
        Self {
            repository,
            clock,
            ids,
        }
    }

    pub async fn list(&self, owner_id: Uuid) -> Result<Vec<Emotion>, JournalError> {
        self.seed_defaults_once(owner_id).await?;
        self.repository.list_live(owner_id).await
    }

    /// Na primeira vez, a pessoa recebe as sete emoções padrão. Depois disso a lista é
    /// só dela: excluir todas não as traz de volta.
    async fn seed_defaults_once(&self, owner_id: Uuid) -> Result<(), JournalError> {
        if self
            .repository
            .count_all_including_deleted(owner_id)
            .await?
            > 0
        {
            return Ok(());
        }
        let defaults = Emotion::default_list(owner_id, self.clock.now(), || self.ids.new_id());
        self.repository.insert_many(owner_id, &defaults).await
    }

    pub async fn create(
        &self,
        owner_id: Uuid,
        name: &str,
        icon: Option<EmotionIcon>,
        visibility: Visibility,
    ) -> Result<Emotion, JournalError> {
        // Criar a primeira emoção antes de abrir a lista não deixa a pessoa sem as padrão.
        self.seed_defaults_once(owner_id).await?;
        let emotion = Emotion::custom(
            self.ids.new_id(),
            owner_id,
            visibility,
            name,
            icon,
            self.clock.now(),
        )?;
        self.repository.insert(&emotion).await?;
        Ok(emotion)
    }

    /// Edição parcial: o nome e o ícone ausentes ficam como estão; sem nenhum dos
    /// dois, nada é gravado.
    pub async fn update(
        &self,
        owner_id: Uuid,
        id: Uuid,
        name: Option<&str>,
        icon: Option<EmotionIcon>,
    ) -> Result<Emotion, JournalError> {
        let mut emotion = self.get(owner_id, id).await?;
        if name.is_none() && icon.is_none() {
            return Ok(emotion);
        }
        let now = self.clock.now();
        if let Some(name) = name {
            emotion.rename(name, now)?;
        }
        if let Some(icon) = icon {
            emotion.set_icon(icon, now)?;
        }
        self.repository.update(&emotion).await?;
        Ok(emotion)
    }

    /// Exclusão lógica: a emoção some da lista e de novas entradas, mas continua
    /// ligada às entradas antigas.
    pub async fn delete(&self, owner_id: Uuid, id: Uuid) -> Result<(), JournalError> {
        let mut emotion = self.get(owner_id, id).await?;
        let now = self.clock.now();
        emotion.delete(now)?;
        if !self
            .repository
            .soft_delete(owner_id, emotion.id, now)
            .await?
        {
            return Err(JournalError::EmotionNotFound);
        }
        Ok(())
    }

    async fn get(&self, owner_id: Uuid, id: Uuid) -> Result<Emotion, JournalError> {
        self.repository
            .find_live(owner_id, id)
            .await?
            .ok_or(JournalError::EmotionNotFound)
    }
}
