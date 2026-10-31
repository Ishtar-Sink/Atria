---
id: TASK-04
spec: SPEC-001
title: "Núcleo do servidor"
profile: julgamento
persona: desenvolvedor
depends_on: [TASK-02]
wave: 3
covers: [RF-21]
type: tarefa
labels: [SPEC-001, julgamento]
status: done
content_hash: 7dfa1e9bc9b2f343a32f87c9e1ac72c21d07f25100d4e3f31e0bdb7164199d19
adjustments: 0
adjusted_at: null
approved_at: 2026-10-30T14:38:10Z
approved_hash: e0d0ad10fdd08905a6dc3a1aba9b5285aa9b5e6b84ccf8da65348fa5a0fd81c3
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: opus
---

# TASK-04: Núcleo do servidor

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-21, RNF-01, RNF-02, RNF-03, RNF-07, contratos (variáveis `ATRIA_`, recursos da API, campos comuns, regra de recorrência), CB-02, CB-03, CB-04, riscos e decisões 13, 18, 50 e 53 a 56.
- `vostok/rules/project/security.md`: [project/security-01] a [project/security-04], [project/security-09] a [project/security-13] e [project/security-18].
- `vostok/rules/project/architecture.md`, `api.md`, `database.md`, `code-style.md`, `testing.md` ([project/testing-02], [project/testing-07], [project/testing-08]), `self-hosting.md` ([project/self-hosting-02] a [project/self-hosting-06]), `stack.md` ([project/stack-02] a [project/stack-04], [project/stack-11], [project/stack-12]) e `naming-convention.md` ([project/naming-convention-08], [project/naming-convention-11]).
- `Cargo.toml`: workspace da TASK-02 (membro `apps/server`, edição 2024, lints comuns).
- `vostok/work/tasks/SPEC-001/TASK-06.md`, `TASK-10.md`, `TASK-11.md`, `TASK-13.md` e `TASK-18.md`: o que os contextos e a integração esperam desta tarefa (nomes do `AppState`, API de sessão, auxiliar de testes, dependências).

### Mudar

- `apps/server/Cargo.toml` (criar): crate `atria-server` com `[lints] workspace = true` e todas as dependências do servidor, inclusive as que os contextos usam (nenhuma tarefa de contexto altera este arquivo).
- `apps/server/build.rs` (criar): detecta quais pastas de contexto já existem e liga a configuração `atria_context="<nome>"`, para que `main.rs` declare os doze módulos sem quebrar a compilação antes de eles existirem.
- `apps/server/src/main.rs` (criar): raiz do crate com `#![forbid(unsafe_code)]`, os `mod` de `http`, `shared`, `storage` e dos doze contextos, logs JSON, configuração e os subcomandos `serve` (padrão) e `migrate`.
- `apps/server/src/http` (criar): pasta do servidor HTTP, ponto de integração; os arquivos abaixo.
- `apps/server/src/http/mod.rs` (criar): declara os submódulos e reexporta `AppState`, `Config`, `build_router`, `CurrentUser`, `start_user_session` e `end_user_session`.
- `apps/server/src/http/config.rs` (criar): `Config::from_env()` com as variáveis `ATRIA_`, padrões seguros e segredos lidos de arquivo.
- `apps/server/src/http/state.rs` (criar): `AppState` (pool, configuração, relógio, gerador de ids, cifrador de campo, storage e cliente HTTP).
- `apps/server/src/http/router.rs` (criar): `build_router(state, api)`: `/api/v1`, `/healthz`, frontend estático e as camadas de sessão, CSRF, cabeçalhos, IP do cliente e log.
- `apps/server/src/http/session.rs` (criar): camada de sessão em PostgreSQL, extrator `CurrentUser` e a API `start_user_session` e `end_user_session`.
- `apps/server/src/http/csrf.rs` (criar): emissão do token e checagem de CSRF em toda mutação.
- `apps/server/src/http/security_headers.rs` (criar): CSP sem inline, `frame-ancestors 'none'`, `Referrer-Policy`, `nosniff` e HSTS com TLS.
- `apps/server/src/http/client_ip.rs` (criar): extrator `ClientIp`, que só aceita `X-Forwarded-For` de proxies confiáveis.
- `apps/server/src/http/healthz.rs` (criar): `/healthz` com a saúde do banco e a versão.
- `apps/server/src/http/static_files.rs` (criar): frontend compilado embutido no binário, com fallback para `index.html`.
- `apps/server/src/http/test_support.rs` (criar): auxiliar de testes (`#[cfg(test)]`) que monta o app com sessão e CSRF e cria sessões de usuários de teste.
- `apps/server/src/http/tests.rs` (criar): testes de integração do `http`.
- `apps/server/src/shared/mod.rs` (criar): declara os submódulos do núcleo comum.
- `apps/server/src/shared/error.rs` (criar): `ApiError` e `ProblemDetails` no formato `application/problem+json` (RFC 9457), com código estável.
- `apps/server/src/shared/ids.rs` (criar): `IdGenerator` com UUID v7 e gerador determinístico para testes.
- `apps/server/src/shared/clock.rs` (criar): `Clock` injetável, `SystemClock` e `FixedClock`.
- `apps/server/src/shared/money.rs` (criar): `Money` em centavos (`i64`) com `Currency`.
- `apps/server/src/shared/recurrence.rs` (criar): `RecurrenceRule` do contrato e o cálculo das ocorrências num intervalo, com fim de mês, 29/02 e horário de verão.
- `apps/server/src/shared/visibility.rs` (criar): `Visibility` (`personal` ou `shared`) para toda entidade (RF-21).
- `apps/server/src/shared/pagination.rs` (criar): `Cursor` opaco em base64url (chave de ordenação + id), `PageParams` e `Page<T>`.
- `apps/server/src/shared/crypto.rs` (criar): `FieldCipher` (XChaCha20-Poly1305) com a chave lida de `ATRIA_ENCRYPTION_KEY_FILE`.
- `apps/server/src/shared/db.rs` (criar): conexão, `begin_for_user` com `set_config('app.current_user_id', $1, true)` e as regras de migração.
- `apps/server/src/shared/test_support.rs` (criar): PostgreSQL em container compartilhado, com um banco novo por teste e o papel `atria_app` sem superusuário (`#[cfg(test)]`).
- `apps/server/src/storage` (criar): pasta do armazenamento de arquivos; os arquivos abaixo.
- `apps/server/src/storage/mod.rs` (criar): trait `FileStorage`, compatível com um storage S3, e `StoredFile`.
- `apps/server/src/storage/key.rs` (criar): `StorageKey` validada, sem `..` nem caminho absoluto.
- `apps/server/src/storage/local.rs` (criar): `LocalFileStorage` em `ATRIA_STORAGE_PATH`, com escrita atômica.

