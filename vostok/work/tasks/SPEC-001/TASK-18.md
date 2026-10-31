---
id: TASK-18
spec: SPEC-001
title: "Integração do servidor"
profile: julgamento
persona: desenvolvedor
depends_on: [TASK-06, TASK-15, TASK-16, TASK-17]
wave: 6
covers: []
type: tarefa
labels: [SPEC-001, julgamento]
status: in_progress
content_hash: 438e8ab2da13b4d4103f685b0e707c45886337dd93306227346ba174f5fcd08a
adjustments: 1
adjusted_at: 2026-10-31T00:28:19Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: 438e8ab2da13b4d4103f685b0e707c45886337dd93306227346ba174f5fcd08a
attempts: 0
tests_result: null
regression_result: null
evidence_result: null
updated_at: 2026-10-31T00:28:19Z
model: opus
---

# TASK-18: Integração do servidor

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: lista de recursos sob `/api/v1`, RNF-02, RN-13, RN-17, CT-15 e decisões 54, 55 e 56.
- `vostok/rules/project/api.md`, `vostok/rules/project/architecture.md`, `vostok/rules/project/database.md`, `vostok/rules/project/security.md`, `vostok/rules/project/self-hosting.md`, `vostok/rules/project/stack.md` ([project/stack-04]), `vostok/rules/project/testing.md` e `vostok/rules/project/development-methodology.md`.
- `vostok/work/tasks/SPEC-001/TASK-06.md` a `vostok/work/tasks/SPEC-001/TASK-17.md`: "Detalhes técnicos" e "Histórico de ajustes" de cada contexto, com os desvios já aceitos (queries checadas em execução pela decisão 1A, caminhos `#[utoipa::path]` com `/api/v1`, `allow(unused_imports)` nos reexports, gancho de exclusão e política de Web Push).
- `apps/server/src/main.rs`: os `mod` dos contextos com `#[cfg(atria_context = ...)]`, `#[allow(dead_code)]` e `#[rustfmt::skip]` (KNW-004), a leitura de `Config::from_env()` antes do subcomando, `run_migrations` (hoje só o store de sessões) e `serve`.
- `apps/server/build.rs`: a condição `atria_context`, que continua como está.
- `apps/server/src/http/router.rs`: `build_router`/`build_router_with`, que já fazem `nest("/api/v1", api)` com `/api/v1/healthz`, as camadas de sessão, CSRF e cabeçalhos, e o `fallback(static_files)`.
- `apps/server/src/http/static_files.rs`: o `route_not_found` (404) para caminhos `api/...`.
- `apps/server/src/http/mod.rs`, `apps/server/src/http/state.rs` e `apps/server/src/http/csrf.rs`: módulos declarados, `AppState` e o nome do cabeçalho e do cookie de CSRF.
- `apps/server/src/http/tests.rs`: testes da TASK-04, raiz do módulo `http::tests`; não existe `http/tests/mod.rs`.
- `apps/server/src/http/test_support.rs`: `TestContext` (banco por `test_pool()`, `app(api)`, `anonymous()`, `sign_in_as()`, `send`).
- `apps/server/src/shared/test_support.rs`: container `atria-server-tests-postgres` reaproveitado e `test_pool()`, que cria `test_<uuid v7>` e nunca o apaga.
- `apps/server/src/shared/db.rs` e `apps/server/src/shared/visibility.rs`: os outros chamadores de `test_pool()` e o `set_config('app.current_user_id', ...)` de produção.
- `apps/server/src/auth/mod.rs`, `apps/server/src/finance/mod.rs`, `apps/server/src/goals/mod.rs`, `apps/server/src/tasks/mod.rs`, `apps/server/src/reminders/mod.rs`, `apps/server/src/notes/mod.rs`, `apps/server/src/journal/mod.rs`, `apps/server/src/library/mod.rs`, `apps/server/src/projects/mod.rs`, `apps/server/src/links/mod.rs`, `apps/server/src/search/mod.rs` e `apps/server/src/reports/mod.rs`: `router()`, `migrator()` e a descrição OpenAPI de cada um (`AuthApi`, `FinanceApi`, `GoalsApi`, `TasksApi`, `RemindersApi` e `ReportsApiDoc` como struct `utoipa::OpenApi`; `openapi()` em notes, journal, library, projects, links e search).
- `apps/server/src/<contexto>/interface/openapi.rs` dos doze contextos: os testes `documents_all_*_routes` e o prefixo dos `#[utoipa::path]` (`/api/v1/...` em auth, finance, goals, tasks, notes, journal, library, projects e links; relativo em reminders).
- `apps/server/src/auth/interface/mod.rs`: `require_complete_account()` e as rotas isentas (`/setup`, `/me`, `/auth/*`).
- `apps/server/src/auth/application/admin.rs` e `apps/server/src/auth/infrastructure/pg_settings.rs`: `instance_settings` exige ator admin; `get_instance` lê `web_push_enabled`.
- `apps/server/src/reminders/application/ports.rs`: `WebPushPolicy::is_enabled(&self) -> BoxFuture<'_, bool>` e o alias `EntityDeletedHook`.
- `apps/server/src/links/application/deletion_hook.rs`: `entity_deleted_hook(pool) -> EntityDeletedHook`; o alias tem a mesma grafia em todos os contextos.
- `apps/server/src/library/interface/mod.rs` e `apps/server/src/library/application/ports.rs`: `Option<Extension<Arc<dyn ThumbnailFetcher>>>`, com o oEmbed real como padrão.
- `apps/server/src/<contexto>/infrastructure` dos doze contextos e `apps/server/src/http/healthz.rs`: as queries `sqlx::query`/`query_as`/`query_scalar` com `.bind`, o SQL montado com `format!` de constantes em `goals/infrastructure/pg_goals.rs` e o `QueryBuilder` em `finance/infrastructure/pg_transactions.rs` e `tasks/infrastructure/pg_tasks.rs`.
- `apps/server/src/<contexto>/migrations` dos doze contextos: versões (`20261101NN000X_`) e as políticas de Row Level Security.
- `package.json` e `pnpm-workspace.yaml`: scripts da raiz e o workspace `packages/*` (TASK-02).
- `apps/web/src/shared/api/client.ts`: o cliente da TASK-05 usa `base_url` `/api/v1` e caminhos relativos, sem importar `@atria/contracts` hoje.

### Mudar

