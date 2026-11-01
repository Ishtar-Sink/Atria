---
id: TASK-09
spec: SPEC-002
title: "Categorias padrão no servidor"
profile: julgamento
persona: desenvolvedor
depends_on: []
wave: 1
covers: [RF-11, CT-10]
type: tarefa
labels: [SPEC-002, julgamento]
status: done
content_hash: f83c00c444d64d0d92484033412cb19c98d66db6963889844d5d7fc3be00e289
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: e5da529fb0cb8fac40fbc6d66c0231623fd4e8d8223baea368d6f6bc709cfea9
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-opus-5-5
---

# TASK-09: Categorias padrão no servidor

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Financeiro: nenhuma categoria é criada), RF-11, CT-10, RN-01, RNF-01, o contrato `GET /categories` (campo `system_key`) e a migração `20261102010001_add-categories-system-key.sql` em "Contratos e interfaces", e a decisão 3 (resposta 3A) do "Registro de decisões".
- `vostok/rules/project/database.md`: [project/database-05] e [project/database-08].
- `vostok/rules/project/code-style.md`: [project/code-style-03], [project/code-style-07] e [project/code-style-11].
- `vostok/rules/project/testing.md`: [project/testing-02], [project/testing-03], [project/testing-07] e [project/testing-09].
- `vostok/rules/project/development-methodology.md`: [project/development-methodology-01] e [project/development-methodology-02].
- `vostok/memory/knowledge.md` (KNW-007 e KNW-009): uma compilação pesada por vez e como regenerar a `.sqlx`.
- `apps/server/src/journal/application/emotions.rs` (fn `seed_defaults_once`): molde da semeadura única das emoções padrão, pela contagem que inclui as excluídas.
- `apps/server/src/finance/migrations/20261101070002_create-finance-categories.sql`: tabela `categories`, índice único parcial `categories_owner_kind_name_key` e RLS.
- `apps/server/src/finance/domain/category.rs`: `Category`, `CategoryColor` e `validate_name`.
- `apps/server/src/finance/application/categories.rs`: `list`, `list_all`, `create`, `update` e `delete`.
- `apps/server/src/finance/application/ports.rs` (trait `CategoryRepository`, linhas 55 a 85).
- `apps/server/src/finance/infrastructure/pg_categories.rs`: `CategoryRow`, `into_domain` e as queries checadas na compilação.
- `apps/server/src/finance/interface/dto.rs` (struct `CategoryResponse`, linhas 270 a 310) e `apps/server/src/finance/interface/handlers.rs` (fn `list_categories`, linhas 400 a 420, e fn `env`, linha 121).
- `apps/server/src/finance/tests/mod.rs`: `FinanceTest`, `ALICE`, `BOB`, `create_category` e `items`.
- `apps/server/src/finance/tests/authorization.rs` (linhas 240 a 260): `INSERT` direto em `categories` com `begin_for_user`, molde do teste de migração.
- `apps/server/src/http/test_support.rs` (struct `TestContext`): banco de teste com as sessões migradas, sem as migrações dos contextos.
- `apps/server/src/finance/tests/transfers.rs` (testes que criam e listam categorias, linhas 95 a 215): não podem mudar de resultado.

### Mudar