### Passos

1. Leia os arquivos de "Ler". Confira `cargo --version` (Rust estável com suporte à edição 2024) e `docker info` (os testes de integração sobem PostgreSQL em container). Rode o bloco de "Verificação" e confirme que ele falha.
2. Crie `apps/server/Cargo.toml` com `[package] name = "atria-server"`, `version = "0.1.0"`, `edition.workspace = true`, `license.workspace = true`, `publish.workspace = true`, `build = "build.rs"` e `[lints] workspace = true`. Confira a versão estável mais recente de cada crate com `cargo search <crate> --limit 1` e fixe a major/minor. Dependências e justificativa ([project/stack-12]):
   - Núcleo HTTP: `axum` 0.8 (feature `macros`), `tokio` (`rt-multi-thread`, `macros`, `signal`, `net`, `fs`, `time`), `tower`, `tower-http` (`trace`, `set-header`, `limit`, `request-id`, `util`), `tower-sessions` e `tower-sessions-sqlx-store` (`postgres`): [project/stack-03] e sessão em cookie ([project/security-02]).
   - Banco: `sqlx` (`runtime-tokio`, `postgres`, `uuid`, `chrono`, `json`, `macros`, `migrate`): [project/stack-04].
   - Serialização e erros: `serde` (`derive`), `serde_json`, `thiserror`: [project/code-style-03] e JSON em `snake_case`.
   - Domínio comum: `uuid` (`v7`, `serde`), `chrono` (`serde`), `chrono-tz`: ids públicos em UUID v7 ([project/api-05]) e recorrência com fuso ([project/code-style-06]).
   - OpenAPI: `utoipa` (`axum_extras`, `uuid`, `chrono`): [project/api-02].
   - Logs: `tracing`, `tracing-subscriber` (`json`, `env-filter`): [project/self-hosting-05].
   - Segurança: `chacha20poly1305` (cifra de campo, [project/security-18]), `base64` (chave e cursor), `subtle` (comparação do CSRF em tempo constante), `rand` (token do CSRF), `sha2` (SHA-256 dos arquivos), `ipnet` (`ATRIA_TRUSTED_PROXIES`), `cookie` (atributos do cookie do CSRF).
   - Frontend embutido: `rust-embed` (feature `mime-guess`): [project/self-hosting-02].
   - Para os contextos (declaradas aqui porque nenhum contexto altera este arquivo): `argon2` (senhas, [project/security-01]), `totp-rs` (2FA, [project/security-17]), `lettre` (`tokio1-rustls-tls`, `smtp-transport`, `builder`; SMTP opcional, RF-08), `web-push` com `default-features = false` e feature `hyper-client` (RF-42), `reqwest` (`rustls-tls`, `json`, sem as features padrão; cliente HTTP do oEmbed, CB-12), `typst` e `typst-pdf` (relatórios em PDF, RF-62), `maud` (relatórios em HTML, RF-61) e `zip` (exportação CSV, RF-63).
   - `[dev-dependencies]`: `testcontainers` e `testcontainers-modules` (feature `postgres`) ([project/testing-02]), `tempfile`, `http-body-util` e `tower` (feature `util`, para `ServiceExt::oneshot`).
