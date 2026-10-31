---
id: TASK-12
spec: SPEC-001
title: "Contexto journal"
profile: julgamento
persona: desenvolvedor
depends_on: [TASK-04]
wave: 4
covers: [RF-44, RF-45, RF-46, CT-27]
type: historia
labels: [SPEC-001, julgamento]
status: done
content_hash: 6a75cde35124a80ea17439d3f80d63637a66e2bb86a9558531ecdbbc9f978c05
adjustments: 1
adjusted_at: 2026-10-30T20:07:26Z
approved_at: 2026-10-30T14:38:10Z
approved_hash: bc4a623598e170490d40198ebd4c3176b26909366197b5ea14e2f01e3a47a79b
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: opus
updated_at: 2026-10-30T20:07:26Z
---

# TASK-12: Contexto journal

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-44, RF-45, RF-46, CT-27, RNF-02, RNF-03, CB-06, contratos `GET|POST /journal-entries` e `GET|POST /emotions`, fluxo principal (passo 9) e decisões 6, 13, 28, 53 a 56.
- `vostok/rules/project/architecture.md`
- `vostok/rules/project/security.md`
- `vostok/rules/project/database.md`
- `vostok/rules/project/api.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`
- `vostok/rules/project/language.md`
- `apps/server/Cargo.toml`: dependências já declaradas pela TASK-04.
- `apps/server/src/main.rs`: como os módulos dos contextos são declarados (só leitura; não alterar).
- `apps/server/src/shared/mod.rs`: erro `problem+json`, UUID v7, relógio injetável, visibilidade, cifrador de campo e paginação por cursor opaco base64url (chave de ordenação + id) da TASK-04.
- `apps/server/src/http/mod.rs`: `AppState`, extrator do usuário autenticado e auxiliar de testes de `apps/server/src/http` da TASK-04, que monta o app com sessão e CSRF e cria sessões de usuários de teste (só leitura; não alterar).
- `vostok/work/tasks/SPEC-001/TASK-15.md`: contrato do gancho `EntityDeletedHook` (CB-06).
- `vostok/work/tasks/SPEC-001/TASK-11.md`: mesmo padrão de criptografia, gancho e leitor para a busca, usado em notes.

### Mudar

- `apps/server/src/journal/mod.rs` (criar): declara as camadas e expõe `router()`, `migrator()`, `openapi()` e o `JournalReader` para a busca e os relatórios.
- `apps/server/src/journal/domain/mod.rs` (criar): módulo do domínio.
- `apps/server/src/journal/domain/journal_entry.rs` (criar): entidade `JournalEntry` com emoções e intensidade, e testes unitários.
- `apps/server/src/journal/domain/emotion.rs` (criar): entidade `Emotion`, lista padrão e testes unitários.
- `apps/server/src/journal/domain/error.rs` (criar): `JournalError` tipado com `thiserror`.
- `apps/server/src/journal/application/mod.rs` (criar): módulo da aplicação.
- `apps/server/src/journal/application/ports.rs` (criar): traits `JournalEntryRepository` e `EmotionRepository` e alias `EntityDeletedHook`.
- `apps/server/src/journal/application/entries.rs` (criar): casos de uso das entradas e `JournalReader`.
- `apps/server/src/journal/application/emotions.rs` (criar): casos de uso da lista de emoções, com a semeadura da lista padrão.
- `apps/server/src/journal/infrastructure/mod.rs` (criar): módulo da infraestrutura.
- `apps/server/src/journal/infrastructure/pg_journal_entry_repository.rs` (criar): repositório das entradas, cifrando e decifrando o texto.
- `apps/server/src/journal/infrastructure/pg_emotion_repository.rs` (criar): repositório das emoções.
- `apps/server/src/journal/interface/mod.rs` (criar): montagem do `router()`.
- `apps/server/src/journal/interface/dto.rs` (criar): corpos de requisição e resposta com `utoipa::ToSchema`.
- `apps/server/src/journal/interface/handlers.rs` (criar): handlers axum e conversão de `JournalError` em `problem+json`.
- `apps/server/src/journal/interface/openapi.rs` (criar): `JournalApi` (`utoipa::OpenApi`) do contexto.
- `apps/server/src/journal/migrations/20261101120001_create-journal.sql` (criar): tabelas `emotions`, `journal_entries` e `journal_entry_emotions`, índices e Row Level Security.
- `apps/server/src/journal/tests/mod.rs` (criar): módulo de testes de integração do contexto.
- `apps/server/src/journal/tests/api.rs` (criar): testes de integração HTTP contra PostgreSQL em container.

