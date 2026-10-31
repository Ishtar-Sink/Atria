//! Corpos da API em `snake_case`, com o esquema OpenAPI gerado do código.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};
use uuid::Uuid;

use crate::auth::application::admin::{InstanceState, IssuedInvite};
use crate::auth::application::password_resets::IssuedLink;
use crate::auth::domain::instance_settings::InstanceSettings;
use crate::auth::domain::preferences::Preferences;
use crate::auth::domain::user::User;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SetupStatus {
    pub required: bool,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SetupRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SignUpRequest {
    pub email: String,
    pub password: String,
    pub invite_token: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct SignInRequest {
    pub email: String,
    pub password: String,
    pub totp_code: Option<String>,
}

/// Usuário da sessão. `account_complete` é falso para o admin sem 2FA.
#[derive(Debug, Serialize, ToSchema)]
pub struct MeResponse {
    pub id: Uuid,
    pub email: String,
    pub role: String,
    pub totp_enabled: bool,
    pub account_complete: bool,
}

impl From<&User> for MeResponse {
    fn from(user: &User) -> Self {
        Self {
            id: user.id,
            email: user.email.clone(),
            role: user.role.as_str().to_owned(),
            totp_enabled: user.totp_enabled(),
            account_complete: user.is_complete(),
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct TotpEnrollmentResponse {
    pub secret: String,
    pub otpauth_uri: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct TotpActivationRequest {
    pub code: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct PasswordResetRequest {
    pub email: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AcceptedResponse {
    pub status: &'static str,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct PasswordResetConfirmation {
    pub password: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserSummary {
    pub id: Uuid,
    pub email: String,
    pub role: String,
    pub is_active: bool,
    pub totp_enabled: bool,
    pub created_at: DateTime<Utc>,
}

impl From<&User> for UserSummary {
    fn from(user: &User) -> Self {
        Self {
            id: user.id,
            email: user.email.clone(),
            role: user.role.as_str().to_owned(),
            is_active: user.is_active,
            totp_enabled: user.totp_enabled(),
            created_at: user.created_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct UserPage {
    pub items: Vec<UserSummary>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct UserListQuery {
    pub cursor: Option<String>,
    pub limit: Option<u32>,
    /// Filtro por papel: `admin`, `elevated` ou `user`.
    pub role: Option<String>,
    /// Busca por parte do e-mail.
    pub q: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateUserRequest {
    pub role: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct InviteResponse {
    pub id: Uuid,
    /// Link com o token; aparece só nesta resposta.
    pub link: String,
    pub expires_at: DateTime<Utc>,
}

impl From<IssuedInvite> for InviteResponse {
    fn from(invite: IssuedInvite) -> Self {
        Self {
            id: invite.id,
            link: invite.link,
            expires_at: invite.expires_at,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct AdminPasswordResetRequest {
    pub user_id: Uuid,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PasswordResetLinkResponse {
    pub link: String,
    pub expires_at: DateTime<Utc>,
}

impl From<IssuedLink> for PasswordResetLinkResponse {
    fn from(issued: IssuedLink) -> Self {
        Self {
            link: issued.link,
            expires_at: issued.expires_at,
        }
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct InstanceStateResponse {
    pub version: String,
    pub database_bytes: i64,
    pub storage_bytes: u64,
    pub healthy: bool,
    pub invite_required: bool,
    pub web_push_enabled: bool,
}

impl From<InstanceState> for InstanceStateResponse {
    fn from(state: InstanceState) -> Self {
        Self {
            version: state.version.to_owned(),
            database_bytes: state.database_bytes,
            storage_bytes: state.storage_bytes,
            healthy: state.healthy,
            invite_required: state.invite_required,
            web_push_enabled: state.web_push_enabled,
        }
    }
}

/// Configurações da instância. A senha do SMTP não existe aqui: vem só de
/// `ATRIA_SMTP_PASSWORD_FILE`.
#[derive(Debug, Serialize, ToSchema)]
pub struct InstanceSettingsResponse {
    pub invite_required: bool,
    pub web_push_enabled: bool,
    /// A chave VAPID está configurada (`ATRIA_WEB_PUSH_VAPID_KEY_FILE`): sem ela, o Web Push
    /// não pode ser ligado.
    pub web_push_configured: bool,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<u16>,
    pub smtp_user: Option<String>,
    pub smtp_from: Option<String>,
}

impl InstanceSettingsResponse {
    pub fn new(settings: InstanceSettings, web_push_configured: bool) -> Self {
        Self {
            invite_required: settings.invite_required,
            web_push_enabled: settings.web_push_enabled,
            web_push_configured,
            smtp_host: settings.smtp_host,
            smtp_port: settings.smtp_port,
            smtp_user: settings.smtp_user,
            smtp_from: settings.smtp_from,
        }
    }
}

/// Mudança parcial; texto vazio limpa o campo de SMTP. Campos desconhecidos (como uma
/// senha de SMTP) são recusados.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdateInstanceSettingsRequest {
    pub invite_required: Option<bool>,
    pub web_push_enabled: Option<bool>,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<u16>,
    pub smtp_user: Option<String>,
    pub smtp_from: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PreferencesResponse {
    pub theme: String,
    pub locale: String,
    pub timezone: String,
    pub currency: String,
    pub palette_shortcut: String,
    pub search_contexts: Vec<String>,
}

impl From<Preferences> for PreferencesResponse {
    fn from(preferences: Preferences) -> Self {
        Self {
            theme: preferences.theme,
            locale: preferences.locale,
            timezone: preferences.timezone,
            currency: preferences.currency,
            palette_shortcut: preferences.palette_shortcut,
            search_contexts: preferences.search_contexts,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct UpdatePreferencesRequest {
    pub theme: Option<String>,
    pub locale: Option<String>,
    pub timezone: Option<String>,
    pub currency: Option<String>,
    pub palette_shortcut: Option<String>,
    pub search_contexts: Option<Vec<String>>,
}