3. Crie `apps/server/build.rs`: para cada nome em `["auth", "finance", "goals", "tasks", "reminders", "notes", "journal", "library", "projects", "links", "search", "reports"]`, imprima `cargo::rustc-check-cfg=cfg(atria_context, values(<os doze nomes entre aspas>))` uma vez, e `cargo::rustc-cfg=atria_context="<nome>"` quando `src/<nome>/mod.rs` existir; imprima `cargo::rerun-if-changed=src` e `cargo::rerun-if-changed=build.rs`. Sem `unwrap` (use `std::path::Path::exists`).
4. Crie `apps/server/src/main.rs` com `#![forbid(unsafe_code)]`, `#![cfg_attr(test, allow(clippy::unwrap_used, clippy::expect_used, clippy::panic))]`, `mod http; mod shared; mod storage;` e, para cada contexto, `#[cfg(atria_context = "<nome>")] #[allow(dead_code)] mod <nome>;`, nesta ordem: `auth`, `finance`, `goals`, `tasks`, `reminders`, `notes`, `journal`, `library`, `projects`, `links`, `search`, `reports`. Um comentário explica o porquê: cada contexto nasce numa tarefa própria e só é compilado quando a pasta existe; o `allow(dead_code)` sai quando a TASK-18 registrar os routers. O `main` (`#[tokio::main]`) inicia o `tracing_subscriber` em JSON com o filtro de `ATRIA_LOG_LEVEL` (padrão `info`), lê `Config::from_env()` (erro: loga só o nome da variável e sai com código 1), conecta com `shared::db::connect`, aplica as migrações (por enquanto só a do armazenamento de sessões, `PostgresStore::migrate`, num ponto único `run_migrations(&pool)` que a TASK-18 estende) e decide pelo primeiro argumento (`std::env::args().nth(1).as_deref()`): `Some("migrate")` aplica as migrações e sai com 0; `None` ou `Some("serve")` sobe o servidor em `ATRIA_BIND_ADDRESS` com `axum::serve(...).with_graceful_shutdown(...)` (SIGTERM e Ctrl+C) e `into_make_service_with_connect_info::<SocketAddr>()`; outro valor sai com código 2 e uma mensagem de uso. Monte o `AppState` e chame `http::build_router(state, axum::Router::new())`: a TASK-18 troca o router vazio pelo de todos os contextos.
5. Escreva primeiro os testes de `shared`, um módulo `#[cfg(test)] mod tests` em cada arquivo, com estes nomes, e confirme que falham:
   - `visibility.rs`: `serializes_as_personal_or_shared`, `rejects_unknown_visibility`, `defaults_to_personal`, `round_trips_through_postgres` (integração).
   - `ids.rs`: `uuid_v7_ids_are_time_ordered`, `sequential_ids_are_deterministic`.
   - `clock.rs`: `fixed_clock_returns_set_instant`, `fixed_clock_can_advance`.
   - `money.rs`: `rejects_lowercase_or_invalid_currency`, `adds_only_same_currency`, `overflow_is_an_error`, `serializes_amount_in_cents_and_currency`.
   - `recurrence.rs`: `monthly_day_31_falls_on_last_day_of_short_months` (CB-02), `yearly_feb_29_falls_on_feb_28_in_common_years` (CB-03), `time_in_dst_gap_fires_once_at_shifted_local_time` (CB-04, `America/New_York`, 2027-03-14 02:30 → 03:30 local), `time_in_dst_overlap_fires_once_at_first_instant`, `weekly_rule_uses_weekdays_and_interval`, `respects_starts_on_and_ends_on`, `rejects_invalid_timezone`, `occurrences_are_returned_in_utc`.
   - `pagination.rs`: `cursor_round_trips_as_base64url`, `rejects_tampered_cursor`, `limit_is_clamped_between_1_and_100`.
   - `crypto.rs`: `encrypt_decrypt_round_trip`, `ciphertext_does_not_contain_plaintext`, `tampered_ciphertext_is_rejected`, `wrong_associated_data_is_rejected`, `key_file_with_wrong_length_is_rejected`, `debug_does_not_print_key`.
   - `error.rs`: `problem_response_has_problem_json_content_type`, `problem_body_has_stable_code`.
   - `db.rs`: `begin_for_user_sets_current_user_id` e `rls_policy_hides_other_users_rows` (integração: cria uma tabela de teste com `ENABLE` e `FORCE ROW LEVEL SECURITY` e a política `owner_id = current_setting('app.current_user_id', true)::uuid`, consulta como `atria_app` e só vê as linhas do próprio usuário).
