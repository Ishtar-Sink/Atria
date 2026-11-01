---
id: TASK-11
spec: SPEC-002
title: "Ícone das emoções no servidor"
profile: julgamento
persona: desenvolvedor
depends_on: []
wave: 1
covers: [RF-19, CT-18]
type: tarefa
labels: [SPEC-002, julgamento]
status: done
content_hash: 83f527f8d9b7e3c087392a75095a1e68888512f05e655d144f9a9f6caa27726e
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: 22b9a12df7e89c18c67b4d50a813c10d402dec6ff20cf6cc874d5001ce6db00e
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-opus-5-5
---

# TASK-11: Ícone das emoções no servidor

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Diário: a tabela `emotions` não tem ícone), RF-19, CT-18, CB-09, RN-07, RNF-01, o contrato `GET /emotions, POST /emotions, PATCH /emotions/{id}` (campo `icon`) e a migração `20261102010002_add-emotions-icon.sql` em "Contratos e interfaces", e a decisão 8 (resposta 8A) do "Registro de decisões".
- `vostok/rules/project/database.md`: [project/database-05].
- `vostok/rules/project/api.md`: [project/api-02] e [project/api-03].
- `vostok/rules/project/code-style.md`: [project/code-style-03], [project/code-style-07] e [project/code-style-11].
- `vostok/rules/project/testing.md`: [project/testing-01], [project/testing-02], [project/testing-03] e [project/testing-09].
- `vostok/memory/knowledge.md` (KNW-007 e KNW-009): uma compilação pesada por vez e como regenerar a `.sqlx`.
- `apps/server/src/journal/migrations/20261101120001_create-journal.sql`: tabela `emotions`, `CHECK` de `system_key` e RLS.
- `apps/server/src/journal/domain/emotion.rs`: `SystemEmotion`, `Emotion`, `Emotion::custom`, `Emotion::system`, `rename` e os testes do arquivo.
- `apps/server/src/journal/application/emotions.rs`: `EmotionService` (`list`, `create`, `rename`, `delete`).
- `apps/server/src/journal/infrastructure/pg_emotion_repository.rs`: `EmotionRow`, `TryFrom<EmotionRow>`, `insert_in`, `insert_ignoring_existing`, `list_live`, `find_live` e `update`.
- `apps/server/src/journal/interface/dto.rs` (linhas 1 a 40 e 150 a 194): `SystemEmotionKey`, `CreateEmotionRequest`, `UpdateEmotionRequest` e `EmotionResponse`.
- `apps/server/src/journal/interface/handlers.rs` (linhas 285 a 362): `list_emotions`, `create_emotion`, `update_emotion` e o `ValidJson` (corpo inválido vira 422 `validation_failed`).
- `apps/server/src/journal/tests/api.rs` (auxiliares `harness`, `call`, `emotions`, `create_emotion`, `system_id` e os testes `ct27_new_emotion_appears_in_list`, `rf46_emotion_can_be_renamed_and_deleted`, `other_user_entry_and_emotion_return_404` e `rls_is_enabled_on_journal_tables`).
- `apps/server/src/http/test_support.rs` (struct `TestContext`): banco de teste sem as migrações dos contextos.

### Mudar

- `apps/server/src/journal/migrations/20261102010002_add-emotions-icon.sql` (criar): `ALTER TABLE emotions ADD COLUMN icon TEXT NULL`, só acrescentando a coluna (RNF-01).
- `apps/server/src/journal/domain/emotion.rs` (alterar): enum `EmotionIcon` com o conjunto fixo de ícones, campo `icon` em `Emotion` e troca do ícone (RF-19).
- `apps/server/src/journal/infrastructure/pg_emotion_repository.rs` (alterar): `icon` nas leituras, nas inserções e na edição.
- `apps/server/src/journal/interface/dto.rs` (alterar): `icon` em `EmotionResponse`, `CreateEmotionRequest` e `UpdateEmotionRequest`, e `name` opcional na edição.
- `apps/server/src/journal/application/emotions.rs` (alterar): `create` recebe o ícone e `rename` vira `update`, com nome e ícone opcionais; necessário porque o caso de uso é quem grava o ícone pedido.
- `apps/server/src/journal/interface/handlers.rs` (alterar): `create_emotion` e `update_emotion` passam o ícone e a edição parcial; necessário para o contrato de `POST` e `PATCH /emotions`.
- `apps/server/src/journal/tests/api.rs` (alterar): testes do ícone, da emoção antiga sem ícone e da migração sobre dados existentes.
- `.sqlx` (alterar): dados offline das queries alteradas, regenerados com `cargo sqlx prepare --workspace` (KNW-009).

