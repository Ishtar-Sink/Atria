//! Handlers HTTP: validação na borda e conversão de `AuthError` em `problem+json`
//! ([project/code-style-03]).

use std::sync::Arc;

use axum::Json;
use axum::extract::{FromRequest, FromRequestParts, Path, Query, Request, State};
use axum::http::StatusCode;
use axum::http::request::Parts;
use serde::de::DeserializeOwned;
use tower_sessions::Session;
use uuid::Uuid;

use super::Collaborators;
use super::dto::{
    AcceptedResponse, AdminPasswordResetRequest, InstanceSettingsResponse, InstanceStateResponse,
    InviteResponse, MeResponse, PasswordResetConfirmation, PasswordResetLinkResponse,
    PasswordResetRequest, PreferencesResponse, SetupRequest, SetupStatus, SignInRequest,
    SignUpRequest, TotpActivationRequest, TotpEnrollmentResponse, UpdateInstanceSettingsRequest,
    UpdatePreferencesRequest, UpdateUserRequest, UserListQuery, UserPage, UserSummary,
};
use crate::auth::application::AuthService;
use crate::auth::application::admin::{UserChange, UserFilter};
use crate::auth::application::sign_in::SignIn;
use crate::auth::application::sign_up::SignUp;
use crate::auth::domain::error::AuthError;
use crate::auth::domain::instance_settings::InstanceSettingsPatch;
use crate::auth::domain::preferences::PreferencesPatch;
use crate::auth::domain::user::{Role, User};
use crate::http::client_ip::ClientIp;
use crate::http::session::CurrentUser;
use crate::http::{AppState, end_user_session, start_user_session};
use crate::shared::error::{ApiError, FieldError, ProblemDetails};
use crate::shared::pagination::{Cursor, DEFAULT_LIMIT, MAX_LIMIT};

/// Chave da sessão que marca o admin sem 2FA; lida por `require_complete_account`.
pub(super) const INCOMPLETE_KEY: &str = "account_incomplete";

impl From<AuthError> for ApiError {
    fn from(error: AuthError) -> Self {
        match error {
            AuthError::InvalidCredentials => Self::unauthorized("invalid_credentials"),
            AuthError::TotpRequired => Self::unauthorized("totp_required"),
            AuthError::InvalidTotpCode => Self::unauthorized("invalid_totp_code"),
            AuthError::Unauthenticated => Self::unauthorized("unauthenticated"),
            AuthError::InviteInvalid => bad_request("invite_invalid"),
            AuthError::ResetTokenInvalid => bad_request("reset_token_invalid"),
            AuthError::InviteRequired => Self::forbidden("invite_required"),
            AuthError::Forbidden => Self::forbidden("forbidden"),
            AuthError::SetupAlreadyDone => Self::conflict("setup_already_done"),
            AuthError::SetupRequired => Self::conflict("setup_required"),
            AuthError::TotpAlreadyEnabled => Self::conflict("totp_already_enabled"),
            AuthError::TotpNotStarted => Self::conflict("totp_not_started"),
            AuthError::UserNotFound => Self::not_found("user_not_found"),
            AuthError::TooManyAttempts {
                retry_after_seconds,
            } => Self::new(
                StatusCode::TOO_MANY_REQUESTS,
                "too_many_attempts",
                "Too Many Requests",
            )
            .with_detail(format!("retry_after_seconds={retry_after_seconds}")),
            AuthError::Validation(errors) => Self::unprocessable("validation_failed", errors),
            AuthError::Internal(message) => {
                tracing::error!(error = %message, "erro interno do contexto auth");
                Self::internal()
            }
        }
    }
}

fn bad_request(code: &'static str) -> ApiError {
    ApiError::new(StatusCode::BAD_REQUEST, code, "Bad Request")
}

fn session_error(error: tower_sessions::session::Error) -> ApiError {
    ApiError::internal_from(&error)
}

/// Corpo JSON cuja falha de leitura vira `problem+json` com código estável.
pub struct ValidJson<T>(pub T);

impl<S: Send + Sync, T: DeserializeOwned> FromRequest<S> for ValidJson<T> {
    type Rejection = ApiError;

    async fn from_request(request: Request, state: &S) -> Result<Self, Self::Rejection> {
        match Json::<T>::from_request(request, state).await {
            Ok(Json(value)) => Ok(Self(value)),
            Err(_) => Err(ApiError::unprocessable(
                "validation_failed",
                vec![FieldError::new("body", "invalid")],
            )),
        }
    }
}

/// Serviço do contexto montado com o estado e os colaboradores do roteador.
pub struct Auth(pub AuthService);

