//! Testes de integração do Acervo, contra PostgreSQL real em container
//! ([project/testing-02]), com relógio e ids fixos ([project/testing-07]).

mod articles;
mod books;
mod files;
mod highlights;
mod videos;

use std::sync::{Arc, Mutex};

use axum::body::{Body, Bytes};
use axum::http::{HeaderMap, Method, StatusCode, header};
use axum::{Extension, Router};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

use crate::http::test_support::{TestContext, TestSession, send};
use crate::library;
use crate::library::application::ports::{
    EntityDeletedHook, FetchedThumbnail, ThumbnailError, ThumbnailFetcher, ThumbnailFuture,
};

pub const ALICE: Uuid = Uuid::from_u128(0x0192_f0c8_0000_7000_8000_0000_0000_0001);
pub const BOB: Uuid = Uuid::from_u128(0x0192_f0c8_0000_7000_8000_0000_0000_0002);

/// PDF mínimo válido: o servidor confere só a assinatura `%PDF-`.
pub fn minimal_pdf() -> Vec<u8> {
    let mut pdf = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n".to_vec();
    pdf.extend_from_slice(
        b"2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
    );
    pdf
}

/// PNG de 1x1 pixel.
pub fn minimal_png() -> Vec<u8> {
    vec![
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44,
        0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1F,
        0x15, 0xC4, 0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0xF8,
        0xFF, 0xFF, 0x3F, 0x00, 0x05, 0xFE, 0x02, 0xFE, 0xA7, 0x35, 0x81, 0x84, 0x00, 0x00, 0x00,
        0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82,
    ]
}

/// JPEG mínimo: o servidor confere só a assinatura `FF D8 FF`.
pub fn minimal_jpeg() -> Vec<u8> {
    vec![
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, b'J', b'F', b'I', b'F', 0x00, 0xFF, 0xD9,
    ]
}

/// Resposta programada do `ThumbnailFetcher` falso.
#[derive(Clone)]
pub enum FakeResult {
    Thumbnail { title: Option<String> },
    NetworkError,
}

/// Busca de miniatura falsa: nenhum teste acessa a internet.
pub struct FakeFetcher {
    result: FakeResult,
    pub calls: Mutex<Vec<String>>,
}

impl FakeFetcher {
    pub fn new(result: FakeResult) -> Arc<Self> {
        Arc::new(Self {
            result,
            calls: Mutex::new(Vec::new()),
        })
    }

    pub fn call_count(&self) -> usize {
        self.calls.lock().unwrap().len()
    }
}

impl ThumbnailFetcher for FakeFetcher {
    fn fetch<'a>(&'a self, video_url: &'a reqwest::Url) -> ThumbnailFuture<'a> {
        self.calls.lock().unwrap().push(video_url.to_string());
        let result = self.result.clone();
        Box::pin(async move {
            match result {
                FakeResult::Thumbnail { title } => Ok(Some(FetchedThumbnail {
                    title,
                    bytes: Bytes::from(minimal_png()),
                })),
                FakeResult::NetworkError => Err(ThumbnailError::Network),
            }
        })
    }
}