- `apps/server/src/finance/migrations/20261102010001_add-categories-system-key.sql` (criar): `ALTER TABLE categories ADD COLUMN system_key TEXT NULL`, só acrescentando a coluna (RNF-01).
- `apps/server/src/finance/application/categories.rs` (alterar): `list` semeia as categorias padrão uma vez por pessoa; renomear uma padrão tira a `system_key` (RF-11, RN-01).
- `apps/server/src/finance/application/ports.rs` (alterar): `count_all_including_deleted` e `insert_defaults` em `CategoryRepository`.
- `apps/server/src/finance/infrastructure/pg_categories.rs` (alterar): `system_key` nas leituras e na edição, contagem com as excluídas e inserção em lote idempotente.
- `apps/server/src/finance/domain/category.rs` (alterar): enum `SystemCategory` com as sete categorias padrão e campo `system_key` em `Category`; necessário porque o campo é do domínio e a lista padrão é regra de negócio ([project/testing-01]).
- `apps/server/src/finance/interface/dto.rs` (alterar): `system_key` em `CategoryResponse`, como pede o contrato de `GET /categories`.
- `apps/server/src/finance/interface/handlers.rs` (alterar): `list_categories` passa o `env(&state)` para `categories::list`, que agora gera ids e datas da semeadura.
- `apps/server/src/finance/tests/categories.rs` (criar): testes de integração das categorias padrão e da migração sobre dados existentes.
- `apps/server/src/finance/tests/mod.rs` (alterar): declara `mod categories;`.
- `.sqlx` (alterar): dados offline das queries alteradas e novas, regenerados com `cargo sqlx prepare --workspace` (KNW-009).

### Passos

1. Leia os arquivos de "Ler". Não rode outra compilação do `atria-server` em paralelo (KNW-007): os comandos `cargo` desta tarefa rodam um por vez.
2. Crie `apps/server/src/finance/migrations/20261102010001_add-categories-system-key.sql` com um comentário em pt-br (chave estável das categorias padrão; nula nas criadas pela pessoa; RF-11) e só `ALTER TABLE categories ADD COLUMN system_key TEXT NULL;`. Sem `UPDATE`, `DROP`, `RENAME` nem valor padrão.
3. Suba o PostgreSQL só para as macros do `sqlx` e aplique as migrações com o binário compilado offline, antes de mudar qualquer query:
   - `docker rm -f atria-sqlx-postgres 2>/dev/null; docker run -d --name atria-sqlx-postgres --shm-size=512m -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:17-alpine` e espere `docker exec atria-sqlx-postgres pg_isready -U postgres` responder `accepting connections`.
   - `SQLX_OFFLINE=true ATRIA_DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres ATRIA_PUBLIC_URL=http://localhost ATRIA_ENCRYPTION_KEY_FILE=/dev/null cargo run -q -p atria-server -- migrate`.
   - Nos passos 6 a 9, rode os comandos `cargo` com `DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres` no ambiente, para as macros checarem as queries novas contra o banco.
4. Escreva os testes antes do código, em `apps/server/src/finance/tests/categories.rs` (com `//!` em pt-br citando RF-11, RN-01 e RNF-01), e declare `mod categories;` em `apps/server/src/finance/tests/mod.rs`, em ordem alfabética. Os testes usam `FinanceTest`, `ALICE`, `BOB`, `id_of` e `items` de `super`:
   - `ct10_default_categories_are_seeded_once`: `GET /categories` da Alice duas vezes; nas duas, 7 itens com `system_key` preenchida: `salary` e `freelance` com `kind` `income`, `housing`, `groceries`, `transport`, `leisure` e `health` com `kind` `expense`, e os mesmos ids nas duas chamadas.
   - `ct10_deleted_default_category_is_not_recreated`: lista, exclui a `groceries` com `DELETE /categories/{id}` (sem uso, sem `replacement_id`), lista de novo: 6 itens e nenhum com `system_key` `groceries`.
   - `ct10_person_who_deleted_all_categories_is_not_seeded_again`: lista, exclui as 7, lista de novo: 0 itens.
   - `person_with_own_category_is_not_seeded`: `create_category(&t.alice, "Viagem", "expense", "info")` antes de qualquer listagem; `GET /categories` devolve só "Viagem", com `system_key` nula.
   - `renaming_default_category_clears_system_key`: `PATCH /categories/{id}` da `salary` com `{ "name": "Pró-labore" }` devolve 200 com `system_key` nula; a lista seguinte continua com 7 itens.
   - `default_categories_belong_to_each_person`: a lista da Alice e a do Bob têm 7 itens cada, sem nenhum id em comum, e `GET /categories/{id}` de uma padrão da Alice pelo Bob devolve 404.
   - `rnf01_system_key_migration_keeps_existing_categories`: com `TestContext::new()`, rode `finance::migrator()` sem a versão nova (`let mut before = finance::migrator(); before.migrations = std::borrow::Cow::Owned(before.migrations.iter().filter(|m| m.version < 20261102010001).cloned().collect());`), insira duas categorias da Alice por SQL com `begin_for_user` (como em `authorization.rs`), conte as linhas, rode `finance::migrator()` inteiro e confira a mesma contagem, os mesmos nomes e `system_key IS NULL` nas duas. Depois, com o app (`ctx.app(finance::router())`) e a sessão da Alice (`ctx.sign_in_as(ALICE)`), `GET /api/v1/categories` devolve só as duas, sem semear.
   Rode `cargo test -p atria-server finance::tests::categories` e confira que os testes falham (não compilam ou falham pela falta da `system_key`).
