//! Documento OpenAPI do contexto, gerado do código ([project/api-02]).

use utoipa::OpenApi;

use super::dto::{
    CardPage, CardResponse, ChecklistItemRequest, ChecklistItemResponse, CreateCardRequest,
    CreateLaneRequest, CreateProjectRequest, InProgressCardResponse, LanePage, LaneResponse,
    LaneSummaryResponse, MoveCardRequest, ProgressResponse, ProjectPage, ProjectResponse,
    ProjectSummaryResponse, ReorderLanesRequest, UpcomingCardResponse, UpdateCardRequest,
    UpdateLaneRequest, UpdateProjectRequest,
};
use super::handlers;
use crate::projects::domain::lane::SystemLane;
use crate::shared::error::{FieldError, ProblemDetails};
use crate::shared::visibility::Visibility;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::list_projects,
        handlers::create_project,
        handlers::get_project,
        handlers::update_project,
        handlers::delete_project,
        handlers::project_summary,
        handlers::list_lanes,
        handlers::create_lane,
        handlers::reorder_lanes,
        handlers::update_lane,
        handlers::delete_lane,
        handlers::list_cards,
        handlers::create_card,
        handlers::get_card,
        handlers::get_card_by_id,
        handlers::update_card,
        handlers::move_card,
        handlers::delete_card,
    ),
    components(schemas(
        CardPage,
        CardResponse,
        ChecklistItemRequest,
        ChecklistItemResponse,
        CreateCardRequest,
        CreateLaneRequest,
        CreateProjectRequest,
        FieldError,
        InProgressCardResponse,
        LanePage,
        LaneResponse,
        LaneSummaryResponse,
        MoveCardRequest,
        ProblemDetails,
        ProgressResponse,
        ProjectPage,
        ProjectResponse,
        ProjectSummaryResponse,
        ReorderLanesRequest,
        SystemLane,
        UpcomingCardResponse,
        UpdateCardRequest,
        UpdateLaneRequest,
        UpdateProjectRequest,
        Visibility,
    )),
    tags((name = "projects", description = "Projetos com raias e cartões, progresso e Visão geral"))
)]
pub struct ProjectsApi;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documents_all_projects_routes() {
        let doc = ProjectsApi::openapi();
        let paths = &doc.paths.paths;

        let list = paths.get("/api/v1/projects").unwrap();
        assert!(list.get.is_some() && list.post.is_some());
        let one = paths.get("/api/v1/projects/{id}").unwrap();
        assert!(one.get.is_some() && one.patch.is_some() && one.delete.is_some());
        assert!(
            paths
                .get("/api/v1/projects/{id}/summary")
                .unwrap()
                .get
                .is_some()
        );
        let lanes = paths.get("/api/v1/projects/{id}/lanes").unwrap();
        assert!(lanes.get.is_some() && lanes.post.is_some());
        assert!(
            paths
                .get("/api/v1/projects/{id}/lanes/order")
                .unwrap()
                .put
                .is_some()
        );
        let lane = paths.get("/api/v1/projects/{id}/lanes/{lane_id}").unwrap();
        assert!(lane.patch.is_some() && lane.delete.is_some());
        let cards = paths.get("/api/v1/projects/{id}/cards").unwrap();
        assert!(cards.get.is_some() && cards.post.is_some());
        let card = paths.get("/api/v1/projects/{id}/cards/{card_id}").unwrap();
        assert!(card.get.is_some() && card.patch.is_some() && card.delete.is_some());
        let moved = paths
            .get("/api/v1/projects/{id}/cards/{card_id}/move")
            .unwrap();
        assert!(moved.post.is_some());
        let schemas = &doc.components.as_ref().unwrap().schemas;
        for name in [
            "ProjectResponse",
            "CardResponse",
            "ProjectSummaryResponse",
            "ProblemDetails",
        ] {
            assert!(schemas.contains_key(name), "falta o esquema {name}");
        }
    }
}
