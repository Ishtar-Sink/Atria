---
id: TASK-15
spec: SPEC-001
title: "Contexto links"
profile: padrao
persona: desenvolvedor
depends_on: [TASK-04]
wave: 4
covers: [RF-18, CT-13]
type: historia
labels: [SPEC-001, padrao]
status: done
content_hash: b787ae3e5714a681eb113edd8f7d0e45d94630e69f0fa7976332ef78c6b77553
adjustments: 1
adjusted_at: 2026-10-30T20:10:36Z
approved_at: 2026-10-30T14:38:10Z
approved_hash: 1be3c595c3c49e87e31399eabc51a7371ef5df8269f9e93e22e3f4513497f022
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: sonnet
updated_at: 2026-10-30T20:10:36Z
---

# TASK-15: Contexto links

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-18, RF-19, RN-10, CB-06, CT-13, contrato `GET|POST /links` e `DELETE /links/{id}` (source_type, source_id, target_type, target_id), decisões 27 e 53 a 56.
- `vostok/rules/project/architecture.md`: [project/architecture-04] e [project/architecture-05].
- `vostok/rules/project/security.md`
- `vostok/rules/project/database.md`
- `vostok/rules/project/api.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`
- `apps/server/Cargo.toml`: dependências já declaradas pela TASK-04.
- `apps/server/src/main.rs`: `mod links;` já declarado pela TASK-04 (só leitura; não alterar).
- `apps/server/src/shared/mod.rs`: erro `problem+json`, UUID v7, relógio injetável, visibilidade e paginação por cursor opaco base64url (chave de ordenação + id) da TASK-04.
- `apps/server/src/http/mod.rs`: `AppState`, extrator do usuário autenticado e auxiliar de testes de `apps/server/src/http` da TASK-04, que monta o app com sessão e CSRF e cria sessões de usuários de teste (só leitura; não alterar).

### Mudar

- `apps/server/src/links/mod.rs` (criar): declara as camadas e expõe `router()`, `migrator()`, `openapi()`, `EntityDeletedHook`, `entity_deleted_hook()` e `remove_links_for_entity()`.
- `apps/server/src/links/domain/mod.rs` (criar): módulo do domínio.
- `apps/server/src/links/domain/link.rs` (criar): `Link`, `EntityRef`, tipos de entidade ligáveis e normalização dos lados, com testes unitários.
- `apps/server/src/links/domain/error.rs` (criar): `LinkError` tipado com `thiserror`.
- `apps/server/src/links/application/mod.rs` (criar): módulo da aplicação.
- `apps/server/src/links/application/ports.rs` (criar): trait `LinkRepository`.
- `apps/server/src/links/application/service.rs` (criar): `LinkService` (ligar, listar por entidade, remover, remover tudo de uma entidade).
- `apps/server/src/links/application/deletion_hook.rs` (criar): alias `EntityDeletedHook` e a fábrica `entity_deleted_hook()` usada pelos outros contextos ao excluir (CB-06).
- `apps/server/src/links/infrastructure/mod.rs` (criar): módulo da infraestrutura.
- `apps/server/src/links/infrastructure/pg_link_repository.rs` (criar): repositório PostgreSQL das ligações.
- `apps/server/src/links/interface/mod.rs` (criar): montagem do `router()`.
- `apps/server/src/links/interface/dto.rs` (criar): corpos de requisição e resposta com `utoipa::ToSchema`.
- `apps/server/src/links/interface/handlers.rs` (criar): handlers axum e conversão de `LinkError` em `problem+json`.
- `apps/server/src/links/interface/openapi.rs` (criar): `LinksApi` (`utoipa::OpenApi`) do contexto.
- `apps/server/src/links/migrations/20261101150001_create-links.sql` (criar): tabela `links`, restrições, índices e Row Level Security.
- `apps/server/src/links/tests/mod.rs` (criar): módulo de testes de integração do contexto.
- `apps/server/src/links/tests/api.rs` (criar): testes de integração HTTP contra PostgreSQL em container.

### Passos

