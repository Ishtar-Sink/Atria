### Ler

- `vostok/work/specs/refined/SPEC-003-financeiro-pronto-para-o-lancamento.md`: "Estado atual" (Cartão de crédito), RF-07, RF-09, RF-10, RNF-01, CB-05, CB-06, CT-06, o bloco "Contratos e interfaces" (removidos e a migração `20261103010001_remove-credit-cards.sql`), o risco "A migração do cartão errar saldos ou perder compras" e as decisões 3 e 14 do "Registro de decisões".
- `vostok/rules/project/database.md`: [project/database-03], [project/database-05], [project/database-07] e [project/database-09].
- `vostok/rules/project/code-style.md`: [project/code-style-02], [project/code-style-03], [project/code-style-05], [project/code-style-08] e [project/code-style-11].
- `vostok/rules/project/testing.md`: [project/testing-02], [project/testing-03] e [project/testing-07].
- `vostok/rules/project/development-methodology.md`: [project/development-methodology-01], [project/development-methodology-02] e [project/development-methodology-03].
- `vostok/rules/project/self-hosting.md`: [project/self-hosting-06].
- `vostok/memory/knowledge.md` (KNW-007 e KNW-009): uma compilação pesada do servidor por vez e como regenerar a `.sqlx` num banco vazio.
- `apps/server/src/finance/migrations/20261101070001_create-finance-accounts.sql`: colunas `kind`, `credit_limit_amount`, `closing_day`, `due_day` e os CHECKs `accounts_credit_card_terms` e `accounts_default_is_standard`.
- `apps/server/src/finance/migrations/20261101070004_create-finance-transactions.sql`: colunas `installment_*` e `statement_period` de `transactions`, o CHECK `transactions_installment_coherent`, os índices `transactions_account_statement_period_idx`, `transactions_installment_group_id_idx` e `transfers_to_account_id_idx (to_account_id, statement_period)`, e a RLS com `FORCE`.
- `apps/server/src/finance/domain/credit_card.rs`: tudo o que sai (`StatementPeriod`, `CardCycle`, `split_installments`, `outstanding_amount`).
- `apps/server/src/finance/domain/account.rs`: `AccountKind`, `CreditCardTerms`, `CardFields`, `credit_card_terms` e os testes.
- `apps/server/src/finance/domain/transaction.rs` (struct `Transaction`, struct `Installment`, fn `apply_edit`, fn `moves_installment`, mod `fixtures` e os testes `unsettled_transaction_edit_accepts_all_editable_fields` e `installment_edit_refuses_account_and_date`).
- `apps/server/src/finance/domain/transfer.rs` e `apps/server/src/finance/domain/error.rs` (`StatementAlreadyPaid`, `InstallmentNotEditable` e o teste `codes_are_stable`).
- `apps/server/src/finance/domain/recurring_transaction.rs` (fn `settle_open`, linhas 150 a 185, e as chamadas dela nos testes, linhas 310 a 460).
- `apps/server/src/finance/domain/summary.rs` (cabeçalho, linhas 1 a 20; struct `CardUsage` e fn `card_usage`, linhas 232 a 258; teste `card_used_limit_sums_unsettled_and_settled_in_open_statement`, linhas 501 a 536).
- `apps/server/src/finance/application/credit_cards.rs`, `apps/server/src/finance/application/accounts.rs`, `apps/server/src/finance/application/transactions.rs` (fn `create` e fn `installments`), `apps/server/src/finance/application/transfers.rs` e `apps/server/src/finance/application/summaries.rs` (struct `CardView`, `PeriodSummaryView`, fn `period` e fn `cards`).
- `apps/server/src/finance/application/ports.rs` (struct `StatementPayment`, trait `TransactionRepository` com `undo_settlement`, `statement_items`, `paid_periods` e `pay_statement`, linhas 150 a 225).
- `apps/server/src/finance/infrastructure/mod.rs` (fns `period`, `day`, `small`, `card_cycle`, struct `TransactionRow`, fn `into_domain` e fn `insert_transaction`).
- `apps/server/src/finance/infrastructure/pg_accounts.rs`, `apps/server/src/finance/infrastructure/pg_transactions.rs` (fns `lock_transaction`, `save_edit`, `statement_paid`, `update`, `undo_settlement`, `statement_items`, `paid_periods`, `pay_statement`), `apps/server/src/finance/infrastructure/pg_transfers.rs` e `apps/server/src/finance/infrastructure/pg_recurring_transactions.rs` (fn `settled_copies` e fn `settle_occurrence`).
- `apps/server/src/finance/interface/mod.rs`: as rotas `/credit-cards/...`.
- `apps/server/src/finance/interface/handlers.rs` (imports, linhas 15 a 35; fn `create_account` e fn `update_account`, linhas 309 a 380; fn `create_transactions`, linhas 570 a 615; fns `statement_period`, `list_statements` e `pay_statement`, linhas 1062 a 1132).
- `apps/server/src/finance/interface/dto.rs` (enum `AccountKindDto`, linhas 24 a 50; contas, linhas 173 a 243; `CreateTransactionRequest`, `InstallmentDto`, `TransactionResponse` e `TransactionItemResponse`, linhas 340 a 572; `TransferResponse`, linhas 608 a 645; faturas, linhas 765 a 822; `AccountBalanceDto`, `BalanceDto`, `CreditCardSummaryDto` e `FinancialSummaryResponse`, linhas 966 a 1061).
- `apps/server/src/finance/interface/openapi.rs`: a lista de `paths`, de `schemas` e o teste `documents_all_finance_routes`.
- `apps/server/src/finance/mod.rs`: o `//!` do módulo e fn `migrator`.
- `apps/server/src/reports/infrastructure/mod.rs` (impl `ExportSource for FinanceExport`, tabelas `accounts` e `transactions`, linhas 715 a 845).
- `apps/server/src/finance/tests/mod.rs` (`mod credit_cards;`, fn `create_card`, fn `monthly_rule`), `apps/server/src/finance/tests/credit_cards.rs`, `apps/server/src/finance/tests/accounts.rs` (teste `creates_credit_card_account`), `apps/server/src/finance/tests/transactions.rs` (teste `updates_unsettled_transaction_fields`), `apps/server/src/finance/tests/summaries.rs` (testes `summary_balance_has_current_forecast_at_period_end_and_per_account` e `summary_cards_show_open_statement_due_date_and_used_limit`) e `apps/server/src/finance/tests/authorization.rs` (fn `seed` e a lista de rotas, linhas 140 a 160).
- `apps/server/src/finance/tests/categories.rs` (teste `rnf01_system_key_migration_keeps_existing_categories`): molde do teste que aplica as migrações até a versão anterior, insere por SQL com `begin_for_user` e aplica a nova.
- `apps/server/src/http/test_support.rs` (struct `TestContext`, fns `app` e `sign_in_as`).