6. Implemente `shared`:
   - `test_support.rs` (`#[cfg(test)]`): um container `testcontainers_modules::postgres::Postgres` iniciado uma vez por processo (`tokio::sync::OnceCell`), que cria o papel `atria_app` `LOGIN NOSUPERUSER NOBYPASSRLS`; `pub async fn test_pool() -> PgPool` cria um banco novo `test_<uuid sem hífens>` com dono `atria_app` e devolve um pool conectado como `atria_app`; `pub async fn admin_pool()` para tarefas de preparação. Testes nunca dependem da data atual ([project/testing-07]).
   - `error.rs`: `#[derive(Serialize, ToSchema)] pub struct ProblemDetails { r#type: String, title: String, status: u16, code: String, detail: Option<String>, errors: Vec<FieldError> }` com `type` = `urn:atria:problem:<code>` (sem URL externa); `pub struct ApiError` com `status`, `code: &'static str`, `title` e `detail`, construtores `not_found(code)`, `unauthorized(code)`, `forbidden(code)`, `conflict(code)`, `unprocessable(code, errors)` e `internal()`, e `impl IntoResponse` com `Content-Type: application/problem+json`. O `internal()` nunca expõe a causa; ela vai só para o log, sem conteúdo pessoal ([project/security-13]). Erros de domínio dos contextos (com `thiserror`) são convertidos em `ApiError` só na camada `interface` ([project/code-style-03]).
   - `ids.rs`: `pub trait IdGenerator: Send + Sync { fn new_id(&self) -> Uuid; }`, `UuidV7Ids` (`Uuid::now_v7()`) e `SequentialIds` (v7 com timestamp fixo e contador, para testes).
   - `clock.rs`: `pub trait Clock: Send + Sync { fn now(&self) -> DateTime<Utc>; }`, `SystemClock` e `FixedClock` (com `set` e `advance`).
   - `money.rs`: `Currency` (3 letras maiúsculas ASCII, `BRL` como `Default`), `Money { amount_cents: i64, currency: Currency }` com `checked_add` e `checked_sub` que recusam moedas diferentes e estouro ([project/code-style-05]).
   - `recurrence.rs`: `RecurrenceRule` com os campos do contrato (`frequency`, `interval`, `weekdays`, `month_day`, `time`, `timezone`, `starts_on`, `ends_on`), `validate()` e `occurrences_between(from: DateTime<Utc>, to: DateTime<Utc>) -> Vec<DateTime<Utc>>`, com dia inexistente caindo no último dia do mês, 29/02 em ano comum caindo em 28/02, horário inexistente avançado pelo tamanho do salto e horário ambíguo no primeiro instante ([project/testing-08]).
   - `visibility.rs`: `#[derive(Serialize, Deserialize, sqlx::Type, ToSchema, Default)] #[serde(rename_all = "snake_case")] #[sqlx(type_name = "text", rename_all = "snake_case")] pub enum Visibility { #[default] Personal, Shared }` (RF-21; RN-17: a marcação não dá acesso a ninguém).
   - `pagination.rs`: `Cursor { sort_key: String, id: Uuid }` codificado em base64url sem padding com `serde_json`; `PageParams { cursor: Option<String>, limit: Option<u32> }` com `limit()` entre 1 e 100, padrão 50; `Page<T> { items: Vec<T>, next_cursor: Option<String> }` ([project/api-04]).
   - `crypto.rs`: `FieldCipher::from_key_file(path)` lê o arquivo, aceita exatamente 32 bytes em base64 (gerado com `openssl rand -base64 32`), e recusa outro tamanho; `encrypt(plaintext: &[u8], associated_data: &[u8]) -> Vec<u8>` grava `0x01` (versão) + nonce aleatório de 24 bytes + texto cifrado; `decrypt` confere a versão e o dado associado; `impl Debug` mostra só `FieldCipher(..)`. Os contextos usam `<tabela>.<coluna>:<id>` como dado associado.
   - `db.rs`: `connect(&Config) -> Result<PgPool, DbError>`; `begin_for_user(pool, user_id) -> Result<Transaction<'_, Postgres>, sqlx::Error>`, que abre a transação e executa `SELECT set_config('app.current_user_id', $1, true)` ([project/database-09]); doc comment com as regras de migração: cada contexto guarda as suas em `apps/server/src/<contexto>/migrations`, com o nome `20261101NN000X_<descricao>.sql` (NN = número da tarefa dona do contexto), e as queries usam as macros checadas do `sqlx` (`query!`, `query_as!`) contra `DATABASE_URL` de um PostgreSQL local com as migrações do contexto aplicadas (`sqlx migrate run --source src/<contexto>/migrations --ignore-missing`).
7. Escreva os testes de `storage` em `storage/mod.rs` (`#[cfg(test)] mod tests`, com `tempfile`): `put_get_delete_round_trip`, `put_returns_size_and_sha256`, `rejects_path_traversal_keys` (`../x`, `/etc/passwd`, `a//b`, vazio), `write_is_atomic_without_partial_file`, `get_missing_file_returns_not_found`. Confirme que falham e implemente: `StorageKey::new(&str)` (segmentos `[a-z0-9-]+` separados por `/`), `pub trait FileStorage: Send + Sync`, sem a macro `async_trait`, com `put(&self, key: &StorageKey, bytes: Bytes) -> Result<StoredFile, StorageError>`, `get`, `delete` e `exists`, com métodos que devolvem `Pin<Box<dyn Future<Output = ...> + Send + '_>>` para o trait ser usado como `Arc<dyn FileStorage>`; `StoredFile { size: u64, sha256: String }`; `LocalFileStorage::new(root)` grava num arquivo temporário na mesma pasta, faz `sync_all` e `rename` ([project/stack-11]).
8. Escreva os testes de `http` em `http/tests.rs` (declarado em `http/mod.rs` com `#[cfg(test)] mod tests;`), usando o auxiliar de testes do passo 9, e confirme que falham:
   - `healthz_returns_ok_with_database`, `healthz_returns_503_without_database`, `healthz_is_also_served_under_api_v1`.
   - `security_headers_are_present` (CSP com `default-src 'self'`, `script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: same-origin`), `hsts_only_with_https_public_url`.
   - `session_cookie_is_http_only_secure_same_site` (RNF-01: cookie `atria_session` com `HttpOnly`, `Secure`, `SameSite=Lax` e `Path=/`).
   - `start_user_session_rotates_session_id`, `end_user_session_invalidates_session`, `current_user_rejects_anonymous_with_401_problem` (código `unauthenticated`).
   - `get_issues_csrf_cookie` (cookie `atria_csrf`, sem `HttpOnly`, com `Secure` e `SameSite=Strict`), `mutation_without_csrf_token_is_rejected_with_403_problem` (código `csrf_invalid`), `mutation_with_valid_csrf_token_passes`, `mutation_with_foreign_origin_is_rejected`.
   - `forwarded_for_is_ignored_from_untrusted_peer`, `forwarded_for_is_used_from_trusted_proxy`.
   - `config_requires_public_url_and_key_file`, `config_debug_redacts_secrets`.
   - `test_support_sign_in_as_creates_authenticated_session`.