- `apps/server/src/main.rs` (alterar): troca os doze `mod` condicionais por `mod <contexto>;` sem `cfg`, `allow(dead_code)` nem `rustfmt::skip`, roda as migrações pelo registro, inicia `reminders::run_dispatcher` e ganha o subcomando `openapi`, tratado antes da leitura da configuração.
- `apps/server/src/http/mod.rs` (alterar): declara `pub mod contexts;` e `pub mod openapi;`.
- `apps/server/src/http/router.rs` (alterar): acrescenta o `method_not_allowed_fallback` com o problema `method_not_allowed` (405).
- `apps/server/src/http/contexts.rs` (criar): registro dos doze contextos: `migrators()`, `run_migrations()`, `api_router(&AppState)` com as camadas e extensões globais e `web_push_policy()`.
- `apps/server/src/http/openapi.rs` (criar): `ApiDoc`, a junção das doze descrições com o prefixo `/api/v1` normalizado, e `openapi_json()`.
- `apps/server/src/http/tests.rs` (alterar): declara os submódulos `support`, `migrations`, `routes`, `api_doc` e `isolation`, cujos arquivos ficam em `http/tests/`.
- `apps/server/src/http/tests/support.rs` (criar): ambiente de teste com o servidor completo, usuários reais (admin com TOTP, `alice` e `bob`), cliente com cookie e CSRF e `ThumbnailFetcher` falso.
- `apps/server/src/http/tests/migrations.rs` (criar): versões únicas, aplicação idempotente e Row Level Security ativa.
- `apps/server/src/http/tests/routes.rs` (criar): `/healthz`, todas as rotas do OpenAPI, 404 e 405, conta incompleta barrada e política de Web Push.
- `apps/server/src/http/tests/api_doc.rs` (criar): o OpenAPI juntado traz as rotas de todos os `documents_all_*_routes`, todas sob `/api/v1`, sem prefixo duplicado nem operação repetida.
- `apps/server/src/http/tests/isolation.rs` (criar): isolamento entre usuários em todos os recursos com id (RNF-02).
- `apps/server/src/http/test_support.rs` (alterar): `TestContext` guarda o banco de teste, que é apagado quando o contexto sai de escopo.
- `apps/server/src/http/healthz.rs` (alterar): `SELECT 1` pela macro checada.
- `apps/server/src/shared/test_support.rs` (alterar): `test_pool()` devolve `TestDatabase`, que apaga o banco no `Drop`; varredura dos bancos de teste antigos na subida do container; `/dev/shm` de 512 MiB; testes da limpeza.
- `apps/server/src/shared/db.rs` (alterar): `set_config` pela macro checada e os testes usam `TestDatabase::pool()`.
- `apps/server/src/shared/visibility.rs` (alterar): os testes usam `TestDatabase::pool()`.
- `apps/server/src/auth` (alterar): `web_push_enabled(&PgPool)` em `application/admin.rs`, reexportado em `mod.rs`; queries pelas macros checadas; formatação pelo `cargo fmt`.
- `apps/server/src/finance` (alterar): queries pelas macros checadas, inclusive o `QueryBuilder` de `infrastructure/pg_transactions.rs`; formatação pelo `cargo fmt`.
- `apps/server/src/goals` (alterar): queries pelas macros checadas, sem o SQL montado com `format!` em `infrastructure/pg_goals.rs`; formatação pelo `cargo fmt`.
- `apps/server/src/tasks` (alterar): queries pelas macros checadas, inclusive o `QueryBuilder` de `infrastructure/pg_tasks.rs`; formatação pelo `cargo fmt`.
- `apps/server/src/reminders` (alterar): queries pelas macros checadas; formatação pelo `cargo fmt`.
- `apps/server/src/notes` (alterar): queries pelas macros checadas; formatação pelo `cargo fmt`.
- `apps/server/src/journal` (alterar): queries pelas macros checadas; formatação pelo `cargo fmt`.
- `apps/server/src/library` (alterar): queries pelas macros checadas; formatação pelo `cargo fmt`.
- `apps/server/src/projects` (alterar): queries pelas macros checadas; formatação pelo `cargo fmt`.
- `apps/server/src/links` (alterar): queries pelas macros checadas; formatação pelo `cargo fmt`.
- `apps/server/src/search/infrastructure/mod.rs` (alterar): queries pelas macros checadas, se houver (os adaptadores chamam os serviços dos outros contextos); os demais arquivos de `apps/server/src/search` só mudam pela formatação do `cargo fmt`.
- `apps/server/src/reports/infrastructure/mod.rs` (alterar): queries pelas macros checadas, se houver (os adaptadores chamam os serviços dos outros contextos); os demais arquivos de `apps/server/src/reports` só mudam pela formatação do `cargo fmt`.
- `.sqlx` (criar): dados offline do `sqlx` gerados por `cargo sqlx prepare --workspace`, para a CI e o build Docker compilarem com `SQLX_OFFLINE=true`.
- `packages/contracts/package.json` (criar): pacote `@atria/contracts` com os scripts `generate`, `check` e `typecheck`.
- `packages/contracts/tsconfig.json` (criar): TypeScript `strict` só para checar os tipos.
- `packages/contracts/openapi.json` (criar): OpenAPI gerado pelo servidor, versionado como fonte dos tipos.
- `packages/contracts/src/schema.ts` (criar): tipos gerados pelo `openapi-typescript`, nunca editados à mão.
- `packages/contracts/src/index.ts` (criar): reexporta `paths`, `components` e `operations` e os atalhos de tipos.

### Passos