### Mudar

- `apps/server/src/finance/migrations/20261103010001_remove-credit-cards.sql` (criar): só DDL; tira os CHECKs, índices e colunas de cartão, fatura e parcela de `accounts`, `transactions` e `transfers` e recria o índice de `transfers.to_account_id` (RF-07, RF-10, CB-05, CB-06, RNF-01).
- `apps/server/src/finance/domain/credit_card.rs` (remover): fim do cartão, da fatura e das parcelas (RF-07).
- `apps/server/src/finance/application/credit_cards.rs` (remover): fim das faturas e do pagamento (RF-07).
- `apps/server/src/finance/tests/credit_cards.rs` (remover): testes do cartão (RF-07).
- `apps/server/src/finance/domain/account.rs` (alterar): a conta perde `kind` e `card`; saem `AccountKind`, `CreditCardTerms`, `CardFields` e `credit_card_terms` (RF-07).
- `apps/server/src/finance/domain/transaction.rs` (alterar): saem `Installment`, `installment`, `installment_group_id`, `statement_period` e o ciclo do cartão na edição (RF-07).
- `apps/server/src/finance/domain/transfer.rs` (alterar): sai `statement_period` (RF-07, CB-06).
- `apps/server/src/finance/domain/recurring_transaction.rs` (alterar): `settle_open` deixa de receber o período da fatura (RF-07).
- `apps/server/src/finance/domain/summary.rs` (alterar): saem `CardUsage` e `card_usage` (RF-09).
- `apps/server/src/finance/domain/error.rs` (alterar): saem `StatementAlreadyPaid` e `InstallmentNotEditable` (RF-07).
- `apps/server/src/finance/domain/mod.rs` (alterar): sai `pub mod credit_card;` (RF-07).
- `apps/server/src/finance/application/mod.rs` (alterar): sai `pub mod credit_cards;` (RF-07).
- `apps/server/src/finance/application/accounts.rs` (alterar): `NewAccount` e `AccountPatch` sem tipo nem campos de cartão (RF-07).
- `apps/server/src/finance/application/transactions.rs` (alterar): sai a compra parcelada (RF-07).
- `apps/server/src/finance/application/summaries.rs` (alterar): sai `credit_cards` e a lista de saldos traz todas as contas (RF-09).
- `apps/server/src/finance/application/transfers.rs` (alterar): sai `statement_period` (RF-07).
- `apps/server/src/finance/application/ports.rs` (alterar): saem `StatementPayment`, `statement_items`, `paid_periods` e `pay_statement` (RF-07).
- `apps/server/src/finance/infrastructure/mod.rs` (alterar): `TransactionRow` e `insert_transaction` sem colunas de parcela e fatura; saem `period`, `day`, `small` e `card_cycle` (RF-07).
- `apps/server/src/finance/infrastructure/pg_accounts.rs` (alterar): leituras e escritas sem `kind` nem colunas de cartão (RF-07).
- `apps/server/src/finance/infrastructure/pg_transactions.rs` (alterar): sem fatura, parcela e pagamento de fatura (RF-07).
- `apps/server/src/finance/infrastructure/pg_transfers.rs` (alterar): sem `statement_period` (RF-07, CB-06).
- `apps/server/src/finance/infrastructure/pg_recurring_transactions.rs` (alterar): a liquidação da ocorrência sem fatura e as cópias lidas sem colunas de parcela (RF-07).
- `apps/server/src/finance/interface/mod.rs` (alterar): saem as rotas `/credit-cards/{id}/statements` e `/credit-cards/{id}/statements/{period}/payment` (RF-07).
- `apps/server/src/finance/interface/handlers.rs` (alterar): saem `list_statements`, `pay_statement`, `statement_period` e os campos de cartão e parcela (RF-07).
- `apps/server/src/finance/interface/dto.rs` (alterar): saem os DTOs e campos de cartão listados em "Contratos e interfaces" (RF-07, RF-09).
- `apps/server/src/finance/interface/openapi.rs` (alterar): saem as rotas e os schemas de cartão, com o teste do contrato (RF-07, [project/development-methodology-03]).
- `apps/server/src/finance/mod.rs` (alterar): o `//!` do módulo sem cartões (RF-07).
- `apps/server/src/finance/tests/mod.rs` (alterar): sai `mod credit_cards;` e `create_card`; entra `mod credit_card_migration;` (RF-07).
- `apps/server/src/finance/tests/transactions.rs` (alterar): a edição sem cartão e a recusa de `installments` (RF-07).
- `apps/server/src/finance/tests/summaries.rs` (alterar): o resumo sem Cartões e com todas as contas no saldo (RF-09).
- `apps/server/src/finance/tests/authorization.rs` (alterar): a semente sem cartão e as rotas de fatura fora da lista, com o teste de que elas não existem mais (RF-07).
- `apps/server/src/reports/infrastructure/mod.rs` (alterar): a exportação do Financeiro sem as colunas de cartão e de parcela (RF-07).
- `apps/server/src/finance/tests/accounts.rs` (alterar): fora dos componentes do plano para esta tarefa (é da TASK-03), mas necessário aqui: o teste `creates_credit_card_account` cria um cartão e quebraria a suíte do Financeiro; ele vira o teste de que a conta não tem mais campos de cartão (RF-07). A TASK-03 vem depois na cadeia e não é afetada.
- `apps/server/src/finance/tests/credit_card_migration.rs` (criar): teste da migração sobre um banco com cartão, parcelas e fatura paga, conferindo contagens e saldos (CT-06, CB-05, CB-06, RNF-01); arquivo próprio para não misturar o teste de migração com os testes de API.
- `.sqlx` (alterar): dados offline das queries alteradas e removidas, regenerados com `cargo sqlx prepare --workspace` (KNW-009).

