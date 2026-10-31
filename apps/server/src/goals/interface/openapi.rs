//! Documento OpenAPI do contexto, gerado do código ([project/api-02]).

use utoipa::OpenApi;

use super::dto::{
    CreateGoalRequest, CreateMilestoneRequest, GoalPage, GoalResponse, MilestonePage,
    MilestoneResponse, SortParam, UpdateGoalRequest, UpdateMilestoneRequest,
};
use super::handlers;
use crate::goals::domain::goal::GoalStatus;
use crate::shared::error::{FieldError, ProblemDetails};
use crate::shared::visibility::Visibility;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::list_goals,
        handlers::create_goal,
        handlers::get_goal,
        handlers::update_goal,
        handlers::delete_goal,
        handlers::list_milestones,
        handlers::create_milestone,
        handlers::update_milestone,
        handlers::delete_milestone,
    ),
    components(schemas(
        CreateGoalRequest,
        CreateMilestoneRequest,
        FieldError,
        GoalPage,
        GoalResponse,
        GoalStatus,
        MilestonePage,
        MilestoneResponse,
        ProblemDetails,
        SortParam,
        UpdateGoalRequest,
        UpdateMilestoneRequest,
        Visibility,
    )),
    tags((name = "goals", description = "Metas e marcos, com o progresso calculado pelos marcos concluídos"))
)]
pub struct GoalsApi;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documents_all_goals_routes() {
        let doc = GoalsApi::openapi();
        let paths = &doc.paths.paths;

        let list = paths.get("/api/v1/goals").unwrap();
        assert!(list.get.is_some() && list.post.is_some());
        let one = paths.get("/api/v1/goals/{id}").unwrap();
        assert!(one.get.is_some() && one.patch.is_some() && one.delete.is_some());
        let milestones = paths.get("/api/v1/goals/{id}/milestones").unwrap();
        assert!(milestones.get.is_some() && milestones.post.is_some());
        let milestone = paths
            .get("/api/v1/goals/{id}/milestones/{milestone_id}")
            .unwrap();
        assert!(milestone.patch.is_some() && milestone.delete.is_some());
        let schemas = &doc.components.as_ref().unwrap().schemas;
        for name in ["GoalResponse", "MilestoneResponse", "ProblemDetails"] {
            assert!(schemas.contains_key(name), "falta o esquema {name}");
        }
    }

    #[test]
    fn documents_goal_labels_and_has_deadline_filter() {
        let doc = GoalsApi::openapi();
        let json = serde_json::to_value(&doc).unwrap();
        let schemas = &json["components"]["schemas"];

        assert_eq!(
            schemas["GoalResponse"]["properties"]["labels"]["type"],
            "array"
        );
        assert_eq!(
            schemas["GoalResponse"]["properties"]["labels"]["items"]["type"],
            "string"
        );
        assert!(schemas["CreateGoalRequest"]["properties"]["labels"].is_object());
        assert!(schemas["UpdateGoalRequest"]["properties"]["labels"].is_object());
        let required = schemas["CreateGoalRequest"]["required"].as_array().unwrap();
        assert!(!required.iter().any(|name| name == "labels"));
        let params: Vec<&str> = json["paths"]["/api/v1/goals"]["get"]["parameters"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| p["name"].as_str().unwrap())
            .collect();
        assert!(params.contains(&"label") && params.contains(&"has_deadline"));
    }
}
