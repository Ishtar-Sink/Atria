//! TOTP (RFC 6238): 30 s, 6 dígitos, SHA-1 e janela de um passo.

use chrono::{DateTime, Utc};
use totp_rs::{Algorithm, Builder, Secret, Totp};

use super::error::AuthError;

const SECRET_LEN: usize = 20;
const STEP_SECONDS: u64 = 30;
const DIGITS: u8 = 6;
const SKEW_STEPS: u16 = 1;

#[derive(Clone)]
pub struct TotpSecret {
    bytes: Vec<u8>,
}

impl std::fmt::Debug for TotpSecret {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("TotpSecret(<redacted>)")
    }
}

impl TotpSecret {
    /// 160 bits aleatórios, o tamanho recomendado pela RFC 4226.
    pub fn generate() -> Self {
        let mut bytes = vec![0u8; SECRET_LEN];
        rand::fill(bytes.as_mut_slice());
        Self { bytes }
    }

    pub fn from_bytes(bytes: Vec<u8>) -> Self {
        Self { bytes }
    }

    pub fn as_bytes(&self) -> &[u8] {
        &self.bytes
    }

    pub fn to_base32(&self) -> String {
        Secret::new(self.bytes.clone().into_boxed_slice()).to_base32()
    }

    /// URI `otpauth://` para o QR code do aplicativo autenticador.
    pub fn otpauth_uri(&self, issuer: &str, account: &str) -> String {
        format!(
            "otpauth://totp/{}:{}?secret={}&issuer={}&algorithm=SHA1&digits={}&period={}",
            encode_component(issuer),
            encode_component(account),
            self.to_base32(),
            encode_component(issuer),
            DIGITS,
            STEP_SECONDS
        )
    }

    fn totp(&self) -> Result<Totp, AuthError> {
        Builder::new()
            .with_algorithm(Algorithm::SHA1)
            .with_digits(DIGITS)
            .with_skew(SKEW_STEPS)
            .with_step_duration(STEP_SECONDS)
            .with_secret(Secret::new(self.bytes.clone().into_boxed_slice()))
            .build()
            .map_err(|_| AuthError::Internal("segredo TOTP inválido".to_owned()))
    }

    /// Confere o código do passo atual ou dos vizinhos (um passo para cada lado).
    pub fn verify(&self, code: &str, now: DateTime<Utc>) -> bool {
        let Ok(totp) = self.totp() else {
            return false;
        };
        let Ok(seconds) = u64::try_from(now.timestamp()) else {
            return false;
        };
        totp.check(code.trim(), seconds).is_some()
    }

    #[cfg(test)]
    pub fn code_at(&self, at: DateTime<Utc>) -> String {
        let seconds = u64::try_from(at.timestamp()).unwrap();
        self.totp().unwrap().generate(seconds).to_string()
    }
}

/// Codificação percentual dos caracteres que não são seguros numa URI.
fn encode_component(text: &str) -> String {
    text.bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                char::from(byte).to_string()
            }
            other => format!("%{other:02X}"),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use chrono::Duration;

    use super::*;

    fn now() -> DateTime<Utc> {
        "2026-11-01T12:00:10Z".parse().unwrap()
    }

    fn secret() -> TotpSecret {
        TotpSecret::from_bytes(b"12345678901234567890".to_vec())
    }

    #[test]
    fn accepts_code_of_current_step() {
        let code = secret().code_at(now());

        assert!(secret().verify(&code, now()));
    }

    #[test]
    fn accepts_code_of_adjacent_step() {
        let secret = secret();

        assert!(secret.verify(&secret.code_at(now() - Duration::seconds(30)), now()));
        assert!(secret.verify(&secret.code_at(now() + Duration::seconds(30)), now()));
    }

    #[test]
    fn refuses_code_two_steps_away() {
        let secret = secret();

        assert!(!secret.verify(&secret.code_at(now() - Duration::seconds(60)), now()));
        assert!(!secret.verify(&secret.code_at(now() + Duration::seconds(60)), now()));
    }

    #[test]
    fn refuses_malformed_code() {
        assert!(!secret().verify("abc", now()));
        assert!(!secret().verify("", now()));
    }

    #[test]
    fn otpauth_uri_carries_secret_and_issuer() {
        let uri = secret().otpauth_uri("Atria", "ana@example.com");

        assert!(uri.starts_with("otpauth://totp/Atria:ana%40example.com?secret="));
        assert!(uri.contains("&issuer=Atria&"));
        assert!(uri.contains(&secret().to_base32()));
    }
}
