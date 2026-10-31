//! Preferências do usuário (RF-58, RF-59, RN-18) com validação de cada campo.

use std::str::FromStr;

use chrono_tz::Tz;

use super::error::AuthError;
use crate::shared::error::FieldError;

pub const SEARCH_CONTEXTS: [&str; 8] = [
    "finance",
    "goals",
    "tasks",
    "reminders",
    "notes",
    "journal",
    "library",
    "projects",
];

const THEMES: [&str; 3] = ["light", "dark", "system"];
const SHORTCUT_MAX_LEN: usize = 32;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Preferences {
    pub theme: String,
    pub locale: String,
    pub timezone: String,
    pub currency: String,
    pub palette_shortcut: String,
    pub search_contexts: Vec<String>,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            theme: "system".to_owned(),
            locale: "pt-BR".to_owned(),
            timezone: "America/Sao_Paulo".to_owned(),
            currency: "BRL".to_owned(),
            palette_shortcut: "mod+k".to_owned(),
            search_contexts: SEARCH_CONTEXTS.iter().map(|c| (*c).to_owned()).collect(),
        }
    }
}

/// Mudança parcial: só os campos presentes são validados e aplicados.
#[derive(Debug, Clone, Default)]
pub struct PreferencesPatch {
    pub theme: Option<String>,
    pub locale: Option<String>,
    pub timezone: Option<String>,
    pub currency: Option<String>,
    pub palette_shortcut: Option<String>,
    pub search_contexts: Option<Vec<String>>,
}

impl Preferences {
    /// Aplica a mudança; com qualquer campo inválido, nada muda e todos os erros voltam.
    pub fn apply(&mut self, patch: PreferencesPatch) -> Result<(), AuthError> {
        let mut errors = Vec::new();
        let mut next = self.clone();
        if let Some(theme) = patch.theme {
            check(&mut errors, "theme", THEMES.contains(&theme.as_str()));
            next.theme = theme;
        }
        if let Some(locale) = patch.locale {
            check(&mut errors, "locale", is_locale(&locale));
            next.locale = locale;
        }
        if let Some(timezone) = patch.timezone {
            check(&mut errors, "timezone", Tz::from_str(&timezone).is_ok());
            next.timezone = timezone;
        }
        if let Some(currency) = patch.currency {
            check(&mut errors, "currency", is_currency(&currency));
            next.currency = currency;
        }
        if let Some(shortcut) = patch.palette_shortcut {
            check(&mut errors, "palette_shortcut", is_shortcut(&shortcut));
            next.palette_shortcut = shortcut;
        }
        if let Some(contexts) = patch.search_contexts {
            check(&mut errors, "search_contexts", are_contexts(&contexts));
            next.search_contexts = contexts;
        }
        if !errors.is_empty() {
            return Err(AuthError::Validation(errors));
        }
        *self = next;
        Ok(())
    }
}

fn check(errors: &mut Vec<FieldError>, field: &str, valid: bool) {
    if !valid {
        errors.push(FieldError::new(field, "invalid"));
    }
}

/// Etiqueta de idioma simples: `pt`, `pt-BR`.
fn is_locale(text: &str) -> bool {
    let (language, region) = match text.split_once('-') {
        Some((language, region)) => (language, Some(region)),
        None => (text, None),
    };
    let language_ok =
        (2..=3).contains(&language.len()) && language.chars().all(|c| c.is_ascii_lowercase());
    let region_ok =
        region.is_none_or(|r| r.len() == 2 && r.chars().all(|c| c.is_ascii_uppercase()));
    language_ok && region_ok
}

fn is_currency(text: &str) -> bool {
    text.len() == 3 && text.chars().all(|c| c.is_ascii_uppercase())
}

fn is_shortcut(text: &str) -> bool {
    !text.is_empty()
        && text.len() <= SHORTCUT_MAX_LEN
        && text
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '+')
}

fn are_contexts(contexts: &[String]) -> bool {
    let known = contexts
        .iter()
        .all(|context| SEARCH_CONTEXTS.contains(&context.as_str()));
    let unique = contexts
        .iter()
        .enumerate()
        .all(|(i, context)| !contexts[..i].contains(context));
    known && unique
}

#[cfg(test)]
mod tests {
    use super::*;

    fn field_codes(error: AuthError) -> Vec<String> {
        match error {
            AuthError::Validation(errors) => errors.into_iter().map(|e| e.field).collect(),
            other => panic!("erro inesperado: {other:?}"),
        }
    }

    #[test]
    fn defaults_are_light_pt_br_sao_paulo_brl_mod_k() {
        let defaults = Preferences::default();

        assert_eq!(defaults.theme, "system");
        assert_eq!(defaults.locale, "pt-BR");
        assert_eq!(defaults.timezone, "America/Sao_Paulo");
        assert_eq!(defaults.currency, "BRL");
        assert_eq!(defaults.palette_shortcut, "mod+k");
        assert_eq!(defaults.search_contexts.len(), 8);
    }

    #[test]
    fn refuses_unknown_timezone() {
        let mut preferences = Preferences::default();
        let patch = PreferencesPatch {
            timezone: Some("Mars/Olympus".to_owned()),
            ..PreferencesPatch::default()
        };

        let error = preferences.apply(patch).unwrap_err();

        assert_eq!(field_codes(error), ["timezone"]);
        assert_eq!(preferences, Preferences::default());
    }

    #[test]
    fn refuses_unknown_search_context() {
        let mut preferences = Preferences::default();
        let patch = PreferencesPatch {
            search_contexts: Some(vec!["notes".to_owned(), "secrets".to_owned()]),
            ..PreferencesPatch::default()
        };

        let error = preferences.apply(patch).unwrap_err();

        assert_eq!(field_codes(error), ["search_contexts"]);
    }

    #[test]
    fn applies_valid_patch_and_keeps_the_rest() {
        let mut preferences = Preferences::default();
        let patch = PreferencesPatch {
            theme: Some("dark".to_owned()),
            locale: Some("en-US".to_owned()),
            timezone: Some("Europe/Lisbon".to_owned()),
            currency: Some("EUR".to_owned()),
            palette_shortcut: Some("ctrl+k".to_owned()),
            search_contexts: Some(vec!["notes".to_owned(), "tasks".to_owned()]),
        };

        preferences.apply(patch).unwrap();

        assert_eq!(preferences.theme, "dark");
        assert_eq!(preferences.currency, "EUR");
        assert_eq!(preferences.search_contexts, ["notes", "tasks"]);
    }

    #[test]
    fn refuses_invalid_theme_currency_locale_and_shortcut() {
        let mut preferences = Preferences::default();
        let patch = PreferencesPatch {
            theme: Some("neon".to_owned()),
            locale: Some("PT_br".to_owned()),
            currency: Some("real".to_owned()),
            palette_shortcut: Some("Ctrl K".to_owned()),
            ..PreferencesPatch::default()
        };

        let error = preferences.apply(patch).unwrap_err();

        assert_eq!(
            field_codes(error),
            ["theme", "locale", "currency", "palette_shortcut"]
        );
    }

    #[test]
    fn refuses_duplicated_search_context() {
        let mut preferences = Preferences::default();
        let patch = PreferencesPatch {
            search_contexts: Some(vec!["notes".to_owned(), "notes".to_owned()]),
            ..PreferencesPatch::default()
        };

        assert!(preferences.apply(patch).is_err());
    }
}