1. Leia os arquivos de "Ler" e confira as pré-condições: os doze contextos têm `mod.rs` com `router()`, `migrator()` e a descrição OpenAPI (struct `*Api`/`*ApiDoc` ou `openapi()`); os `router()` usam caminhos relativos a `/api/v1`; anote o prefixo dos `#[utoipa::path]` de `search` e `reports`; `search::router()` e `reports::router()` só extraem `Extension<EntityDeletedHook>` ou nenhuma extensão (os leitores de busca, como `NoteReader`, `JournalReader`, `LibrarySearch` e `ProjectSearch`, são montados pela TASK-16 a partir do `AppState`); não existe `apps/server/src/http/tests/mod.rs`. Se faltar um item num contexto, ou se `search`/`reports` exigirem outra extensão, pare e registre o bloqueio com o contexto e o item: a correção é na tarefa daquele contexto.
2. Vazamento dos bancos de teste. Remova o container reaproveitado, para ele ser recriado com o `/dev/shm` novo: `docker rm -f atria-server-tests-postgres`. Em `apps/server/src/shared/test_support.rs`, escreva primeiro, num `#[cfg(test)] mod tests` no fim do arquivo, os testes que devem falhar: `test_database_is_dropped_when_guard_drops` (cria um `TestDatabase`, guarda o nome, solta o valor e confere por `admin_pool()` que `pg_database` não tem mais o nome) e `stale_test_databases_are_swept` (cria pelo superusuário um banco `test_<uuid v7 de 1 hora atrás>` e outro `test_<uuid v7 de agora>`, chama `sweep_stale_databases` e confere que só o antigo sumiu). Depois implemente: `pub struct TestDatabase { pool: PgPool, name: String }` com `pub fn pool(&self) -> &PgPool` e `pub fn name(&self) -> &str`; `test_pool()` passa a devolver `TestDatabase`; `impl Drop for TestDatabase` fecha o pool e roda, numa `std::thread` com runtime `tokio` `current_thread` própria e `join`, `DROP DATABASE IF EXISTS <nome> WITH (FORCE)` como superusuário, só com `eprintln!` em caso de erro, nunca `panic!`; `async fn sweep_stale_databases(conn: &mut PgConnection)` lista `pg_database` com `datname LIKE 'test\_%'`, lê o instante do UUID v7 do nome e roda `DROP DATABASE IF EXISTS` sem `FORCE` nos mais antigos que 10 minutos, ignorando o erro de banco em uso; `start_server` a chama uma vez, depois de `create_app_role`; o container ganha `.with_shm_size(512 * 1024 * 1024)`. Ajuste os chamadores: `apps/server/src/http/test_support.rs` (`TestContext` ganha o campo `_database: TestDatabase`, declarado depois de `state`, e o `AppState` usa `database.pool().clone()`), `apps/server/src/shared/db.rs` e `apps/server/src/shared/visibility.rs` (`.pool()` nos testes). Rode `cargo test -p atria-server shared::` e `cargo test -p atria-server http::` até passar.
3. Escreva os testes de `apps/server/src/http/tests/migrations.rs`, que devem falhar: `migration_versions_are_unique_across_contexts` (junta as versões de `migrators()` e exige que não se repitam), `migrations_apply_on_empty_database_in_order` (banco vazio, `run_migrations` termina sem erro), `migrations_are_idempotent` (rodar duas vezes não muda `_sqlx_migrations`) e `every_owned_table_has_row_level_security` (toda tabela com coluna `owner_id` tem `relrowsecurity` e ao menos uma política em `pg_policies`). Em `apps/server/src/http/tests.rs`, acrescente `mod support; mod migrations; mod routes; mod api_doc; mod isolation;` depois dos `use`, sem mexer nos testes da TASK-04: os arquivos ficam em `apps/server/src/http/tests/`, como submódulos de `tests.rs`, e nunca se cria `http/tests/mod.rs`, que conflitaria com `tests.rs` (E0761).
4. Em `apps/server/src/auth/application/admin.rs`, acrescente `pub async fn web_push_enabled(pool: &PgPool) -> Result<bool, AuthError>`, fora do `AdminService` e sem ator, que lê `pg_settings::get_instance` e devolve `web_push_enabled`; reexporte em `apps/server/src/auth/mod.rs` com `pub use self::application::admin::web_push_enabled;`.
5. Crie `apps/server/src/http/contexts.rs`: `pub fn migrators() -> Vec<(&'static str, Migrator)>` na ordem `auth`, `finance`, `goals`, `tasks`, `reminders`, `notes`, `journal`, `library`, `projects`, `links`, `search`, `reports`, chamando `set_ignore_missing(true)` em cada um no registro (`tasks` e `reminders` não o fazem no próprio `migrator()`); `pub async fn run_migrations(pool: &PgPool) -> Result<(), MigrationError>`, que roda `http::session::migrate_store` e depois um migrator por vez nessa ordem, com erro tipado (`thiserror`) que leva o nome do contexto; `struct InstanceWebPushPolicy { pool: PgPool }` com `impl reminders::WebPushPolicy`, cujo `is_enabled` devolve `Box::pin(async move { ... })` com `auth::web_push_enabled`, e `false` com `tracing::warn!` sem dados pessoais em caso de erro; `pub fn web_push_policy(pool: PgPool) -> Arc<dyn reminders::WebPushPolicy>`; e `pub fn api_router(state: &AppState) -> Router<AppState>`, que faz `merge` dos doze `router()` e aplica, nessa ordem, `.layer(auth::require_complete_account())`, `.layer(Extension(links::entity_deleted_hook(state.pool.clone())))` e `.layer(Extension(web_push_policy(state.pool.clone())))`. O `EntityDeletedHook` de `links` serve a todos os contextos, porque o alias tem a mesma grafia em todos. Nenhum `ThumbnailFetcher` é instalado em produção: sem a extensão, `library` usa o oEmbed com o `http_client` do `AppState`.
6. Em `apps/server/src/main.rs`, troque cada bloco `#[cfg(atria_context = "<nome>")] #[allow(dead_code)] #[rustfmt::skip] mod <nome>;` por `mod <nome>;` e remova o comentário que explicava a condição e o `rustfmt::skip`; mantenha os `cfg_attr` de `http`, `shared` e `storage`. Troque `run_migrations` por `http::contexts::run_migrations` em `migrate` e `serve` (e o `StartupError::Migration` pelo erro tipado do registro). Em `serve`, monte `http::build_router(state.clone(), http::contexts::api_router(&state))`, inicie `tokio::spawn(reminders::run_dispatcher(state.clone(), http::contexts::web_push_policy(state.pool.clone())))` depois das migrações, registre `tracing::info!("disparador de lembretes iniciado")` e chame `abort()` no handle quando `axum::serve` terminar. Trate `Some("openapi")` antes de `Config::from_env()`: imprime `http::openapi::openapi_json()` em stdout e sai com 0, sem configuração nem banco; atualize `USAGE` para `uso: atria-server [serve|migrate|openapi]`.
7. Escreva os testes de `apps/server/src/http/tests/api_doc.rs`, que devem falhar: `merged_openapi_keeps_every_context_route` (para cada uma das doze descrições, cada par caminho e método, com o prefixo normalizado, existe no `ApiDoc` juntado), `openapi_paths_have_single_api_prefix` (todo caminho começa com `/api/v1/` e nenhum contém `/api/v1/api/v1`), `openapi_has_no_duplicate_operations` (nenhum par caminho e método é declarado por dois contextos, e o total de operações juntadas é a soma das de cada contexto) e `openapi_schema_names_do_not_conflict` (um nome de schema repetido entre contextos tem o mesmo JSON nos dois, como `ProblemDetails`). As asserções de rota de cada `documents_all_*_routes` (auth, finance, goals, tasks, reminders, projects) valem sobre o documento juntado.
8. Crie `apps/server/src/http/openapi.rs`: `#[derive(OpenApi)] #[openapi(info(title = "Atria API", version = env!("CARGO_PKG_VERSION")))] struct ApiDoc`, sem `servers`; `fn context_docs() -> Vec<(&'static str, utoipa::openapi::OpenApi)>` com as doze descrições (`AuthApi::openapi()`, `FinanceApi::openapi()`, `GoalsApi::openapi()`, `TasksApi::openapi()`, `RemindersApi::openapi()`, `notes::openapi()`, `journal::openapi()`, `library::openapi()`, `projects::openapi()`, `links::openapi()`, `search::openapi()` e `ReportsApiDoc::openapi()`, ou a forma que o passo 1 anotou); `fn with_api_prefix(doc) -> OpenApi`, que acrescenta `/api/v1` só aos caminhos que ainda não começam com `/api/v1/` (hoje, os de reminders); `pub fn api_doc() -> utoipa::openapi::OpenApi`, que junta com `OpenApi::merge` as doze descrições normalizadas; e `pub fn openapi_json() -> String` com `to_pretty_json`, com caminhos em ordem estável. Rode `cargo test -p atria-server http::tests::api_doc` até passar.
9. Escreva os testes de `apps/server/src/http/tests/routes.rs`, que devem falhar: `healthz_responds_ok_with_all_contexts` (`GET /healthz` devolve 200 com o servidor completo e as migrações aplicadas), `every_openapi_path_is_routed` (para cada caminho e método de `api_doc()`, troca os parâmetros por valores válidos: UUID v7 para ids, `finance` para `{report}`, `2026-11` para `{period}` e um token aleatório para `{token}`; faz a requisição sem sessão e exige que a resposta não seja o problema `route_not_found` nem 405), `unknown_route_returns_route_not_found_problem`, `wrong_method_returns_method_not_allowed_problem` (`PUT /api/v1/goals` devolve 405 `problem+json` com `method_not_allowed`), `admin_without_totp_is_blocked_on_every_context` (admin criado pelo `/api/v1/setup` sem ativar o 2FA recebe 403 `totp_required` em `/api/v1/goals` e `/api/v1/notes`, e só `/api/v1/setup`, `/api/v1/auth/*` e `/api/v1/me` continuam liberados) e `web_push_policy_follows_instance_setting` (com `web_push_enabled` desligado, `web_push_policy(pool).is_enabled()` devolve `false`; ligado pelo `PATCH /api/v1/admin/instance/settings`, devolve `true`).
10. Em `apps/server/src/http/router.rs`, acrescente ao `Router` montado o `method_not_allowed_fallback`, que responde `problem+json` com `method_not_allowed` (405) pelo `ApiError` do `shared`; o 404 `route_not_found` já vem do `static_files`. Em `apps/server/src/http/mod.rs`, declare `pub mod contexts;` e `pub mod openapi;`.
11. Escreva `apps/server/src/http/tests/support.rs` sobre o `TestContext` da TASK-04: banco de teste do passo 2, `run_migrations` do registro, app de `ctx.app(contexts::api_router(&ctx.state).layer(Extension(fake)))` com um `ThumbnailFetcher` falso (`Arc<dyn library::application::ports::ThumbnailFetcher>` que devolve uma miniatura fixa, sem rede), requisições por `tower::ServiceExt::oneshot`, e o fluxo real de usuários: `POST /api/v1/setup` cria o admin, que ativa o TOTP por `/api/v1/auth/totp` e `/api/v1/auth/totp/activation` e entra com o código gerado do segredo; o admin gera dois convites e cria `alice` e `bob` por `/api/v1/auth/sign-up`. O cliente guarda o cookie de sessão e envia o token CSRF no cabeçalho `CSRF_HEADER`.
12. Escreva `apps/server/src/http/tests/isolation.rs`, com uma tabela de recursos que tenham rota com id: `accounts`, `categories`, `transactions`, `goals`, `tasks`, `reminders`, `notes`, `journal-entries`, `emotions`, `books`, `articles`, `videos`, `projects` e `links`; o corpo mínimo de cada criação vem dos campos obrigatórios do schema em `api_doc()`. Testes: `other_user_gets_404_on_every_resource` (alice cria; bob faz `GET`, `PATCH` e `DELETE` no id e recebe 404), `admin_gets_404_on_other_users_content` (RN-13), `shared_visibility_does_not_grant_access` (alice marca `visibility: "shared"`, bob recebe 404, RN-17 e CT-15), `listings_never_include_other_users_items`, `search_reports_and_exports_never_leak_other_users_data` (`/api/v1/search`, `/api/v1/reports/{report}` e `/api/v1/exports` de bob não contêm o termo nem os ids de alice) e `deleting_entity_removes_its_links_on_both_sides` (alice liga uma nota a uma meta por `POST /api/v1/links`, exclui a nota e `GET /api/v1/links` da meta não traz mais a ligação, CB-06).
13. Rode `cargo test -p atria-server http::` até passar e depois `cargo test -p atria-server` inteiro.
14. Rode `cargo fmt`: sem o `rustfmt::skip`, ele passa a formatar os doze contextos (KNW-004). Rode `cargo fmt --check` e `cargo test -p atria-server` de novo; a mudança nos contextos é só de formatação.
15. Queries checadas na compilação ([project/stack-04], decisão 1A). Suba um PostgreSQL só para as macros: `docker run -d --name atria-sqlx-postgres --shm-size=512m -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:17-alpine`; aplique as migrações com `ATRIA_DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres ATRIA_PUBLIC_URL=http://localhost ATRIA_ENCRYPTION_KEY_FILE=/dev/null cargo run -q -p atria-server -- migrate`; e exporte `DATABASE_URL` com a mesma URL para os passos 15 a 17. Converta o código de produção, um contexto por vez, nesta ordem: `apps/server/src/shared/db.rs` e `apps/server/src/http/healthz.rs`; depois `auth`, `finance`, `goals`, `tasks`, `reminders`, `notes`, `journal`, `library`, `projects`, `links`, `search` e `reports`. Em cada um: `sqlx::query(...).bind(...)` vira `sqlx::query!`, `query_as::<_, Row>` vira `sqlx::query_as!(Row, ...)` e `query_scalar` vira `sqlx::query_scalar!`, com os parâmetros na chamada; tipos próprios e nulabilidade pelas anotações de coluna (`as "col: Tipo"`, `as "col!"`, `as "col?"`) e parâmetros com tipo próprio por `as _` ou conversão explícita; SQL montado com `format!` de constantes (`goals/infrastructure/pg_goals.rs`) vira SQL literal com as colunas escritas; filtros e cursores opcionais do `QueryBuilder` (`finance/infrastructure/pg_transactions.rs`, `tasks/infrastructure/pg_tasks.rs`) viram um SQL literal com parâmetros opcionais (`($n::tipo IS NULL OR coluna = $n)`), listas com `= ANY($n)` e uma query literal por variante de ordenação. Depois de cada contexto, rode `cargo test -p atria-server <contexto>::` e confira o mesmo número de testes passando de antes; tire o `#[derive(sqlx::FromRow)]` que ficar sem uso. O código de teste (`tests/`, `tests.rs`, `test_support.rs` e `#[cfg(test)] mod tests`) continua com queries em execução, porque cria tabelas e bancos que não estão no schema.
16. Gere os dados offline: instale o `sqlx-cli` se faltar (`cargo install sqlx-cli --no-default-features --features rustls,postgres --locked`) e rode `cargo sqlx prepare --workspace`, que grava `.sqlx` na raiz. Confira que `SQLX_OFFLINE=true cargo build -p atria-server` compila sem banco. A pasta `.sqlx` é versionada e regenerada sempre que uma query mudar.
17. Rode `cargo clippy -p atria-server -- -D warnings` e corrija os avisos, sem `unwrap`, `expect` nem `panic!` fora dos testes; depois remova o banco das macros (`docker rm -f atria-sqlx-postgres`) e tire `DATABASE_URL` do ambiente.
18. Crie `packages/contracts/package.json` com `"name": "@atria/contracts"`, `"private": true`, `"type": "module"`, `"exports": { ".": "./src/index.ts" }`, `devDependencies` `openapi-typescript` (7.x, fixada) e `typescript` (a mesma versão da raiz), e os scripts `"generate": "openapi-typescript openapi.json -o src/schema.ts"`, `"check": "openapi-typescript openapi.json | cmp - src/schema.ts"` e `"typecheck": "tsc --noEmit"`. Crie `packages/contracts/tsconfig.json` com `strict: true`, `noEmit: true`, `module` e `moduleResolution` `bundler` e `include: ["src"]`.
19. Gere os contratos: `cargo run -q -p atria-server -- openapi > packages/contracts/openapi.json`, `pnpm install` e `pnpm --filter @atria/contracts generate`. Escreva `packages/contracts/src/index.ts` com `export type { paths, components, operations } from "./schema";` e `export type Schemas = components["schemas"];`. Os caminhos em `paths` vêm completos (`/api/v1/...`).
20. Rode `pnpm --filter @atria/contracts typecheck` e `pnpm --filter @atria/web typecheck`; se o cliente da TASK-05 importar um nome que os tipos gerados não produzem, pare e registre o bloqueio com o nome.
21. Rode a Verificação inteira, inclusive a contagem de bancos `test_%` no container depois da suíte.

