<!-- Escrito na finalização da tarefa. -->

## Resumo

Remove o cartão de crédito do servidor financeiro (SPEC-003, TASK-01): tipo de conta cartão, limite, fechamento e vencimento, faturas, pagamento de fatura, período de fatura e campos de parcela. A migração `20261103010001_remove-credit-cards.sql` remove colunas e constraints correspondentes e não altera valores, datas, liquidações nem saldos.

## Migração

- `apps/server/src/finance/migrations/20261103010001_remove-credit-cards.sql` (novo, só DDL):
  - `accounts`: remove as constraints `accounts_credit_card_terms` e `accounts_default_is_standard` e as colunas `kind`, `credit_limit_amount`, `closing_day` e `due_day`.
  - `transactions`: remove a constraint `transactions_installment_coherent`, os índices `transactions_account_statement_period_idx` e `transactions_installment_group_id_idx`, e as colunas `installment_number`, `installment_total`, `installment_group_id` e `statement_period`.
  - `transfers`: remove `transfers_to_account_id_idx` e a coluna `statement_period`; recria `transfers_to_account_id_idx` apenas em `(to_account_id)`, para a chave estrangeira continuar indexada.
- Nenhuma migração existente foi editada.

## Mudanças por camada

**Domínio** (`apps/server/src/finance/domain/`)
- `credit_card.rs`: removido (`StatementPeriod`, `CardCycle`, `split_installments`, `outstanding_amount`). `mod.rs` deixa de declará-lo.
- `account.rs`: saem `AccountKind`, `CreditCardTerms`, `CardFields`, `credit_card_terms` e os campos `kind` e `card` de `Account`, com o teste de cartão.
- `transaction.rs`: saem `Installment`, os campos de parcela e de período e `moves_installment`. `apply_edit` perde o parâmetro `cycle`; a regra de transação liquidada é mantida.
- `transfer.rs`: sai `statement_period`.
- `recurring_transaction.rs`: `settle_open` deixa de receber `statement_period`; a cópia não tem mais campos de parcela e fatura.
- `summary.rs`: saem `CardUsage`, `card_usage` e seu teste.
- `error.rs`: saem `StatementAlreadyPaid` e `InstallmentNotEditable`; `codes_are_stable` ajustado.

**Aplicação** (`apps/server/src/finance/application/`)
- `credit_cards.rs`: removido; `mod.rs` deixa de declará-lo.
- `accounts.rs`: `NewAccount` e `AccountPatch` ficam só com `name` e `visibility`.
- `transactions.rs`: sai `installments`, o cálculo de período e os campos de parcela. `create` continua devolvendo `CreatedTransactions { items }`, agora com um único item.
- `transfers.rs`: sai `statement_period`.
- `ports.rs`: saem `StatementPayment`, `statement_items`, `paid_periods` e `pay_statement`; o doc de `undo_settlement` deixa de citar a recusa de fatura paga.
- `summaries.rs`: saem `CardView` e `credit_cards`; `accounts` recebe `all_accounts`, sem filtro.

**Infraestrutura** (`apps/server/src/finance/infrastructure/`)
- `mod.rs`: saem os helpers `period`, `day`, `small` e `card_cycle`; `TransactionRow` e `insert_transaction` ficam sem colunas de parcela e fatura.
- `pg_accounts.rs`: leituras, inserções e `update` sem `kind` nem colunas de cartão; `card_columns` removido. A regra de `delete` (recusa com movimentações) não muda.
- `pg_transactions.rs`: sem colunas de parcela e fatura em `lock_transaction`, `get` e `list`; `save_edit` sem `statement_period`; removidos `statement_paid`, `statement_items`, `paid_periods` e `pay_statement`; `undo_settlement` sem checagem de fatura; `update` chama `apply_edit(edit, now)`.
- `pg_transfers.rs`: sem `statement_period` em leitura, inserção e `SELECT`.
- `pg_recurring_transactions.rs`: `settle_occurrence` chama `settle_open(copy_id, request, now)`; `settled_copies` sem colunas de parcela e fatura.

**Interface** (`apps/server/src/finance/interface/`)
- `mod.rs`: rotas `/credit-cards/{id}/statements` e `/credit-cards/{id}/statements/{period}/payment` removidas.
- `handlers.rs`: removidos `list_statements`, `pay_statement` e `statement_period`; `create_account` e `update_account` sem `credit_limit_amount`; `create_transactions` sem `installments`.
- `dto.rs`: removidos `AccountKindDto`, `InstallmentDto`, `StatementResponse`, `StatementList`, `PayStatementRequest`, `StatementPaymentResponse` e `CreditCardSummaryDto`; saem os campos `kind`, `credit_limit_amount`, `closing_day`, `due_day`, `installments`, `installment`, `statement_period` e `credit_cards` dos DTOs. Os DTOs usam `deny_unknown_fields`, então pedidos com esses campos são recusados com 422.
- `openapi.rs`: rotas e schemas de cartão fora do contrato; descrição da tag passa a "Financeiro: contas, movimentações, recorrências e painel". O teste `documents_all_finance_routes` foi ajustado e `card_schemas_are_gone_from_contract` foi acrescentado.
- `apps/server/src/finance/mod.rs`: `//!` do módulo sem cartões.