5. Em `apps/server/src/finance/domain/category.rs`:
   - Crie `pub enum SystemCategory { Salary, Freelance, Housing, Groceries, Transport, Leisure, Health }` com `pub const ALL: [Self; 7]`, `pub fn key(self) -> &'static str` (`salary`, `freelance`, `housing`, `groceries`, `transport`, `leisure`, `health`), `pub fn from_key(key: &str) -> Option<Self>`, `pub fn kind(self) -> TransactionKind` (as duas primeiras `Income`, as demais `Expense`), `pub fn color(self) -> CategoryColor` (`Success`, `Accent`, `Primary`, `Success`, `Info`, `Accent`, `Danger`, os tons do protótipo) e `pub fn default_name(self) -> &'static str` (`Salário`, `Freelance`, `Moradia`, `Mercado`, `Transporte`, `Lazer`, `Saúde`), com um comentário dizendo que o nome é só o valor gravado na coluna obrigatória e que a tela traduz pela chave ([project/language-06]).
   - Acrescente `pub system_key: Option<SystemCategory>` a `Category`, depois de `color`.
   - Crie `pub fn default_categories(owner_id: Uuid, now: DateTime<Utc>, mut new_id: impl FnMut() -> Uuid) -> Vec<Category>`, uma por `SystemCategory::ALL`, com `Visibility::Personal`.
   - Acrescente testes unitários no `mod tests` do arquivo: `system_category_keys_round_trip` (`from_key(key())` devolve a mesma para as sete) e `default_categories_have_two_income_and_five_expense`.
6. Em `apps/server/src/finance/application/ports.rs`, acrescente a `CategoryRepository`: `fn count_all_including_deleted(&self, owner_id: Uuid) -> impl Future<Output = Outcome<i64>> + Send;` (doc: conta também as excluídas, para excluir não semear de novo) e `fn insert_defaults(&self, owner_id: Uuid, categories: &[Category]) -> impl Future<Output = Outcome<()>> + Send;` (doc: grava todas numa só transação e ignora as que já existem).
7. Em `apps/server/src/finance/infrastructure/pg_categories.rs`:
   - `CategoryRow` ganha `system_key: Option<String>`; `into_domain` converte com `SystemCategory::from_key`, e chave desconhecida vira `corrupt("system_key")`.
   - Acrescente `system_key` às colunas do `SELECT` de `list` e de `get`.
   - Em `update`, acrescente `system_key = $7` ao `UPDATE` com `category.system_key.map(SystemCategory::key)`.
   - `count_all_including_deleted`: `SELECT count(*) AS "count!" FROM categories WHERE owner_id = $1`, dentro de `begin(&self.pool, owner_id)`.
   - `insert_defaults`: numa só transação de `begin`, um `INSERT INTO categories (id, owner_id, visibility, name, kind, color, system_key, created_at, updated_at) VALUES (...) ON CONFLICT DO NOTHING` por categoria; o `ON CONFLICT DO NOTHING` cobre duas listagens simultâneas da mesma pessoa (índice único de nome por tipo). O `insert` atual não muda: a categoria criada pela pessoa nunca tem chave.