1. Leia os arquivos de "Ler" e anote os nomes reais que a TASK-04 criou: `AppState` e seus campos (pool, relógio, gerador de ids), extrator do usuário autenticado, erro `problem+json`, enum de visibilidade, tipo de paginação por cursor opaco base64url (chave de ordenação + id) e o auxiliar de testes de `apps/server/src/http` (pool em container, app com sessão e CSRF, sessões de usuários de teste). Use esses nomes; não crie equivalentes.
2. Crie `apps/server/src/links/migrations/20261101150001_create-links.sql` com a tabela `links`: `id UUID PRIMARY KEY`, `owner_id UUID NOT NULL`, `visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal','shared'))`, `source_type TEXT NOT NULL`, `source_id UUID NOT NULL`, `target_type TEXT NOT NULL`, `target_id UUID NOT NULL`, `created_at` e `updated_at TIMESTAMPTZ NOT NULL`; `CHECK` de `source_type` e `target_type` na lista `account, transaction, transfer, goal, milestone, task, reminder, note, journal_entry, book, article, video, project, project_card`; `CHECK ((source_type, source_id) < (target_type, target_id))` (lados normalizados, o que também impede ligar uma entidade a ela mesma); `CONSTRAINT links_pair_uniq UNIQUE (owner_id, source_type, source_id, target_type, target_id)`; índices `links_owner_source_idx ON links (owner_id, source_type, source_id)` e `links_owner_target_idx ON links (owner_id, target_type, target_id)` ([project/database-07]); `ENABLE` e `FORCE ROW LEVEL SECURITY` com a política `links_owner_isolation` `USING (owner_id = current_setting('app.current_user_id', true)::uuid)` e o mesmo `WITH CHECK`. Sem FK para tabelas de outros contextos ([project/architecture-05]).
3. Escreva primeiro os testes unitários em `domain/link.rs`, que devem falhar: `link_to_itself_is_rejected`, `unknown_entity_type_is_rejected`, `link_sides_are_normalized`, `reversed_input_produces_same_normalized_link`, `linked_side_is_the_opposite_of_queried_entity`, `linkable_types_match_the_database_check`.
4. Implemente `domain/error.rs` (`LinkError`: `NotFound`, `SelfLink`, `UnknownEntityType`, `AlreadyExists`) e `domain/link.rs` (`EntityType` com as 14 variantes e `as_str()` em `snake_case`, `EntityRef { entity_type, entity_id }`, `Link::new(owner_id, a, b, visibility, now)` que ordena os lados e recusa lados iguais, e `Link::other_side(&EntityRef) -> Option<EntityRef>`), sem `sqlx` nem `axum`. Rode `cargo test -p atria-server links::domain` até passar.
5. Escreva os testes de integração em `apps/server/src/links/tests/api.rs` (registrados em `tests/mod.rs` e em `mod.rs` com `#[cfg(test)] mod tests;`), com `links::router()` montado pelo auxiliar de testes de `apps/server/src/http`, `links::migrator()` aplicado no container e relógio e ids fixos: `ct13_link_note_to_goal_appears_on_both_sides` (POST de `note` para `goal`; `GET /links?entity_type=note&entity_id=` e `?entity_type=goal&entity_id=` devolvem a mesma ligação, com `linked_type` `goal` e `note` respectivamente), `ct13_removing_link_from_goal_side_removes_from_both` (DELETE pelo id obtido na listagem da meta; as duas listagens vêm vazias), `rn10_reverse_duplicate_link_returns_409` (código `link_already_exists`), `self_link_returns_422`, `unknown_entity_type_returns_422`, `listing_filters_by_linked_type_and_paginates_by_cursor`, `other_user_links_are_invisible_and_delete_returns_404`, `cb06_remove_links_for_entity_clears_both_sides` (ligações em que a entidade é origem e destino somem; ligações de outras entidades e de outro dono ficam), `cb06_entity_deleted_hook_removes_links` (chama o gancho de `entity_deleted_hook()` com `(owner_id, "note", note_id)` e espera a listagem vazia), `rls_is_enabled_on_links_table`. Rode e confirme que falham.
6. Em `application/ports.rs`, declare `LinkRepository` (`insert`, `list_for_entity` com cursor e filtro `linked_type`, `find`, `delete`, `delete_for_entity`). Em `application/service.rs`, implemente `LinkService` (`create`, `list_for_entity`, `delete`, `remove_for_entity`), sempre filtrando por `owner_id` do usuário autenticado ([project/security-04]); `create` normaliza os lados no domínio e converte a violação de `links_pair_uniq` em `AlreadyExists`.
7. Em `application/deletion_hook.rs`, declare o contrato que os outros contextos copiam:
   `pub type EntityDeletedHook = std::sync::Arc<dyn Fn(uuid::Uuid, &'static str, uuid::Uuid) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync>;`
   com os argumentos `(owner_id, entity_type, entity_id)` e um comentário dizendo que a grafia tem de ser idêntica nos contextos que excluem entidades, para ser o mesmo tipo na `Extension`. Implemente `pub fn entity_deleted_hook(pool: sqlx::PgPool) -> EntityDeletedHook`, que chama `remove_links_for_entity`, e `pub async fn remove_links_for_entity(pool: &sqlx::PgPool, owner_id: Uuid, entity_type: &str, entity_id: Uuid) -> Result<u64, LinkError>`; tipo desconhecido não remove nada e devolve 0. Em falha, o gancho registra um `tracing::warn!` só com ids e o tipo, nunca conteúdo ([project/security-13]), e não propaga o erro.