### Baseline

- `cargo test -p atria-server 2>&1 | grep -E "^test result" || true`

### Verificação

```bash
# o container de teste é recriado com /dev/shm de 512 MiB pela própria suíte
docker rm -f atria-server-tests-postgres
cargo fmt --check
# o rustfmt confere os contextos de novo (KNW-004)
! grep -q 'rustfmt::skip' apps/server/src/main.rs
! grep -q 'atria_context' apps/server/src/main.rs
cargo clippy -p atria-server -- -D warnings
# integração: migrações, rotas, OpenAPI juntado, /healthz e isolamento entre usuários
cargo test -p atria-server http::
# a limpeza dos bancos de teste
cargo test -p atria-server shared::test_support
# a suíte inteira do servidor continua passando com tudo registrado
cargo test -p atria-server
# nenhum banco de teste sobra e o /dev/shm é de 512 MiB
test "$(docker exec atria-server-tests-postgres psql -U postgres -tAc "SELECT count(*) FROM pg_database WHERE datname LIKE 'test\_%'")" -eq 0
test "$(docker inspect -f '{{.HostConfig.ShmSize}}' atria-server-tests-postgres)" -eq 536870912
# nenhuma query de produção checada só em execução
! find apps/server/src -name '*.rs' ! -path '*/tests/*' ! -name 'tests.rs' ! -name 'test_support.rs' -exec awk 'p && /^mod tests \{/{nextfile} {p=/^#\[cfg\(test\)\]/} /sqlx::(query|query_as|query_scalar)(::<[^(]*>)?\(|QueryBuilder/{print FILENAME":"FNR}' {} + | grep .
# dados offline do sqlx suficientes para compilar sem banco (CI e Docker)
test -d .sqlx
SQLX_OFFLINE=true cargo build -p atria-server
# o OpenAPI versionado é o que o servidor gera hoje
cargo run -q -p atria-server -- openapi | cmp - packages/contracts/openapi.json
# os tipos TS gerados batem com o OpenAPI e compilam
pnpm --filter @atria/contracts check
pnpm --filter @atria/contracts typecheck
pnpm --filter @atria/web typecheck
```

