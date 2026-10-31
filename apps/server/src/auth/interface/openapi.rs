//! Documento OpenAPI do contexto, gerado do código ([project/api-02]).

use utoipa::OpenApi;

use super::dto::{
    AcceptedResponse, AdminPasswordResetRequest, InstanceSettingsResponse, InstanceStateResponse,
    InviteResponse, MeResponse, PasswordResetConfirmation, PasswordResetLinkResponse,
    PasswordResetRequest, PreferencesResponse, SetupRequest, SetupStatus, SignInRequest,
    SignUpRequest, TotpActivationRequest, TotpEnrollmentResponse, UpdateInstanceSettingsRequest,
    UpdatePreferencesRequest, UpdateUserRequest, UserPage, UserSummary,
};
use super::handlers;
use crate::shared::error::{FieldError, ProblemDetails};

#[derive(OpenApi)]
#[openapi(
    paths(
        handlers::setup_status,
        handlers::run_setup,
        handlers::sign_up,
        handlers::sign_in,
        handlers::sign_out,
        handlers::request_password_reset,
        handlers::reset_password,
        handlers::begin_totp,
        handlers::activate_totp,
        handlers::me,
        handlers::get_preferences,
        handlers::update_preferences,
        handlers::list_users,
        handlers::update_user,
        handlers::create_invite,
        handlers::create_admin_password_reset,
        handlers::instance_state,
        handlers::get_instance_settings,
        handlers::update_instance_settings,
    ),
    components(schemas(
        AcceptedResponse,
        AdminPasswordResetRequest,
        FieldError,
        InstanceSettingsResponse,
        InstanceStateResponse,
        InviteResponse,
        MeResponse,
        PasswordResetConfirmation,
        PasswordResetLinkResponse,
        PasswordResetRequest,
        PreferencesResponse,
        ProblemDetails,
        SetupRequest,
        SetupStatus,
        SignInRequest,
        SignUpRequest,
        TotpActivationRequest,
        TotpEnrollmentResponse,
        UpdateInstanceSettingsRequest,
        UpdatePreferencesRequest,
        UpdateUserRequest,
        UserPage,
        UserSummary,
    )),
    tags((name = "auth", description = "Contas, sessão, 2FA, preferências e administração da instância"))
)]
pub struct AuthApi;

#[cfg(test)]
mod tests {
    use utoipa::OpenApi;

    use super::AuthApi;

    #[test]
    fn documents_all_auth_routes() {
        let document = AuthApi::openapi();
        let paths: Vec<&String> = document.paths.paths.keys().collect();

        for expected in [
            "/api/v1/setup",
            "/api/v1/auth/sign-up",
            "/api/v1/auth/sign-in",
            "/api/v1/auth/sign-out",
            "/api/v1/auth/password-resets",
            "/api/v1/auth/password-resets/{token}",
            "/api/v1/auth/totp",
            "/api/v1/auth/totp/activation",
            "/api/v1/me",
            "/api/v1/me/preferences",
            "/api/v1/admin/users",
            "/api/v1/admin/users/{id}",
            "/api/v1/admin/invites",
            "/api/v1/admin/password-resets",
            "/api/v1/admin/instance",
            "/api/v1/admin/instance/settings",
        ] {
            assert!(
                paths.iter().any(|path| path.as_str() == expected),
                "{expected}"
            );
        }
    }

    #[test]
    fn documents_methods_of_shared_paths() {
        let document = AuthApi::openapi();
        let setup = &document.paths.paths["/api/v1/setup"];
        let settings = &document.paths.paths["/api/v1/admin/instance/settings"];

        assert!(setup.get.is_some() && setup.post.is_some());
        assert!(settings.get.is_some() && settings.patch.is_some());
        assert!(document.components.is_some());
    }
}