9. Implemente `http/test_support.rs` (`#[cfg(test)] pub mod test_support;` em `http/mod.rs`): `pub struct TestContext { pub state: AppState, pub clock: Arc<FixedClock> }`; `TestContext::new().await` usa `shared::test_support::test_pool()`, aplica a migração do armazenamento de sessões, cria o storage numa `tempfile::TempDir` guardada no contexto, usa `FixedClock` em `2026-11-01T12:00:00Z`, `SequentialIds`, um `FieldCipher` com chave fixa de teste e um `Config` de teste com `public_url = https://atria.test`; `ctx.app(api: Router<AppState>) -> Router` monta `build_router(state, api)` com uma rota extra só de teste, `POST /__test/sessions/{user_id}`, que chama `start_user_session`; `ctx.sign_in_as(user_id: Uuid) -> TestSession` (o usuário não precisa existir em tabela) e `ctx.anonymous() -> TestSession` (só com o token CSRF); `TestSession { cookie: String, csrf_token: String }` com `request(method, uri) -> http::request::Builder`, que acrescenta `Cookie`, `X-CSRF-Token` e `Origin: https://atria.test`, e `json(method, uri, body)`; `send(app, request) -> (StatusCode, HeaderMap, serde_json::Value)` com `tower::ServiceExt::oneshot`. Todos os contextos usam este auxiliar; não crie outro.
10. Implemente o restante de `http`:
    - `config.rs`: `pub struct Config` com `database_url`, `bind_address` (padrão `0.0.0.0:8080`), `public_url` (obrigatória; `Secure` e HSTS dependem de ela ser `https`), `encryption_key_file` (obrigatória), `storage_path` (padrão `/data/files`), `trusted_proxies: Vec<IpNet>` (padrão vazio), `log_level` (padrão `info`), `smtp: Option<SmtpConfig>` (só com `ATRIA_SMTP_HOST`; porta padrão 587; senha lida de `ATRIA_SMTP_PASSWORD_FILE`) e `web_push_vapid_key_file: Option<PathBuf>`; `Config::from_env()` e `Config::from_vars(impl Fn(&str) -> Option<String>)` (para teste); `impl Debug` sem a URL do banco com senha nem segredos ([project/security-12]).
    - `state.rs`: `#[derive(Clone)] pub struct AppState { pub pool: PgPool, pub config: Arc<Config>, pub clock: Arc<dyn Clock>, pub ids: Arc<dyn IdGenerator>, pub cipher: Arc<FieldCipher>, pub storage: Arc<dyn FileStorage>, pub http_client: reqwest::Client }` e `impl FromRef<AppState>` para `PgPool`. O `http_client` tem tempo limite de 10 s e `User-Agent` `atria/<versão>`.
    - `session.rs`: `session_layer(pool, &Config)` com `tower_sessions_sqlx_store::PostgresStore`, cookie `atria_session`, `HttpOnly`, `Secure` quando `public_url` é `https`, `SameSite::Lax` e expiração por inatividade de 30 dias; `pub async fn start_user_session(session: &Session, user_id: Uuid) -> Result<(), ApiError>` (troca o id da sessão com `cycle_id`, grava `user_id` e um token CSRF novo); `pub async fn end_user_session(session: &Session) -> Result<(), ApiError>` (`flush`); `pub struct CurrentUser { pub user_id: Uuid }` com `FromRequestParts`, que responde 401 `unauthenticated` sem sessão de usuário.
    - `csrf.rs`: middleware que, em todo `GET`/`HEAD` sem token na sessão, cria um token aleatório de 32 bytes em base64url, guarda na sessão e devolve no cookie `atria_csrf` (`Secure`, `SameSite=Strict`, `Path=/`, sem `HttpOnly`, para o frontend ler); em `POST`, `PUT`, `PATCH` e `DELETE`, exige o cabeçalho `X-CSRF-Token` igual ao da sessão (comparação com `subtle`) e, quando houver `Origin`, que ele seja a origem de `public_url`; falha responde 403 `csrf_invalid` ([project/security-03]).
    - `security_headers.rs`: `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin` e `Strict-Transport-Security: max-age=31536000; includeSubDomains` só com `public_url` `https` ([project/security-11]). Uma rota pode sobrescrever a CSP (relatórios da TASK-17) com o cabeçalho já presente na resposta.
    - `client_ip.rs`: `ClientIp(IpAddr)` a partir de `ConnectInfo<SocketAddr>`; só quando o par está em `trusted_proxies`, usa o último endereço não confiável de `X-Forwarded-For` ([project/self-hosting-04]). O `auth` usa para limitar tentativas.
    - `healthz.rs`: `GET` responde `200 {"status":"ok","version":"<CARGO_PKG_VERSION>","database":"ok"}` com `SELECT 1` em até 2 s, ou `503` com `"database":"unavailable"`.
    - `static_files.rs`: `#[derive(rust_embed::Embed)] #[folder = "../web/dist"] #[allow_missing = true] struct WebAssets;` servindo o arquivo pedido com o `Content-Type` certo e `Cache-Control: public, max-age=31536000, immutable` em `/assets/*`, e `index.html` (`no-cache`) para rotas sem extensão fora de `/api`; sem build do frontend, responde 404.
    - `router.rs`: `pub fn build_router(state: AppState, api: Router<AppState>) -> Router` com `nest("/api/v1", api.route("/healthz", get(healthz)))`, `route("/healthz", get(healthz))`, o fallback do frontend e as camadas, de fora para dentro: `TraceLayer` com span só com método, `MatchedPath` e status (nunca a URI com query nem corpo, [project/security-13]), `SetRequestId`, cabeçalhos de segurança, `RequestBodyLimitLayer` de 1 MiB (as rotas de envio dos contextos ampliam com `DefaultBodyLimit`), sessão e CSRF.