### Evidências

- `server-integration-tests.txt` (automática): `cargo test -p atria-server http:: 2>&1`
  - Prova: as migrações dos doze contextos aplicam em ordem, o OpenAPI juntado traz todas as rotas sob `/api/v1` sem repetição, todas as rotas respondem pelo router montado, `/healthz` responde e nenhum usuário, nem o admin, lê ou altera dados de outro (RNF-02, CT-15).
  - Trecho: as linhas `test http::tests::routes::healthz_responds_ok_with_all_contexts ... ok`, `test http::tests::routes::every_openapi_path_is_routed ... ok`, `test http::tests::api_doc::merged_openapi_keeps_every_context_route ... ok`, `test http::tests::api_doc::openapi_has_no_duplicate_operations ... ok`, `test http::tests::isolation::other_user_gets_404_on_every_resource ... ok`, `test http::tests::migrations::every_owned_table_has_row_level_security ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED`, erro `E0761` ou nenhum teste `http::tests::` novo listado.
- `test-db-cleanup.txt` (automática): `cargo test -p atria-server shared::test_support 2>&1 | grep -E "^test |^test result"; docker exec atria-server-tests-postgres psql -U postgres -tAc "SELECT count(*) FROM pg_database WHERE datname LIKE 'test\_%'"; docker inspect -f '{{.HostConfig.ShmSize}}' atria-server-tests-postgres`
  - Prova: cada teste apaga o próprio banco, os bancos antigos são varridos e o container tem `/dev/shm` de 512 MiB.
  - Trecho: `test_database_is_dropped_when_guard_drops ... ok`, `stale_test_databases_are_swept ... ok`, a contagem `0` e `536870912`.
  - Falha: `FAILED`, contagem maior que zero ou `67108864` (64 MiB).
