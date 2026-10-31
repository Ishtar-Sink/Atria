//! IP do cliente: `X-Forwarded-For` só vale quando o par é um proxy confiável
//! ([project/self-hosting-04]). O `auth` usa para limitar tentativas.

use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;

use axum::extract::{ConnectInfo, FromRef, FromRequestParts};
use axum::http::request::Parts;
use ipnet::IpNet;

use crate::http::Config;
use crate::shared::error::ApiError;

const X_FORWARDED_FOR: &str = "x-forwarded-for";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ClientIp(pub IpAddr);

impl<S> FromRequestParts<S> for ClientIp
where
    S: Send + Sync,
    Arc<Config>: FromRef<S>,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let config = Arc::<Config>::from_ref(state);
        let Some(ConnectInfo(peer)) = parts.extensions.get::<ConnectInfo<SocketAddr>>() else {
            return Err(ApiError::internal());
        };
        Ok(Self(resolve(peer.ip(), parts, &config.trusted_proxies)))
    }
}

fn is_trusted(ip: IpAddr, proxies: &[IpNet]) -> bool {
    proxies.iter().any(|net| net.contains(&ip))
}

/// Percorre a cadeia da direita para a esquerda e fica com o último endereço que
/// não é de um proxy confiável.
fn resolve(peer: IpAddr, parts: &Parts, proxies: &[IpNet]) -> IpAddr {
    if !is_trusted(peer, proxies) {
        return peer;
    }
    let chain: Vec<IpAddr> = parts
        .headers
        .get_all(X_FORWARDED_FOR)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        .filter_map(|item| item.trim().parse().ok())
        .collect();
    chain
        .iter()
        .rev()
        .find(|ip| !is_trusted(**ip, proxies))
        .or(chain.first())
        .copied()
        .unwrap_or(peer)
}