### Passos

1. Leia os arquivos de "Ler" e anote os nomes reais que a TASK-04 criou: `AppState` e seus campos (pool, cifrador de campo, relógio, gerador de ids), extrator do usuário autenticado, erro `problem+json`, enum de visibilidade, paginação por cursor opaco base64url (chave de ordenação + id), transação que abre com `set_config('app.current_user_id', $1, true)` e auxiliar de testes de `apps/server/src/http` (sessões de usuários de teste com CSRF, pool em container, app de teste, requisição autenticada com CSRF). Use esses nomes; não crie equivalentes.
2. Crie `apps/server/src/journal/migrations/20261101120001_create-journal.sql`:
   - `emotions`: `id UUID PRIMARY KEY`, `owner_id UUID NOT NULL`, `visibility TEXT NOT NULL DEFAULT 'personal' CHECK (visibility IN ('personal','shared'))`, `system_key TEXT NULL CHECK (system_key IN ('joy','sadness','anger','fear','anxiety','calm','gratitude'))`, `name TEXT NULL CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 50)`, `CHECK (system_key IS NOT NULL OR name IS NOT NULL)`, `created_at`, `updated_at`, `deleted_at TIMESTAMPTZ NULL`; índices únicos `emotions_owner_name_uniq ON emotions (owner_id, lower(name)) WHERE deleted_at IS NULL AND name IS NOT NULL` e `emotions_owner_system_key_uniq ON emotions (owner_id, system_key) WHERE system_key IS NOT NULL`.
   - `journal_entries`: `id UUID PRIMARY KEY`, `owner_id UUID NOT NULL`, `visibility` (mesmo `CHECK`), `occurred_at TIMESTAMPTZ NOT NULL`, `text_ciphertext BYTEA NOT NULL`, `created_at`, `updated_at`, `deleted_at TIMESTAMPTZ NULL`; índice `journal_entries_owner_occurred_idx ON journal_entries (owner_id, occurred_at DESC, id DESC) WHERE deleted_at IS NULL`.
   - `journal_entry_emotions`: `entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE`, `emotion_id UUID NOT NULL REFERENCES emotions(id)`, `owner_id UUID NOT NULL`, `intensity SMALLINT NULL CHECK (intensity BETWEEN 1 AND 5)`, `PRIMARY KEY (entry_id, emotion_id)`; índice `journal_entry_emotions_emotion_idx ON journal_entry_emotions (emotion_id)` ([project/database-07]).
   - `ENABLE` e `FORCE ROW LEVEL SECURITY` nas três tabelas, com políticas `<tabela>_owner_isolation` comparando `owner_id` a `current_setting('app.current_user_id', true)::uuid` (`USING` e `WITH CHECK`). Sem `tsvector` ([project/database-06]) e sem FK para tabelas de outro contexto.