impl FromRequestParts<AppState> for Auth {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let collaborators = parts
            .extensions
            .get::<Arc<Collaborators>>()
            .cloned()
            .ok_or_else(ApiError::internal)?;
        Ok(Self(AuthService {
            pool: state.pool.clone(),
            clock: state.clock.clone(),
            ids: state.ids.clone(),
            cipher: state.cipher.clone(),
            config: state.config.clone(),
            hasher: collaborators.hasher.clone(),
            mailer: collaborators.mailer.clone(),
        }))
    }
}

/// Grava, na sessão, se o admin ainda precisa ativar o 2FA.
async fn sync_session_flag(session: &Session, user: &User) -> Result<(), ApiError> {
    if user.is_complete() {
        session
            .remove::<bool>(INCOMPLETE_KEY)
            .await
            .map_err(session_error)?;
        return Ok(());
    }
    session
        .insert(INCOMPLETE_KEY, true)
        .await
        .map_err(session_error)
}

async fn open_session(session: &Session, user: &User) -> Result<(), ApiError> {
    start_user_session(session, user.id).await?;
    sync_session_flag(session, user).await
}

#[utoipa::path(
    get, path = "/api/v1/setup", tag = "auth",
    responses((status = 200, body = SetupStatus))
)]
pub async fn setup_status(Auth(auth): Auth) -> Result<Json<SetupStatus>, ApiError> {
    Ok(Json(SetupStatus {
        required: auth.setup_required().await?,
    }))
}

#[utoipa::path(
    post, path = "/api/v1/setup", tag = "auth", request_body = SetupRequest,
    responses(
        (status = 201, body = MeResponse),
        (status = 409, body = ProblemDetails, description = "setup_already_done"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn run_setup(
    Auth(auth): Auth,
    session: Session,
    ValidJson(body): ValidJson<SetupRequest>,
) -> Result<(StatusCode, Json<MeResponse>), ApiError> {
    let user = auth.run_setup(&body.email, &body.password).await?;
    open_session(&session, &user).await?;
    Ok((StatusCode::CREATED, Json(MeResponse::from(&user))))
}

#[utoipa::path(
    post, path = "/api/v1/auth/sign-up", tag = "auth", request_body = SignUpRequest,
    responses(
        (status = 201, body = MeResponse),
        (status = 400, body = ProblemDetails, description = "invite_invalid"),
        (status = 403, body = ProblemDetails, description = "invite_required"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
        (status = 429, body = ProblemDetails, description = "too_many_attempts"),
    )
)]
pub async fn sign_up(
    Auth(auth): Auth,
    ClientIp(ip): ClientIp,
    session: Session,
    ValidJson(body): ValidJson<SignUpRequest>,
) -> Result<(StatusCode, Json<MeResponse>), ApiError> {
    let user = auth
        .sign_up(SignUp {
            email: body.email,
            password: body.password,
            invite_token: body.invite_token,
            client_ip: ip.to_string(),
        })
        .await?;
    open_session(&session, &user).await?;
    Ok((StatusCode::CREATED, Json(MeResponse::from(&user))))
}

#[utoipa::path(
    post, path = "/api/v1/auth/sign-in", tag = "auth", request_body = SignInRequest,
    responses(
        (status = 200, body = MeResponse),
        (status = 401, body = ProblemDetails, description = "invalid_credentials, totp_required ou invalid_totp_code"),
        (status = 429, body = ProblemDetails, description = "too_many_attempts"),
    )
)]
pub async fn sign_in(
    Auth(auth): Auth,
    ClientIp(ip): ClientIp,
    session: Session,
    ValidJson(body): ValidJson<SignInRequest>,
) -> Result<Json<MeResponse>, ApiError> {
    let user = auth
        .sign_in(SignIn {
            email: body.email,
            password: body.password,
            totp_code: body.totp_code,
            client_ip: ip.to_string(),
        })
        .await?;
    open_session(&session, &user).await?;
    Ok(Json(MeResponse::from(&user)))
}

#[utoipa::path(
    post, path = "/api/v1/auth/sign-out", tag = "auth",
    responses((status = 204))
)]
pub async fn sign_out(session: Session) -> Result<StatusCode, ApiError> {
    end_user_session(&session).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post, path = "/api/v1/auth/password-resets", tag = "auth", request_body = PasswordResetRequest,
    responses(
        (status = 202, body = AcceptedResponse, description = "Mesma resposta exista ou não o e-mail"),
        (status = 429, body = ProblemDetails, description = "too_many_attempts"),
    )
)]
pub async fn request_password_reset(
    Auth(auth): Auth,
    ClientIp(ip): ClientIp,
    ValidJson(body): ValidJson<PasswordResetRequest>,
) -> Result<(StatusCode, Json<AcceptedResponse>), ApiError> {
    auth.request_password_reset(&body.email, &ip.to_string())
        .await?;
    Ok((
        StatusCode::ACCEPTED,
        Json(AcceptedResponse { status: "accepted" }),
    ))
}