### Passos

1. Leia os arquivos de "Ler". Não rode outra compilação do `atria-server` em paralelo (KNW-007): os comandos `cargo` desta tarefa rodam um por vez. Nenhuma migração existente é editada ([project/development-methodology-02]).
2. Crie `apps/server/src/finance/migrations/20261103010001_remove-credit-cards.sql`. Decisões já tomadas, com o critério:
   - **Só DDL, sem `UPDATE`/`DELETE`.** As tabelas têm `FORCE ROW LEVEL SECURITY` e a migração roda sem `app.current_user_id`: um `UPDATE` afetaria zero linhas sem erro fora de um superusuário. Tirar as colunas já converte o cartão em conta comum, porque nada mais distingue os dois. Descartado: `UPDATE accounts SET kind = 'standard'` (depende do papel do banco e é inútil se a coluna sai).
   - **Remover as colunas, não mantê-las.** Descartado manter `accounts.kind` com `CHECK (kind = 'standard')` ou deixar `statement_period` nula sem uso: seriam colunas mortas ([project/code-style-08]) e o contrato da spec tira esses campos. Limite, fechamento, vencimento, número da parcela e período da fatura deixam de existir por RF-07; valores, datas, liquidações e saldos ficam intactos (RNF-01), e o backup antes do deploy cobre o resto (mitigação da spec). Descartado: tabela de arquivo com os dados do cartão (fora do escopo).
   - **Parcelas viram saídas independentes sem mudar a descrição (CB-05).** Cada parcela já é uma linha própria com a sua data prevista e o seu valor; basta tirar `installment_*`. Descartado: acrescentar "(2/3)" à descrição (muda texto da pessoa, que a CB-05 não pede, e esbarra no `CHECK` de 200 caracteres).
   - **Transferência da fatura paga continua, sem `statement_period` (CB-06).** Ela já moveu os saldos; só a coluna sai.
   - **Índice de `transfers.to_account_id`.** O índice atual é `(to_account_id, statement_period)` e some com a coluna; recrie `(to_account_id)` para a chave estrangeira continuar indexada ([project/database-07]).
   Conteúdo, com um `--` em pt-br no topo (fim do cartão de crédito, SPEC-003, RF-07, RF-10, RNF-01; só DDL por causa da RLS) e nesta ordem:
   ```sql
   ALTER TABLE accounts DROP CONSTRAINT accounts_credit_card_terms;
   ALTER TABLE accounts DROP CONSTRAINT accounts_default_is_standard;
   ALTER TABLE accounts
       DROP COLUMN kind,
       DROP COLUMN credit_limit_amount,
       DROP COLUMN closing_day,
       DROP COLUMN due_day;

   ALTER TABLE transactions DROP CONSTRAINT transactions_installment_coherent;
   DROP INDEX transactions_account_statement_period_idx;
   DROP INDEX transactions_installment_group_id_idx;
   ALTER TABLE transactions
       DROP COLUMN installment_number,
       DROP COLUMN installment_total,
       DROP COLUMN installment_group_id,
       DROP COLUMN statement_period;

   DROP INDEX transfers_to_account_id_idx;
   ALTER TABLE transfers DROP COLUMN statement_period;
   CREATE INDEX transfers_to_account_id_idx ON transfers (to_account_id);
   ```
   Confira: `git status --porcelain -- apps/server/src/finance/migrations` mostra só o arquivo novo.
