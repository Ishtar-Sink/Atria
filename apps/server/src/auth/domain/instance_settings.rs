//! Configurações da instância (RF-60): convite obrigatório, Web Push e SMTP sem a
//! senha, que vem só do arquivo `ATRIA_SMTP_PASSWORD_FILE` ([project/security-12]).

use super::error::AuthError;
use crate::shared::error::FieldError;

const HOST_MAX_LEN: usize = 253;
const FIELD_MAX_LEN: usize = 254;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstanceSettings {
    pub invite_required: bool,
    pub web_push_enabled: bool,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<u16>,
    pub smtp_user: Option<String>,
    pub smtp_from: Option<String>,
}

impl Default for InstanceSettings {
    fn default() -> Self {
        Self {
            invite_required: true,
            web_push_enabled: false,
            smtp_host: None,
            smtp_port: None,
            smtp_user: None,
            smtp_from: None,
        }
    }
}

/// Mudança parcial; texto vazio limpa o campo de SMTP.
#[derive(Debug, Clone, Default)]
pub struct InstanceSettingsPatch {
    pub invite_required: Option<bool>,
    pub web_push_enabled: Option<bool>,
    pub smtp_host: Option<String>,
    pub smtp_port: Option<u16>,
    pub smtp_user: Option<String>,
    pub smtp_from: Option<String>,
}

impl InstanceSettings {
    pub fn apply(&mut self, patch: InstanceSettingsPatch) -> Result<(), AuthError> {
        let mut errors = Vec::new();
        let mut next = self.clone();
        if let Some(value) = patch.invite_required {
            next.invite_required = value;
        }
        if let Some(value) = patch.web_push_enabled {
            next.web_push_enabled = value;
        }
        if let Some(host) = patch.smtp_host {
            next.smtp_host = text_field(&mut errors, "smtp_host", host, is_host);
        }
        if let Some(user) = patch.smtp_user {
            next.smtp_user = text_field(&mut errors, "smtp_user", user, is_plain_text);
        }
        if let Some(from) = patch.smtp_from {
            next.smtp_from = text_field(&mut errors, "smtp_from", from, is_plain_text);
        }
        if let Some(port) = patch.smtp_port {
            if port == 0 {
                errors.push(FieldError::new("smtp_port", "invalid"));
            }
            next.smtp_port = Some(port);
        }
        if !errors.is_empty() {
            return Err(AuthError::Validation(errors));
        }
        *self = next;
        Ok(())
    }
}

fn text_field(
    errors: &mut Vec<FieldError>,
    field: &str,
    value: String,
    valid: fn(&str) -> bool,
) -> Option<String> {
    let value = value.trim().to_owned();
    if value.is_empty() {
        return None;
    }
    if !valid(&value) {
        errors.push(FieldError::new(field, "invalid"));
    }
    Some(value)
}

fn is_host(text: &str) -> bool {
    text.len() <= HOST_MAX_LEN
        && text
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
}

fn is_plain_text(text: &str) -> bool {
    text.len() <= FIELD_MAX_LEN && !text.chars().any(char::is_control)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_require_invite_and_disable_push() {
        let settings = InstanceSettings::default();

        assert!(settings.invite_required);
        assert!(!settings.web_push_enabled);
        assert_eq!(settings.smtp_host, None);
    }

    #[test]
    fn applies_patch_and_clears_empty_text() {
        let mut settings = InstanceSettings::default();
        settings
            .apply(InstanceSettingsPatch {
                invite_required: Some(false),
                web_push_enabled: Some(true),
                smtp_host: Some("smtp.example.com".to_owned()),
                smtp_port: Some(587),
                ..InstanceSettingsPatch::default()
            })
            .unwrap();
        assert!(!settings.invite_required);
        assert_eq!(settings.smtp_host.as_deref(), Some("smtp.example.com"));

        settings
            .apply(InstanceSettingsPatch {
                smtp_host: Some(String::new()),
                ..InstanceSettingsPatch::default()
            })
            .unwrap();
        assert_eq!(settings.smtp_host, None);
    }

    #[test]
    fn refuses_invalid_host_and_port() {
        let mut settings = InstanceSettings::default();
        let result = settings.apply(InstanceSettingsPatch {
            smtp_host: Some("bad host!".to_owned()),
            smtp_port: Some(0),
            ..InstanceSettingsPatch::default()
        });

        assert!(matches!(result, Err(AuthError::Validation(errors)) if errors.len() == 2));
        assert_eq!(settings, InstanceSettings::default());
    }
}
