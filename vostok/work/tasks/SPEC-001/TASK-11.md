---
id: TASK-11
spec: SPEC-001
title: "Contexto notes"
profile: julgamento
persona: desenvolvedor
depends_on: [TASK-04]
wave: 4
covers: [RF-43, CT-26]
type: historia
labels: [SPEC-001, julgamento]
status: done
content_hash: 54c9095a78c434378ff8e90bd7ca6122b1e88aa8e0a97bd4b617956fe1e63e6a
adjustments: 1
adjusted_at: 2026-10-30T20:07:01Z
approved_at: 2026-10-30T14:38:10Z
approved_hash: 7507293f2a1ca54999214c29a0b17ed8dd4ac331928b4748208360bbfe36ed6e
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: opus
updated_at: 2026-10-30T20:07:01Z
---

# TASK-11: Contexto notes

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-43, CT-26, RNF-02, RNF-03, CB-06, contrato `GET|POST /notes`, campos comuns de toda entidade e decisões 13, 26, 53 a 56.
- `vostok/rules/project/architecture.md`
- `vostok/rules/project/security.md`
- `vostok/rules/project/database.md`
- `vostok/rules/project/api.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`
- `apps/server/Cargo.toml`: dependências já declaradas pela TASK-04 (`axum`, `sqlx`, `utoipa`, `thiserror`, `uuid`, `testcontainers`).
- `apps/server/src/main.rs`: como os módulos dos contextos são declarados (só leitura; não alterar).
- `apps/server/src/shared/mod.rs`: erro `problem+json`, gerador de UUID v7, relógio injetável, visibilidade, cifrador de campo e paginação por cursor opaco base64url (chave de ordenação + id) da TASK-04.
- `apps/server/src/http/mod.rs`: `AppState`, extrator do usuário autenticado, CSRF e auxiliar de testes de `apps/server/src/http` da TASK-04, que monta o app com sessão e CSRF e cria sessões de usuários de teste (só leitura; não alterar).
- `vostok/work/tasks/SPEC-001/TASK-15.md`: contrato do gancho `EntityDeletedHook` usado para remover as ligações ao excluir (CB-06).

### Mudar

- `apps/server/src/notes/mod.rs` (criar): declara as camadas e expõe `router()`, `migrator()`, `openapi()` e o `NoteReader` para a busca.
- `apps/server/src/notes/domain/mod.rs` (criar): módulo do domínio.
- `apps/server/src/notes/domain/note.rs` (criar): entidade `Note`, validação de título e corpo e testes unitários.
- `apps/server/src/notes/domain/error.rs` (criar): `NoteError` tipado com `thiserror`.
- `apps/server/src/notes/application/mod.rs` (criar): módulo da aplicação.
- `apps/server/src/notes/application/ports.rs` (criar): trait `NoteRepository` e alias `EntityDeletedHook`.
- `apps/server/src/notes/application/service.rs` (criar): `NoteService` (cadastrar, ver, listar, editar, excluir) e `NoteReader` (notas descriptografadas do dono).
- `apps/server/src/notes/infrastructure/mod.rs` (criar): módulo da infraestrutura.
- `apps/server/src/notes/infrastructure/pg_note_repository.rs` (criar): repositório PostgreSQL que cifra e decifra título e corpo.
- `apps/server/src/notes/interface/mod.rs` (criar): montagem do `router()`.
- `apps/server/src/notes/interface/dto.rs` (criar): corpos de requisição e resposta com `utoipa::ToSchema`.
- `apps/server/src/notes/interface/handlers.rs` (criar): handlers axum e conversão de `NoteError` em `problem+json`.
- `apps/server/src/notes/interface/openapi.rs` (criar): `NotesApi` (`utoipa::OpenApi`) do contexto.
- `apps/server/src/notes/migrations/20261101110001_create-notes.sql` (criar): tabela `notes`, índices e Row Level Security.
- `apps/server/src/notes/tests/mod.rs` (criar): módulo de testes de integração do contexto.
- `apps/server/src/notes/tests/api.rs` (criar): testes de integração HTTP contra PostgreSQL em container.

### Passos