3. Suba o PostgreSQL só para as macros do `sqlx` e aplique as migrações (já com a nova) com o binário compilado offline, antes de mudar qualquer query (KNW-009):
   - `docker rm -f atria-sqlx-postgres 2>/dev/null; docker run -d --name atria-sqlx-postgres --shm-size=512m -e POSTGRES_PASSWORD=postgres -p 55432:5432 postgres:17-alpine` e espere `docker exec atria-sqlx-postgres pg_isready -U postgres` responder `accepting connections`.
   - `SQLX_OFFLINE=true ATRIA_DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres ATRIA_PUBLIC_URL=http://localhost ATRIA_ENCRYPTION_KEY_FILE=/dev/null cargo run -q -p atria-server -- migrate`. Se a migração falhar aqui, corrija o SQL do passo 2 (o banco é descartável: recrie o container) antes de seguir.
   - Nos passos 4 a 12, rode os comandos `cargo` com `DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres` no ambiente, para as macros checarem as queries contra o esquema sem cartão.
4. Testes primeiro ([project/development-methodology-01]). Nenhum nome de teste novo contém `error`, `warning`, `failed` ou `panicked`.
   - Crie `apps/server/src/finance/tests/credit_card_migration.rs`, com `//!` em pt-br (migração do fim do cartão sobre dados existentes: CT-06, CB-05, CB-06, RNF-01), e declare `mod credit_card_migration;` em `apps/server/src/finance/tests/mod.rs`, em ordem alfabética (antes de `deletion_hook`). Use `ALICE`, `id_of` e `monthly_rule` de `super`, `TestContext` e `send` de `crate::http::test_support`, `begin_for_user` de `crate::shared::db` e `finance::migrator()`, como em `categories.rs`. Uma função `async fn seed_before_migration(ctx: &TestContext)` aplica `finance::migrator()` filtrado em `migration.version < 20261103010001` (mesmo `Cow::Owned` de `rnf01_system_key_migration_keeps_existing_categories`) e, numa transação de `begin_for_user(&ctx.state.pool, ALICE)`, insere por SQL (timestamps com `now()`, moeda `'BRL'`, ids `Uuid::from_u128`):
     - conta `1` "Conta principal", `kind 'standard'`, `is_default true`, `balance_amount 90000`; conta `2` "Cartão", `kind 'credit_card'`, `is_default false`, `balance_amount 0`, `credit_limit_amount 500000`, `closing_day 10`, `due_day 17`;
     - entrada `14` na conta `1`, 100000, prevista e liquidada em `2026-11-01` (`settled_amount 100000`, `difference_amount 0`, `difference_kind NULL`);
     - compra parcelada na conta `2`: saídas `11`, `12` e `13` de 10000, `installment_group_id 11`, `installment_number` 1, 2 e 3, `installment_total 3`, `expected_date` `2026-11-17`, `2026-12-17` e `2027-01-17`, `statement_period` `2026-11`, `2026-12` e `2027-01`; a `11` liquidada em `2026-11-17` por 10000 (`difference_amount 0`);
     - transferência `21` da conta `1` para a `2`, 10000, `transferred_on 2026-11-17`, `statement_period '2026-11'` (a fatura paga);
     - recorrente `31` de saída na conta `2`, 5000, `rule` = `monthly_rule("2026-11-25", 25)` ligada com `.bind(...)`.
     Os saldos batem com os dados: conta 1 = 100000 − 10000 = 90000; conta 2 = −10000 + 10000 = 0. Uma `async fn snapshot(ctx: &TestContext)` lê, com `begin_for_user`, as contagens de `accounts`, `transactions`, `transfers` e `recurring_transactions`, `SELECT id, balance_amount FROM accounts ORDER BY id`, `SELECT id, kind, account_id, expected_amount, expected_date::text, settled_amount, settled_at::text FROM transactions ORDER BY id` e `SELECT id, from_account_id, to_account_id, amount, transferred_on::text FROM transfers ORDER BY id` (datas como texto, para não depender de chrono x time). Testes:
     - `ct06_rnf01_card_migration_keeps_counts_and_balances`: semeia, tira o `snapshot`, roda `finance::migrator().run(&ctx.state.pool)`, tira de novo e confere igualdade; confere em `information_schema.columns` que `accounts` não tem `kind`, `credit_limit_amount`, `closing_day` e `due_day`, e que `transactions` e `transfers` não têm `installment_number`, `installment_total`, `installment_group_id` e `statement_period`; com `ctx.app(finance::router())` e `ctx.sign_in_as(ALICE)`, `GET /api/v1/accounts` devolve 2 contas, a `2` com `balance_amount` 0 e sem as chaves `kind` e `credit_limit_amount`, e `GET /api/v1/financial-summaries?from=2026-11-01&to=2026-11-30` devolve `balance.current` 90000, `balance.accounts` com 2 itens e nenhuma chave `credit_cards`.
     - `cb05_installments_become_independent_expenses`: semeia, migra e confere por `GET /api/v1/transactions?account_id=<conta 2>&repetition=one_off&from=2026-11-01&to=2027-01-31` três saídas de 10000 nas datas `2026-11-17`, `2026-12-17` e `2027-01-17`, a primeira liquidada e as outras duas abertas, nenhuma com a chave `installment`.
     - `cb06_paid_statement_transfer_keeps_amount_without_period`: semeia, migra e confere por `GET /api/v1/transfers/<21>` status 200, `amount` 10000, `from_account_id` conta 1, `to_account_id` conta 2 e nenhuma chave `statement_period`.
   - `apps/server/src/finance/tests/accounts.rs`: substitua `creates_credit_card_account` por `account_has_no_card_fields`: `POST /accounts` com `{"name": "Cartão", "kind": "credit_card"}` e com `{"name": "Cartão", "credit_limit_amount": 100000}` devolvem 422 (`deny_unknown_fields`); `GET /accounts/{id}` de uma conta criada com `create_account` não tem as chaves `kind`, `credit_limit_amount`, `closing_day` e `due_day`.
   - `apps/server/src/finance/tests/transactions.rs`: em `updates_unsettled_transaction_fields`, tire o cartão (a segunda edição, `card_status`/`on_card` e o `&card` do laço de saldos) e troque `updated["statement_period"] == Null` por `assert!(updated.get("statement_period").is_none())` e `assert!(updated.get("installment").is_none())`. Acrescente `installments_are_no_longer_accepted`: `POST /transactions` na conta padrão com `"installments": 3` devolve 422.
   - `apps/server/src/finance/tests/summaries.rs`: remova `summary_cards_show_open_statement_due_date_and_used_limit`. Em `summary_balance_has_current_forecast_at_period_end_and_per_account`, troque `create_card` por `t.create_account(&t.alice, "Poupança")` (a compra de 5000 continua nela) e passe a esperar `accounts.len() == 2` (todas as contas, na ordem da listagem de contas), com a `checking` em 100000 e a poupança em −5000, e `assert!(body.get("credit_cards").is_none())`.
   - `apps/server/src/finance/tests/authorization.rs`: em `seed`, tire `create_card`, a movimentação no cartão e a chave `"card"`; tire as duas rotas `/credit-cards/...` da lista de `other_user_resources_return_404`. Acrescente `statement_routes_are_gone`: `GET /api/v1/credit-cards/{id da poupança}/statements` e `POST /api/v1/credit-cards/{id}/statements/2026-11/payment` (com CSRF, como as outras mutações) devolvem 404.
   - `apps/server/src/finance/tests/mod.rs`: remova `mod credit_cards;` e `create_card`. Remova o arquivo `apps/server/src/finance/tests/credit_cards.rs`.
   - `apps/server/src/finance/interface/openapi.rs`: em `documents_all_finance_routes`, tire as duas rotas `/api/v1/credit-cards/...` de `expected`. Acrescente `card_schemas_are_gone_from_contract`: `components.schemas` sem `AccountKindDto`, `InstallmentDto`, `StatementResponse`, `StatementList`, `PayStatementRequest`, `StatementPaymentResponse` e `CreditCardSummaryDto`; `AccountResponse.properties` sem `kind`, `credit_limit_amount`, `closing_day` e `due_day`; `CreateTransactionRequest.properties` sem `installments`; `TransactionResponse` e `TransactionItemResponse` sem `installment` e `statement_period`; `TransferResponse` sem `statement_period`; `FinancialSummaryResponse` sem `credit_cards`; `AccountBalanceDto` sem `kind`.
   Rode `cargo test -p atria-server finance::` e confira que não compila ou que os testes novos falham.