8. Em `apps/server/src/finance/application/categories.rs`:
   - `list` passa a receber `env: Env<'_>` depois de `repo`; antes de listar, chama `seed_defaults_once(repo, env, owner_id)`, que não faz nada se `count_all_including_deleted` for maior que 0 e senão grava `default_categories(owner_id, env.clock.now(), || env.ids.new_id())` com `insert_defaults`. `list_all` não semeia (é usada por resumo, relatórios e busca).
   - `create` grava `system_key: None`.
   - `update` limpa `category.system_key` quando `patch.name` vem preenchido, com um comentário: a padrão renomeada passa a mostrar o nome da pessoa, não a tradução.
9. Em `apps/server/src/finance/interface/handlers.rs`, `list_categories` chama `categories::list(&repo, env(&state), user.user_id, kind, page_after(&page)?, limit + 1)`. Em `apps/server/src/finance/interface/dto.rs`, crie `pub enum SystemCategoryKey` (`Serialize`, `Deserialize`, `ToSchema`, `#[serde(rename_all = "snake_case")]`, as sete variantes e `impl From<SystemCategory>`) e acrescente a `CategoryResponse`, depois de `color`, `/// Chave da categoria padrão (RF-11): a tela traduz o nome por ela; nula nas criadas pela pessoa e nas padrão renomeadas.` `pub system_key: Option<SystemCategoryKey>`, preenchida no `From<Category>`.
10. Rode `cargo test -p atria-server finance::` até passar, com `DATABASE_URL` do passo 3.
11. Regenere os dados offline: `cp -a .sqlx "${TMPDIR:-/tmp}/atria-sqlx-backup-task09"` e, com `DATABASE_URL` do passo 3, `cargo sqlx prepare --workspace`. Se o `prepare` falhar, restaure com `rm -rf .sqlx && cp -a "${TMPDIR:-/tmp}/atria-sqlx-backup-task09" .sqlx`, corrija e repita. Depois tire `DATABASE_URL` do ambiente, remova o banco das macros (`docker rm -f atria-sqlx-postgres`) e confira que `SQLX_OFFLINE=true cargo build -p atria-server` compila.
12. Rode `cargo fmt` e a Verificação inteira, sem `DATABASE_URL` no ambiente.

### Baseline

- `cargo test -p atria-server finance:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server -- reports:: search:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo test -p atria-server http::tests:: 2>&1 | grep ' \.\.\. ' | sort`
- `cargo clippy -q -p atria-server --all-targets -- -D warnings`
- `cargo fmt --check`

### Verificação

```bash
cargo fmt --check
cargo clippy -p atria-server --all-targets -- -D warnings
SQLX_OFFLINE=true cargo build -q -p atria-server
test -z "$(git status --porcelain -- apps/server/src/finance/migrations/20261101070002_create-finance-categories.sql)"
# evidência: categories-tests.txt
cargo test -p atria-server finance::tests::categories
cargo test -p atria-server finance::
cargo test -p atria-server -- reports:: search::
cargo test -p atria-server http::tests::
```

Resultado esperado: formatação e clippy sem aviso, o build offline compilando com a `.sqlx` regenerada, a migração antiga intocada e `test result: ok` nos testes das categorias, do Financeiro, dos relatórios, da busca e do `http` (isolamento, rotas e migrações).

### Evidências