- `sqlx-checked-queries.txt` (automática): `find apps/server/src -name '*.rs' ! -path '*/tests/*' ! -name 'tests.rs' ! -name 'test_support.rs' -exec awk 'p && /^mod tests \{/{nextfile} {p=/^#\[cfg\(test\)\]/} /sqlx::(query|query_as|query_scalar)(::<[^(]*>)?\(|QueryBuilder/{print FILENAME":"FNR}' {} + | wc -l; grep -rhoE "sqlx::query(_as|_scalar)?!" apps/server/src | wc -l`
  - Prova: o código de produção usa só as macros checadas na compilação ([project/stack-04]).
  - Trecho: `0` na primeira linha e um número maior que zero na segunda.
  - Falha: primeira linha maior que zero ou segunda linha `0`.
- `sqlx-offline.txt` (automática): `ls .sqlx | wc -l && SQLX_OFFLINE=true cargo build -p atria-server 2>&1 | tail -n 3`
  - Prova: os dados offline do `sqlx` existem e bastam para compilar o servidor sem banco, como na CI e no build Docker.
  - Trecho: um número maior que zero de arquivos `query-*.json` e a linha `Finished` do cargo.
  - Falha: `No such file or directory`, contagem `0` ou `error: ... SQLX_OFFLINE`.
- `openapi-paths.txt` (automática): `node -e "const d=require('./packages/contracts/openapi.json');const p=Object.keys(d.paths);console.log(p.filter(x=>!x.startsWith('/api/v1/')||x.includes('/api/v1/api/v1')).length);console.log(p.sort().join('\n'))"`
  - Prova: o OpenAPI gerado traz os caminhos dos doze contextos, todos com um único prefixo `/api/v1`.
  - Trecho: a primeira linha `0` e caminhos como `/api/v1/setup`, `/api/v1/accounts`, `/api/v1/reminders`, `/api/v1/search`, `/api/v1/links`, `/api/v1/reports/{report}` e `/api/v1/exports`.
  - Falha: erro `Cannot find module`, primeira linha maior que zero ou falta de caminhos de algum contexto.
- `contracts-check.txt` (automática): `pnpm --filter @atria/contracts check 2>&1 && pnpm --filter @atria/contracts typecheck 2>&1 && grep -c "export interface paths" packages/contracts/src/schema.ts`
  - Prova: os tipos TypeScript estão gerados do OpenAPI atual e compilam.
  - Trecho: os dois scripts sem erro e a contagem `1` no fim.
  - Falha: `differ`, erro do `tsc` ou `No projects matched the filters`.
  - Artefato: `packages/contracts/openapi.json` e `packages/contracts/src/schema.ts`.

### Concluída quando

- [ ] O servidor aplica as migrações dos doze contextos na ordem definida, sem versões repetidas e de forma idempotente (RNF-02).

  > Como comprovar: em `server-integration-tests.txt`, ver `migration_versions_are_unique_across_contexts`, `migrations_apply_on_empty_database_in_order` e `migrations_are_idempotent` como `ok`.

- [ ] O OpenAPI juntado traz todas as rotas de todos os contextos sob `/api/v1`, sem prefixo duplicado, sem operação repetida e sem conflito de schema (RNF-02).

  > Como comprovar: em `server-integration-tests.txt`, ver os quatro testes `http::tests::api_doc::` como `ok`; em `openapi-paths.txt`, ver `0` na primeira linha.

- [ ] `/healthz` e todas as rotas do OpenAPI respondem pelo servidor montado, sem `route_not_found` nem 405, e rota ou método errado respondem com o problema certo (RNF-02).

  > Como comprovar: em `server-integration-tests.txt`, ver `healthz_responds_ok_with_all_contexts`, `every_openapi_path_is_routed`, `unknown_route_returns_route_not_found_problem` e `wrong_method_returns_method_not_allowed_problem` como `ok`.

- [ ] O admin sem 2FA é barrado em todos os contextos, a política de Web Push segue a configuração da instância e o disparador de lembretes sobe com o servidor (RNF-02).

  > Como comprovar: em `server-integration-tests.txt`, ver `admin_without_totp_is_blocked_on_every_context` e `web_push_policy_follows_instance_setting` como `ok`; ao subir o servidor, ver no log a linha `disparador de lembretes iniciado`.

- [ ] Nenhum usuário, nem o admin, lê, altera ou exclui dado de outro em nenhum recurso, e a marcação "compartilhada" não dá acesso (RNF-02, CT-15).

  > Como comprovar: em `server-integration-tests.txt`, ver os testes `http::tests::isolation::` de acesso como `ok`.

- [ ] Excluir uma entidade remove as ligações dela dos dois lados, pelo gancho de `links` instalado no servidor (RNF-02).

  > Como comprovar: em `server-integration-tests.txt`, ver `deleting_entity_removes_its_links_on_both_sides` como `ok`.

- [ ] Toda tabela com dono tem Row Level Security ativa com política (RNF-02).

  > Como comprovar: em `server-integration-tests.txt`, ver `every_owned_table_has_row_level_security` como `ok`.

- [ ] Os testes não deixam bancos sobrando no container de teste, que tem `/dev/shm` de 512 MiB (RNF-02).

  > Como comprovar: em `test-db-cleanup.txt`, ver os dois testes de limpeza como `ok`, a contagem `0` de bancos `test_%` depois da suíte e `536870912`.

- [ ] Todo o código de produção do servidor usa queries checadas na compilação e compila sem banco com os dados offline em `.sqlx` (RNF-02).

  > Como comprovar: em `sqlx-checked-queries.txt`, ver `0` na primeira linha; em `sqlx-offline.txt`, ver arquivos em `.sqlx` e a linha `Finished`.

- [ ] O pacote `@atria/contracts` tem o OpenAPI gerado pelo servidor e os tipos TypeScript gerados dele, sem diferença com o código atual, e o frontend compila com eles (RNF-02).

  > Como comprovar: abrir `openapi-paths.txt` e ver os caminhos `/api/v1/...` de todos os contextos; abrir `contracts-check.txt` e ver os scripts sem erro e a contagem `1`.

- [ ] Os doze contextos são declarados no `main.rs` sem condição e sem `rustfmt::skip`, e `cargo fmt --check` volta a conferir os contextos (RNF-02).

  > Como comprovar: abrir `apps/server/src/main.rs` e não achar `atria_context` nem `rustfmt::skip`; rodar `cargo fmt --check` e ver que termina sem erro.

- [ ] A suíte inteira do servidor, o `cargo fmt --check` e o `cargo clippy -- -D warnings` passam (RNF-02).

  > Como comprovar: rodar a Verificação e ver todos os comandos terminarem sem erro.