### Passos

1. Leia os arquivos de "Ler". Não rode outra compilação do `atria-server` em paralelo (KNW-007).
2. Crie `apps/server/src/journal/migrations/20261102010002_add-emotions-icon.sql` com um comentário em pt-br (ícone escolhido de um conjunto fixo; nulo usa o ícone pela `system_key` ou o neutro; RF-19, CB-09) e só `ALTER TABLE emotions ADD COLUMN icon TEXT NULL;`.
3. Suba o PostgreSQL só para as macros e aplique as migrações com o binário compilado offline, antes de mudar qualquer query:
   - `docker rm -f atria-sqlx-postgres 2>/dev/null; docker run -d --name atria-sqlx-postgres --shm-size=512m -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:17-alpine` e espere `docker exec atria-sqlx-postgres pg_isready -U postgres` responder `accepting connections`.
   - `SQLX_OFFLINE=true ATRIA_DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres ATRIA_PUBLIC_URL=http://localhost ATRIA_ENCRYPTION_KEY_FILE=/dev/null cargo run -q -p atria-server -- migrate`.
   - Nos passos 6 a 9, rode os comandos `cargo` com `DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres` no ambiente.
4. Testes primeiro, em `apps/server/src/journal/tests/api.rs` (reaproveite `harness`, `call`, `emotions` e `system_id`):
   - `ct18_custom_emotion_is_created_with_chosen_icon`: `POST /api/v1/emotions` com `{ "name": "Saudade", "icon": "star" }` devolve 201 com `icon` `star`, e a emoção aparece com `icon` `star` em `GET /api/v1/emotions`.
   - `ct18_emotion_icon_can_be_changed_without_renaming`: `PATCH /api/v1/emotions/{id}` com `{ "icon": "moon" }` devolve 200 com `icon` `moon` e o mesmo `name`; `PATCH` com `{ "name": "Nostalgia" }` mantém `icon` `moon`.
   - `ct18_default_emotions_have_no_icon_and_keep_system_key`: as sete padrão vêm com `icon` nulo e `system_key` preenchida (a tela mostra o ícone pela chave).
   - `cb09_custom_emotion_without_icon_has_null_icon`: `create_emotion(&h, &alice, "Tédio")` (sem `icon`) devolve `icon` nulo.
   - `unknown_emotion_icon_is_rejected`: `POST` com `{ "name": "X", "icon": "rocket" }` e `PATCH` com `{ "icon": "rocket" }` devolvem 422 com `code` `validation_failed`.
   - `other_user_cannot_change_emotion_icon`: `PATCH` do Bob com `{ "icon": "sun" }` numa emoção da Alice devolve 404 `emotion_not_found`.
   - `rnf01_icon_migration_keeps_existing_emotions`: com `TestContext::new()`, rode `journal::migrator()` sem a versão nova (`let mut before = journal::migrator(); before.migrations = std::borrow::Cow::Owned(before.migrations.iter().filter(|m| m.version < 20261102010002).cloned().collect());`), grave por SQL, com `begin_for_user` da Alice, uma emoção personalizada (`INSERT INTO emotions (id, owner_id, name, created_at, updated_at) VALUES (...)`) e uma padrão (`system_key` `joy`, `name` nulo), conte as linhas, rode `journal::migrator()` inteiro e confira a mesma contagem, os mesmos nomes e chaves e `icon IS NULL` nas duas; depois, pelo app (`ctx.app(journal::router())` e `ctx.sign_in_as(ALICE)`), `GET /api/v1/emotions` devolve as duas com `icon` nulo, sem semear de novo.
   Rode `cargo test -p atria-server journal::` e confira que esses testes falham.
