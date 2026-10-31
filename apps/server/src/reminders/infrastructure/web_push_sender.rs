//! Envio Web Push com VAPID, com a chave privada P-256 em PEM lida de
//! `ATRIA_WEB_PUSH_VAPID_KEY_FILE`. Sem a variável, o Web Push fica desligado e o
//! lembrete continua aparecendo no app.

use std::fs::File;
use std::path::Path;

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use web_push::{
    ContentEncoding, HyperWebPushClient, PartialVapidSignatureBuilder, SubscriptionInfo,
    VapidSignatureBuilder, WebPushClient, WebPushError, WebPushMessageBuilder,
};

use crate::http::Config;
use crate::reminders::application::ports::{BoxFuture, PushSendError, PushSender};
use crate::reminders::domain::push_subscription::PushSubscription;

#[derive(Debug, thiserror::Error)]
pub enum VapidKeyError {
    #[error("falha ao ler a chave VAPID")]
    Read(#[from] std::io::Error),
    #[error("chave VAPID inválida")]
    Invalid,
}

/// Chave VAPID carregada: assina as mensagens e dá a chave pública ao navegador.
#[derive(Clone)]
pub struct VapidKey {
    signer: PartialVapidSignatureBuilder,
}

impl VapidKey {
    pub fn from_pem_file(path: &Path) -> Result<Self, VapidKeyError> {
        let file = File::open(path)?;
        let signer =
            VapidSignatureBuilder::from_pem_no_sub(file).map_err(|_| VapidKeyError::Invalid)?;
        Ok(Self { signer })
    }

    /// Chave pública sem compressão em base64url, o `applicationServerKey` do navegador.
    pub fn public_key(&self) -> String {
        URL_SAFE_NO_PAD.encode(self.signer.get_public_key())
    }
}

/// Lê a chave da configuração; `None` sem `ATRIA_WEB_PUSH_VAPID_KEY_FILE`.
pub fn vapid_key(config: &Config) -> Result<Option<VapidKey>, VapidKeyError> {
    config
        .web_push_vapid_key_file
        .as_deref()
        .map(VapidKey::from_pem_file)
        .transpose()
}

pub struct WebPushSender {
    key: VapidKey,
    /// `sub` do VAPID: contato do responsável pela instância, a URL pública.
    subject: String,
    client: HyperWebPushClient,
}

impl WebPushSender {
    pub fn new(key: VapidKey, subject: String) -> Self {
        Self {
            key,
            subject,
            client: HyperWebPushClient::new(),
        }
    }

    async fn deliver(
        &self,
        subscription: &PushSubscription,
        payload: &[u8],
        ttl_seconds: u32,
    ) -> Result<(), PushSendError> {
        let info = SubscriptionInfo::new(
            subscription.endpoint.as_str(),
            subscription.p256dh.as_str(),
            subscription.auth.as_str(),
        );
        let mut signature = self.key.signer.clone().add_sub_info(&info);
        signature.add_claim("sub", self.subject.as_str());
        let signature = signature.build().map_err(failed)?;
        let mut message = WebPushMessageBuilder::new(&info);
        message.set_ttl(ttl_seconds);
        message.set_payload(ContentEncoding::Aes128Gcm, payload);
        message.set_vapid_signature(signature);
        let message = message.build().map_err(failed)?;
        self.client.send(message).await.map_err(failed)
    }
}

fn failed(error: WebPushError) -> PushSendError {
    match error {
        WebPushError::EndpointNotValid(_) | WebPushError::EndpointNotFound(_) => {
            PushSendError::Gone
        }
        _ => PushSendError::Failed,
    }
}

impl PushSender for WebPushSender {
    fn send<'a>(
        &'a self,
        subscription: &'a PushSubscription,
        payload: &'a [u8],
        ttl_seconds: u32,
    ) -> BoxFuture<'a, Result<(), PushSendError>> {
        Box::pin(self.deliver(subscription, payload, ttl_seconds))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_key_is_uncompressed_p256_in_base64url() {
        let dir = tempfile::tempdir().unwrap();
        let path = crate::reminders::tests::write_vapid_key(dir.path());

        let key = VapidKey::from_pem_file(&path).unwrap();
        let bytes = URL_SAFE_NO_PAD.decode(key.public_key()).unwrap();

        assert_eq!(bytes.len(), 65);
        assert_eq!(bytes[0], 0x04);
    }

    #[test]
    fn invalid_key_file_is_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("vapid.pem");
        std::fs::write(&path, "não é uma chave").unwrap();

        assert!(matches!(
            VapidKey::from_pem_file(&path),
            Err(VapidKeyError::Invalid)
        ));
        assert!(matches!(
            VapidKey::from_pem_file(&dir.path().join("ausente.pem")),
            Err(VapidKeyError::Read(_))
        ));
    }
}
