//! Descrição OpenAPI do contexto de lembretes, com caminhos relativos a `/api/v1`.

use utoipa::OpenApi;

use crate::reminders::interface::dto::{
    CreateReminderBody, CreateSubscriptionBody, PatchReminderBody, PublicKeyResponse,
    ReminderKindDto, ReminderPageResponse, ReminderResponse, SubscriptionKeysBody,
    SubscriptionResponse, UpcomingFireResponse, UpcomingResponse,
};
use crate::reminders::interface::handlers;
use crate::shared::error::{FieldError, ProblemDetails};
use crate::shared::recurrence::{Frequency, RecurrenceRule, Weekday};
use crate::shared::visibility::Visibility;

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::list_reminders,
        handlers::create_reminder,
        handlers::upcoming_fires,
        handlers::get_reminder,
        handlers::patch_reminder,
        handlers::delete_reminder,
        handlers::web_push_public_key,
        handlers::create_subscription,
        handlers::delete_subscription,
    ),
    components(schemas(
        CreateReminderBody,
        PatchReminderBody,
        ReminderResponse,
        ReminderPageResponse,
        ReminderKindDto,
        UpcomingFireResponse,
        UpcomingResponse,
        PublicKeyResponse,
        CreateSubscriptionBody,
        SubscriptionKeysBody,
        SubscriptionResponse,
        RecurrenceRule,
        Frequency,
        Weekday,
        Visibility,
        ProblemDetails,
        FieldError,
    )),
    tags((name = "reminders", description = "Lembretes, próximos disparos e Web Push"))
)]
pub struct RemindersApi;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn documents_all_reminders_routes() {
        let api = RemindersApi::openapi();
        let paths = &api.paths.paths;
        let methods = |path: &str| -> Vec<String> {
            let item = paths.get(path).unwrap_or_else(|| panic!("falta {path}"));
            let json = serde_json::to_value(item).unwrap();
            let mut methods: Vec<String> = json
                .as_object()
                .unwrap()
                .keys()
                .filter(|key| ["get", "post", "patch", "put", "delete"].contains(&key.as_str()))
                .cloned()
                .collect();
            methods.sort();
            methods
        };

        assert_eq!(methods("/reminders"), ["get", "post"]);
        assert_eq!(methods("/reminders/{id}"), ["delete", "get", "patch"]);
        assert_eq!(methods("/reminders/upcoming"), ["get"]);
        assert_eq!(methods("/web-push/public-key"), ["get"]);
        assert_eq!(methods("/push-subscriptions"), ["post"]);
        assert_eq!(methods("/push-subscriptions/{id}"), ["delete"]);
        assert_eq!(paths.len(), 6);
        assert!(paths.keys().all(|path| !path.starts_with("/api/v1")));
        let schemas = &api.components.as_ref().unwrap().schemas;
        assert!(schemas.contains_key("ReminderResponse"));
        assert!(schemas.contains_key("ProblemDetails"));
    }
}