5. Domínio, em `apps/server/src/finance/domain/`:
   - Remova `credit_card.rs` e `pub mod credit_card;` de `mod.rs`.
   - `account.rs`: tire `AccountKind`, `CreditCardTerms`, `CardFields`, `credit_card_terms`, os campos `kind` e `card` de `Account` (e de `default_for`), o teste `credit_card_requires_limit_closing_and_due_days` e o import de `CardCycle`; o `//!` passa a falar só de conta comum e da conta padrão.
   - `transaction.rs`: tire `Installment`, os campos `installment`, `installment_group_id` e `statement_period`, `moves_installment`, o parâmetro `cycle` de `apply_edit` (a regra da liquidada continua) e a frase sobre parcela e cartão do doc; no `fixtures::transaction` e nos testes, tire os campos e o argumento `None`/`Some(card)`; remova `installment_edit_refuses_account_and_date` e, em `unsettled_transaction_edit_accepts_all_editable_fields`, a asserção do `statement_period`.
   - `transfer.rs`: tire `statement_period` e o import.
   - `recurring_transaction.rs`: tire o parâmetro `statement_period` de `settle_open` e os campos `installment`, `installment_group_id` e `statement_period` da cópia; ajuste as chamadas nos testes do arquivo.
   - `summary.rs`: tire `CardUsage`, `card_usage`, o teste `card_used_limit_sums_unsettled_and_settled_in_open_statement`, o import de `StatementPeriod` e "cartões" do `//!`; remova imports que ficarem sem uso.
   - `error.rs`: tire `StatementAlreadyPaid` e `InstallmentNotEditable`, os `code()` e as asserções deles em `codes_are_stable`.
   Confira: `cargo test -p atria-server finance::domain::` passa.
