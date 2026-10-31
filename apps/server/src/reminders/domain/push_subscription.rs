//! Inscrição Web Push de um navegador: endpoint do serviço de push e as chaves da
//! cifra da mensagem (RFC 8291).

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::reminders::domain::error::{FieldIssue, RemindersError};

pub const ENDPOINT_MAX_CHARS: usize = 2048;
/// Chave pública P-256 sem compressão: 0x04 seguido de X e Y.
const P256DH_BYTES: usize = 65;
const AUTH_BYTES: usize = 16;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PushSubscription {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub endpoint: String,
    pub p256dh: String,
    pub auth: String,
    pub created_at: DateTime<Utc>,
}

/// Inscrição validada, ainda sem id.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NewPushSubscription {
    pub endpoint: String,
    pub p256dh: String,
    pub auth: String,
}

impl NewPushSubscription {
    pub fn new(endpoint: &str, p256dh: &str, auth: &str) -> Result<Self, RemindersError> {
        let endpoint = endpoint.trim();
        let p256dh = p256dh.trim();
        let auth = auth.trim();
        let mut issues = Vec::new();
        if !valid_endpoint(endpoint) {
            issues.push(FieldIssue::new("endpoint", "invalid_endpoint"));
        }
        if !decodes_to(p256dh, P256DH_BYTES).is_some_and(|bytes| bytes.first() == Some(&0x04)) {
            issues.push(FieldIssue::new("p256dh", "invalid_key"));
        }
        if decodes_to(auth, AUTH_BYTES).is_none() {
            issues.push(FieldIssue::new("auth", "invalid_key"));
        }
        if !issues.is_empty() {
            return Err(RemindersError::Validation(issues));
        }
        Ok(Self {
            endpoint: endpoint.to_owned(),
            p256dh: p256dh.to_owned(),
            auth: auth.to_owned(),
        })
    }
}

fn valid_endpoint(endpoint: &str) -> bool {
    let host = endpoint.strip_prefix("https://").unwrap_or_default();
    !host.is_empty()
        && !host.starts_with('/')
        && endpoint.chars().count() <= ENDPOINT_MAX_CHARS
        && !endpoint.chars().any(char::is_whitespace)
}

/// Os navegadores mandam as chaves em base64url, com ou sem o preenchimento `=`.
fn decodes_to(text: &str, length: usize) -> Option<Vec<u8>> {
    URL_SAFE_NO_PAD
        .decode(text.trim_end_matches('='))
        .ok()
        .filter(|bytes| bytes.len() == length)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn p256dh() -> String {
        let mut key = vec![0x04u8];
        key.extend([7u8; 64]);
        URL_SAFE_NO_PAD.encode(key)
    }

    fn auth() -> String {
        URL_SAFE_NO_PAD.encode([9u8; 16])
    }

    fn fields(result: Result<NewPushSubscription, RemindersError>) -> Vec<&'static str> {
        match result {
            Err(RemindersError::Validation(issues)) => issues.iter().map(|i| i.field).collect(),
            other => panic!("esperava erro de validação, veio {other:?}"),
        }
    }

    #[test]
    fn subscription_requires_https_endpoint_and_keys() {
        let endpoint = "https://push.example.test/send/abc";

        let valid = NewPushSubscription::new(endpoint, &p256dh(), &auth()).unwrap();
        let padded = NewPushSubscription::new(endpoint, &format!("{}=", p256dh()), &auth());

        assert_eq!(valid.endpoint, endpoint);
        assert!(padded.is_ok());
        assert_eq!(
            fields(NewPushSubscription::new(
                "http://push.example.test/send",
                &p256dh(),
                &auth()
            )),
            ["endpoint"]
        );
        assert_eq!(
            fields(NewPushSubscription::new("https://", &p256dh(), &auth())),
            ["endpoint"]
        );
        assert_eq!(
            fields(NewPushSubscription::new(endpoint, "", "")),
            ["p256dh", "auth"]
        );
        let short_key = URL_SAFE_NO_PAD.encode([4u8; 33]);
        assert_eq!(
            fields(NewPushSubscription::new(endpoint, &short_key, &auth())),
            ["p256dh"]
        );
    }
}