5. Em `apps/server/src/journal/domain/emotion.rs`:
   - Crie `pub enum EmotionIcon { Sun, Rain, Flame, Bolt, Wind, Leaf, Heart, Star, Moon, Cloud, Sparkles, Smile }` com `pub const ALL: [Self; 12]`, `pub fn key(self) -> &'static str` (`sun`, `rain`, `flame`, `bolt`, `wind`, `leaf`, `heart`, `star`, `moon`, `cloud`, `sparkles`, `smile`) e `pub fn from_key(key: &str) -> Option<Self>`, com um comentário: conjunto fixo, o mesmo da tela de Emoções (TASK-20); o ícone de cada emoção padrão sem ícone escolhido é decidido pela tela a partir da `system_key`.
   - Acrescente `pub icon: Option<EmotionIcon>` a `Emotion`, depois de `name`; `Emotion::custom` ganha o parâmetro `icon: Option<EmotionIcon>` depois de `name`; `Emotion::system` grava `icon: None`.
   - Crie `pub fn set_icon(&mut self, icon: EmotionIcon, now: DateTime<Utc>) -> Result<(), JournalError>`, que recusa a emoção excluída com `EmotionNotFound`, como `rename`.
   - Acrescente testes no `mod tests` do arquivo: `emotion_icon_keys_round_trip` (`from_key(key())` nas doze e `from_key("rocket")` nulo), `set_icon_keeps_name_and_system_key` e `deleted_emotion_icon_cannot_change`; ajuste as chamadas existentes de `Emotion::custom` com `None`.
6. Em `apps/server/src/journal/infrastructure/pg_emotion_repository.rs`: `EmotionRow` ganha `icon: Option<String>`; `TryFrom` converte com `EmotionIcon::from_key`, e chave desconhecida vira `JournalError::infrastructure("ícone de emoção desconhecido")`; acrescente `icon` às colunas e valores de `insert_in` e `insert_ignoring_existing` (`emotion.icon.map(EmotionIcon::key)`), aos `SELECT` de `list_live` e `find_live`, e `icon = $6` ao `UPDATE` de `update`.
7. Em `apps/server/src/journal/application/emotions.rs`:
   - `create(owner_id, name, icon: Option<EmotionIcon>, visibility)` passa o ícone a `Emotion::custom`.
   - Troque `rename` por `pub async fn update(&self, owner_id: Uuid, id: Uuid, name: Option<&str>, icon: Option<EmotionIcon>) -> Result<Emotion, JournalError>`: busca a emoção viva, aplica `rename` quando há nome e `set_icon` quando há ícone, e grava com `update`; sem nenhum dos dois, devolve a emoção sem gravar (edição parcial, como o `CategoryPatch` do Financeiro).
8. Em `apps/server/src/journal/interface/dto.rs`:
   - Crie `pub enum EmotionIconKey` (`Debug`, `Clone`, `Copy`, `Serialize`, `Deserialize`, `ToSchema`, `#[serde(rename_all = "snake_case")]`, as doze variantes) com `From<EmotionIcon>` e `From<EmotionIconKey> for EmotionIcon`; uma chave fora do conjunto falha na leitura do corpo e vira 422 `validation_failed`.
   - `CreateEmotionRequest` ganha `/// Ícone do conjunto fixo; ausente, a tela mostra o ícone neutro.` `pub icon: Option<EmotionIconKey>`.
   - `UpdateEmotionRequest` passa a `pub name: Option<String>` e ganha `pub icon: Option<EmotionIconKey>`, com o doc "Edição parcial: o campo ausente fica como está".
   - `EmotionResponse` ganha, depois de `name`, `/// Nulo: a tela usa o ícone pela `system_key` ou o neutro (CB-09).` `pub icon: Option<EmotionIconKey>`, preenchido no `From<Emotion>`.
9. Em `apps/server/src/journal/interface/handlers.rs`: `create_emotion` passa `body.icon.map(Into::into)`; `update_emotion` chama `emotions(&state).update(user.user_id, id, body.name.as_deref(), body.icon.map(Into::into))`. Atualize as descrições do `#[utoipa::path]` de `PATCH /api/v1/emotions/{id}` ("Renomeia ou troca o ícone").
10. Rode `cargo test -p atria-server journal::` até passar, com `DATABASE_URL` do passo 3.
11. Regenere os dados offline: `cp -a .sqlx "${TMPDIR:-/tmp}/atria-sqlx-backup-task11"` e, com `DATABASE_URL`, `cargo sqlx prepare --workspace`. Se falhar, restaure com `rm -rf .sqlx && cp -a "${TMPDIR:-/tmp}/atria-sqlx-backup-task11" .sqlx`, corrija e repita. Tire `DATABASE_URL` do ambiente, remova o banco das macros (`docker rm -f atria-sqlx-postgres`) e confira que `SQLX_OFFLINE=true cargo build -p atria-server` compila.
12. Rode `cargo fmt` e a Verificação inteira, sem `DATABASE_URL` no ambiente.

### Baseline