6. Aplicação, em `apps/server/src/finance/application/`:
   - Remova `credit_cards.rs` e `pub mod credit_cards;` de `mod.rs`.
   - `accounts.rs`: `NewAccount { name, visibility }` e `AccountPatch { name, visibility }`; `create` grava a conta sem tipo nem cartão; `update` perde o bloco de `CardFields`; o `//!` fica "Casos de uso de contas (RF-24, RF-25, RF-26)...".
   - `transactions.rs`: tire `installments` de `NewTransaction`, a fn `installments`, o cálculo de `statement_period` e os campos de parcela; `create` continua devolvendo `Outcome<Vec<Transaction>>` com um único item. Decisão: manter a forma da resposta `CreatedTransactions { items }`; descartado devolver um objeto só, porque mudaria um contrato que a spec não lista. Ajuste o `//!` (sem "compra parcelada no cartão").
   - `transfers.rs`: tire `statement_period: None`.
   - `ports.rs`: tire `StatementPayment`, `statement_items`, `paid_periods`, `pay_statement`, o import de `StatementPeriod` e a frase "recusa a de uma fatura já paga" do doc de `undo_settlement`.
   - `summaries.rs`: tire `CardView`, `credit_cards`, fn `cards`, os imports de `AccountKind`, `StatementPeriod`, `CardUsage` e `card_usage`; `accounts` recebe `all_accounts` sem filtro, com o doc "Todas as contas; o saldo atual soma todas."; o `//!` deixa de citar cartões. Decisão: listar todas as contas, porque o cartão convertido vira conta comum e precisa aparecer no saldo; descartado esconder as ex-contas de cartão (não há mais como distingui-las).