8. Em `infrastructure/pg_link_repository.rs`, implemente `PgLinkRepository` com queries parametrizadas com `sqlx::query`/`sqlx::query_as` e `.bind` (checadas em execução, sem SQL montado por concatenação; a troca pelas macros checadas na compilação, exigidas por [project/stack-04], fica com a TASK-18, que gera a pasta `.sqlx`), em transação que abre com `set_config('app.current_user_id', $1, true)`. A listagem por entidade usa `WHERE owner_id = $1 AND ((source_type = $2 AND source_id = $3) OR (target_type = $2 AND target_id = $3))`, ordenada por `created_at DESC, id DESC` com cursor opaco base64url. A exclusão é física: a ligação não tem tela própria nem lixeira na spec (RN-10).
9. Em `interface/dto.rs`, declare `CreateLinkRequest { source_type, source_id, target_type, target_id, visibility? }`, `LinkResponse` (campos comuns + `source_type`, `source_id`, `target_type`, `target_id` normalizados e, na listagem por entidade, `linked_type` e `linked_id`, o lado oposto à entidade consultada, para a aba "Conexões" filtrar e agrupar por tipo) e `LinkListQuery { entity_type, entity_id, linked_type?, cursor?, limit? (1 a 100, padrão 50) }`, em `snake_case` com `utoipa::ToSchema`/`IntoParams`.
10. Em `interface/handlers.rs`, implemente com `#[utoipa::path]` e caminhos relativos (a TASK-18 monta sob `/api/v1`): `POST /links` (201), `GET /links` (200, exige `entity_type` e `entity_id`) e `DELETE /links/{id}` (204). Erros só aqui em `problem+json`: `link_not_found` (404, também para ligação de outro usuário), `link_already_exists` (409), `self_link`, `unknown_entity_type` e `validation_failed` (422).
11. Em `interface/openapi.rs`, declare `#[derive(utoipa::OpenApi)] pub struct LinksApi`; em `interface/mod.rs`, monte o `Router<AppState>`; em `mod.rs`, exponha `pub fn router() -> axum::Router<AppState>`, `pub fn migrator() -> sqlx::migrate::Migrator` (`sqlx::migrate!("src/links/migrations")`), `pub fn openapi() -> utoipa::openapi::OpenApi` e `pub use application::deletion_hook::{EntityDeletedHook, entity_deleted_hook, remove_links_for_entity}`. A TASK-18 instala `Extension(links::entity_deleted_hook(pool))` no app; esta tarefa não faz isso.
12. Não altere `apps/server/src/main.rs` nem `apps/server/src/http`: o `mod links;` já é declarado em `apps/server/src/main.rs` pela TASK-04, e esta tarefa só cria `apps/server/src/links/mod.rs`. Se `cargo test -p atria-server links:: -- --list` não listar os testes por falta dessa declaração, **PARE** e peça o ajuste da tarefa (skill `adjust-task`).
13. Rode os comandos da Verificação até todos passarem, com Docker disponível para o testcontainers.

### Baseline