#[utoipa::path(
    put, path = "/api/v1/auth/password-resets/{token}", tag = "auth",
    params(("token" = String, Path, description = "Token de redefinição")),
    request_body = PasswordResetConfirmation,
    responses(
        (status = 204),
        (status = 400, body = ProblemDetails, description = "reset_token_invalid"),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn reset_password(
    Auth(auth): Auth,
    Path(token): Path<String>,
    ValidJson(body): ValidJson<PasswordResetConfirmation>,
) -> Result<StatusCode, ApiError> {
    auth.reset_password(&token, &body.password).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post, path = "/api/v1/auth/totp", tag = "auth",
    responses(
        (status = 201, body = TotpEnrollmentResponse),
        (status = 409, body = ProblemDetails, description = "totp_already_enabled"),
    )
)]
pub async fn begin_totp(
    Auth(auth): Auth,
    current: CurrentUser,
) -> Result<(StatusCode, Json<TotpEnrollmentResponse>), ApiError> {
    let enrollment = auth.begin_totp(current.user_id).await?;
    Ok((
        StatusCode::CREATED,
        Json(TotpEnrollmentResponse {
            secret: enrollment.secret,
            otpauth_uri: enrollment.otpauth_uri,
        }),
    ))
}

#[utoipa::path(
    post, path = "/api/v1/auth/totp/activation", tag = "auth", request_body = TotpActivationRequest,
    responses(
        (status = 204),
        (status = 401, body = ProblemDetails, description = "invalid_totp_code"),
        (status = 409, body = ProblemDetails, description = "totp_not_started ou totp_already_enabled"),
    )
)]
pub async fn activate_totp(
    Auth(auth): Auth,
    current: CurrentUser,
    session: Session,
    ValidJson(body): ValidJson<TotpActivationRequest>,
) -> Result<StatusCode, ApiError> {
    auth.activate_totp(current.user_id, &body.code).await?;
    session
        .remove::<bool>(INCOMPLETE_KEY)
        .await
        .map_err(session_error)?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get, path = "/api/v1/me", tag = "auth",
    responses((status = 200, body = MeResponse), (status = 401, body = ProblemDetails))
)]
pub async fn me(Auth(auth): Auth, current: CurrentUser) -> Result<Json<MeResponse>, ApiError> {
    let user = auth.active_user(current.user_id).await?;
    Ok(Json(MeResponse::from(&user)))
}

#[utoipa::path(
    get, path = "/api/v1/me/preferences", tag = "auth",
    responses((status = 200, body = PreferencesResponse), (status = 401, body = ProblemDetails))
)]
pub async fn get_preferences(
    Auth(auth): Auth,
    current: CurrentUser,
) -> Result<Json<PreferencesResponse>, ApiError> {
    let user = auth.active_user(current.user_id).await?;
    Ok(Json(auth.preferences(user.id).await?.into()))
}

#[utoipa::path(
    patch, path = "/api/v1/me/preferences", tag = "auth", request_body = UpdatePreferencesRequest,
    responses(
        (status = 200, body = PreferencesResponse),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_preferences(
    Auth(auth): Auth,
    current: CurrentUser,
    ValidJson(body): ValidJson<UpdatePreferencesRequest>,
) -> Result<Json<PreferencesResponse>, ApiError> {
    let user = auth.active_user(current.user_id).await?;
    let patch = PreferencesPatch {
        theme: body.theme,
        locale: body.locale,
        timezone: body.timezone,
        currency: body.currency,
        palette_shortcut: body.palette_shortcut,
        search_contexts: body.search_contexts,
    };
    Ok(Json(auth.update_preferences(user.id, patch).await?.into()))
}

fn parse_role(field: &str, text: &str) -> Result<Role, ApiError> {
    Role::parse(text).ok_or_else(|| {
        ApiError::unprocessable("validation_failed", vec![FieldError::new(field, "invalid")])
    })
}

#[utoipa::path(
    get, path = "/api/v1/admin/users", tag = "auth", params(UserListQuery),
    responses((status = 200, body = UserPage), (status = 403, body = ProblemDetails))
)]
pub async fn list_users(
    Auth(auth): Auth,
    current: CurrentUser,
    Query(query): Query<UserListQuery>,
) -> Result<Json<UserPage>, ApiError> {
    let invalid_cursor = || {
        ApiError::unprocessable(
            "validation_failed",
            vec![FieldError::new("cursor", "invalid")],
        )
    };
    let cursor = query
        .cursor
        .as_deref()
        .map(Cursor::decode)
        .transpose()
        .map_err(|_| invalid_cursor())?;
    let filter = UserFilter {
        role: query
            .role
            .as_deref()
            .map(|r| parse_role("role", r))
            .transpose()?,
        query: query.q.filter(|q| !q.trim().is_empty()),
        cursor,
        limit: query.limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT),
    };
    let page = auth.list_users(current.user_id, filter).await?;
    Ok(Json(UserPage {
        items: page.items.iter().map(UserSummary::from).collect(),
        next_cursor: page.next_cursor,
    }))
}