- `cargo test -p atria-server journal:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server reports:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server http::tests:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
SQLX_OFFLINE=true cargo build -q -p atria-server
test -z "$(git status --porcelain -- apps/server/src/journal/migrations/20261101120001_create-journal.sql)"
# evidência: emotion-icon-tests.txt
cargo test -p atria-server -- journal::tests::api::ct18_ journal::tests::api::cb09_ journal::tests::api::unknown_emotion_icon journal::tests::api::other_user_cannot_change_emotion_icon journal::tests::api::rnf01_ journal::domain::emotion::
cargo test -p atria-server journal::
cargo test -p atria-server reports::
cargo test -p atria-server http::tests::
```

Resultado esperado: formatação e clippy sem aviso, o build offline compilando com a `.sqlx` regenerada, a migração antiga intocada e `test result: ok` nos testes do ícone, do Diário, dos relatórios e do `http` (OpenAPI juntado, rotas, isolamento e migrações).

### Evidências

- `emotion-icon-tests.txt` (automática, da verificação)
  - Prova: a emoção personalizada é criada com o ícone escolhido de um conjunto fixo, o ícone muda sem renomear, a padrão vem sem ícone e com a chave, a personalizada antiga sem ícone continua nula, um ícone fora do conjunto é recusado, outra pessoa recebe 404 e a migração só acrescenta a coluna, sem mexer nas emoções existentes (RF-19, CT-18, CB-09, RNF-01).
  - Trecho: as linhas `test journal::tests::api::ct18_custom_emotion_is_created_with_chosen_icon ... ok`, `ct18_emotion_icon_can_be_changed_without_renaming ... ok`, `cb09_custom_emotion_without_icon_has_null_icon ... ok`, `rnf01_icon_migration_keeps_existing_emotions ... ok` e `test journal::domain::emotion::tests::emotion_icon_keys_round_trip ... ok`, e `test result: ok` sem falhas.
  - Falha: `FAILED`, `test result: FAILED` ou só os testes antigos de `journal::domain::emotion` (testes novos ausentes).

### Concluída quando

- [x] A pessoa cria uma emoção personalizada com um ícone de um conjunto fixo e a lista mostra esse ícone; trocar o ícone não muda o nome (RF-19, CT-18).

  > Como comprovar: em `emotion-icon-tests.txt`, ver `ct18_custom_emotion_is_created_with_chosen_icon` e `ct18_emotion_icon_can_be_changed_without_renaming` com `ok`.

- [x] As emoções padrão vêm com a chave e sem ícone gravado, e a personalizada sem ícone vem com o ícone nulo, para a tela usar o ícone pela chave ou o neutro (RF-19, CB-09).

  > Como comprovar: em `emotion-icon-tests.txt`, ver `ct18_default_emotions_have_no_icon_and_keep_system_key` e `cb09_custom_emotion_without_icon_has_null_icon` com `ok`.

- [x] Um ícone fora do conjunto é recusado com 422, e outra pessoa não troca o ícone da emoção (404) (RF-19).

  > Como comprovar: em `emotion-icon-tests.txt`, ver `unknown_emotion_icon_is_rejected` e `other_user_cannot_change_emotion_icon` com `ok`.

- [x] A migração só acrescenta a coluna `icon`, nula, e as emoções que já existiam continuam iguais depois dela (RNF-01, CB-09).

  > Como comprovar: em `emotion-icon-tests.txt`, ver `rnf01_icon_migration_keeps_existing_emotions ... ok`; abrir a migração nova e ver só o `ALTER TABLE ... ADD COLUMN`.

- [x] O servidor compila sem banco com os dados offline regenerados, sem aviso de formatação ou do clippy, e os testes do Diário, dos relatórios e do `http` continuam passando (RF-19).

  > Como comprovar: rodar a Verificação e ver todos os comandos terminarem sem erro.

## Descrição

### Resumo executivo

O servidor passa a guardar um ícone para cada emoção personalizada do Diário, escolhido de um conjunto fixo, e a devolvê-lo nas listas.
É a base para o seletor de emoções com ícones e para a linha do tempo em cartões.
Perfil julgamento: mexe no banco de produção (só acrescenta uma coluna) e no contrato das emoções.
Desbloqueia a geração do contrato (TASK-15) e, por ela, as telas do Diário (TASK-20).

### Detalhes técnicos