pub type HookCalls = Arc<Mutex<Vec<(Uuid, &'static str, Uuid)>>>;

pub struct Harness {
    pub ctx: TestContext,
    pub app: Router,
    pub alice: TestSession,
    pub bob: TestSession,
    pub fetcher: Arc<FakeFetcher>,
    pub hook_calls: HookCalls,
}

impl Harness {
    pub async fn new() -> Self {
        Self::with_fetcher(FakeResult::Thumbnail {
            title: Some("Título do provedor".to_owned()),
        })
        .await
    }

    pub async fn with_fetcher(result: FakeResult) -> Self {
        let ctx = TestContext::new().await;
        library::migrator()
            .run(&ctx.state.pool)
            .await
            .expect("migrações do acervo");
        let fetcher = FakeFetcher::new(result);
        let hook_calls = HookCalls::default();
        let recorded = hook_calls.clone();
        let hook: EntityDeletedHook = Arc::new(move |owner, kind, id| {
            let recorded = recorded.clone();
            Box::pin(async move {
                recorded.lock().unwrap().push((owner, kind, id));
            })
        });
        let dyn_fetcher: Arc<dyn ThumbnailFetcher> = fetcher.clone();
        let api = library::router()
            .layer(Extension(dyn_fetcher))
            .layer(Extension(hook));
        let app = ctx.app(api);
        let alice = ctx.sign_in_as(ALICE).await;
        let bob = ctx.sign_in_as(BOB).await;
        Self {
            ctx,
            app,
            alice,
            bob,
            fetcher,
            hook_calls,
        }
    }

    pub async fn call(
        &self,
        session: &TestSession,
        method: Method,
        uri: &str,
        body: Option<Value>,
    ) -> (StatusCode, Value) {
        let request = match body {
            Some(body) => session.json(method, uri, &body),
            None => session
                .request(method, uri)
                .body(Body::empty())
                .expect("pedido"),
        };
        let (status, _, json) = send(&self.app, request).await;
        (status, json)
    }

    /// POST/PATCH/PUT/DELETE esperando um status; devolve o JSON.
    pub async fn expect(
        &self,
        session: &TestSession,
        method: Method,
        uri: &str,
        body: Option<Value>,
        expected: StatusCode,
    ) -> Value {
        let (status, json) = self.call(session, method, uri, body).await;
        assert_eq!(status, expected, "{uri}: {json}");
        json
    }

    pub async fn get(&self, session: &TestSession, uri: &str) -> Value {
        self.expect(session, Method::GET, uri, None, StatusCode::OK)
            .await
    }

    pub async fn create(&self, session: &TestSession, uri: &str, body: Value) -> Value {
        self.expect(session, Method::POST, uri, Some(body), StatusCode::CREATED)
            .await
    }

    /// Envio de arquivo com corpo cru (`PUT`).
    pub async fn upload(
        &self,
        session: &TestSession,
        uri: &str,
        bytes: Vec<u8>,
    ) -> (StatusCode, Value) {
        let request = session
            .request(Method::PUT, uri)
            .header(header::CONTENT_TYPE, "application/octet-stream")
            .body(Body::from(bytes))
            .expect("pedido");
        let (status, _, json) = send(&self.app, request).await;
        (status, json)
    }

    pub async fn upload_ok(&self, session: &TestSession, uri: &str, bytes: Vec<u8>) -> Value {
        let (status, json) = self.upload(session, uri, bytes).await;
        assert_eq!(status, StatusCode::OK, "{uri}: {json}");
        json
    }

    /// Baixa o arquivo: status, cabeçalhos e corpo.
    pub async fn download(
        &self,
        session: &TestSession,
        uri: &str,
    ) -> (StatusCode, HeaderMap, Vec<u8>) {
        let request = session
            .request(Method::GET, uri)
            .body(Body::empty())
            .expect("pedido");
        let response = self.app.clone().oneshot(request).await.expect("resposta");
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = response
            .into_body()
            .collect()
            .await
            .expect("corpo")
            .to_bytes();
        (status, headers, bytes.to_vec())
    }

    pub async fn create_book(&self, session: &TestSession, body: Value) -> String {
        let book = self.create(session, "/api/v1/books", body).await;
        book["id"].as_str().expect("id do livro").to_owned()
    }

    pub async fn create_article(&self, session: &TestSession, body: Value) -> String {
        let article = self.create(session, "/api/v1/articles", body).await;
        article["id"].as_str().expect("id do artigo").to_owned()
    }

    pub async fn create_video(&self, session: &TestSession, body: Value) -> Value {
        self.create(session, "/api/v1/videos", body).await
    }
}

pub fn ids(page: &Value) -> Vec<String> {
    page["items"]
        .as_array()
        .expect("items")
        .iter()
        .map(|item| item["id"].as_str().expect("id").to_owned())
        .collect()
}

pub fn book_body(title: &str, pages: i32) -> Value {
    json!({ "title": title, "page_count": pages })
}