- `categories-tests.txt` (automática, da verificação)
  - Prova: as categorias padrão de entrada e de saída são criadas uma única vez por pessoa na primeira listagem, a excluída não volta, quem já tem categoria não recebe as padrão, cada pessoa tem as suas e a migração só acrescenta a coluna, sem mexer nas categorias que já existem (RF-11, CT-10, RN-01, RNF-01).
  - Trecho: as linhas `test finance::tests::categories::ct10_default_categories_are_seeded_once ... ok`, `ct10_deleted_default_category_is_not_recreated ... ok`, `default_categories_belong_to_each_person ... ok` e `rnf01_system_key_migration_keeps_existing_categories ... ok`, e `test result: ok. 7 passed`.
  - Falha: `FAILED`, `test result: FAILED` ou `running 0 tests` (arquivo de testes ausente).

### Concluída quando

- [x] Na primeira vez que a pessoa abre a lista de categorias, ela recebe duas categorias padrão de entrada e cinco de saída, cada uma com a chave `system_key`, e listar de novo não cria outras (RF-11, CT-10).

  > Como comprovar: em `categories-tests.txt`, ver `ct10_default_categories_are_seeded_once ... ok`.

- [x] Excluir uma categoria padrão não a recria, e quem excluiu todas ou já tinha categoria própria não recebe as padrão (RN-01, CT-10).

  > Como comprovar: em `categories-tests.txt`, ver `ct10_deleted_default_category_is_not_recreated`, `ct10_person_who_deleted_all_categories_is_not_seeded_again` e `person_with_own_category_is_not_seeded` com `ok`.

- [x] As categorias padrão são de cada pessoa: outra pessoa não as vê nem as abre (404), e renomear uma padrão tira a chave (RF-11).

  > Como comprovar: em `categories-tests.txt`, ver `default_categories_belong_to_each_person` e `renaming_default_category_clears_system_key` com `ok`.

- [x] A migração só acrescenta a coluna `system_key`, nula, e as categorias que já existiam continuam iguais depois dela (RNF-01, RF-11).

  > Como comprovar: em `categories-tests.txt`, ver `rnf01_system_key_migration_keeps_existing_categories ... ok`; abrir a migração nova e ver só o `ALTER TABLE ... ADD COLUMN`.

- [x] O servidor compila sem banco com os dados offline regenerados, sem aviso de formatação ou do clippy, e os testes do Financeiro, dos relatórios, da busca e do `http` continuam passando (RF-11).

  > Como comprovar: rodar a Verificação e ver todos os comandos terminarem sem erro, com `test result: ok` em cada suíte.

## Descrição

### Resumo executivo

Quem abre o Financeiro pela primeira vez passa a encontrar categorias prontas de entrada (Salário, Freelance) e de saída (Moradia, Mercado, Transporte, Lazer, Saúde), em vez de uma lista vazia que travava o cadastro.
As categorias são criadas uma única vez por pessoa: uma que ela exclui não volta.
Perfil julgamento: mexe no banco de produção (só acrescenta uma coluna) e no contrato de categorias.
Desbloqueia a geração do contrato (TASK-15) e, por ela, o formulário de movimentação (TASK-16).

### Detalhes técnicos

**Abordagem.** Coluna nova `categories.system_key` (nula), enum `SystemCategory` no domínio com chave, tipo, cor e nome gravado, e semeadura em `categories::list` igual à das emoções (`journal/application/emotions.rs`): grava a lista padrão só quando a pessoa não tem nenhuma categoria, nem excluída. `GET /categories` passa a devolver `system_key`.

**Decisões (perfil julgamento: alternativas e critério).**