1. Leia os arquivos de "Ler" e anote os nomes reais que a TASK-04 criou: o `AppState` e seus campos (pool, cifrador de campo, relógio, gerador de ids), o extrator do usuário autenticado, o tipo de erro `problem+json`, o enum de visibilidade, o tipo de paginação por cursor opaco base64url (chave de ordenação + id), o transação que abre com `set_config('app.current_user_id', $1, true)` e o auxiliar de testes de `apps/server/src/http` (sessões de usuários de teste com CSRF, pool PostgreSQL em container, app de teste, requisição autenticada com CSRF). Use esses nomes em todos os passos; não crie equivalentes no contexto.
2. Crie `apps/server/src/notes/migrations/20261101110001_create-notes.sql` com a tabela `notes`: `id UUID PRIMARY KEY`, `owner_id UUID NOT NULL`, `visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal','shared'))`, `title_ciphertext BYTEA NOT NULL`, `body_ciphertext BYTEA NOT NULL`, `created_at TIMESTAMPTZ NOT NULL`, `updated_at TIMESTAMPTZ NOT NULL`, `deleted_at TIMESTAMPTZ NULL`; índice `notes_owner_updated_idx ON notes (owner_id, updated_at DESC, id DESC) WHERE deleted_at IS NULL` e índice `notes_owner_created_idx ON notes (owner_id, created_at DESC, id DESC) WHERE deleted_at IS NULL`; `ALTER TABLE notes ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY`, com a política `notes_owner_isolation` comparando `owner_id` a `current_setting('app.current_user_id', true)::uuid` (`USING` e `WITH CHECK`). Sem coluna `tsvector` ([project/database-06]) e sem FK para tabelas de outro contexto ([project/architecture-04]).
3. Escreva primeiro os testes unitários em `apps/server/src/notes/domain/note.rs` (`#[cfg(test)] mod tests`), que devem falhar: `title_is_required`, `title_is_trimmed`, `title_longer_than_200_chars_is_rejected`, `body_longer_than_100000_chars_is_rejected`, `empty_body_is_accepted`, `edit_changes_updated_at_with_injected_clock`, `delete_sets_deleted_at_with_injected_clock`, `deleted_note_cannot_be_edited`.
4. Implemente `domain/error.rs` (`NoteError`: `NotFound`, `TitleRequired`, `TitleTooLong`, `BodyTooLong`, `Deleted`) e `domain/note.rs` (`Note` com `id`, `owner_id`, `visibility`, `title`, `body`, `created_at`, `updated_at`, `deleted_at`; construtor `Note::new`, `edit`, `delete`, recebendo o instante do relógio injetável), sem depender de `sqlx`, `axum` nem do cifrador ([project/architecture-03]). Rode `cargo test -p atria-server notes::domain` até passar.
5. Escreva os testes de integração em `apps/server/src/notes/tests/api.rs` (registrados em `tests/mod.rs` e em `mod.rs` com `#[cfg(test)] mod tests;`), montando `notes::router()` com o `AppState` de teste da TASK-04 e aplicando `notes::migrator()` no PostgreSQL do container, com relógio e ids fixos: `ct26_note_lifecycle_create_edit_delete` (POST 201, PATCH 200 com o novo título, DELETE 204, GET 404 `note_not_found` e ausência na listagem), `rnf03_note_content_is_not_stored_in_plain_text` (cria a nota com o marcador `marcador-secreto-ct26` no título e no corpo e confere com `SELECT title_ciphertext, body_ciphertext FROM notes` direto no banco que nenhum dos bytes contém o marcador), `other_user_note_returns_404_on_get_patch_delete`, `listing_paginates_by_cursor_and_filters_by_visibility`, `invalid_payload_returns_problem_json`, `deleting_note_calls_entity_deleted_hook` (camada `Extension<EntityDeletedHook>` que grava as chamadas e espera `(owner_id, "note", note_id)`), `delete_without_hook_still_succeeds`, `note_reader_returns_only_own_live_notes_decrypted`, `rls_is_enabled_on_notes_table` (`SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'notes'`). Rode e confirme que falham.
6. Em `application/ports.rs`, declare o trait `NoteRepository` (`insert`, `update`, `find_live`, `list_live` com cursor, filtro `visibility` e ordenação `updated_at` ou `created_at`, `soft_delete`, `all_live_for_owner`) e o alias `pub type EntityDeletedHook = std::sync::Arc<dyn Fn(uuid::Uuid, &'static str, uuid::Uuid) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync>;`, com os argumentos `(owner_id, entity_type, entity_id)`, escrito exatamente como na TASK-15 para ser o mesmo tipo na `Extension`, e um comentário dizendo por que a grafia tem de ser idêntica.
7. Em `application/service.rs`, implemente `NoteService` com os casos de uso `create`, `get`, `list`, `edit` e `delete`, sempre filtrando por `owner_id` do usuário autenticado ([project/security-04]), e `NoteReader::decrypted_notes_for_owner(owner_id) -> Result<Vec<DecryptedNote>, NoteError>`, com `DecryptedNote { id, title, body, visibility, created_at, updated_at }`, só das notas não excluídas do próprio dono: é o serviço que a TASK-16 usa para a busca em memória.
8. Em `infrastructure/pg_note_repository.rs`, implemente `PgNoteRepository` com o pool e o cifrador de campo do `AppState`: cifra título e corpo antes do `INSERT`/`UPDATE` e decifra depois do `SELECT`, com o dado associado `notes.title:<id>` e `notes.body:<id>` quando o cifrador da TASK-04 aceitar dado associado. Queries parametrizadas com `sqlx::query`/`sqlx::query_as` e `.bind` (checadas em execução, sem SQL montado por concatenação; a troca pelas macros checadas na compilação, exigidas por [project/stack-04], fica com a TASK-18, que gera a pasta `.sqlx`), dentro do transação que abre com `set_config('app.current_user_id', $1, true)`. Exclusão lógica com `deleted_at` ([project/database-08]).
9. Em `interface/dto.rs`, declare `CreateNoteRequest { title, body, visibility? }`, `UpdateNoteRequest { title?, body?, visibility? }`, `NoteResponse` (campos comuns + `title`, `body`) e `NoteListQuery { cursor?, limit? (1 a 100, padrão 50), visibility?, sort? (updated_at | created_at) }`, com `serde` em `snake_case` e `utoipa::ToSchema`/`IntoParams`.
10. Em `interface/handlers.rs`, implemente `POST /notes` (201), com caminhos relativos (a TASK-18 monta sob `/api/v1`), `GET /notes` (lista com cursor no formato de paginação da TASK-04), `GET /notes/{id}` (200), `PATCH /notes/{id}` (200) e `DELETE /notes/{id}` (204), cada um com `#[utoipa::path]`. O `DELETE` extrai `Option<Extension<EntityDeletedHook>>` e, depois do commit, chama o gancho com `(owner_id, "note", id)`. Converta `NoteError` em `problem+json` só aqui ([project/code-style-03]), com os códigos `note_not_found` (404, também para nota de outro usuário), `validation_failed` (422). Nenhum `tracing` registra título nem corpo, só ids ([project/security-13]).
11. Em `interface/openapi.rs`, declare `#[derive(utoipa::OpenApi)] pub struct NotesApi` com os paths e schemas do contexto; em `interface/mod.rs`, monte o `Router<AppState>` com as cinco rotas.
12. Em `apps/server/src/notes/mod.rs`, declare `domain`, `application`, `infrastructure`, `interface` e `#[cfg(test)] mod tests`, e exponha `pub fn router() -> axum::Router<AppState>`, `pub fn migrator() -> sqlx::migrate::Migrator` (`sqlx::migrate!("src/notes/migrations")`), `pub fn openapi() -> utoipa::openapi::OpenApi` e `pub use application::service::{NoteReader, DecryptedNote}`. Não altere `apps/server/src/main.rs` nem `apps/server/src/http`: o `mod notes;` já é declarado em `apps/server/src/main.rs` pela TASK-04, e esta tarefa só cria `apps/server/src/notes/mod.rs`. Se ela ainda não existir e `cargo test -p atria-server notes:: -- --list` não listar os testes, **PARE** e peça o ajuste da tarefa (skill `adjust-task`) em vez de mexer nesses arquivos.
13. Rode os comandos da Verificação até todos passarem, com Docker disponível para o testcontainers.