#[utoipa::path(
    patch, path = "/api/v1/admin/users/{id}", tag = "auth",
    params(("id" = Uuid, Path, description = "Id do usuário")),
    request_body = UpdateUserRequest,
    responses(
        (status = 200, body = UserSummary),
        (status = 403, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "user_not_found"),
    )
)]
pub async fn update_user(
    Auth(auth): Auth,
    current: CurrentUser,
    Path(id): Path<Uuid>,
    ValidJson(body): ValidJson<UpdateUserRequest>,
) -> Result<Json<UserSummary>, ApiError> {
    let change = UserChange {
        role: body
            .role
            .as_deref()
            .map(|r| parse_role("role", r))
            .transpose()?,
        is_active: body.is_active,
    };
    let user = auth.change_user(current.user_id, id, change).await?;
    Ok(Json(UserSummary::from(&user)))
}

#[utoipa::path(
    post, path = "/api/v1/admin/invites", tag = "auth",
    responses((status = 201, body = InviteResponse), (status = 403, body = ProblemDetails))
)]
pub async fn create_invite(
    Auth(auth): Auth,
    current: CurrentUser,
) -> Result<(StatusCode, Json<InviteResponse>), ApiError> {
    let invite = auth.create_invite(current.user_id).await?;
    Ok((StatusCode::CREATED, Json(invite.into())))
}

#[utoipa::path(
    post, path = "/api/v1/admin/password-resets", tag = "auth", request_body = AdminPasswordResetRequest,
    responses(
        (status = 201, body = PasswordResetLinkResponse),
        (status = 403, body = ProblemDetails),
        (status = 404, body = ProblemDetails, description = "user_not_found"),
    )
)]
pub async fn create_admin_password_reset(
    Auth(auth): Auth,
    current: CurrentUser,
    ValidJson(body): ValidJson<AdminPasswordResetRequest>,
) -> Result<(StatusCode, Json<PasswordResetLinkResponse>), ApiError> {
    let issued = auth
        .admin_password_reset(current.user_id, body.user_id)
        .await?;
    Ok((StatusCode::CREATED, Json(issued.into())))
}

#[utoipa::path(
    get, path = "/api/v1/admin/instance", tag = "auth",
    responses((status = 200, body = InstanceStateResponse), (status = 403, body = ProblemDetails))
)]
pub async fn instance_state(
    Auth(auth): Auth,
    current: CurrentUser,
) -> Result<Json<InstanceStateResponse>, ApiError> {
    Ok(Json(auth.instance_state(current.user_id).await?.into()))
}

#[utoipa::path(
    get, path = "/api/v1/admin/instance/settings", tag = "auth",
    responses((status = 200, body = InstanceSettingsResponse), (status = 403, body = ProblemDetails))
)]
pub async fn get_instance_settings(
    State(state): State<AppState>,
    Auth(auth): Auth,
    current: CurrentUser,
) -> Result<Json<InstanceSettingsResponse>, ApiError> {
    let settings = auth.instance_settings(current.user_id).await?;
    Ok(Json(InstanceSettingsResponse::new(
        settings,
        web_push_configured(&state),
    )))
}

/// Como em `reminders::interface::handlers::web_push_available`: basta a chave estar definida.
fn web_push_configured(state: &AppState) -> bool {
    state.config.web_push_vapid_key_file.is_some()
}

#[utoipa::path(
    patch, path = "/api/v1/admin/instance/settings", tag = "auth",
    request_body = UpdateInstanceSettingsRequest,
    responses(
        (status = 200, body = InstanceSettingsResponse),
        (status = 403, body = ProblemDetails),
        (status = 422, body = ProblemDetails, description = "validation_failed"),
    )
)]
pub async fn update_instance_settings(
    State(state): State<AppState>,
    Auth(auth): Auth,
    current: CurrentUser,
    ValidJson(body): ValidJson<UpdateInstanceSettingsRequest>,
) -> Result<Json<InstanceSettingsResponse>, ApiError> {
    let patch = InstanceSettingsPatch {
        invite_required: body.invite_required,
        web_push_enabled: body.web_push_enabled,
        smtp_host: body.smtp_host,
        smtp_port: body.smtp_port,
        smtp_user: body.smtp_user,
        smtp_from: body.smtp_from,
    };
    let settings = auth
        .update_instance_settings(current.user_id, patch)
        .await?;
    Ok(Json(InstanceSettingsResponse::new(
        settings,
        web_push_configured(&state),
    )))
}