7. Infraestrutura, em `apps/server/src/finance/infrastructure/`:
   - `mod.rs`: tire `period`, `day`, `small`, `card_cycle`, os imports de `CardCycle`, `StatementPeriod` e `Installment`, os campos `installment_number`, `installment_total`, `installment_group_id` e `statement_period` de `TransactionRow` e de `into_domain`, e as colunas e parâmetros correspondentes do `INSERT` de `insert_transaction`.
   - `pg_accounts.rs`: tire `kind`, `credit_limit_amount`, `closing_day` e `due_day` de `AccountRow`, de `into_domain`, dos `SELECT` de `list`, `get` e `delete`, dos `INSERT` de `ensure_default` e `insert` e do `UPDATE` de `update` (fica `name`, `visibility`, `updated_at`); remova `card_columns` e os imports. A regra de `delete` (recusa com movimentações) não muda: é da TASK-03.
   - `pg_transactions.rs`: tire as colunas de parcela e fatura dos `SELECT` de `lock_transaction`, `get` e `list`; tire `statement_period` do `UPDATE` de `save_edit` (renumere os parâmetros); remova `statement_paid`, a checagem dele em `undo_settlement`, `card_cycle` em `update` (chame `item.apply_edit(edit, now)`), e as fns `statement_items`, `paid_periods` e `pay_statement`, com os imports que ficarem sem uso (`outstanding_amount`, `StatementPeriod`, `StatementPayment`, `insert_transfer`, `period`, `Transfer`).
   - `pg_transfers.rs`: tire `statement_period` de `TransferRow`, de `into_domain`, do `INSERT` de `insert_transfer` e dos quatro `SELECT`. `insert_transfer` pode deixar de ser `pub(crate)` se só `pg_transfers.rs` o usar.
   - `pg_recurring_transactions.rs`: tire `card_cycle` e o cálculo do período de `settle_occurrence` (chame `recurring.settle_open(copy_id, request, now)`) e as colunas de parcela e fatura do `SELECT` de `settled_copies`.
