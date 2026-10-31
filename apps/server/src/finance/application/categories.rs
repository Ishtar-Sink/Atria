//! Casos de uso de categorias, com tipo e cor (RF-30, CB-15, PD-49, PD-58).

use uuid::Uuid;

use crate::finance::application::Env;
use crate::finance::application::ports::{CategoryRepository, Outcome};
use crate::finance::domain::category::{Category, CategoryColor, validate_name};
use crate::finance::domain::transaction::TransactionKind;
use crate::shared::visibility::Visibility;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewCategory {
    pub name: String,
    pub kind: TransactionKind,
    pub color: CategoryColor,
    pub visibility: Visibility,
}

/// O tipo não muda depois da criação; campos ausentes ficam como estão.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CategoryPatch {
    pub name: Option<String>,
    pub color: Option<CategoryColor>,
    pub visibility: Option<Visibility>,
}

pub async fn list<R: CategoryRepository>(
    repo: &R,
    owner_id: Uuid,
    kind: Option<TransactionKind>,
    after: Option<Uuid>,
    limit: u32,
) -> Outcome<Vec<Category>> {
    repo.list(owner_id, kind, after, limit).await
}

/// Todas as categorias do dono, página a página.
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
    let now = env.clock.now();
    let category = Category {
        id: env.ids.new_id(),
        owner_id,
        visibility: input.visibility,
        name: validate_name(&input.name)?,
        kind: input.kind,
        color: input.color,
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
    let mut category = repo.get(owner_id, id).await?;
    if let Some(name) = patch.name.as_deref() {
        category.name = validate_name(name)?;
    }
    if let Some(color) = patch.color {
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
    repo.delete(owner_id, id, replacement_id, env.clock.now())
        .await
}
