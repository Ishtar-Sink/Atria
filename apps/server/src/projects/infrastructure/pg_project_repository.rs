//! Repositório PostgreSQL de projetos, raias, cartões e checklists. As queries são
//! checadas na compilação ([project/stack-04]). Cada operação abre a transação com o usuário da RLS e filtra
//! também por `owner_id` ([project/security-04]); a exclusão é lógica em projetos e
//! cartões ([project/database-08]) e física em raias.

use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, NaiveDate, Utc};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::http::AppState;
use crate::projects::application::ports::{
    ProjectListItem, ProjectQuery, ProjectRepository, ProjectSearchHit, SearchFuture,
    SearchRepository,
};
use crate::projects::application::search::ProjectSearch;
use crate::projects::domain::card::{Card, CardId, CardPriority, ChecklistItem};
use crate::projects::domain::error::ProjectError;
use crate::projects::domain::lane::{Lane, LaneColor, SystemLane};
use crate::projects::domain::project::Project;
use crate::shared::db::begin_for_user;
use crate::shared::visibility::Visibility;

/// Deslocamento temporário das posições dos cartões regravados: o índice único parcial
/// não é adiável, então as posições antigas saem do caminho antes das novas entrarem.
const POSITION_SHIFT: i32 = 1_000_000;

pub struct PgProjectRepository {
    pool: PgPool,
}

impl PgProjectRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn internal(error: sqlx::Error) -> ProjectError {
    ProjectError::internal(error)
}