8. Interface, em `apps/server/src/finance/interface/`:
   - `mod.rs`: remova as rotas `/credit-cards/{id}/statements` e `/credit-cards/{id}/statements/{period}/payment`.
   - `handlers.rs`: remova `statement_period`, `list_statements`, `pay_statement` e os imports de `credit_cards`, `CardFields` e `StatementPeriod`; `create_account` e `update_account` sem `check_amount("credit_limit_amount", ...)` nem `CardFields`; `create_transactions` sem `installments`.
   - `dto.rs`: remova `AccountKindDto` e os `From`, `InstallmentDto`, `StatementResponse`, `StatementList`, `PayStatementRequest`, `StatementPaymentResponse`, `CreditCardSummaryDto` e os imports de `Statement`, `StatementPayment`, `CardView` e `AccountKind`; tire `kind`, `credit_limit_amount`, `closing_day` e `due_day` de `CreateAccountRequest`, `UpdateAccountRequest` e `AccountResponse`; `installments` de `CreateTransactionRequest` (e a frase sobre parcela do doc de `UpdateTransactionRequest`); `installment` e `statement_period` de `TransactionResponse` e `TransactionItemResponse`; `statement_period` de `TransferResponse`; `kind` de `AccountBalanceDto`; `credit_cards` de `FinancialSummaryResponse`; o doc de `BalanceDto` passa a "o atual soma todas as contas, a lista traz todas". Decisão: com `deny_unknown_fields`, um pedido com `kind` ou campos de cartão é recusado com 422; descartado aceitar e ignorar `kind`, porque a spec remove o `AccountKindDto` e esconderia clientes desatualizados. A tela de conta só deixa de enviar `kind` na TASK-10, depois do contrato da TASK-07.
   - `openapi.rs`: tire `handlers::list_statements`, `handlers::pay_statement` e os schemas removidos da lista; a descrição da tag fica "Financeiro: contas, movimentações, recorrências e painel".
9. `apps/server/src/reports/infrastructure/mod.rs`, em `impl ExportSource for FinanceExport`: tire as colunas `kind`, `credit_limit_amount`, `closing_day` e `due_day` da tabela `accounts` e `installment_number` e `installment_total` da tabela `transactions`, com os valores correspondentes de cada linha.
10. `apps/server/src/finance/mod.rs`: o `//!` passa a "Contexto Financeiro: contas, movimentações, liquidação, transferências, categorias, recorrências com ocorrência aberta e o painel por período (...)", sem "cartões".
11. Rode `cargo test -p atria-server finance::` até passar, com `DATABASE_URL` do passo 3; depois `cargo test -p atria-server -- reports:: search::` e `cargo test -p atria-server http::tests::`. Confira também com `grep -rn 'credit_card\|statement_period\|installment' apps/server/src --include='*.rs'` que só sobram o nome do arquivo de teste `credit_card_migration.rs`, o SQL e as asserções desse teste e as asserções de ausência nos testes.
12. Regenere os dados offline: `cp -a .sqlx "${TMPDIR:-/tmp}/atria-sqlx-backup-spec003-task01"` e, com `DATABASE_URL` do passo 3, `cargo sqlx prepare --workspace`. Se o `prepare` falhar, restaure com `rm -rf .sqlx && cp -a "${TMPDIR:-/tmp}/atria-sqlx-backup-spec003-task01" .sqlx`, corrija e repita. Depois tire `DATABASE_URL` do ambiente, remova o banco das macros (`docker rm -f atria-sqlx-postgres`) e confira que `SQLX_OFFLINE=true cargo build -q -p atria-server` compila.
13. Rode `cargo fmt` e a Verificação inteira, sem `DATABASE_URL` no ambiente.