3. Escreva primeiro os testes unitários, que devem falhar. Em `domain/journal_entry.rs`: `text_is_required`, `text_longer_than_100000_chars_is_rejected`, `intensity_must_be_between_1_and_5`, `intensity_is_optional`, `entry_rejects_duplicate_emotion`, `entry_accepts_many_emotions`, `occurred_at_is_kept_in_utc`, `edit_changes_updated_at_with_injected_clock`, `delete_sets_deleted_at_with_injected_clock`. Em `domain/emotion.rs`: `emotion_name_is_trimmed_and_limited_to_50_chars`, `default_list_has_seven_system_emotions`, `renaming_system_emotion_keeps_system_key`.
4. Implemente `domain/error.rs` (`JournalError`: `EntryNotFound`, `EmotionNotFound`, `UnknownEmotion`, `TextRequired`, `TextTooLong`, `InvalidIntensity`, `DuplicateEmotion`, `EmotionNameTaken`, `InvalidEmotionName`), `domain/journal_entry.rs` (`JournalEntry` com `id`, `owner_id`, `visibility`, `occurred_at: DateTime<Utc>`, `text`, `emotions: Vec<EntryEmotion { emotion_id, intensity: Option<u8> }>`, `created_at`, `updated_at`, `deleted_at`) e `domain/emotion.rs` (`Emotion` com `system_key: Option<SystemEmotion>` e `name: Option<String>`; `SystemEmotion::ALL` com `joy`, `sadness`, `anger`, `fear`, `anxiety`, `calm` e `gratitude`), sem `sqlx`, `axum` nem cifrador. Rode `cargo test -p atria-server journal::domain` até passar.
5. Escreva os testes de integração em `apps/server/src/journal/tests/api.rs` (registrados em `tests/mod.rs` e em `mod.rs` com `#[cfg(test)] mod tests;`), com `journal::router()` sobre o `AppState` de teste, `journal::migrator()` aplicado no container e relógio e ids fixos: `ct27_two_entries_same_day_with_emotions_and_intensity` (duas entradas em 2026-11-05, às 08:00 e às 21:30 UTC, uma com `anxiety` intensidade 4 e outra com duas emoções sem intensidade; a listagem do dia devolve as duas com data, hora e emoções), `ct27_new_emotion_appears_in_list`, `rf46_emotion_can_be_renamed_and_deleted`, `default_emotions_are_seeded_once` (o primeiro `GET /emotions` cria as sete; excluir todas e listar de novo não recria), `deleted_emotion_stays_on_past_entries` (a entrada antiga continua mostrando a emoção com `deleted: true`; nova entrada com ela é recusada), `entry_with_other_users_emotion_is_rejected` (422 `unknown_emotion`), `intensity_out_of_range_is_rejected` (422 `validation_failed`), `rnf03_journal_text_is_not_stored_in_plain_text` (marcador `marcador-secreto-ct27` e `SELECT text_ciphertext FROM journal_entries` direto no banco sem o marcador), `other_user_entry_and_emotion_return_404`, `listing_filters_by_period_and_emotion_with_cursor`, `deleting_entry_calls_entity_deleted_hook` (espera `(owner_id, "journal_entry", entry_id)`), `delete_without_hook_still_succeeds`, `journal_reader_returns_only_own_live_entries_decrypted`, `rls_is_enabled_on_journal_tables`. Rode e confirme que falham.
6. Em `application/ports.rs`, declare `JournalEntryRepository` (`insert`, `update`, `find_live`, `list_live` com cursor, `from`, `to`, `emotion_id` e `visibility`, `soft_delete`, `all_live_for_owner`), `EmotionRepository` (`list_live`, `count_all_including_deleted`, `insert_many`, `insert`, `update`, `soft_delete`, `find_live_ids_for_owner`) e o alias `pub type EntityDeletedHook = std::sync::Arc<dyn Fn(uuid::Uuid, &'static str, uuid::Uuid) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> + Send + Sync>;`, com os argumentos `(owner_id, entity_type, entity_id)`, escrito exatamente como na TASK-15, com um comentário dizendo por que a grafia tem de ser idêntica.
7. Em `application/emotions.rs`, implemente `EmotionService` (`list`, `create`, `rename`, `delete`); `list` semeia as sete emoções de `SystemEmotion::ALL` (com `name` nulo) só quando `count_all_including_deleted` for zero, na mesma transação. Exclusão lógica: a emoção some da lista e de novas entradas, mas continua ligada às entradas antigas.
8. Em `application/entries.rs`, implemente `JournalEntryService` (`create`, `get`, `list`, `edit`, `delete`), validando que toda `emotion_id` existe, é do dono e não foi excluída (senão `UnknownEmotion`), e `JournalReader::decrypted_entries_for_owner(owner_id) -> Result<Vec<DecryptedJournalEntry>, JournalError>`, com `DecryptedJournalEntry { id, occurred_at, text, emotions, visibility, created_at, updated_at }`, só das entradas não excluídas do próprio dono: é o serviço que a TASK-16 (busca em memória) e a TASK-17 (relatório do Diário) usam.
9. Em `infrastructure/`, implemente `PgJournalEntryRepository` (cifra o texto antes do `INSERT`/`UPDATE` e decifra depois do `SELECT`, com o dado associado `journal_entries.text:<id>` quando o cifrador aceitar; grava e substitui as linhas de `journal_entry_emotions` na mesma transação) e `PgEmotionRepository`, com queries parametrizadas com `sqlx::query`/`sqlx::query_as` e `.bind` (checadas em execução, sem SQL montado por concatenação; a troca pelas macros checadas na compilação, exigidas por [project/stack-04], fica com a TASK-18, que gera a pasta `.sqlx`), dentro do transação que abre com `set_config('app.current_user_id', $1, true)`, e exclusão lógica com `deleted_at`.
10. Em `interface/dto.rs`, declare `CreateJournalEntryRequest { occurred_at (RFC 3339 com fuso), text, emotions: [{ emotion_id, intensity? }], visibility? }`, `UpdateJournalEntryRequest` (todos opcionais; `emotions` substitui a lista), `JournalEntryResponse` (campos comuns + `occurred_at` em UTC, `text`, `emotions: [{ emotion_id, system_key, name, intensity, deleted }]`), `JournalEntryListQuery { cursor?, limit? (1 a 100, padrão 50), from?, to?, emotion_id?, visibility? }`, `CreateEmotionRequest { name, visibility? }`, `UpdateEmotionRequest { name }` e `EmotionResponse` (campos comuns + `system_key`, `name`), em `snake_case` com `utoipa::ToSchema`/`IntoParams`. O nome das emoções padrão vem nulo: a tradução é do frontend ([project/language-06]).
11. Em `interface/handlers.rs`, implemente `POST|GET /journal-entries` (caminhos relativos; a TASK-18 monta sob `/api/v1`), `GET|PATCH|DELETE /journal-entries/{id}`, `GET|POST /emotions` e `PATCH|DELETE /emotions/{id}`, com `#[utoipa::path]`. O `DELETE` da entrada extrai `Option<Extension<EntityDeletedHook>>` e, depois do commit, chama o gancho com `(owner_id, "journal_entry", id)`. Códigos de erro: `journal_entry_not_found` e `emotion_not_found` (404, também para dado de outro usuário), `unknown_emotion`, `emotion_name_taken` e `validation_failed` (422). Nenhum `tracing` registra texto nem nome de emoção, só ids ([project/security-13]).
12. Em `interface/openapi.rs`, declare `#[derive(utoipa::OpenApi)] pub struct JournalApi`; em `interface/mod.rs`, monte o `Router<AppState>`; em `mod.rs`, exponha `pub fn router() -> axum::Router<AppState>`, `pub fn migrator() -> sqlx::migrate::Migrator` (`sqlx::migrate!("src/journal/migrations")`), `pub fn openapi() -> utoipa::openapi::OpenApi` e `pub use application::entries::{JournalReader, DecryptedJournalEntry}`.
13. Não altere `apps/server/src/main.rs` nem `apps/server/src/http`: o `mod journal;` já é declarado em `apps/server/src/main.rs` pela TASK-04, e esta tarefa só cria `apps/server/src/journal/mod.rs`. Se `cargo test -p atria-server journal:: -- --list` não listar os testes por falta dessa declaração, **PARE** e peça o ajuste da tarefa (skill `adjust-task`).
14. Rode os comandos da Verificação até todos passarem, com Docker disponível para o testcontainers.