## Descrição

### Resumo executivo

Junta todos os módulos do servidor num único serviço: cada área passa a responder pela mesma API, com o banco preparado na subida e o contrato da API publicado para o frontend.
Também prova, com testes sobre o servidor completo, que nenhuma pessoa, nem o administrador, enxerga ou altera dados de outra, passa todas as consultas ao banco para a forma conferida na compilação e acaba com o acúmulo de bancos de teste que quebrava a suíte.
Perfil julgamento, risco alto: é o ponto de integração de doze áreas e do contrato público, e a troca das consultas atinge cerca de 30 arquivos.
Desbloqueia todas as telas do frontend, que dependem dos tipos gerados aqui, e o build Docker (TASK-36), que depende dos dados offline.

### Detalhes técnicos

- **Abordagem:** um registro único (`apps/server/src/http/contexts.rs`) lista os doze contextos e é a única coisa que `main.rs` e o router consultam; o OpenAPI é a soma das descrições de cada contexto, com o prefixo normalizado (`apps/server/src/http/openapi.rs`), e vira `packages/contracts/openapi.json` pelo subcomando `openapi`; os tipos TS saem dele pelo `openapi-typescript`. Depois da integração, com a rede de testes completa, as queries de produção passam para as macros checadas e a pasta `.sqlx` é gerada.
- **Componentes:** `apps/server/src/main.rs`, `apps/server/src/http` e `apps/server/src/shared` (TASK-04), o pacote novo `packages/contracts` e os doze contextos, que mudam em três pontos só: a formatação pelo `cargo fmt` (KNW-004), as queries pelas macros e, no `auth`, a função `web_push_enabled`.
- **Decisão: migrações por contexto numa tabela só, com `set_ignore_missing(true)` aplicado no registro, em ordem fixa (auth primeiro).** Segue a decisão 55 da spec. `tasks` e `reminders` não chamam `set_ignore_missing` no próprio `migrator()`; aplicar no registro vale para todos sem mexer nesses contextos. Alternativas descartadas: uma tabela `_sqlx_migrations` por contexto (API de nome de tabela pouco estável no `sqlx`, complica o backup) e juntar as pastas num `build.rs` (esconde a origem). Critério: versões únicas, checadas por teste, e aplicação idempotente ([project/self-hosting-06], [project/development-methodology-02]).
- **Decisão: routers relativos montados com `nest("/api/v1")` e OpenAPI com caminhos completos, sem `servers`.** O `build_router` da TASK-04 já faz o `nest`. Nove dos dez contextos prontos declaram `#[utoipa::path]` com `/api/v1/...` e os testes `documents_all_*_routes` deles conferem esses caminhos; só `reminders` usa caminhos relativos. A junção acrescenta `/api/v1` só a quem não o tem, o que também cobre `search` e `reports` na forma que vierem. Alternativas descartadas: `servers(/api/v1)` com caminhos relativos (exigiria mudar nove contextos e seus testes, e com os caminhos de hoje duplicaria o prefixo para o cliente) e `nest` fixo por contexto na junção (quebra se um contexto mudar de forma). Critério: `openapi_paths_have_single_api_prefix`, `openapi_has_no_duplicate_operations` e `every_openapi_path_is_routed` passam.
- **Decisão: camadas e extensões globais no registro.** `api_router` aplica a todo o `/api/v1` `auth::require_complete_account()` (admin sem 2FA, RF-07; as isenções `/setup`, `/me` e `/auth/*` ficam no próprio auth), `Extension(links::entity_deleted_hook(pool))` (CB-06; o alias `EntityDeletedHook` tem a mesma grafia em todos os contextos, então uma extensão serve a todos) e `Extension<Arc<dyn reminders::WebPushPolicy>>`. Descartado cada contexto aplicar a própria verificação, que deixaria rotas sem ela.
- **Decisão: `WebPushPolicy` por um adaptador no `http` sobre `auth::web_push_enabled`.** O auth só lê a configuração com ator admin (`instance_settings`), então ganha uma função de aplicação sem ator, e o adaptador `InstanceWebPushPolicy` implementa a porta do reminders devolvendo `BoxFuture`, com erro valendo desligado. Alternativas descartadas: o `http` ler `instance_settings` direto (proibido por [project/architecture-04]) e o auth implementar a trait do reminders (acopla auth a reminders). O mesmo adaptador vai para `reminders::run_dispatcher`, iniciado em `tokio::spawn` e abortado quando o servidor para.
- **Decisão: sem `ThumbnailFetcher` nem leitores de busca como extensão em produção.** O `library` já usa o oEmbed com o `http_client` do `AppState` quando a extensão falta; os testes de integração instalam um falso, para não depender de rede ([project/architecture-12]). Os leitores (`NoteReader`, `JournalReader`, `LibrarySearch`, `ProjectSearch`) são montados pela TASK-16 a partir do `AppState`. Descartado instalar o oEmbed explicitamente, que repetiria o padrão do contexto.
- **Decisão: subcomando `openapi` antes da configuração.** Hoje o `main.rs` lê `Config::from_env()` antes do subcomando; o `openapi` precisa rodar sem `ATRIA_` nem banco (CI e geração dos contratos). Descartado exigir variáveis falsas para gerar o contrato.
- **Decisão: `openapi-typescript` só com tipos; `openapi.json` versionado e conferido com `cmp`.** O cliente fica em `apps/web/src/shared` (TASK-05). Alternativas descartadas: `openapi-generator` (exige Java), tipos à mão (proibido por [project/api-02]) e gerar só na CI (esconde a mudança do contrato na revisão, [project/development-methodology-03]). Dependência nova justificada por [project/api-02] ([project/stack-12]).
- **Decisão: isolamento testado no servidor completo, por tabela de recursos.** Complementa os testes de autorização de cada contexto ([project/testing-03]) com sessão e CSRF reais, o admin (RN-13) e a marcação compartilhada (RN-17). Critério: todo recurso com rota `{id}` aparece na tabela.
- **Decisão: testes novos como submódulos de `http/tests.rs`.** A TASK-04 criou `apps/server/src/http/tests.rs`; criar `http/tests/mod.rs` daria o erro E0761 (dois arquivos para o mesmo módulo). `tests.rs` declara `mod support; mod migrations; mod routes; mod api_doc; mod isolation;` e os arquivos ficam em `http/tests/`, o que mantém os caminhos `http::tests::<arquivo>::<teste>`. Alternativas descartadas: mover `tests.rs` para `tests/mod.rs` (mexe no arquivo da TASK-04 só para trocar de lugar) e `#[path]` (esconde a ligação entre arquivo e módulo).
- **Decisão: banco de teste apagado por guarda, varredura dos antigos e `/dev/shm` maior.** `test_pool()` criava um banco por teste e nunca o apagava: 2.502 bancos encheram os 64 MB do `/dev/shm` do container `atria-server-tests-postgres`. `TestDatabase` apaga o banco no `Drop` com `WITH (FORCE)`, numa thread com runtime própria (não há `Drop` assíncrono); a varredura na subida do container apaga, sem `FORCE`, os `test_*` com mais de 10 minutos pelo instante do UUID v7 do nome, o que cobre processos mortos sem derrubar outra execução em andamento; o container ganha 512 MiB de `/dev/shm`. Alternativas descartadas: só aumentar o `/dev/shm` (adia a falha), só varrer (sobra uma execução inteira de bancos) e varrer com `FORCE` (derruba testes de outra execução). O container reaproveitado precisa ser recriado uma vez para o `/dev/shm` novo valer.
- **Decisão: `mod` dos contextos sem condição e sem `rustfmt::skip`.** Com os doze contextos prontos, a condição do `build.rs` deixa de ser necessária no `main.rs`, o `allow(dead_code)` esconderia código morto e o `rustfmt::skip` fazia o `cargo fmt --check` passar sem conferir os contextos (KNW-004). O `build.rs` e os `cfg_attr` de `http`, `shared` e `storage` ficam, inofensivos.
- **Decisão: queries checadas na compilação nesta tarefa ([project/stack-04], decisão 1A do usuário).** Os contextos da onda 4 usaram `sqlx::query`/`query_as`/`query_scalar` com `.bind`, checadas em execução, por decisão do usuário, deixando a troca para cá, onde todas as migrações e queries existem. Impacto: cerca de 200 queries em 28 arquivos de produção (`shared/db.rs`, `http/healthz.rs`, `auth/application/setup.rs` e o `infrastructure` dos dez contextos prontos), mais o que `search` e `reports` trouxerem; o SQL dinâmico de `goals/infrastructure/pg_goals.rs` (`format!`) e o `QueryBuilder` de `finance/infrastructure/pg_transactions.rs` e `tasks/infrastructure/pg_tasks.rs` viram SQL literal com parâmetros opcionais. Ordem: depois da integração e dos testes de `http::`, um contexto por vez, na ordem das migrações, rodando os testes do contexto depois de cada um. O código de teste fica com queries em execução, porque cria tabelas e bancos fora do schema. Alternativas descartadas: manter as queries em execução (fere [project/stack-04]) e uma tarefa nova só para a troca (o usuário pediu que ficasse aqui, e ela depende do registro das migrações).
- **Riscos:** a troca das queries é a maior parte da tarefa e pode esbarrar em tipos próprios e nulabilidade inferida errada pelas macros (resolvidos com as anotações de coluna e pegos pelos testes de cada contexto); colisão de versões de migração entre contextos; conflito de nomes de schemas na junção do OpenAPI; um contexto sem Row Level Security; todos aparecem como teste falhando e, se a correção for de desenho do contexto, viram bloqueio para a tarefa dele. Os tipos gerados têm as chaves `/api/v1/...`, enquanto o cliente da TASK-05 usa `base_url` `/api/v1` com caminhos relativos: quem tipar o cliente pelos `paths` (TASK-35) tira o prefixo da chave. O cliente pode esperar nomes que os tipos gerados não têm (passo 20).
- **Referências:** RNF-02, RN-13, RN-17, CT-15, decisões 54, 55 e 56 da spec; decisão 1A do usuário (queries checadas na TASK-18); KNW-004; [project/api-01], [project/api-02], [project/api-03], [project/architecture-04], [project/database-09], [project/security-04], [project/self-hosting-05], [project/stack-04].
- **Arquivos em comum na onda 6:** nenhum; é a única tarefa da onda. `main.rs`, `http` e `shared` são da TASK-04, e os contextos das TASK-06 a TASK-17, todas de ondas anteriores.

