//! Casos de uso de categorias, com tipo e cor (RF-30, CB-15, PD-49, PD-58).

use uuid::Uuid;

use crate::finance::application::Env;
use crate::finance::application::ports::{CategoryRepository, Outcome};
use crate::finance::domain::category::{
    Category, CategoryColor, default_categories, ensure_unlocked, validate_name,
};
use crate::finance::domain::transaction::TransactionKind;
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewCategory {
    pub name: String,
    pub kind: TransactionKind,
    pub color: String,
    pub visibility: Visibility,
}

/// O tipo não muda depois da criação; campos ausentes ficam como estão.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CategoryPatch {
    pub name: Option<String>,
    pub color: Option<String>,
    pub visibility: Option<Visibility>,
}

/// Lista as categorias do dono; na primeira vez, semeia as padrão (RF-11).
pub async fn list<R: CategoryRepository>(
    repo: &R,
    env: Env<'_>,
    owner_id: Uuid,
    kind: Option<TransactionKind>,
    after: Option<Uuid>,
    limit: u32,
) -> Outcome<Vec<Category>> {
    seed_defaults_once(repo, env, owner_id).await?;
    repo.list(owner_id, kind, after, limit).await
}

/// Só quem nunca teve categoria recebe as padrão: excluir todas, ou já ter uma
/// própria, não as traz de volta (RN-01).
async fn seed_defaults_once<R: CategoryRepository>(
    repo: &R,
    env: Env<'_>,
    owner_id: Uuid,
) -> Outcome<()> {
    if repo.count_all_including_deleted(owner_id).await? > 0 {
        return Ok(());
    }
    let defaults = default_categories(owner_id, env.clock.now(), || env.ids.new_id());
    repo.insert_defaults(owner_id, &defaults).await
}

/// Todas as categorias do dono, página a página, sem semear: é usada pelo resumo,
/// pelos relatórios e pela busca.
pub async fn list_all<R: CategoryRepository>(repo: &R, owner_id: Uuid) -> Outcome<Vec<Category>> {
    let mut all: Vec<Category> = Vec::new();
    loop {
        let after = all.last().map(|category| category.id);
        let page = repo.list(owner_id, None, after, super::SCAN_PAGE).await?;
        let done = page.len() < super::SCAN_PAGE as usize;
        all.extend(page);
        if done {
            return Ok(all);
        }
    }
}

pub async fn create<R: CategoryRepository>(
    repo: &R,
    env: Env<'_>,
    owner_id: Uuid,
    input: NewCategory,
) -> Outcome<Category> {
    let color = CategoryColor::parse(&input.color)?;
    let now = env.clock.now();
    let category = Category {
        id: env.ids.new_id(),
        owner_id,
        visibility: input.visibility,
        name: validate_name(&input.name)?,
        kind: input.kind,
        color,
        system_key: None,
        created_at: now,
        updated_at: now,
    };
    repo.insert(&category).await?;
    Ok(category)
}

pub async fn update<R: CategoryRepository>(
    repo: &R,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
    patch: CategoryPatch,
) -> Outcome<Category> {
    let color = patch
        .color
        .as_deref()
        .map(CategoryColor::parse)
        .transpose()?;
    let mut category = repo.get(owner_id, id).await?;
    if patch.name.is_some() {
        ensure_unlocked(category.system_key)?;
    }
    if let Some(name) = patch.name.as_deref() {
        category.name = validate_name(name)?;
        // A padrão renomeada passa a mostrar o nome da pessoa, não a tradução.
        category.system_key = None;
    }
    if let Some(color) = color {
        category.color = color;
    }
    if let Some(visibility) = patch.visibility {
        category.visibility = visibility;
    }
    category.updated_at = env.clock.now();
    repo.update(&category).await?;
    Ok(category)
}

pub async fn delete<R: CategoryRepository>(
    repo: &R,
    env: Env<'_>,
    owner_id: Uuid,
    id: Uuid,
    replacement_id: Option<Uuid>,
) -> Outcome<()> {
    // O `get` mantém o 404 de outro dono antes da trava.
    let category = repo.get(owner_id, id).await?;
    ensure_unlocked(category.system_key)?;
    repo.delete(owner_id, id, replacement_id, env.clock.now())
        .await
}