| Decisão | Escolhida | Alternativas descartadas | Critério |
|---|---|---|---|
| Quando semear | Na listagem (`GET /categories`), quando a contagem com as excluídas é zero | Também ao criar a primeira categoria, como nas emoções; semear no cadastro da pessoa (acopla ao `auth`) | O formulário de movimentação abre pela listagem (CT-10). Semear ao criar faria a primeira categoria da pessoa colidir pelo nome com uma padrão (índice único por tipo) e mudaria o resultado de testes existentes (`transfers.rs`) que criam "Mercado", "Moradia" e "Salário". |
| Marcador de "já semeou" | Contagem de todas as categorias, inclusive excluídas | Contar só as com `system_key`; tabela de controle | Igual às emoções (RN-01) e sem coluna ou tabela extra (RNF-01). Quem já usa o Financeiro com categorias próprias não recebe as padrão; o caso de produção (nenhuma categoria, Bug 7) recebe. |
| Nome da padrão | Nome em pt-br gravado em `name` (coluna obrigatória) e tradução pela `system_key` na tela | `name` nulo, como nas emoções | A coluna `name` é `NOT NULL` e mudar isso reescreveria o esquema; RNF-01 só permite acrescentar coluna nula. |
| Renomear uma padrão | Limpa a `system_key` | Manter a chave | Com a chave, a tela continuaria mostrando a tradução e esconderia o nome escolhido; o marcador da semeadura não depende da chave. |
| Duas listagens simultâneas | `INSERT ... ON CONFLICT DO NOTHING` numa transação | Trava por pessoa | O índice único de nome por tipo já impede duplicar; é idempotente e sem trava. |
| `CHECK` na coluna | Sem `CHECK`, validação no domínio (`from_key`, leitura desconhecida vira `corrupt`) | `CHECK (system_key IN (...))` | Segue o SQL do contrato da spec; uma chave nova exigiria trocar a restrição em outra migração. |

**Dados offline do `sqlx`.** As queries são macros checadas na compilação ([project/stack-04]) e o build da CI e do Docker usa `SQLX_OFFLINE=true`: mudar uma query exige regenerar `.sqlx` (KNW-009). A `.sqlx` não está nos componentes do plano, mas é consequência obrigatória da mudança de query; por isso entra em "Mudar".

**Riscos técnicos.** Falha no `cargo sqlx prepare` apaga a `.sqlx` (backup no passo 11). A migração roda em produção com dados reais: o teste `rnf01_*` aplica a versão nova sobre categorias já gravadas.

**Referências da spec.** RF-11, CT-10, RN-01, RNF-01; contrato `GET /categories`; decisão 3 (resposta 3A); risco "Uma migração quebrar a subida com dados reais".

**Arquivos em comum na onda 1.** `.sqlx` com a TASK-11 e a TASK-12 (as três regeneram os dados offline: executar em sequência, cada uma com a migração da anterior já aplicada no banco das macros) e `apps/server/src/finance/interface/dto.rs` com a TASK-10 (comentário de `upcoming_bills`). As demais tarefas de servidor da onda também compilam o `atria-server` e rodam uma por vez (KNW-007).

### Card

- **Título:** Categorias padrão no servidor
- **Tipo:** tarefa
- **Descrição:** Cria uma única vez, para cada pessoa, as categorias padrão de entrada e de saída do Financeiro, com a chave `system_key` no contrato, numa migração que só acrescenta uma coluna nula.
- **Critérios de aceite:**
  - [ ] A primeira listagem de categorias traz 2 categorias padrão de entrada e 5 de saída, uma vez só.
  - [ ] Uma categoria padrão excluída não volta.
  - [ ] Cada pessoa tem as próprias categorias padrão; outra pessoa recebe 404.
  - [ ] A migração só acrescenta a coluna e preserva as categorias existentes.
  - [ ] Build offline, fmt, clippy e testes do Financeiro, relatórios, busca e `http` sem falha.
- **Rótulos:** SPEC-002, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-opus-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 5 | 2026-11-01 | retomada | validating | decisão do usuário: Usuário aceitou a diferença do comando 1: testes upcoming_bills_cover_* renomeados para upcoming_movements_cover_* pela TASK-10; aceito(s): 1 |
| 6 | 2026-11-01 | regressão | passed | 4 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 7 | 2026-11-01 | evidências | passed | 1 evidência(s) em evidence/TASK-09/ |
| 8 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