**Relatórios** (`apps/server/src/reports/infrastructure/mod.rs`)
- Exportação do Financeiro sem `kind`, `credit_limit_amount`, `closing_day` e `due_day` (tabela `accounts`) e sem `installment_number` e `installment_total` (tabela `transactions`).

**Testes** (`apps/server/src/finance/tests/`)
- `credit_cards.rs`: removido; `mod.rs` sem `mod credit_cards;` e sem `create_card`.
- `credit_card_migration.rs` (novo): semeia um banco no estado anterior (migrações com versão menor que `20261103010001`), aplica a migração e confere, nos testes `ct06_rnf01_card_migration_keeps_counts_and_balances`, `cb05_installments_become_independent_expenses` e `cb06_paid_statement_transfer_keeps_amount_without_period`, contagens e saldos iguais antes e depois, colunas removidas do esquema e as respostas das rotas de contas, resumo, transações e transferências.
- `accounts.rs`: `creates_credit_card_account` substituído por `account_has_no_card_fields`. Este arquivo estava fora dos componentes desta tarefa (o plano o atribui à TASK-03), mas o teste antigo quebraria a suíte do Financeiro.
- `transactions.rs`, `summaries.rs` e `authorization.rs`: ajustados para o modelo sem cartão; as rotas de fatura passam a devolver 404.

**Dados offline** (`.sqlx/`)
- 22 arquivos alterados, regenerados com `cargo sqlx prepare --workspace` contra um PostgreSQL 17 descartável com as migrações aplicadas.

## Decisões

- **Só DDL, sem `UPDATE` nem `DELETE`.** As tabelas têm `FORCE ROW LEVEL SECURITY` e a migração roda sem `app.current_user_id`; um `UPDATE` afetaria zero linhas sem erro. Remover a coluna `kind` já transforma o cartão em conta comum, pois nada mais o distingue. Descartado `UPDATE accounts SET kind = 'standard'`.
- **Remover as colunas, sem mantê-las.** Manter `kind` com `CHECK (kind = 'standard')` ou `statement_period` nula seria código morto. Descartada uma tabela de arquivo com os dados do cartão, fora do escopo.
- **Parcelas como saídas independentes, sem alterar a descrição.** Cada parcela já é uma linha própria com data e valor; basta remover `installment_*`. Descartado acrescentar "(2/3)" à descrição: mudaria o texto informado pelo usuário e esbarraria no limite de 200 caracteres.
- **Transferência de fatura paga mantida**, sem `statement_period`. Ela já movimentou os saldos.
- **Índice de `transfers.to_account_id`** recriado como `(to_account_id)`, pois o índice atual depende da coluna removida.
- **Pedidos com campos de cartão são recusados (422), não ignorados.** Aceitar e descartar `kind` esconderia clientes desatualizados, já que o contrato remove `AccountKindDto`.
- **Forma da resposta de criação de transações mantida** (`CreatedTransactions { items }`), porque trocar por um objeto único mudaria um contrato que a spec não lista.
- **Resumo lista todas as contas.** Ex-cartões viram contas comuns e precisam aparecer no saldo; não há mais como distingui-los.

## Verificação

- Verificação (testes): passou sem falhas. Saída em `validation/tests.out`, na pasta da tarefa.
- Regressão: comparada com o baseline de 6 comandos (todos com código de saída 0); resultado "passed", com 4 comandos iguais ao baseline, 1 com acréscimo e 1 mudança esperada.
- Evidências: 2 arquivos em `evidencias/`, na pasta da tarefa; resultado "passed".

## Pontos de atenção

- **Contrato com a tela de contas.** Pedidos com `kind` são recusados. A tela ainda envia `kind` e só deixa de enviá-lo na TASK-10, depois do contrato da TASK-07. Até lá, criar ou alterar contas pela tela pode falhar.
- **Dados de cartão deixam de existir no banco:** limite, fechamento, vencimento, número de parcela e período de fatura. O backup antes do deploy é a mitigação prevista na spec para o risco de a migração errar saldos ou perder compras.
- **Regra de exclusão de conta** (recusa com movimentações) continua igual; a alteração dela é da TASK-03.
- **Migrações com RLS forçada** rodam sem usuário, por isso devem ser só DDL quando não houver filtro de usuário disponível.
- **Operação:** uma compilação pesada do servidor por vez (KNW-007); a `.sqlx` é regenerada contra um banco vazio com o esquema atual (KNW-009).