11. Rode `cargo test -p atria-server shared::`, `cargo test -p atria-server storage::` e `cargo test -p atria-server http::` até passarem, depois `cargo fmt --all` e `cargo clippy -p atria-server --all-targets -- -D warnings` até zero avisos.
12. Rode o bloco de "Verificação" até terminar sem erro.

### Baseline

- `test -e apps/server/Cargo.toml && echo "apps/server/Cargo.toml existe" || echo "apps/server/Cargo.toml ausente"`
- `ls apps/server/src 2>/dev/null || echo "apps/server/src ausente"`

### Verificação

```bash
cargo fmt --all --check
cargo clippy -p atria-server --all-targets -- -D warnings
cargo test -p atria-server shared::
cargo test -p atria-server storage::
cargo test -p atria-server http::

# Raiz do crate: unsafe proibido e os doze contextos declarados.
grep -q '#!\[forbid(unsafe_code)\]' apps/server/src/main.rs
for c in auth finance goals tasks reminders notes journal library projects links search reports; do
  grep -q "#\[cfg(atria_context = \"$c\")\]" apps/server/src/main.rs || { echo "FALHA: contexto não declarado: $c"; exit 1; }
done

# Dependências que os contextos esperam encontrar.
for d in axum sqlx tower-sessions sha2 base64 utoipa thiserror chrono-tz argon2 totp-rs lettre web-push reqwest typst typst-pdf maud zip chacha20poly1305 rust-embed testcontainers testcontainers-modules; do
  grep -qE "^$d *=" apps/server/Cargo.toml || { echo "FALHA: dependência ausente: $d"; exit 1; }
done

# Sem unwrap, expect ou panic fora de testes (o clippy já nega; aqui só as macros).
if grep -rnE "panic!\(|todo!\(|unimplemented!\(" apps/server/src --include='*.rs' | grep -vE "/tests?\.rs:|test_support\.rs:"; then
  echo "FALHA: panic fora de teste"; exit 1
fi
echo "verificação da TASK-04 ok"
```

Resultado esperado: código 0, `test result: ok` nos três filtros e a última linha `verificação da TASK-04 ok`.

### Evidências

- `http-tests.txt` (automática): `cargo test -p atria-server http:: 2>&1 | grep -E "^test |test result"`
  - Prova: sessão em cookie seguro, CSRF em toda mutação, cabeçalhos de segurança, IP do cliente só de proxy confiável, `/healthz` e o auxiliar de testes funcionam (RNF-01).
  - Trecho: `test http::tests::session_cookie_is_http_only_secure_same_site ... ok`, `test http::tests::mutation_without_csrf_token_is_rejected_with_403_problem ... ok`, `test http::tests::security_headers_are_present ... ok`, `test http::tests::healthz_returns_ok_with_database ... ok`, `test http::tests::test_support_sign_in_as_creates_authenticated_session ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED`, `error: package ID specification` ou nenhuma linha `test http::`.
- `shared-tests.txt` (automática): `cargo test -p atria-server shared:: 2>&1 | grep -E "^test |test result"`
  - Prova: visibilidade pessoal ou compartilhada, recorrência nos casos de borda, cifra de campo, cursor, dinheiro, erro `problem+json` e RLS (RF-21, RNF-02, RNF-03).
  - Trecho: `test shared::visibility::tests::serializes_as_personal_or_shared ... ok`, `test shared::recurrence::tests::monthly_day_31_falls_on_last_day_of_short_months ... ok`, `test shared::recurrence::tests::time_in_dst_gap_fires_once_at_shifted_local_time ... ok`, `test shared::crypto::tests::ciphertext_does_not_contain_plaintext ... ok`, `test shared::db::tests::rls_policy_hides_other_users_rows ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED` ou nenhuma linha `test shared::`.
- `storage-tests.txt` (automática): `cargo test -p atria-server storage:: 2>&1 | grep -E "^test |test result"`
  - Prova: o armazenamento local grava, lê e remove arquivos com escrita atômica e recusa chaves perigosas ([project/stack-11], [project/security-10]).
  - Trecho: `test storage::tests::rejects_path_traversal_keys ... ok`, `test storage::tests::write_is_atomic_without_partial_file ... ok` e `test result: ok`.
  - Falha: `FAILED` ou nenhuma linha `test storage::`.

### Concluída quando

- [x] Toda entidade pode usar a marcação de visibilidade pessoal ou compartilhada, gravada e lida do banco como `personal` ou `shared` (RF-21).

  > Como comprovar: em `shared-tests.txt`, ver `serializes_as_personal_or_shared`, `rejects_unknown_visibility` e `round_trips_through_postgres` como `ok`.

