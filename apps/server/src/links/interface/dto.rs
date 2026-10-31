//! Corpos de requisição e resposta de ligações, em `snake_case` ([project/naming-convention-06]).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::links::domain::link::{EntityRef, Link};
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateLinkRequest {
    /// Tipo ligável, como `note`, `goal` ou `project_card`.
    pub source_type: String,
    pub source_id: Uuid,
    pub target_type: String,
    pub target_id: Uuid,
    pub visibility: Option<Visibility>,
}

#[derive(Debug, Clone, Default, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct LinkListQuery {
    /// Tipo da entidade consultada (obrigatório).
    pub entity_type: Option<String>,
    /// Id da entidade consultada (obrigatório).
    pub entity_id: Option<Uuid>,
    /// Filtra pelo tipo do lado oposto.
    pub linked_type: Option<String>,
    /// Cursor opaco devolvido em `next_cursor`.
    pub cursor: Option<String>,
    /// De 1 a 100; padrão 50.
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct LinkResponse {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub visibility: Visibility,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub source_type: String,
    pub source_id: Uuid,
    pub target_type: String,
    pub target_id: Uuid,
    /// Só na listagem: o tipo do lado oposto à entidade consultada.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_type: Option<String>,
    /// Só na listagem: o id do lado oposto à entidade consultada.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub linked_id: Option<Uuid>,
}

impl LinkResponse {
    pub fn from_link(link: Link, queried: Option<&EntityRef>) -> Self {
        let other = queried.and_then(|entity| link.other_side(entity));
        Self {
            id: link.id,
            owner_id: link.owner_id,
            visibility: link.visibility,
            created_at: link.created_at,
            updated_at: link.updated_at,
            source_type: link.source.entity_type.as_str().to_owned(),
            source_id: link.source.entity_id,
            target_type: link.target.entity_type.as_str().to_owned(),
            target_id: link.target.entity_id,
            linked_type: other.map(|side| side.entity_type.as_str().to_owned()),
            linked_id: other.map(|side| side.entity_id),
        }
    }
}

/// Página de ligações no formato de paginação comum ([project/api-04]).
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct LinkPage {
    pub items: Vec<LinkResponse>,
    pub next_cursor: Option<String>,
}
