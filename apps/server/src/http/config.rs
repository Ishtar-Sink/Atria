//! Configuração só por variáveis `ATRIA_`, com padrões seguros; segredos lidos de
//! arquivo, nunca do repositório nem do log ([project/security-12],
//! [project/self-hosting-03]).

use std::fmt;
use std::net::SocketAddr;
use std::path::PathBuf;

use ipnet::IpNet;

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum ConfigError {
    #[error("variável obrigatória ausente: {0}")]
    Missing(&'static str),
    #[error("variável com valor inválido: {0}")]
    Invalid(&'static str),
    #[error("arquivo da variável ilegível: {0}")]
    Unreadable(&'static str),
}

impl ConfigError {
    /// Nome da variável, o único dado do erro que pode ir para o log.
    pub fn variable(&self) -> &'static str {
        match self {
            Self::Missing(name) | Self::Invalid(name) | Self::Unreadable(name) => name,
        }
    }
}

#[derive(Clone, PartialEq, Eq)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub user: Option<String>,
    pub password: Option<String>,
    pub from: Option<String>,
}

impl fmt::Debug for SmtpConfig {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SmtpConfig")
            .field("host", &self.host)
            .field("port", &self.port)
            .field("user", &self.user.as_ref().map(|_| "<redacted>"))
            .field("password", &self.password.as_ref().map(|_| "<redacted>"))
            .field("from", &self.from)
            .finish()
    }
}

#[derive(Clone, PartialEq, Eq)]
pub struct Config {
    pub database_url: String,
    pub bind_address: SocketAddr,
    /// URL pública; com `https`, o cookie leva `Secure` e a resposta, HSTS.
    pub public_url: String,
    pub encryption_key_file: PathBuf,
    pub storage_path: PathBuf,
    pub trusted_proxies: Vec<IpNet>,
    pub log_level: String,
    pub smtp: Option<SmtpConfig>,
    pub web_push_vapid_key_file: Option<PathBuf>,
}

const DEFAULT_BIND_ADDRESS: &str = "0.0.0.0:8080";
const DEFAULT_STORAGE_PATH: &str = "/data/files";
const DEFAULT_SMTP_PORT: u16 = 587;

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Self::from_vars(|name| std::env::var(name).ok())
    }

    pub fn from_vars(var: impl Fn(&str) -> Option<String>) -> Result<Self, ConfigError> {
        let get = |name: &str| var(name).filter(|value| !value.trim().is_empty());
        let required = |name: &'static str| get(name).ok_or(ConfigError::Missing(name));
        let public_url = required("ATRIA_PUBLIC_URL")?;
        if origin_of(&public_url).is_none() {
            return Err(ConfigError::Invalid("ATRIA_PUBLIC_URL"));
        }
        Ok(Self {
            database_url: required("ATRIA_DATABASE_URL")?,
            bind_address: get("ATRIA_BIND_ADDRESS")
                .unwrap_or_else(|| DEFAULT_BIND_ADDRESS.to_owned())
                .parse()
                .map_err(|_| ConfigError::Invalid("ATRIA_BIND_ADDRESS"))?,
            public_url,
            encryption_key_file: PathBuf::from(required("ATRIA_ENCRYPTION_KEY_FILE")?),
            storage_path: PathBuf::from(
                get("ATRIA_STORAGE_PATH").unwrap_or_else(|| DEFAULT_STORAGE_PATH.to_owned()),
            ),
            trusted_proxies: parse_proxies(get("ATRIA_TRUSTED_PROXIES"))?,
            log_level: get("ATRIA_LOG_LEVEL").unwrap_or_else(|| "info".to_owned()),
            smtp: parse_smtp(&get)?,
            web_push_vapid_key_file: get("ATRIA_WEB_PUSH_VAPID_KEY_FILE").map(PathBuf::from),
        })
    }

    pub fn is_https(&self) -> bool {
        self.public_url.starts_with("https://")
    }

    /// Origem (`esquema://host[:porta]`) da URL pública, comparada ao `Origin`.
    pub fn public_origin(&self) -> &str {
        origin_of(&self.public_url).unwrap_or(&self.public_url)
    }
}

fn origin_of(url: &str) -> Option<&str> {
    let rest = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))?;
    let host_len = rest.find('/').unwrap_or(rest.len());
    if host_len == 0 {
        return None;
    }
    Some(&url[..url.len() - rest.len() + host_len])
}

fn parse_proxies(value: Option<String>) -> Result<Vec<IpNet>, ConfigError> {
    let Some(value) = value else {
        return Ok(Vec::new());
    };
    value
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(|item| {
            item.parse::<IpNet>()
                .or_else(|_| item.parse::<std::net::IpAddr>().map(IpNet::from))
                .map_err(|_| ConfigError::Invalid("ATRIA_TRUSTED_PROXIES"))
        })
        .collect()
}

fn parse_smtp(get: &impl Fn(&str) -> Option<String>) -> Result<Option<SmtpConfig>, ConfigError> {
    let Some(host) = get("ATRIA_SMTP_HOST") else {
        return Ok(None);
    };
    let port = match get("ATRIA_SMTP_PORT") {
        Some(port) => port
            .parse()
            .map_err(|_| ConfigError::Invalid("ATRIA_SMTP_PORT"))?,
        None => DEFAULT_SMTP_PORT,
    };
    let password = match get("ATRIA_SMTP_PASSWORD_FILE") {
        Some(path) => Some(
            std::fs::read_to_string(path)
                .map_err(|_| ConfigError::Unreadable("ATRIA_SMTP_PASSWORD_FILE"))?
                .trim_end()
                .to_owned(),
        ),
        None => None,
    };
    Ok(Some(SmtpConfig {
        host,
        port,
        user: get("ATRIA_SMTP_USER"),
        password,
        from: get("ATRIA_SMTP_FROM"),
    }))
}

impl fmt::Debug for Config {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // A URL do banco pode levar a senha: nunca aparece ([project/security-12]).
        f.debug_struct("Config")
            .field("database_url", &"<redacted>")
            .field("bind_address", &self.bind_address)
            .field("public_url", &self.public_url)
            .field("encryption_key_file", &self.encryption_key_file)
            .field("storage_path", &self.storage_path)
            .field("trusted_proxies", &self.trusted_proxies)
            .field("log_level", &self.log_level)
            .field("smtp", &self.smtp)
            .field("web_push_vapid_key_file", &self.web_push_vapid_key_file)
            .finish()
    }
}
