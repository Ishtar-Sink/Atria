//! Gancho de exclusão (CB-06): os contextos que excluem entidades o chamam depois do
//! commit, e as ligações da entidade somem dos dois lados.

use sqlx::PgPool;
use uuid::Uuid;

use crate::links::domain::error::LinkError;
use crate::links::domain::link::EntityType;
use crate::links::infrastructure::pg_link_repository::PgLinkRepository;

/// Gancho chamado depois de excluir uma entidade, com `(owner_id, entity_type, entity_id)`.
///
/// A grafia tem de ser idêntica nos contextos que excluem entidades (notes, goals,
/// finance, journal...): a `Extension` do axum casa pelo tipo, e um alias escrito de
/// outro jeito vira outro tipo, então o gancho simplesmente não seria encontrado.
pub type EntityDeletedHook = std::sync::Arc<
    dyn Fn(
            uuid::Uuid,
            &'static str,
            uuid::Uuid,
        ) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>>
        + Send
        + Sync,
>;

/// Remove as ligações da entidade, nos dois lados; tipo desconhecido não remove nada.
pub async fn remove_links_for_entity(
    pool: &PgPool,
    owner_id: Uuid,
    entity_type: &str,
    entity_id: Uuid,
) -> Result<u64, LinkError> {
    let Ok(entity_type) = entity_type.parse::<EntityType>() else {
        return Ok(0);
    };
    use crate::links::application::service::LinkService;
    LinkService::for_pool(PgLinkRepository::new(pool.clone()))
        .remove_for_entity(owner_id, entity_type, entity_id)
        .await
}

/// Gancho que a TASK-18 instala como `Extension`. Falha vira aviso só com ids e tipo
/// ([project/security-13]) e não é propagada: a exclusão já foi gravada.
pub fn entity_deleted_hook(pool: PgPool) -> EntityDeletedHook {
    std::sync::Arc::new(move |owner_id, entity_type, entity_id| {
        let pool = pool.clone();
        Box::pin(async move {
            if let Err(error) =
                remove_links_for_entity(&pool, owner_id, entity_type, entity_id).await
            {
                tracing::warn!(
                    %owner_id, entity_type, %entity_id, error = %error,
                    "falha ao remover as ligações da entidade excluída"
                );
            }
        })
    })
}
