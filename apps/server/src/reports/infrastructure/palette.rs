//! Cores do tema claro, copiadas dos tokens de `packages/theme` (`tokens.css`), que
//! são a fonte da identidade do ecossistema. O teste confere cada cor contra o CSS.

pub const BG: &str = "#f3f0fa";
pub const SURFACE: &str = "#ffffff";
pub const SURFACE_MUTED: &str = "#eae5f6";
pub const BORDER: &str = "#d9d1ec";
pub const BORDER_STRONG: &str = "#bfb3dd";
pub const PRIMARY: &str = "#6d28d9";
pub const PRIMARY_SOFT: &str = "#ebe0fd";
pub const PRIMARY_ON: &str = "#ffffff";
pub const ACCENT: &str = "#0e7490";
pub const ACCENT_FILL: &str = "#06b6d4";
pub const ACCENT_SOFT: &str = "#d8f1f6";
pub const TEXT: &str = "#1a1230";
pub const TEXT_MUTED: &str = "#4f4469";
pub const SUCCESS: &str = "#047857";
pub const SUCCESS_SOFT: &str = "#d9f3e7";
pub const WARNING: &str = "#92400e";
pub const WARNING_SOFT: &str = "#fcefcf";
pub const INFO: &str = "#0369a1";
pub const INFO_SOFT: &str = "#daeefb";

/// Variável CSS (sem o `--`) e a cor, na ordem do arquivo de tokens.
pub const TOKENS: [(&str, &str); 19] = [
    ("bg", BG),
    ("surface", SURFACE),
    ("surface-muted", SURFACE_MUTED),
    ("border", BORDER),
    ("border-strong", BORDER_STRONG),
    ("primary", PRIMARY),
    ("primary-soft", PRIMARY_SOFT),
    ("primary-on", PRIMARY_ON),
    ("accent", ACCENT),
    ("accent-fill", ACCENT_FILL),
    ("accent-soft", ACCENT_SOFT),
    ("text", TEXT),
    ("text-muted", TEXT_MUTED),
    ("success", SUCCESS),
    ("success-soft", SUCCESS_SOFT),
    ("warning", WARNING),
    ("warning-soft", WARNING_SOFT),
    ("info", INFO),
    ("info-soft", INFO_SOFT),
];

/// Cor sólida de um tom das barras (`primary`, `accent`, `success`, `warning`, `info`).
#[cfg(test)]
pub fn tone_color(tone: &str) -> &'static str {
    match tone {
        "accent" => ACCENT_FILL,
        "success" => SUCCESS,
        "warning" => WARNING,
        "info" => INFO,
        _ => PRIMARY,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Variáveis do primeiro bloco do CSS, o do tema claro.
    fn light_tokens() -> std::collections::HashMap<String, String> {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../packages/theme/src/tokens.css");
        let css = std::fs::read_to_string(path).unwrap();
        let block = css
            .split_once('{')
            .and_then(|(_, rest)| rest.split_once('}'))
            .map(|(body, _)| body.to_owned())
            .unwrap();
        block
            .lines()
            .filter_map(|line| {
                let line = line.trim().strip_prefix("--")?;
                let (name, value) = line.split_once(':')?;
                Some((
                    name.trim().to_owned(),
                    value.trim().trim_end_matches(';').to_owned(),
                ))
            })
            .collect()
    }

    #[test]
    fn palette_matches_theme_tokens() {
        let tokens = light_tokens();

        assert!(tokens.len() > 20, "o CSS de tokens não foi lido");
        for (name, color) in TOKENS {
            assert_eq!(
                tokens.get(name).map(String::as_str),
                Some(color),
                "cor --{name} fora do tema"
            );
        }
    }

    #[test]
    fn tone_color_falls_back_to_primary() {
        assert_eq!(tone_color("success"), SUCCESS);
        assert_eq!(tone_color("desconhecido"), PRIMARY);
    }
}