**Abordagem.** Coluna nova `emotions.icon` (nula), enum `EmotionIcon` no domínio com doze chaves, campo `icon` em `Emotion`, `EmotionResponse`, `CreateEmotionRequest` e `UpdateEmotionRequest`, e a edição de emoção vira parcial (nome e ícone opcionais). Os testes vão em `journal/tests/api.rs` para reaproveitar os auxiliares privados do arquivo.

**Conjunto de ícones.** `sun`, `rain`, `flame`, `bolt`, `wind`, `leaf`, `heart`, `star`, `moon`, `cloud`, `sparkles` e `smile`. Sugestão para a TASK-20 (a tela decide): `joy` → `sun`, `sadness` → `rain`, `anger` → `flame`, `fear` → `bolt`, `anxiety` → `wind`, `calm` → `leaf`, `gratitude` → `heart`, e um ícone neutro próprio para `icon` nulo sem `system_key` (CB-09). Uma chave fora do conjunto é recusada com 422 `validation_failed` (corpo inválido), porque o enum vem do OpenAPI e a TASK-20 recebe a lista pronta nos tipos gerados.

**Decisões (perfil julgamento: alternativas e critério).**

| Decisão | Escolhida | Alternativas descartadas | Critério |
|---|---|---|---|
| Ícone das padrão | Nulo no banco; a tela escolhe pela `system_key` | Gravar o ícone das sete padrão na migração | RNF-01 proíbe reescrever dados; o contrato diz "nulo usa o ícone pela system_key". |
| Valor aceito | Enum fechado no contrato e no domínio | Texto livre; nome de arquivo de imagem | RF-19 pede um conjunto fixo; o enum dá o tipo à tela e impede valor desconhecido. |
| `CHECK` na coluna | Sem `CHECK`, validação no domínio e no enum do pedido | `CHECK (icon IN (...))` | Segue o SQL do contrato da spec; um ícone novo exigiria trocar a restrição em outra migração. |
| Edição | `PATCH` parcial com `name` e `icon` opcionais | `PATCH /emotions/{id}/icon` separado | Mantém uma rota só, como no contrato, e não quebra quem já manda só `name`. |
| Ícone nas entradas do Diário | Fora desta tarefa: a linha do tempo cruza `emotion_id` com `GET /emotions` | `icon` em `EntryEmotionResponse` | O contrato da spec só pede `icon` em `/emotions`; acrescentar nas entradas mudaria o repositório das entradas, fora dos componentes do plano. |

**Dados offline do `sqlx`.** Mudar as queries exige regenerar `.sqlx` (KNW-009); por isso ela entra em "Mudar", embora não esteja nos componentes do plano. Pelo mesmo motivo, `application/emotions.rs`, `interface/handlers.rs` e `tests/api.rs` entram: sem eles o pedido com `icon` não chega ao domínio.

**Riscos técnicos.** Falha no `cargo sqlx prepare` apaga a `.sqlx` (backup no passo 11). A migração roda em produção: o teste `rnf01_*` aplica a versão nova sobre emoções já gravadas. `UpdateEmotionRequest.name` passa a opcional: compatível com quem manda o nome, mas muda o tipo gerado (TASK-15).

**Referências da spec.** RF-19, CT-18, CB-09, RN-07, RNF-01; contratos de `/emotions`; decisão 8 (resposta 8A).

**Arquivos em comum na onda 1.** `.sqlx` com a TASK-09 e a TASK-12 (as três regeneram os dados offline: executar em sequência, cada uma com a migração da anterior já aplicada no banco das macros). As demais tarefas de servidor da onda compilam o `atria-server` e rodam uma por vez (KNW-007).

### Card

- **Título:** Ícone das emoções no servidor
- **Tipo:** tarefa
- **Descrição:** As emoções do Diário ganham o campo `icon`, escolhido de um conjunto fixo, nas listas, na criação e na edição, com uma migração que só acrescenta uma coluna nula.
- **Critérios de aceite:**
  - [ ] A emoção personalizada é criada e editada com um ícone do conjunto fixo.
  - [ ] As padrão e as antigas sem ícone vêm com `icon` nulo.
  - [ ] Ícone fora do conjunto responde 422; emoção de outra pessoa responde 404.
  - [ ] A migração só acrescenta a coluna e preserva as emoções existentes.
  - [ ] Build offline, fmt, clippy e testes do Diário, relatórios e `http` sem falha.
- **Rótulos:** SPEC-002, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-opus-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 com acréscimo |
| 5 | 2026-11-01 | evidências | passed | 1 evidência(s) em evidence/TASK-11/ |
| 6 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