- `test -d apps/server/src/links && echo existe || echo ausente`
- `cargo test -q -p atria-server shared:: 2>/dev/null`
- `cargo test -q -p atria-server http:: 2>/dev/null`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
cargo test -p atria-server links:: -- --list | grep -q 'links::tests::api::ct13_link_note_to_goal_appears_on_both_sides'
cargo test -p atria-server links::
cargo test -p atria-server links::tests::api::cb06_entity_deleted_hook_removes_links -- --exact
```

Resultado esperado: formatação e clippy sem aviso, `test result: ok` em todos os testes do contexto e o teste do gancho de exclusão passando.

### Evidências

- `links-tests.txt` (automática): `cargo test -p atria-server links::`
  - Prova: os testes unitários e de integração das ligações passam: ligação vista dos dois lados, remoção por um lado some dos dois, duplicata invertida recusada, filtro por tipo, autorização e RLS (RF-18, CT-13, RN-10, RNF-02).
  - Trecho: as linhas `test links::tests::api::ct13_link_note_to_goal_appears_on_both_sides ... ok`, `test links::tests::api::ct13_removing_link_from_goal_side_removes_from_both ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED` ou `running 0 tests` (contexto inexistente).
- `links-deletion-hook.txt` (automática): `cargo test -p atria-server links::tests::api::cb06_entity_deleted_hook_removes_links -- --exact`
  - Prova: o gancho usado pelos outros contextos ao excluir uma entidade remove as ligações dela dos dois lados (CB-06).
  - Trecho: `test links::tests::api::cb06_entity_deleted_hook_removes_links ... ok` e `test result: ok. 1 passed`.
  - Falha: `FAILED`, ou `0 passed` (teste ausente).

### Concluída quando

- [x] Uma entidade se liga a outra de qualquer tipo ligável, e a ligação aparece na listagem dos dois lados, com o tipo do lado oposto para filtrar e agrupar (RF-18, CT-13).

  > Como comprovar: rodar `cargo test -p atria-server links::` e ver `ct13_link_note_to_goal_appears_on_both_sides ... ok` e `listing_filters_by_linked_type_and_paginates_by_cursor ... ok` em `links-tests.txt`.

- [x] Remover a ligação por um lado remove dos dois, e a mesma ligação em sentido invertido não é criada de novo (RF-18, CT-13).

  > Como comprovar: ver `ct13_removing_link_from_goal_side_removes_from_both ... ok` e `rn10_reverse_duplicate_link_returns_409 ... ok` em `links-tests.txt`.

- [x] Ao excluir uma entidade, as ligações dela somem dos dois lados pelo gancho, sem o contexto `links` ler tabelas de outros contextos (RF-18).

  > Como comprovar: ver `cb06_entity_deleted_hook_removes_links ... ok` em `links-deletion-hook.txt` e `cb06_remove_links_for_entity_clears_both_sides ... ok` em `links-tests.txt`.

- [x] Ligações de outra pessoa não aparecem e não podem ser removidas (404), e a tabela tem Row Level Security ativa (RF-18).

  > Como comprovar: ver `other_user_links_are_invisible_and_delete_returns_404 ... ok` e `rls_is_enabled_on_links_table ... ok` em `links-tests.txt`.

- [x] O contexto expõe `router()`, `migrator()`, `openapi()` e o gancho, não altera `main.rs` nem `http`, passa limpo em `cargo fmt --check` e `cargo clippy -- -D warnings`, e as camadas `domain` e `application` têm pelo menos 80% de cobertura (RF-18).

  > Como comprovar: rodar a Verificação e ver todos os comandos terminando sem erro; abrir `apps/server/src/links/mod.rs` e ver as funções públicas; rodar `cargo llvm-cov -p atria-server --summary-only -- links::` e ver 80% ou mais nos arquivos de `links/domain` e `links/application`.

## Descrição

### Resumo executivo

Entrega no servidor as ligações "Conecta com": qualquer item pode ser ligado a outro, a ligação aparece nos dois lados e some dos dois quando removida.
Também oferece aos outros módulos um aviso de exclusão, para que apagar um item leve junto as ligações dele.
Perfil padrao: decisões locais já tomadas; risco médio, porque o formato do aviso de exclusão é usado por vários módulos.
Depende do núcleo do servidor e libera a integração do servidor e a aba Conexões.

### Detalhes técnicos

**Abordagem.** Contexto DDD `apps/server/src/links`, genérico e bidirecional ([project/architecture-05]): uma linha por ligação, com tipo e id dos dois lados, lida pelos dois lados na mesma consulta. TDD contra PostgreSQL real em container. Rotas relativas (`/links`), montadas sob `/api/v1` pela TASK-18; a TASK-18 registra `router()`, `migrator()` e `openapi()` e instala o gancho.

**Decisões locais já tomadas.**

- Uma linha por ligação com os lados normalizados (o menor par tipo-id como `source`), com `CHECK` e `UNIQUE` no banco ([project/database-05]); descartadas duas linhas espelhadas, que podem divergir e quebrar o RN-10.
- Exclusão física: remover de um lado remove a única linha, logo some dos dois (RN-10); descartada exclusão lógica, sem lixeira de ligações na spec.
- Lista fechada de tipos ligáveis, igual no domínio e no `CHECK` ([project/security-09]): `account`, `transaction`, `transfer`, `goal`, `milestone`, `task`, `reminder`, `note`, `journal_entry`, `book`, `article`, `video`, `project`, `project_card`. As TASK-11 a TASK-14 usam `note`, `journal_entry`, `book`, `article`, `video`, `project` e `project_card` no gancho.
- Sem checar se o lado oposto existe ou é do dono: o contexto não lê tabelas de outros ([project/architecture-04]); a ligação é sempre do dono que a criou e só ele a vê, e o frontend resolve cada lado nos endpoints do contexto dele, que respondem 404 para dado alheio. Descartada uma porta de verificação por contexto, que acoplaria `links` a todos os módulos.
- Listagem por entidade com `linked_type` e `linked_id` (o lado oposto), para a aba "Conexões" (TASK-31) filtrar, agrupar e categorizar por tipo (RF-19).
- Remoção ao excluir uma entidade (CB-06) pelo gancho `EntityDeletedHook`, um `Arc<dyn Fn(owner_id, entity_type, entity_id)>` com grafia idêntica nos contextos que excluem, extraído como `Option<Extension<EntityDeletedHook>>` e chamado depois do commit; a TASK-18 instala `Extension(links::entity_deleted_hook(pool))`. Descartados chamar `links` direto (acopla e cria dependência entre tarefas da mesma onda) e `NOTIFY` do PostgreSQL (evento perdido sem ouvinte).

**Riscos técnicos.** Se o gancho falhar depois do commit da exclusão, a ligação fica órfã; o lado excluído responde 404 e o frontend o esconde. Qualquer diferença na grafia do alias nos outros contextos faz a `Extension` não casar e o gancho não rodar: os testes de cada contexto cobrem a chamada, e a TASK-18 deve cobrir a integração.

**Referências da spec.** RF-18, CT-13, RN-10, CB-06, RF-19 (consumido pela TASK-31); decisões 27, 53, 55 e 56; contrato `GET|POST /links` e `DELETE /links/{id}`.

**Arquivos em comum na onda 4.** Nenhum: a tarefa só cria arquivos sob `apps/server/src/links/`.

### Card

- **Título:** Contexto links
- **Tipo:** historia
- **Descrição:** Ligações bidirecionais genéricas no servidor: ligar qualquer entidade a outra, ver a ligação dos dois lados, remover dos dois e limpar as ligações quando uma entidade é excluída.
- **Critérios de aceite:**
  - [ ] Uma nota ligada a uma meta aparece nos dois lados.
  - [ ] Remover a ligação pela meta a remove dos dois lados.
  - [ ] A mesma ligação invertida não é duplicada.
  - [ ] Excluir uma entidade remove as ligações dela pelo gancho.
  - [ ] Ligações de outra pessoa respondem 404, com Row Level Security ativa.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-04

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: sonnet |
| 2 | 2026-10-30 | baseline | coletado | 3 comando(s); códigos de saída: 0, 0, 0; 2 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | ajuste | in_progress | Passo do repositório: queries parametrizadas checadas em execução (sqlx::query/query_as com .bind) no lugar das macros checadas na compilação, por decisão do usuário (1A); a troca pelas macros fica com a TASK-18 |
| 4 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 5 | 2026-10-31 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 6 | 2026-10-31 | retomada | validating | decisão do usuário: aceite do usuário (KNW-005): pasta links criada pela própria tarefa (defeito da issue 6); aceito(s): 1 |
| 7 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 8 | 2026-10-31 | regressão | passed | 2 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 9 | 2026-10-31 | evidências | passed | 2 evidência(s) em evidence/TASK-15/ |
| 10 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Passo do repositório: queries parametrizadas checadas em execução (sqlx::query/query_as com .bind) no lugar das macros checadas na compilação, por decisão do usuário (1A); a troca pelas macros fica com a TASK-18 |
