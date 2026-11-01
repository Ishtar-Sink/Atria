//! Documento OpenAPI do contexto de tarefas ([project/api-02]).

use utoipa::OpenApi;

use crate::shared::error::{FieldError, ProblemDetails};
use crate::shared::recurrence::{Frequency, TaskRecurrenceRule, Weekday};
use crate::shared::visibility::Visibility;
use crate::tasks::interface::dto::{
    CompletionRequest, CompletionResponse, CreateTaskRequest, OccurrenceListResponse,
    OccurrenceResponse, TaskPageResponse, TaskResponse, TaskStatusParam, UpdateTaskRequest,
};
use crate::tasks::interface::handlers;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::list_tasks,
        handlers::create_task,
        handlers::get_task,
        handlers::update_task,
        handlers::delete_task,
        handlers::complete_task,
        handlers::reopen_task,
        handlers::list_occurrences,
    ),
    components(schemas(
        CreateTaskRequest,
        UpdateTaskRequest,
        CompletionRequest,
        CompletionResponse,
        TaskResponse,
        TaskPageResponse,
        TaskStatusParam,
        OccurrenceResponse,
        OccurrenceListResponse,
        TaskRecurrenceRule,
        Frequency,
        Weekday,
        Visibility,
        ProblemDetails,
        FieldError,
    )),
    tags((name = "tasks", description = "Tarefas pontuais e recorrentes"))
)]
pub struct TasksApi;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documents_all_tasks_routes() {
        let doc = TasksApi::openapi();
        let expected: [(&str, &[&str]); 4] = [
            ("/api/v1/tasks", &["get", "post"]),
            ("/api/v1/tasks/{id}", &["get", "patch", "delete"]),
            ("/api/v1/tasks/{id}/completion", &["post", "delete"]),
            ("/api/v1/tasks/occurrences", &["get"]),
        ];

        for (path, methods) in expected {
            let item = doc
                .paths
                .paths
                .get(path)
                .unwrap_or_else(|| panic!("{path}"));
            for method in methods {
                let operation = match *method {
                    "get" => &item.get,
                    "post" => &item.post,
                    "patch" => &item.patch,
                    "delete" => &item.delete,
                    _ => &None,
                };
                assert!(operation.is_some(), "{method} {path}");
            }
        }
        assert_eq!(doc.paths.paths.len(), expected.len());
        let schemas = &doc.components.as_ref().unwrap().schemas;
        for schema in ["TaskResponse", "TaskRecurrenceRule", "ProblemDetails"] {
            assert!(schemas.contains_key(schema), "{schema}");
        }
    }

    #[test]
    fn documents_task_labels_and_label_filter() {
        let doc = TasksApi::openapi();
        let json = serde_json::to_value(&doc).unwrap();
        let schemas = &json["components"]["schemas"];

        assert_eq!(
            schemas["TaskResponse"]["properties"]["labels"]["type"],
            "array"
        );
        assert_eq!(
            schemas["TaskResponse"]["properties"]["labels"]["items"]["type"],
            "string"
        );
        assert!(schemas["CreateTaskRequest"]["properties"]["labels"].is_object());
        assert!(schemas["UpdateTaskRequest"]["properties"]["labels"].is_object());
        for request in ["CreateTaskRequest", "UpdateTaskRequest"] {
            let required = schemas[request]["required"]
                .as_array()
                .cloned()
                .unwrap_or_default();
            assert!(!required.iter().any(|name| name == "labels"), "{request}");
        }
        let params: Vec<&str> = json["paths"]["/api/v1/tasks"]["get"]["parameters"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| p["name"].as_str().unwrap())
            .collect();
        assert!(params.contains(&"label"), "{params:?}");
    }

    #[test]
    fn documents_optional_time_and_next_occurrence() {
        let json = serde_json::to_value(TasksApi::openapi()).unwrap();
        let schemas = &json["components"]["schemas"];

        let rule_required = schemas["TaskRecurrenceRule"]["required"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        assert!(!rule_required.iter().any(|name| name == "time"));
        assert!(schemas["TaskRecurrenceRule"]["properties"]["time"].is_object());
        assert!(schemas["TaskResponse"]["properties"]["next_occurrence"].is_object());
        let response_required = schemas["TaskResponse"]["required"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        assert!(
            !response_required
                .iter()
                .any(|name| name == "next_occurrence")
        );
    }
}