struct ProjectRow {
    id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    name: String,
    description: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl ProjectRow {
    fn into_project(self, lanes: Vec<Lane>, cards: Vec<Card>) -> Project {
        Project {
            id: self.id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            name: self.name,
            description: self.description,
            created_at: self.created_at,
            updated_at: self.updated_at,
            lanes,
            cards,
        }
    }
}

struct ListRow {
    project: ProjectRow,
    done_cards: i64,
    total_cards: i64,
}

struct LaneRow {
    id: Uuid,
    project_id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    system_key: Option<SystemLane>,
    name: Option<String>,
    color: String,
    counts_as_done: bool,
    position: i32,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl LaneRow {
    fn into_lane(self) -> Result<Lane, ProjectError> {
        Ok(Lane {
            id: self.id,
            project_id: self.project_id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            system_key: self.system_key,
            name: self.name,
            color: LaneColor::parse(&self.color)?,
            counts_as_done: self.counts_as_done,
            position: self.position,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

struct CardRow {
    id: Uuid,
    project_id: Uuid,
    lane_id: Uuid,
    owner_id: Uuid,
    visibility: Visibility,
    title: String,
    description: Option<String>,
    priority: Option<String>,
    labels: Vec<String>,
    due_date: Option<NaiveDate>,
    position: i32,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl CardRow {
    fn into_card(self, checklist: Vec<ChecklistItem>) -> Result<Card, ProjectError> {
        Ok(Card {
            id: self.id,
            project_id: self.project_id,
            lane_id: self.lane_id,
            owner_id: self.owner_id,
            visibility: self.visibility,
            title: self.title,
            description: self.description,
            priority: self
                .priority
                .as_deref()
                .map(CardPriority::parse)
                .transpose()?,
            labels: self.labels,
            due_date: self.due_date,
            checklist,
            position: self.position,
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

struct ChecklistRow {
    id: Uuid,
    card_id: Uuid,
    text: String,
    done: bool,
    position: i32,
}

/// Escapa `%`, `_` e `\` para a busca por parte do nome.
fn like_pattern(text: &str) -> String {
    let escaped = text
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    format!("%{escaped}%")
}

fn to_count(value: i64) -> u32 {
    u32::try_from(value).unwrap_or(u32::MAX)
}

async fn lanes_of(
    conn: &mut PgConnection,
    owner: Uuid,
    project_ids: &[Uuid],
) -> Result<Vec<Lane>, ProjectError> {
    sqlx::query_as!(LaneRow, "SELECT id, project_id, owner_id, visibility AS \"visibility: _\", system_key AS \"system_key: _\", name, color, \
     counts_as_done, position, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM project_lanes \
         WHERE project_id = ANY($1) AND owner_id = $2 ORDER BY project_id, position", project_ids, owner)
        .fetch_all(conn)
        .await
        .map_err(internal)?
        .into_iter()
        .map(LaneRow::into_lane)
        .collect()
}

async fn cards_of(
    conn: &mut PgConnection,
    owner: Uuid,
    project_id: Uuid,
) -> Result<Vec<Card>, ProjectError> {
    let rows = sqlx::query_as!(CardRow, "SELECT id, project_id, lane_id, owner_id, visibility AS \"visibility: _\", title, description, \
     priority, labels, due_date AS \"due_date: _\", position, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM project_cards \
         WHERE project_id = $1 AND owner_id = $2 AND deleted_at IS NULL \
         ORDER BY lane_id, position", project_id, owner)
        .fetch_all(&mut *conn)
        .await
        .map_err(internal)?;
    let ids: Vec<Uuid> = rows.iter().map(|r| r.id).collect();
    let items = sqlx::query_as!(
        ChecklistRow,
        "SELECT id, card_id, text, done, position FROM project_card_checklist_items \
         WHERE card_id = ANY($1) AND owner_id = $2 ORDER BY card_id, position",
        &ids,
        owner
    )
    .fetch_all(conn)
    .await
    .map_err(internal)?;
    let mut by_card: HashMap<Uuid, Vec<ChecklistItem>> = HashMap::new();
    for item in items {
        by_card
            .entry(item.card_id)
            .or_default()
            .push(ChecklistItem {
                id: item.id,
                text: item.text,
                done: item.done,
                position: item.position,
            });
    }
    rows.into_iter()
        .map(|row| {
            let checklist = by_card.remove(&row.id).unwrap_or_default();
            row.into_card(checklist)
        })
        .collect()
}

/// Carrega o agregado; com `lock`, trava a linha do projeto até o fim da transação.
async fn load_project(
    conn: &mut PgConnection,
    owner: Uuid,
    id: Uuid,
    lock: bool,
) -> Result<Project, ProjectError> {
    let row = if lock {
        sqlx::query_as!(
            ProjectRow,
            "SELECT id, owner_id, visibility AS \"visibility: _\", name, description, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM projects \
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL FOR UPDATE",
            id,
            owner
        )
        .fetch_optional(&mut *conn)
        .await
    } else {
        sqlx::query_as!(
            ProjectRow,
            "SELECT id, owner_id, visibility AS \"visibility: _\", name, description, created_at AS \"created_at: _\", updated_at AS \"updated_at: _\" FROM projects \
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL",
            id,
            owner
        )
        .fetch_optional(&mut *conn)
        .await
    }
    .map_err(internal)?
    .ok_or(ProjectError::ProjectNotFound)?;
    let lanes = lanes_of(conn, owner, &[id]).await?;
    let cards = cards_of(conn, owner, id).await?;
    Ok(row.into_project(lanes, cards))
}

async fn insert_lane(conn: &mut PgConnection, lane: &Lane) -> Result<(), ProjectError> {
    sqlx::query!(
        "INSERT INTO project_lanes (id, owner_id, visibility, project_id, system_key, name, \
         color, counts_as_done, position, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
        lane.id,
        lane.owner_id,
        lane.visibility as _,
        lane.project_id,
        lane.system_key as _,
        &lane.name as _,
        lane.color.as_str(),
        lane.counts_as_done,
        lane.position,
        lane.created_at as _,
        lane.updated_at as _
    )
    .execute(conn)
    .await
    .map_err(internal)?;
    Ok(())
}

async fn update_lane(conn: &mut PgConnection, lane: &Lane) -> Result<(), ProjectError> {
    sqlx::query!(
        "UPDATE project_lanes SET visibility = $3, name = $4, color = $5, counts_as_done = $6, \
         position = $7, updated_at = $8 WHERE id = $1 AND owner_id = $2",
        lane.id,
        lane.owner_id,
        lane.visibility as _,
        &lane.name as _,
        lane.color.as_str(),
        lane.counts_as_done,
        lane.position,
        lane.updated_at as _
    )
    .execute(conn)
    .await
    .map_err(internal)?;
    Ok(())
}

async fn insert_card(conn: &mut PgConnection, card: &Card) -> Result<(), ProjectError> {
    sqlx::query!(
        "INSERT INTO project_cards (id, owner_id, visibility, project_id, lane_id, title, \
         description, priority, labels, due_date, position, created_at, updated_at) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)",
        card.id,
        card.owner_id,
        card.visibility as _,
        card.project_id,
        card.lane_id,
        &card.title,
        &card.description as _,
        card.priority.map(CardPriority::as_str),
        &card.labels,
        card.due_date as _,
        card.position,
        card.created_at as _,
        card.updated_at as _
    )
    .execute(conn)
    .await
    .map_err(internal)?;
    Ok(())
}

async fn update_card(conn: &mut PgConnection, card: &Card) -> Result<(), ProjectError> {
    sqlx::query!(
        "UPDATE project_cards SET visibility = $3, lane_id = $4, title = $5, description = $6, \
         priority = $7, labels = $8, due_date = $9, position = $10, updated_at = $11 \
         WHERE id = $1 AND owner_id = $2",
        card.id,
        card.owner_id,
        card.visibility as _,
        card.lane_id,
        &card.title,
        &card.description as _,
        card.priority.map(CardPriority::as_str),
        &card.labels,
        card.due_date as _,
        card.position,
        card.updated_at as _
    )
    .execute(conn)
    .await
    .map_err(internal)?;
    Ok(())
}

/// Regrava o checklist inteiro do cartão, na ordem.
async fn replace_checklist(conn: &mut PgConnection, card: &Card) -> Result<(), ProjectError> {
    sqlx::query!(
        "DELETE FROM project_card_checklist_items WHERE card_id = $1 AND owner_id = $2",
        card.id,
        card.owner_id
    )
    .execute(&mut *conn)
    .await
    .map_err(internal)?;
    for item in &card.checklist {
        sqlx::query!(
            "INSERT INTO project_card_checklist_items (id, owner_id, visibility, card_id, text, \
             done, position, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)",
            item.id,
            card.owner_id,
            card.visibility as _,
            card.id,
            &item.text,
            item.done,
            item.position,
            card.updated_at as _
        )
        .execute(&mut *conn)
        .await
        .map_err(internal)?;
    }
    Ok(())
}

async fn save_project_row(conn: &mut PgConnection, project: &Project) -> Result<(), ProjectError> {
    sqlx::query!(
        "UPDATE projects SET visibility = $3, name = $4, description = $5, updated_at = $6 \
         WHERE id = $1 AND owner_id = $2",
        project.id,
        project.owner_id,
        project.visibility as _,
        &project.name,
        &project.description as _,
        project.updated_at as _
    )
    .execute(conn)
    .await
    .map_err(internal)?;
    Ok(())
}

async fn save_lanes(
    conn: &mut PgConnection,
    before: &Project,
    after: &Project,
) -> Result<(), ProjectError> {
    for lane in &after.lanes {
        match before.lanes.iter().find(|l| l.id == lane.id) {
            None => insert_lane(conn, lane).await?,
            Some(old) if old != lane => update_lane(conn, lane).await?,
            Some(_) => {}
        }
    }
    Ok(())
}

async fn save_cards(
    conn: &mut PgConnection,
    before: &Project,
    after: &Project,
    now: DateTime<Utc>,
) -> Result<(), ProjectError> {
    let removed: Vec<Uuid> = before
        .cards
        .iter()
        .filter(|c| !after.cards.iter().any(|a| a.id == c.id))
        .map(|c| c.id)
        .collect();
    if !removed.is_empty() {
        sqlx::query!(
            "UPDATE project_cards SET deleted_at = $3, updated_at = $3 \
             WHERE id = ANY($1) AND owner_id = $2",
            &removed,
            after.owner_id,
            now as _
        )
        .execute(&mut *conn)
        .await
        .map_err(internal)?;
    }
    let changed: Vec<&Card> = after
        .cards
        .iter()
        .filter(|c| before.cards.iter().find(|o| o.id == c.id) != Some(*c))
        .collect();
    let existing: Vec<Uuid> = changed
        .iter()
        .filter(|c| before.cards.iter().any(|o| o.id == c.id))
        .map(|c| c.id)
        .collect();
    if !existing.is_empty() {
        sqlx::query!("UPDATE project_cards SET position = position + $3 WHERE id = ANY($1) AND owner_id = $2", &existing, after.owner_id, POSITION_SHIFT)
        .execute(&mut *conn)
        .await
        .map_err(internal)?;
    }
    for card in changed {
        let old = before.cards.iter().find(|o| o.id == card.id);
        match old {
            None => insert_card(conn, card).await?,
            Some(_) => update_card(conn, card).await?,
        }
        if old.is_none_or(|o| o.checklist != card.checklist) {
            replace_checklist(conn, card).await?;
        }
    }
    Ok(())
}

/// Remove as raias que saíram do agregado. Cartões já excluídos que ainda apontam para
/// elas passam para uma raia que ficou, para a chave estrangeira não barrar.
async fn delete_removed_lanes(
    conn: &mut PgConnection,
    before: &Project,
    after: &Project,
) -> Result<(), ProjectError> {
    let removed: Vec<Uuid> = before
        .lanes
        .iter()
        .filter(|l| !after.lanes.iter().any(|a| a.id == l.id))
        .map(|l| l.id)
        .collect();
    let Some(keep) = after.lanes.first() else {
        return Ok(());
    };
    if removed.is_empty() {
        return Ok(());
    }
    sqlx::query!(
        "UPDATE project_cards SET lane_id = $3 \
         WHERE lane_id = ANY($1) AND owner_id = $2 AND deleted_at IS NOT NULL",
        &removed,
        after.owner_id,
        keep.id
    )
    .execute(&mut *conn)
    .await
    .map_err(internal)?;
    sqlx::query!(
        "DELETE FROM project_lanes WHERE id = ANY($1) AND owner_id = $2",
        &removed,
        after.owner_id
    )
    .execute(conn)
    .await
    .map_err(internal)?;
    Ok(())
}

/// Grava só o que mudou entre o agregado carregado e o alterado pelo domínio.
async fn save_diff(
    conn: &mut PgConnection,
    before: &Project,
    after: &Project,
    now: DateTime<Utc>,
) -> Result<(), ProjectError> {
    let project_changed = before.name != after.name
        || before.description != after.description
        || before.visibility != after.visibility
        || before.updated_at != after.updated_at;
    if project_changed {
        save_project_row(conn, after).await?;
    }
    save_lanes(conn, before, after).await?;
    save_cards(conn, before, after, now).await?;
    delete_removed_lanes(conn, before, after).await
}

impl ProjectRepository for PgProjectRepository {
    async fn insert_with_lanes(&self, project: &Project) -> Result<(), ProjectError> {
        let mut tx = begin_for_user(&self.pool, project.owner_id)
            .await
            .map_err(internal)?;
        sqlx::query!(
            "INSERT INTO projects (id, owner_id, visibility, name, description, created_at, \
             updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            project.id,
            project.owner_id,
            project.visibility as _,
            &project.name,
            &project.description as _,
            project.created_at as _,
            project.updated_at as _
        )
        .execute(&mut *tx)
        .await
        .map_err(internal)?;
        for lane in &project.lanes {
            insert_lane(&mut tx, lane).await?;
        }
        tx.commit().await.map_err(internal)?;
        Ok(())
    }

    async fn find_live(&self, owner: Uuid, id: Uuid) -> Result<Project, ProjectError> {
        let mut tx = begin_for_user(&self.pool, owner).await.map_err(internal)?;
        let project = load_project(&mut tx, owner, id, false).await?;
        tx.commit().await.map_err(internal)?;
        Ok(project)
    }

    async fn list_live(
        &self,
        owner: Uuid,
        query: &ProjectQuery,
    ) -> Result<Vec<ProjectListItem>, ProjectError> {
        let mut tx = begin_for_user(&self.pool, owner).await.map_err(internal)?;
        let pattern = query.text.as_deref().map(like_pattern);
        let (instant, after_id) = match query.after {
            Some(position) => (Some(position.created_at), Some(position.id)),
            None => (None, None),
        };
        let rows = sqlx::query!(
            "SELECT p.id, p.owner_id, p.visibility AS \"visibility: Visibility\", \
               p.name, p.description, p.created_at AS \"created_at: DateTime<Utc>\", \
               p.updated_at AS \"updated_at: DateTime<Utc>\", \
               c.done AS \"done_cards!\", c.total AS \"total_cards!\" \
             FROM projects p \
             CROSS JOIN LATERAL (SELECT count(*) FILTER (WHERE l.counts_as_done) AS done, \
                 count(*) AS total \
               FROM project_cards pc JOIN project_lanes l ON l.id = pc.lane_id \
               WHERE pc.project_id = p.id AND pc.owner_id = $1 AND pc.deleted_at IS NULL) c \
             WHERE p.owner_id = $1 AND p.deleted_at IS NULL \
               AND ($2::text IS NULL OR p.name ILIKE $2) \
               AND ($3::text IS NULL OR p.visibility = $3) \
               AND ($4::timestamptz IS NULL OR (p.created_at, p.id) < ($4::timestamptz, $5::uuid)) \
             ORDER BY p.created_at DESC, p.id DESC LIMIT $6",
            owner,
            &pattern as _,
            query.visibility as _,
            instant as _,
            after_id,
            i64::from(query.limit)
        )
        .fetch_all(&mut *tx)
        .await
        .map_err(internal)?
        .into_iter()
        .map(|row| ListRow {
            project: ProjectRow {
                id: row.id,
                owner_id: row.owner_id,
                visibility: row.visibility,
                name: row.name,
                description: row.description,
                created_at: row.created_at,
                updated_at: row.updated_at,
            },
            done_cards: row.done_cards,
            total_cards: row.total_cards,
        })
        .collect::<Vec<_>>();
        let ids: Vec<Uuid> = rows.iter().map(|r| r.project.id).collect();
        let mut lanes = lanes_of(&mut tx, owner, &ids).await?;
        tx.commit().await.map_err(internal)?;
        Ok(rows
            .into_iter()
            .map(|row| {
                let id = row.project.id;
                let (mine, rest): (Vec<Lane>, Vec<Lane>) =
                    lanes.drain(..).partition(|l| l.project_id == id);
                lanes = rest;
                ProjectListItem {
                    done_cards: to_count(row.done_cards),
                    total_cards: to_count(row.total_cards),
                    project: row.project.into_project(mine, Vec::new()),
                }
            })
            .collect())
    }

    async fn find_card_project(&self, owner: Uuid, card_id: CardId) -> Result<Uuid, ProjectError> {
        let mut tx = begin_for_user(&self.pool, owner).await.map_err(internal)?;
        let project_id: Option<Uuid> = sqlx::query_scalar!(
            "SELECT pc.project_id FROM project_cards pc \
             JOIN projects p ON p.id = pc.project_id \
             WHERE pc.id = $1 AND pc.owner_id = $2 \
             AND pc.deleted_at IS NULL AND p.deleted_at IS NULL",
            card_id,
            owner
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(internal)?;
        tx.commit().await.map_err(internal)?;
        project_id.ok_or(ProjectError::CardNotFound)
    }

    async fn soft_delete(
        &self,
        owner: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
    ) -> Result<Vec<Uuid>, ProjectError> {
        let mut tx = begin_for_user(&self.pool, owner).await.map_err(internal)?;
        let deleted: Option<Uuid> = sqlx::query_scalar!(
            "UPDATE projects SET deleted_at = $3, updated_at = $3 \
             WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL RETURNING id",
            id,
            owner,
            now as _
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(internal)?;
        deleted.ok_or(ProjectError::ProjectNotFound)?;
        let card_ids: Vec<Uuid> = sqlx::query_scalar!(
            "UPDATE project_cards SET deleted_at = $3, updated_at = $3 \
             WHERE project_id = $1 AND owner_id = $2 AND deleted_at IS NULL RETURNING id",
            id,
            owner,
            now as _
        )
        .fetch_all(&mut *tx)
        .await
        .map_err(internal)?;
        tx.commit().await.map_err(internal)?;
        Ok(card_ids)
    }

    async fn mutate<R, F>(
        &self,
        owner: Uuid,
        id: Uuid,
        now: DateTime<Utc>,
        change: F,
    ) -> Result<R, ProjectError>
    where
        R: Send,
        F: FnOnce(&mut Project) -> Result<R, ProjectError> + Send,
    {
        let mut tx = begin_for_user(&self.pool, owner).await.map_err(internal)?;
        let before = load_project(&mut tx, owner, id, true).await?;
        let mut after = before.clone();
        let result = change(&mut after)?;
        save_diff(&mut tx, &before, &after, now).await?;
        tx.commit().await.map_err(internal)?;
        Ok(result)
    }
}

pub struct PgProjectSearch {
    pool: PgPool,
}

impl PgProjectSearch {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

fn entity_type(kind: &str) -> &'static str {
    match kind {
        "project" => "project",
        _ => "project_card",
    }
}

impl SearchRepository for PgProjectSearch {
    fn search<'a>(&'a self, owner_id: Uuid, query: &'a str, limit: i64) -> SearchFuture<'a> {
        Box::pin(async move {
            let mut tx = begin_for_user(&self.pool, owner_id)
                .await
                .map_err(internal)?;
            let rows = sqlx::query!(
                r#"SELECT entity_type AS "entity_type!", id AS "id!", project_id AS "project_id!",
                          title AS "title!", rank AS "rank!" FROM (
                     SELECT 'project'::text AS entity_type, p.id, p.id AS project_id, p.name AS title,
                            ts_rank(p.search_vector, q.query)::float8 AS rank
                       FROM projects p, websearch_to_tsquery('portuguese', projects_unaccent($2)) AS q(query)
                      WHERE p.owner_id = $1 AND p.deleted_at IS NULL AND p.search_vector @@ q.query
                     UNION ALL
                     SELECT 'project_card'::text, c.id, c.project_id, c.title,
                            ts_rank(c.search_vector, q.query)::float8
                       FROM project_cards c
                       JOIN projects p ON p.id = c.project_id AND p.deleted_at IS NULL,
                            websearch_to_tsquery('portuguese', projects_unaccent($2)) AS q(query)
                      WHERE c.owner_id = $1 AND c.deleted_at IS NULL AND c.search_vector @@ q.query
                   ) hits ORDER BY rank DESC, title, id LIMIT $3"#,
                owner_id,
                query,
                limit
            )
            .fetch_all(&mut *tx)
            .await
            .map_err(internal)?;
            tx.commit().await.map_err(internal)?;
            Ok(rows
                .into_iter()
                .map(|row| ProjectSearchHit {
                    entity_type: entity_type(&row.entity_type),
                    id: row.id,
                    project_id: row.project_id,
                    title: row.title,
                    rank: row.rank,
                })
                .collect())
        })
    }
}

impl ProjectSearch {
    /// Busca montada com o banco do servidor, para a TASK-16.
    pub fn from_state(state: &AppState) -> Self {
        Self::new(Arc::new(PgProjectSearch::new(state.pool.clone())))
    }
}