### Card

- **Título:** Integração do servidor
- **Tipo:** tarefa
- **Descrição:** Registra as rotas, as migrações e o OpenAPI dos doze contextos no servidor, publica os tipos TypeScript em `@atria/contracts`, passa as queries para as macros checadas com a pasta `.sqlx`, corrige o vazamento de bancos de teste e prova o isolamento entre usuários no servidor completo.
- **Critérios de aceite:**
  - [ ] As migrações de todos os contextos aplicam em ordem e sem repetição.
  - [ ] O OpenAPI traz todas as rotas sob `/api/v1`, sem duplicação.
  - [ ] `/healthz` e todas as rotas da API respondem.
  - [ ] Nenhum usuário, nem o admin, acessa dados de outro.
  - [ ] As queries de produção são checadas na compilação e o servidor compila sem banco.
  - [ ] Os testes não deixam bancos sobrando no container.
  - [ ] `@atria/contracts` tem o OpenAPI e os tipos TypeScript gerados e atualizados.
- **Rótulos:** SPEC-001, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-06, TASK-15, TASK-16, TASK-17

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-31 | início | in_progress | aprovada em 2026-10-31T00:29:40Z; modelo: opus |
| 2 | 2026-10-31 | baseline | coletado | 1 comando(s); códigos de saída: 0; 6 evidência(s) automática(s) gravada(s) para comparação |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-31 | agente | Registro dos doze contextos atualizado ao código real: migrators com set_ignore_missing no registro, OpenAPI das structs *Api e openapi() com prefixo /api/v1 normalizado sem servers, mod sem cfg nem rustfmt::skip (KNW-004); Extensões globais: entity_deleted_hook de links, require_complete_account, WebPushPolicy por adaptador sobre auth::web_push_enabled (BoxFuture), run_dispatcher em tokio::spawn, ThumbnailFetcher falso só nos testes e leitores da busca montados pela TASK-16; Queries de produção convertidas para as macros checadas, contexto por contexto na ordem das migrações, e pasta .sqlx gerada (stack-04, decisão 1A); Vazamento de bancos de teste corrigido: TestDatabase com DROP no Drop, varredura dos antigos, /dev/shm de 512 MiB e testes de limpeza; Conflito http/tests.rs x http/tests/mod.rs resolvido com submódulos de tests.rs; Testes do OpenAPI juntado (api_doc): rotas de todos os documents_all_*_routes sob /api/v1, sem prefixo duplicado nem operação repetida; Baseline sem as linhas que citavam caminhos criados pela tarefa; Ler, Mudar, Passos, Verificação, Evidências, Concluída quando, Detalhes técnicos e card coerentes |