### Baseline

- `test -d apps/server/src/journal && echo existe || echo ausente`
- `cargo test -q -p atria-server shared:: 2>/dev/null`
- `cargo test -q -p atria-server http:: 2>/dev/null`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
cargo test -p atria-server journal:: -- --list | grep -q 'journal::tests::api::ct27_two_entries_same_day_with_emotions_and_intensity'
cargo test -p atria-server journal::
cargo test -p atria-server journal::tests::api::rnf03_journal_text_is_not_stored_in_plain_text -- --exact
! grep -rnE '(trace|debug|info|warn|error)!\(.*\b(text|name)\b' apps/server/src/journal
```

Resultado esperado: formatação e clippy sem aviso, `test result: ok` nos testes do contexto, o teste de criptografia em repouso passando e nenhum log com texto ou nome de emoção.

### Evidências

- `journal-tests.txt` (automática): `cargo test -p atria-server journal::`
  - Prova: os testes unitários e de integração do Diário passam: várias entradas por dia, emoções com intensidade, lista editável, autorização, gancho de ligações, leitor da busca e RLS (RF-44, RF-45, RF-46, CT-27, RNF-02, CB-06).
  - Trecho: as linhas `test journal::tests::api::ct27_two_entries_same_day_with_emotions_and_intensity ... ok`, `test journal::tests::api::ct27_new_emotion_appears_in_list ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED` ou `running 0 tests` (contexto inexistente).
- `journal-encryption-at-rest.txt` (automática): `cargo test -p atria-server journal::tests::api::rnf03_journal_text_is_not_stored_in_plain_text -- --exact`
  - Prova: o texto das entradas fica cifrado no PostgreSQL, sem o texto em claro (RNF-03, [project/security-18]).
  - Trecho: `test journal::tests::api::rnf03_journal_text_is_not_stored_in_plain_text ... ok` e `test result: ok. 1 passed`.
  - Falha: `FAILED`, ou `0 passed` (teste ausente).

### Concluída quando

- [x] O Diário aceita várias entradas no mesmo dia, cada uma com data, hora e texto (RF-44, CT-27).

  > Como comprovar: rodar `cargo test -p atria-server journal::` e ver `ct27_two_entries_same_day_with_emotions_and_intensity ... ok` em `journal-tests.txt`.

- [x] Cada entrada recebe uma ou mais emoções, com intensidade opcional de 1 a 5, e intensidade fora disso é recusada (RF-45, CT-27).

  > Como comprovar: ver `ct27_two_entries_same_day_with_emotions_and_intensity ... ok` e `intensity_out_of_range_is_rejected ... ok` em `journal-tests.txt`.

- [x] A pessoa edita a própria lista de emoções: a lista padrão aparece uma vez, uma emoção nova entra na lista, e renomear e excluir funcionam sem apagar o histórico das entradas antigas (RF-46, CT-27).

  > Como comprovar: ver `ct27_new_emotion_appears_in_list`, `rf46_emotion_can_be_renamed_and_deleted`, `default_emotions_are_seeded_once` e `deleted_emotion_stays_on_past_entries` com `ok` em `journal-tests.txt`.

- [x] O texto das entradas fica criptografado em repouso: lendo a tabela direto no banco, o texto em claro não aparece (RNF-03).

  > Como comprovar: ver `rnf03_journal_text_is_not_stored_in_plain_text ... ok` em `journal-encryption-at-rest.txt`.

- [x] Uma pessoa não lê nem altera entradas e emoções de outra, nem usa a emoção de outra numa entrada: a resposta é 404 ou 422, e as tabelas têm Row Level Security ativa (RNF-02).

  > Como comprovar: ver `other_user_entry_and_emotion_return_404`, `entry_with_other_users_emotion_is_rejected` e `rls_is_enabled_on_journal_tables` com `ok` em `journal-tests.txt`.

- [x] Excluir uma entrada avisa o contexto de ligações pelo gancho, e a busca e os relatórios recebem só as entradas do próprio dono, descriptografadas (RF-44, CB-06).

  > Como comprovar: ver `deleting_entry_calls_entity_deleted_hook`, `delete_without_hook_still_succeeds` e `journal_reader_returns_only_own_live_entries_decrypted` com `ok` em `journal-tests.txt`.

- [x] O contexto expõe `router()`, `migrator()` e `openapi()`, não altera `apps/server/src/main.rs` nem `apps/server/src/http`, passa limpo em `cargo fmt --check` e `cargo clippy -- -D warnings`, sem log de conteúdo, e as camadas `domain` e `application` têm pelo menos 80% de cobertura (RF-44, RF-45, RF-46).

  > Como comprovar: rodar a Verificação e ver todos os comandos terminando sem erro; abrir `apps/server/src/journal/mod.rs` e ver as três funções públicas; rodar `cargo llvm-cov -p atria-server --summary-only -- journal::` e ver 80% ou mais nos arquivos de `journal/domain` e `journal/application`.

## Descrição

### Resumo executivo

Entrega no servidor o Diário: várias entradas por dia com data, hora e texto, emoções marcadas com intensidade opcional e uma lista de emoções que cada pessoa edita.
O texto das entradas fica criptografado, e a busca e os relatórios recebem só as entradas da própria pessoa, já legíveis.
Perfil julgamento: são os dados mais sensíveis do produto e há decisões de privacidade e de modelagem das emoções; o risco é alto.
Depende do núcleo do servidor e libera a busca global, os relatórios, a integração do servidor e as telas do Diário.

### Detalhes técnicos

**Abordagem.** Contexto DDD `apps/server/src/journal` no mesmo padrão da TASK-11 (cifra no adaptador, gancho de exclusão e leitor descriptografado), com duas agregações: `JournalEntry` (com as emoções marcadas) e `Emotion` (lista do usuário). TDD contra PostgreSQL real em container. Rotas relativas (`/journal-entries` e `/emotions`), montadas sob `/api/v1` pela TASK-18; a TASK-18 registra o `router()`, o `migrator()` e o `openapi()`.

**Decisões (perfil julgamento: alternativas e critério de escolha).**

| Decisão | Escolhida | Alternativas descartadas | Critério |
|---|---|---|---|
| O que cifrar | O texto da entrada | Também os nomes das emoções e a associação entrada x emoção | O texto é o conteúdo do diário (RNF-03); cifrar a lista de emoções impediria o `UNIQUE` por pessoa no banco ([project/database-05]) e a agregação do relatório. Risco aceito e registrado: quem acessa o banco vê quais emoções e quando, mitigado por RLS e acesso restrito ao banco; revisável numa spec futura. |
| Data e hora | `occurred_at TIMESTAMPTZ` em UTC, enviado com fuso | Colunas `date` e `time` locais | [project/code-style-06]: UTC no banco, fuso do usuário só na apresentação. |
| Lista padrão de emoções | Sete emoções com `system_key` e `name` nulo, semeadas no primeiro acesso | Semear no cadastro (acopla ao contexto auth); sem lista padrão (o fluxo principal marca "ansiedade" sem criar) | Sem acoplamento ([project/architecture-04]) e tradução pelo frontend ([project/language-06]); não recria se a pessoa apagou todas. |
| Excluir emoção em uso | Exclusão lógica: some da lista e de novas entradas, fica nas antigas | Recusar a exclusão; apagar das entradas | Preserva o histórico e mantém a lista editável (RF-46). |
| Intensidade | `SMALLINT` de 1 a 5, opcional | Escala 1 a 10 ou texto livre | Escala curta, com `CHECK` no banco e validação no domínio. |
| Remover ligações (CB-06) | Gancho `EntityDeletedHook` via `Extension`, depois do commit | Chamar `links` direto; `NOTIFY` | Mesmo critério da TASK-11: sem acoplamento e testável. |
| Busca textual | Só pela busca global, via `JournalReader` | `q` na listagem | Um único caminho de descriptografia em memória (decisão 13, RNF-04). |

**Riscos técnicos.** Perda da chave torna o diário ilegível (backup na TASK-36). Descriptografar em memória pode ficar lento com muito volume (medido pela TASK-16). O alias `EntityDeletedHook` tem de ter a mesma grafia da TASK-15. As rotas são relativas, e o prefixo `/api/v1` é da TASK-18.

**Referências da spec.** RF-44, RF-45, RF-46, CT-27, RNF-02, RNF-03, CB-06, RN-17; decisões 6, 13, 28, 53, 55 e 56; contratos `GET|POST /journal-entries` e `GET|POST /emotions`.

**Arquivos em comum na onda 4.** Nenhum: a tarefa só cria arquivos sob `apps/server/src/journal/`.

### Card

- **Título:** Contexto journal
- **Tipo:** historia
- **Descrição:** Diário no servidor: entradas com data, hora e texto criptografado, emoções com intensidade opcional e lista de emoções editável, com leitura descriptografada do próprio dono para busca e relatórios.
- **Critérios de aceite:**
  - [ ] Duas entradas no mesmo dia ficam com data, hora e emoções.
  - [ ] Intensidade opcional de 1 a 5, validada.
  - [ ] Uma emoção nova aparece na lista, e renomear e excluir funcionam.
  - [ ] O texto não aparece em claro no banco.
  - [ ] Dados de outra pessoa respondem 404, com Row Level Security ativa.
  - [ ] A exclusão avisa o contexto de ligações pelo gancho.
- **Rótulos:** SPEC-001, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-04

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: opus |
| 2 | 2026-10-30 | baseline | coletado | 3 comando(s); códigos de saída: 0, 0, 0; 2 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | ajuste | in_progress | Passo do repositório: queries parametrizadas checadas em execução (sqlx::query/query_as com .bind) no lugar das macros checadas na compilação, por decisão do usuário (1A); a troca pelas macros fica com a TASK-18 |
| 4 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 5 | 2026-10-31 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 6 | 2026-10-31 | retomada | validating | decisão do usuário: aceite do usuário (KNW-005): pasta journal criada pela própria tarefa (defeito da issue 6); aceito(s): 1 |
| 7 | 2026-10-31 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 8 | 2026-10-31 | regressão | passed | 2 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 9 | 2026-10-31 | evidências | passed | 2 evidência(s) em evidence/TASK-12/ |
| 10 | 2026-10-31 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Passo do repositório: queries parametrizadas checadas em execução (sqlx::query/query_as com .bind) no lugar das macros checadas na compilação, por decisão do usuário (1A); a troca pelas macros fica com a TASK-18 |