- [x] A sessão fica num cookie `HttpOnly`, `Secure` e `SameSite`, toda mutação sem token CSRF válido ou de outra origem é recusada e as respostas trazem CSP sem inline, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy` e HSTS com TLS (RNF-01).

  > Como comprovar: em `http-tests.txt`, ver `ok` em `session_cookie_is_http_only_secure_same_site`, `mutation_without_csrf_token_is_rejected_with_403_problem`, `mutation_with_foreign_origin_is_rejected`, `security_headers_are_present` e `hsts_only_with_https_public_url`.

- [x] Os contextos têm a API de sessão (criar e encerrar a sessão de um usuário e ler o usuário atual) e o auxiliar de testes que monta o app com sessão e CSRF e cria sessões de usuários de teste.

  > Como comprovar: em `http-tests.txt`, ver `start_user_session_rotates_session_id`, `end_user_session_invalidates_session`, `current_user_rejects_anonymous_with_401_problem` e `test_support_sign_in_as_creates_authenticated_session` como `ok`.

- [x] O isolamento entre usuários tem a segunda camada no banco: a transação de cada pedido identifica o usuário e a política de Row Level Security esconde as linhas dos outros (RNF-02).

  > Como comprovar: em `shared-tests.txt`, ver `begin_for_user_sets_current_user_id` e `rls_policy_hides_other_users_rows` como `ok`.

- [x] O conteúdo cifrado não guarda o texto em claro, recusa adulteração e usa a chave lida de `ATRIA_ENCRYPTION_KEY_FILE`, fora do banco e fora dos logs (RNF-03).

  > Como comprovar: em `shared-tests.txt`, ver `ok` em `ciphertext_does_not_contain_plaintext`, `tampered_ciphertext_is_rejected`, `key_file_with_wrong_length_is_rejected` e `debug_does_not_print_key`.

- [x] A recorrência calcula as ocorrências no último dia em meses curtos, em 28/02 em anos comuns e uma única vez na mudança de horário de verão.

  > Como comprovar: em `shared-tests.txt`, ver `ok` nos oito testes `shared::recurrence::tests::`.

- [x] `main.rs` proíbe `unsafe`, declara os doze contextos e o `Cargo.toml` tem todas as dependências que os contextos usam; o crate passa limpo em `cargo fmt` e `cargo clippy -D warnings`.

  > Como comprovar: rodar a "Verificação" e ver `verificação da TASK-04 ok` no fim.

- [x] O servidor sobe só com variáveis `ATRIA_`, responde `/healthz` com a saúde do banco e serve o frontend compilado no mesmo processo, sem serviço externo (RNF-07).

  > Como comprovar: em `http-tests.txt`, ver `healthz_returns_ok_with_database`, `healthz_returns_503_without_database` e `config_requires_public_url_and_key_file` como `ok`.

## Descrição

### Resumo executivo

Cria o coração do servidor do Atria: a porta de entrada das requisições, a sessão de login, as proteções contra ataques comuns, a criptografia do diário e das notas e o armazenamento de arquivos.
É a base de segurança e privacidade sobre a qual todos os módulos são construídos, sem reescrever essas proteções em cada um.
Perfil de execução julgamento: decisões de desenho com impacto em todos os módulos e risco alto se algo ficar frágil.
Risco alto: um erro aqui expõe dados pessoais em todo o produto; por isso cada proteção tem teste automático.
Desbloqueia os doze módulos do servidor (TASK-06 a TASK-15, depois TASK-16 e TASK-17) e a autohospedagem (TASK-36).

### Detalhes técnicos

**Abordagem.** Um crate só, `atria-server`, com o núcleo em três módulos: `http` (servidor, sessão, CSRF, cabeçalhos, IP do cliente, `/healthz`, frontend embutido, `AppState`, configuração e auxiliar de testes), `shared` (erro `problem+json`, ids, relógio, dinheiro, recorrência, visibilidade, cursor, cifra de campo, banco e PostgreSQL de teste) e `storage`. Cada contexto expõe `router()`, `migrator()` e a descrição OpenAPI no próprio `mod.rs` e nunca altera `main.rs` nem `http`; a TASK-18 registra todos.

**Componentes.** `apps/server/Cargo.toml`, `apps/server/src/main.rs`, `apps/server/src/http`, `apps/server/src/shared`, `apps/server/src/storage`, e `apps/server/build.rs` como suporte da compilação dos contextos.

**Decisões e critérios.** Critérios usados em todas: segurança por padrão, manutenção ativa e compatibilidade com `axum` 0.8, nenhuma infraestrutura além do PostgreSQL ([project/architecture-12], [project/architecture-13]) e testabilidade sem mock de banco.

| Tema | Escolha | Alternativas descartadas | Motivo |
|---|---|---|---|
| Sessão | `tower-sessions` com `tower-sessions-sqlx-store` no PostgreSQL | `axum-login` (acopla o modelo de usuário, que é do contexto `auth`); sessão própria numa tabela do `auth` (reescreve rotação de id, expiração e cookie); JWT em cookie (sem revogação no sair nem na desativação) | Sessão revogável, id trocado no login, sem Redis e com o cookie sob controle ([project/security-02]). |
| CSRF | Token sincronizado guardado na sessão e espelhado no cookie `atria_csrf`, enviado em `X-CSRF-Token`, mais a checagem de `Origin` | Só `SameSite` (não cobre subdomínios do mesmo site nem navegadores antigos); `axum_csrf` (manutenção irregular e cookie próprio fora da sessão); token por formulário (o frontend é SPA) | Defesa em duas camadas, simples para o cliente da TASK-05 ler e reenviar ([project/security-03]). |
| Cifra de campo | XChaCha20-Poly1305 (`chacha20poly1305`) com nonce aleatório de 24 bytes, byte de versão e dado associado `<tabela>.<coluna>:<id>` | AES-256-GCM (nonce de 12 bytes, risco de repetição com chave única de longa duração); `pgcrypto` (a chave passaria pelo banco e pelos logs de query); envelope com KMS (serviço externo) | Chave só no arquivo `ATRIA_ENCRYPTION_KEY_FILE`, fora do banco; o dado associado impede trocar o conteúdo de uma linha pelo de outra ([project/security-18], RNF-03). O byte de versão permite trocar a chave no futuro. |
| Módulos dos contextos | `mod` dos doze contextos em `main.rs`, cada um com `#[cfg(atria_context = "...")]` ligado pelo `build.rs` quando a pasta existe | `mod` sem condição (não compila até os doze existirem, e as doze tarefas da onda 4 rodam em paralelo); cada contexto alterar `main.rs` (conflito entre tarefas paralelas no ponto de integração) | Cada contexto compila e testa assim que é criado, sem tocar no ponto de integração. |
| Frontend no servidor | `rust-embed` de `apps/web/dist` com `allow_missing` | `ServeDir` numa pasta (exigiria uma variável `ATRIA_` fora do contrato da spec); só o servidor do Vite (não serve em produção) | Um único binário e um único processo além do banco ([project/self-hosting-02]). |
| `/healthz` | Na raiz e em `/api/v1/healthz` | Só num dos dois | A regra pede `/healthz` e o contrato o lista entre os recursos de `/api/v1`. |
| Subcomandos | `std::env::args` com `serve` e `migrate` | `clap` (dependência para dois subcomandos) | A TASK-18 acrescenta `openapi` no mesmo mecanismo. |
| Recorrência | Em `shared`, usada por finance, tasks e reminders | Uma por contexto (três cálculos com os mesmos casos de borda) | Um só lugar testado para CB-02, CB-03 e CB-04 ([project/testing-08]); contextos não se leem, mas compartilham o núcleo. |