### Baseline

- `test -d apps/server/src/notes && echo existe || echo ausente`
- `cargo test -q -p atria-server shared:: 2>/dev/null`
- `cargo test -q -p atria-server http:: 2>/dev/null`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
cargo test -p atria-server notes:: -- --list | grep -q 'notes::tests::api::ct26_note_lifecycle_create_edit_delete'
cargo test -p atria-server notes::
cargo test -p atria-server notes::tests::api::rnf03_note_content_is_not_stored_in_plain_text -- --exact
! grep -rnE '(trace|debug|info|warn|error)!\(.*\b(title|body)\b' apps/server/src/notes
```

Resultado esperado: formatação e clippy sem aviso, `test result: ok` nos testes do contexto, o teste de criptografia em repouso passando e nenhum log com título ou corpo.

### Evidências

- `notes-tests.txt` (automática): `cargo test -p atria-server notes::`
  - Prova: os testes unitários e de integração do contexto notes passam: ciclo de vida, autorização, paginação, gancho de ligações, leitor da busca e RLS (RF-43, CT-26, RNF-02, CB-06).
  - Trecho: as linhas `test notes::tests::api::ct26_note_lifecycle_create_edit_delete ... ok`, `test notes::tests::api::other_user_note_returns_404_on_get_patch_delete ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED` ou `running 0 tests` (contexto inexistente).
- `notes-encryption-at-rest.txt` (automática): `cargo test -p atria-server notes::tests::api::rnf03_note_content_is_not_stored_in_plain_text -- --exact`
  - Prova: título e corpo ficam cifrados no PostgreSQL, sem o texto em claro (RNF-03, [project/security-18]).
  - Trecho: `test notes::tests::api::rnf03_note_content_is_not_stored_in_plain_text ... ok` e `test result: ok. 1 passed`.
  - Falha: `FAILED`, ou `0 passed` (teste ausente).

### Concluída quando

- [x] A API cria, edita e exclui uma nota, e a nota excluída não aparece mais na leitura nem na listagem (RF-43, CT-26).

  > Como comprovar: rodar `cargo test -p atria-server notes::` e ver `ct26_note_lifecycle_create_edit_delete ... ok` em `notes-tests.txt`.

- [x] Título e corpo da nota ficam criptografados em repouso: lendo a tabela direto no banco, o texto em claro não aparece (RNF-03).

  > Como comprovar: ver `rnf03_note_content_is_not_stored_in_plain_text ... ok` em `notes-encryption-at-rest.txt`.

- [x] Uma pessoa não lê, não altera e não exclui a nota de outra: a resposta é 404, e a tabela tem Row Level Security ativa (RNF-02).

  > Como comprovar: ver `other_user_note_returns_404_on_get_patch_delete ... ok` e `rls_is_enabled_on_notes_table ... ok` em `notes-tests.txt`.

- [x] Excluir uma nota avisa o contexto de ligações pelo gancho, sem depender dele, para as ligações sumirem dos dois lados (CB-06).

  > Como comprovar: ver `deleting_note_calls_entity_deleted_hook ... ok` e `delete_without_hook_still_succeeds ... ok` em `notes-tests.txt`.

- [x] O contexto oferece à busca as notas descriptografadas só do próprio dono, sem a busca ler a tabela de notas (RF-43).

  > Como comprovar: ver `note_reader_returns_only_own_live_notes_decrypted ... ok` em `notes-tests.txt`.

- [x] O contexto expõe `router()`, `migrator()` e `openapi()` e não altera `apps/server/src/main.rs` nem `apps/server/src/http` (RF-43).

  > Como comprovar: abrir `apps/server/src/notes/mod.rs` e ver as três funções públicas; conferir que a lista de arquivos alterados só tem caminhos sob `apps/server/src/notes/`.

- [x] O código passa limpo em `cargo fmt --check` e `cargo clippy -- -D warnings`, sem log de título ou corpo, e as camadas `domain` e `application` do contexto têm pelo menos 80% de cobertura (RF-43).

  > Como comprovar: rodar a Verificação e ver todos os comandos terminando sem erro; rodar `cargo llvm-cov -p atria-server --summary-only -- notes::` e ver 80% ou mais nas linhas dos arquivos de `notes/domain` e `notes/application`.

## Descrição

### Resumo executivo

Entrega no servidor o módulo de Notas: criar, editar, ver, listar e excluir notas independentes, com o conteúdo guardado criptografado, de modo que nem quem acessa o banco lê o texto.
Também oferece à busca global as notas da própria pessoa, já legíveis, sem abrir o conteúdo de mais ninguém.
Perfil julgamento: envolve dados pessoais sensíveis e decisões de privacidade; o risco é alto, pois um erro aqui expõe texto pessoal ou torna as notas ilegíveis.
Depende do núcleo do servidor e libera a busca global, a integração do servidor e as telas de Notas.

### Detalhes técnicos

**Abordagem.** Contexto DDD `apps/server/src/notes` com `domain` puro, `application` com portas, `infrastructure` PostgreSQL e `interface` axum + `utoipa`, testado em TDD contra PostgreSQL real em container ([project/testing-02]). Expõe `router()`, `migrator()` e `openapi()`; a TASK-18 registra tudo em `main.rs` e `http`. Rotas relativas (`/notes`): a TASK-18 monta o `router()` e o `openapi()` sob `/api/v1` ([project/api-01]).

**Decisões (perfil julgamento: alternativas e critério de escolha).**

| Decisão | Escolhida | Alternativas descartadas | Critério |
|---|---|---|---|
| Onde cifrar | No adaptador `PgNoteRepository`, com o cifrador de campo da TASK-04 | Na aplicação (vaza detalhe de persistência para os casos de uso); no banco com `pgcrypto` (a chave passaria pelo PostgreSQL e por logs de query, contra [project/security-18]) | Chave fora do banco e domínio sem dependência de criptografia ([project/architecture-03]). |
| O que cifrar | Título e corpo | Título em claro para ordenar e listar | O título também é conteúdo pessoal e a busca precisa dele de qualquer forma (RNF-03). |
| Dado associado (AAD) | `notes.<coluna>:<id>`, se o cifrador aceitar | Sem AAD | Impede trocar o texto cifrado entre linhas ou colunas sem detecção. |
| Busca textual | Só pela busca global (TASK-16), via `NoteReader` | `q` na listagem, descriptografando a cada página | Um único caminho de descriptografia em memória, medido no RNF-04; a listagem fica só com filtro, ordenação e cursor. |
| Remover ligações ao excluir (CB-06) | Gancho `EntityDeletedHook` opcional via `Extension`, chamado depois do commit | Chamar o contexto `links` direto (acopla e cria dependência da TASK-15); `NOTIFY` do PostgreSQL (evento perdido sem ouvinte e difícil de testar) | Sem acoplamento ([project/architecture-04]) e testável com um gancho falso; a TASK-18 instala o gancho real. |
| Exclusão | Lógica, com `deleted_at` | Física | Lixeira prevista em [project/database-08]; o texto continua cifrado. |
| Isolamento | Filtro por `owner_id` na query + RLS | Só RLS, ou só aplicação | Defesa em duas camadas ([project/security-04], [project/database-09]). |

**Riscos técnicos.** Perda da chave torna as notas ilegíveis (backup da chave documentado na TASK-36). Descriptografar tudo em memória pode ficar lento com muito volume (medido na TASK-16 pelo RNF-04). O alias `EntityDeletedHook` precisa ter exatamente a mesma grafia da TASK-15 para a `Extension` casar. As rotas são relativas, e o prefixo `/api/v1` é da TASK-18.

**Referências da spec.** RF-43, CT-26, RNF-02, RNF-03, CB-06, RN-17; decisões 13, 26, 53, 55 e 56; contratos `GET|POST /notes` e campos comuns de entidade.

**Arquivos em comum na onda 4.** Nenhum: a tarefa só cria arquivos sob `apps/server/src/notes/`.

### Card

- **Título:** Contexto notes
- **Tipo:** historia
- **Descrição:** Módulo de Notas no servidor: cadastro, edição, listagem e exclusão de notas com conteúdo criptografado em repouso, e leitura descriptografada do próprio dono para a busca global.
- **Critérios de aceite:**
  - [ ] A nota passa pelo ciclo criar, editar e excluir, e some depois de excluída.
  - [ ] Título e corpo não aparecem em claro no banco.
  - [ ] Nota de outra pessoa responde 404, com Row Level Security ativa.
  - [ ] A exclusão avisa o contexto de ligações pelo gancho.
  - [ ] A busca recebe só as notas do próprio dono, descriptografadas.
- **Rótulos:** SPEC-001, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-04

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: opus |
| 2 | 2026-10-30 | baseline | coletado | 3 comando(s); códigos de saída: 0, 0, 0; 2 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | ajuste | in_progress | Passo do repositório: queries parametrizadas checadas em execução (sqlx::query/query_as com .bind) no lugar das macros checadas na compilação, por decisão do usuário (1A); a troca pelas macros fica com a TASK-18 |
| 4 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 5 | 2026-10-30 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 6 | 2026-10-30 | retomada | validating | decisão do usuário: aceite do usuário (KNW-005): pasta notes criada pela própria tarefa (defeito da issue 6); aceito(s): 1 |
| 7 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 8 | 2026-10-30 | regressão | passed | 2 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 9 | 2026-10-30 | evidências | passed | 2 evidência(s) em evidence/TASK-11/ |
| 10 | 2026-10-30 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Passo do repositório: queries parametrizadas checadas em execução (sqlx::query/query_as com .bind) no lugar das macros checadas na compilação, por decisão do usuário (1A); a troca pelas macros fica com a TASK-18 |