**Convenções comuns aplicadas.** Migrações em `apps/server/src/<contexto>/migrations` com o nome `20261101NN000X_<descricao>.sql` (NN = número da tarefa dona), para as versões não colidirem entre os migrators; RLS com `set_config('app.current_user_id', $1, true)` em cada transação e a política `owner_id = current_setting('app.current_user_id', true)::uuid`, com `FORCE ROW LEVEL SECURITY` porque o dono da tabela ignora a política sem ele; cursor opaco em base64url (chave de ordenação + id); rotas dos contextos relativas, montadas sob `/api/v1` pelo `build_router`.

**Riscos técnicos.** As macros checadas do `sqlx` precisam de um banco com o esquema na compilação: a TASK-04 não tem query de tabela e documenta o modo em `shared/db.rs`; a geração dos dados offline (`.sqlx`) para a CI fica com a integração (TASK-18), quando todas as migrações existem. O container de teste usa o papel `atria_app` sem superusuário: com o superusuário, a RLS seria ignorada e os testes de isolamento passariam sem provar nada. A CSP sem inline exige que o build do Vite não injete script inline (cuidado da TASK-05). O `tower-sessions-sqlx-store` cria a própria tabela no esquema `tower_sessions`, fora das migrações dos contextos.

**Referências da spec.** RF-21, RNF-01, RNF-02, RNF-03, RNF-07; contratos de variáveis `ATRIA_`, campos comuns e regra de recorrência; CB-02, CB-03, CB-04; RN-17; riscos de recorrência e de perda da chave; decisões 13, 18, 26, 50 e 53 a 56.

**Arquivos em comum na onda 3.** Nenhum: a TASK-03, da mesma onda, só mexe em `packages/theme` e `packages/ui`. `apps/server/src/main.rs` e `apps/server/src/http` voltam a ser alterados só pela TASK-18, na onda 6.

### Card

- **Título:** Núcleo do servidor
- **Tipo:** tarefa
- **Descrição:** Núcleo do servidor em Rust: HTTP com sessão segura, CSRF e cabeçalhos de segurança, `/healthz`, configuração `ATRIA_`, núcleo comum (erros, ids, relógio, dinheiro, recorrência, visibilidade, cursor e criptografia de campo), armazenamento de arquivos e auxiliar de testes para os contextos.
- **Critérios de aceite:**
  - [ ] Sessão em cookie seguro, CSRF em toda mutação e cabeçalhos de segurança testados.
  - [ ] Visibilidade pessoal ou compartilhada disponível para toda entidade.
  - [ ] Diário e notas prontos para cifra com chave fora do banco.
  - [ ] Recorrência correta em fim de mês, 29/02 e horário de verão.
  - [ ] Contextos declarados e auxiliar de testes pronto para os doze módulos.
- **Rótulos:** SPEC-001, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-02

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: opus |
| 2 | 2026-10-30 | baseline | coletado | 2 comando(s); códigos de saída: 0, 0; 3 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-10-30 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 5 | 2026-10-30 | retomada | validating | decisão do usuário: Usuário aceitou [1] e [2]: as pastas criadas são a entrega da tarefa; aceito(s): 1, 2 |
| 6 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 7 | 2026-10-30 | regressão | passed | 0 igual(is) ao baseline, 2 aceito(s) pelo usuário |
| 8 | 2026-10-30 | evidências | passed | 3 evidência(s) em evidence/TASK-04/ |
| 9 | 2026-10-30 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
