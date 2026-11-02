# Estudo: empréstimos consignados descontados em folha

Este estudo é a primeira tarefa da SPEC-006 (RF-01). Ele confirma ou troca o contrato proposto pela spec antes de qualquer código, e as TASK-02 a TASK-08 o leem no primeiro passo: se alguma delas assumir algo diferente do que está aqui, ela para e pede ajuste. O caso de referência é o holerite de outubro de 2026, com salário líquido de R$ 10.669,88 sem os consignados, seis consignados que somam R$ 3.746,70 e R$ 6.923,18 caindo na conta.

## Pergunta

Como guardar um consignado ligado a uma entrada avulsa ou recorrente, como as parcelas existem e seguem a periodicidade da entrada, como liquidar e desfazer a entrada e as parcelas juntas e de forma atômica, e o que muda no banco e no contrato sem mexer nas movimentações existentes?

## Estado atual

O Financeiro tem só dois tipos de movimentação: `TransactionKind` é entrada (`income`) ou saída (`expense`). As sete categorias padrão (`SystemCategory::ALL`) são semeadas uma vez por pessoa; renomear uma delas limpa o `system_key`, e excluir é permitido.

A recorrente tem uma única ocorrência aberta, que é virtual: ela só existe na projeção. Liquidar a ocorrência grava uma cópia ligada por `generated_from`, e o índice único `transactions_generated_from_occurrence_key` garante uma cópia por ocorrência (DEC-003). Excluir a última cópia liquidada reabre a ocorrência (DEC-004), e desfazer a liquidação segue a DEC-005.

A liquidação, o desfazer e a exclusão já acontecem numa transação do banco dentro de `pg_transactions.rs` e `pg_recurring_transactions.rs`, com a movimentação (ou a recorrente) e a conta travadas ([project/database-03]). A tabela `recurring_transactions` tem `recurring_transactions_id_owner_key UNIQUE (id, owner_id)`, mas `transactions` não tem a restrição equivalente. As rotas reais de liquidação são `POST /api/v1/transactions/{id}/settlement`, `DELETE /api/v1/transactions/{id}/settlement` e `POST /api/v1/recurring-transactions/{id}/settlement`; a spec as chamou de `/settle`.

## Modelo de dados

O consignado fica numa tabela própria. Ele tem ciclo de vida próprio (cadastro, edição, encerramento e exclusão), e a parcela liquidada precisa de uma chave estrangeira para ele (RF-13), o que um `JSONB` dentro da entrada não oferece.

| Opção | Como fica | A favor | Contra |
|---|---|---|---|
| Tabela própria `payroll_loans` | Uma linha por consignado, ligada à entrada avulsa ou à recorrência | Chave estrangeira para a parcela, RLS própria, rotas e edição independentes | Uma tabela e uma migração a mais |
| `JSONB` na entrada | Lista de consignados dentro da entrada, como os itens da SPEC-004 | Sem tabela nova | Sem chave estrangeira para a parcela; editar um consignado reescreve a entrada; sem rota própria |

Recomendação: tabela própria `payroll_loans`, com estas colunas:

- `id`, `owner_id`, `visibility`, `created_at`, `updated_at` e `deleted_at`, como as demais tabelas do Financeiro;
- `income_id` e `income_recurrence_id`, com exatamente um preenchido (`CHECK (num_nonnulls(income_id, income_recurrence_id) = 1)`);
- `name`, de 1 a 60 caracteres, e `contract_number`, opcional, de 1 a 40;
- `installment_amount BIGINT CHECK (installment_amount > 0)` e `currency CHAR(3)`, copiada da entrada;
- `total_installments` e `current_installment` (`SMALLINT`), ou `ends_on DATE`, com um `CHECK` que aceita exatamente um dos dois modos e `1 ≤ current_installment ≤ total_installments`;
- `starts_on DATE NOT NULL`, a data da parcela atual.

As chaves estrangeiras são compostas com `owner_id`, para uma pessoa nunca ligar um consignado à entrada de outra: `(income_id, owner_id)` aponta para `transactions` e `(income_recurrence_id, owner_id)` para `recurring_transactions`. A tabela tem `UNIQUE (id, owner_id)`, índices nas duas chaves e no dono com `WHERE deleted_at IS NULL`, `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY` e a política do dono igual à de `transactions` ([project/database-01], [project/database-02], [project/database-05], [project/database-07], [project/database-08], [project/database-09]).

A parcela liquidada é uma linha de `transactions`, que ganha três colunas nulas:

- `payroll_loan_id`: o consignado;
- `income_transaction_id`: a entrada liquidada, avulsa ou cópia da recorrente;
- `installment_number`: o número da parcela, nulo no modo por data final.

A restrição `transactions_payroll_installment_coherent` exige `payroll_loan_id` e `income_transaction_id` juntos, `installment_number` só com eles e `kind = 'expense'` quando preenchidos. O índice único `transactions_payroll_installment_key ON (payroll_loan_id, income_transaction_id) WHERE deleted_at IS NULL` impede liquidar a mesma parcela duas vezes. As chaves compostas que apontam para `transactions` exigem a restrição nova `transactions_id_owner_key UNIQUE (id, owner_id)`.

A parcela não usa `generated_from`. Esse campo liga a cópia à recorrente, e `transactions_generated_from_occurrence_key` aceita uma só cópia por ocorrência: seis parcelas na mesma data seriam recusadas.

## Prazo e numeração das parcelas

O prazo tem dois modos que se excluem (RN-05, RN-06, decisão 3 da spec):

- total de parcelas: `total_installments` com `current_installment`;
- data final: `ends_on`.

Nos dois, `starts_on` é gravado como a data da parcela atual: a ocorrência aberta da recorrente ou a data da entrada avulsa.

O número da parcela numa data é `current_installment` mais a quantidade de datas da regra da entrada depois de `starts_on` até essa data (RN-07), contadas com `next_date_after` de `recurring_transaction.rs`. A última parcela é a de número `total_installments` ou, no modo por data, a última data da regra até `ends_on`, ou seja, a do período que contém a data. O status `active` ou `ended` é calculado, não gravado (RF-10, CB-01). Pular a ocorrência pula a parcela do período, porque a contagem segue as datas. Editar `current_installment` grava de novo `starts_on` com a ocorrência aberta.

Converter a data final num total na hora do cadastro foi descartado: a conta ficaria errada se a periodicidade da entrada mudasse depois.

Recusas:

- `current_installment`/`out_of_range`, quando a parcela atual passa do total ou é menor que 1 (CB-02);
- `ends_on`/`before_next_installment`, quando a data final é anterior à próxima parcela (CB-03);
- `ends_on`/`fields_mismatch`, quando vêm os dois modos ou nenhum.

Casos da tabela: `ct02` (última parcela em 2027-03-05), `ct07` (última parcela em 2029-11-05), `cb02` e `cb03`.

## Geração das parcelas

A parcela aberta é virtual, e a liquidada é gravada. É o mesmo modelo da ocorrência da recorrente (DEC-003), e vale também para a entrada avulsa, com uma única parcela na data da entrada (FA-04).

| Opção | Como fica | A favor | Contra |
|---|---|---|---|
| (a) Gravadas desde o cadastro | Uma saída por parcela, até o fim do prazo | Listagem direta | 48 linhas futuras, contra a DEC-003; cada edição da entrada sincroniza as parcelas |
| (b) Virtuais até a liquidação | A projeção calcula as parcelas; a liquidação grava cada uma | Igual à recorrente; mudar a entrada muda as parcelas sem gravar nada | A projeção ganha mais um tipo de item |
| (c) Recorrência de saída ligada | Uma recorrente de saída por consignado | Reaproveita a recorrente | Duplica a regra; pode ser liquidada sozinha, contra a RN-08; precisa de sincronização |

Recomendação: (b). As parcelas virtuais entram em três pontos:

- `forecast.rs`: a `VirtualOccurrence` ganha `payroll_loan_id` e `installment_number`, e a chave do item passa a ser o `payroll_loan_id` quando presente, para seis parcelas na mesma data não colidirem;
- `virtual_items` em `application/transactions.rs`: as listagens, inclusive as parcelas das entradas avulsas ainda abertas;
- `projected` em `application/summaries.rs`: o painel (RF-06).

Mudar a conta ou a data da entrada muda as parcelas abertas sem nenhuma gravação (CB-07). Nenhuma parcela aberta é liquidável sozinha, porque não tem linha (RN-08).

Casos da tabela: `ct03` (projeção com entrada 1066988 e saídas de 374670) e `fa04`.

## Liquidação conjunta

Com parcelas no período, o pedido de liquidação traz `account_amount`, o valor que caiu na conta, no lugar de `settled_amount` (RF-08, decisão 12 da spec). O líquido da entrada é `account_amount + Σ parcelas` (RN-02), e as parcelas ficam com o valor fixo (RN-03). Só depois entra o cálculo reverso da SPEC-004 (e o da SPEC-005, quando houver base ligada ou parcela a deduzir) sobre esse líquido, como em `financeiro-descontos.md`.

A ordem dentro da única transação do banco é esta (RNF-03):

1. travar a entrada (ou a recorrente);
2. travar os consignados dela com `FOR UPDATE`;
3. travar a conta;
4. liquidar a entrada com `account_amount + Σ parcelas`;
5. inserir uma saída já liquidada por parcela, na mesma data e na mesma conta (RF-07);
6. somar ao saldo uma vez `account_amount`.

Qualquer erro desfaz tudo (CT-12). Os métodos que já fazem a liquidação em `pg_transactions.rs` e `pg_recurring_transactions.rs` ganham esses passos; um método novo que repetisse a liquidação inteira em outro lugar foi descartado, porque duplicaria as travas da SPEC-004.

Recusas:

- `account_amount`/`must_not_be_negative`, quando `account_amount` é negativo, o mesmo código de `settled_amount` negativo de hoje;
- `account_amount`/`fields_mismatch`, quando `account_amount` vem sem parcelas no período ou quando `settled_amount` vem com parcelas;
- `installment_follows_income` (409), ao tentar liquidar, desfazer, editar ou excluir uma parcela sozinha (RN-08, CB-05).

`account_amount` menor que a soma das parcelas é aceito (CB-04, CT-15, decisão 13 da spec). A entrada é liquidada com `account_amount + Σ`, as parcelas são liquidadas e o saldo sobe `account_amount`. Pela RN-02, o líquido nunca fica negativo com `account_amount` ≥ 0. Só a tela avisa antes de confirmar, para pegar erro de digitação, sem bloquear; o servidor não tem código de erro para isso.

A prévia `POST /api/v1/transactions/settlement-preview` não muda: a tela soma as parcelas ao valor que caiu na conta antes de pedir a prévia.

Casos da tabela: `ct04` (conta 692318, entrada 1066988, saldo +692318), `ct05` (entrada 1074670, diferença 7682), `cb04` (entrada 749339), `cb04-negativo` e `cb05`.

## Desfazer e excluir

Desfazer a liquidação da entrada faz a exclusão lógica das saídas das parcelas daquele período (as de `income_transaction_id` igual à entrada), na mesma transação, e o saldo volta `account_amount` (RF-09). Na cópia da recorrente, a cópia é excluída e a ocorrência reabre, como na DEC-004 e na DEC-005, e as parcelas voltam a ser virtuais. Na entrada avulsa, ela volta a aberta, e a parcela também volta a virtual. Excluir a última cópia liquidada (DEC-004) segue o mesmo caminho.

Excluir a entrada ou a recorrente com consignados faz a exclusão lógica dos consignados (RN-09). As parcelas já liquidadas de períodos anteriores ficam como histórico. Desfazer as parcelas em separado foi descartado (decisão 8 da spec).

Caso da tabela: `ct06`.

## Categoria do sistema "Empréstimo"

A categoria é `SystemCategory::Loan`, de chave `loan`, de saída, com o nome gravado "Empréstimo" e a cor `#92400e`. Ela fica fora de `SystemCategory::ALL`, então as padrão continuam sete e o semeio não muda, mas é reconhecida por `from_key`.

Ela é criada sob demanda, na transação que cadastra o primeiro consignado da pessoa, com o índice único parcial `categories_owner_loan_key ON categories (owner_id) WHERE system_key = 'loan' AND deleted_at IS NULL`. Se a pessoa já tem uma categoria de saída chamada "Empréstimo" sem chave, essa categoria é adotada e recebe `system_key = 'loan'`, porque `categories_owner_kind_name_key` recusaria uma segunda.

Renomear ou excluir a "Empréstimo" é recusado com `system_category_locked` (RN-04, CB-06); a cor e a visibilidade mudam. Semear a categoria na migração foi descartado, porque exigiria `NO FORCE` e uma inserção por pessoa; colocá-la em `ALL` também, porque quem já foi semeado nunca a receberia.

Há uma diferença com a spec: o CB-06 diz "como as demais categorias do sistema", mas hoje as sete padrão podem ser renomeadas e excluídas. O estudo não muda esse comportamento; só a "Empréstimo" fica protegida.

## Migração

O arquivo `20261105010001_add-payroll-loans.sql` tem só DDL, como a `20261103010001_remove-credit-cards.sql`. Ele:

1. cria `payroll_loans` com a RLS;
2. acrescenta `transactions_id_owner_key UNIQUE (id, owner_id)`;
3. acrescenta as três colunas nulas de `transactions`, sem padrão;
4. cria a restrição `transactions_payroll_installment_coherent` e o índice `transactions_payroll_installment_key`;
5. cria `categories_owner_loan_key`.

Nada existente muda (RNF-02): as colunas novas nascem nulas; a restrição vale nas linhas antigas, em que tudo é nulo; `UNIQUE (id, owner_id)` vale porque `id` já é chave primária; e o índice parcial da categoria não cobre nenhuma linha atual. Não há `UPDATE` nem `NO FORCE` temporário ([project/development-methodology-02]).

Recomenda-se o teste de migração na TASK-03: saldo das contas e resumo do painel iguais antes e depois.

## Contrato

O consignado confirma os campos da spec (`income_id`, `income_recurrence_id`, `name`, `contract_number`, `installment_amount`, `total_installments`, `current_installment` e `ends_on`) e ganha campos só de leitura:

- `status` (`active` ou `ended`), calculado;
- `currency`, `starts_on`, `next_installment_on`, `last_installment_on` e `remaining_installments`.

Na resposta, `current_installment` é o número da próxima parcela aberta, e é nulo no modo por data final.

Rotas:

- `GET /api/v1/payroll-loans`, com os filtros `income_id` e `income_recurrence_id`;
- `POST /api/v1/payroll-loans`;
- `GET/PATCH/DELETE /api/v1/payroll-loans/{id}`.

A movimentação ganha, só para leitura, `payroll_loan_id`, `income_transaction_id` e `installment_number`. A parcela virtual da listagem traz `payroll_loan_id`, `installment_number` e a origem (`income_id` ou `recurrence_id`).

As duas rotas de liquidação, `POST /api/v1/transactions/{id}/settlement` e `POST /api/v1/recurring-transactions/{id}/settlement`, aceitam `account_amount`; `settled_amount` passa a ser opcional, com exatamente um dos dois.

Códigos de erro novos:

- `current_installment`/`out_of_range`, `ends_on`/`before_next_installment` e `ends_on`/`fields_mismatch`;
- `account_amount`/`must_not_be_negative` e `account_amount`/`fields_mismatch`;
- `installment_follows_income` (409);
- `system_category_locked`;
- `income_id`/`not_income` e `income_id`/`already_settled`, no cadastro.

## Tabela de casos comum

Os valores estão em centavos. A entrada é a recorrência mensal do salário, no dia 5, com a ocorrência aberta em 2026-11-05 e líquido previsto de 1066988: o bruto 1450000 menos INSS 98807, IRPF 280705 e Sindical 3500. Os seis consignados têm parcelas de 26491, 4527, 16047, 16941, 16941 e 293723, com soma de 374670. O de 293723 é o "Empréstimo 178176138", parcela 12 de 48. As TASK-02 e TASK-04 usam estes ids nos nomes dos testes.

| id | entrada | resultado |
|---|---|---|
| ct02 | consignado com `ends_on` 2027-03-20 e `starts_on` 2026-11-05 | parcelas em 2026-11-05, 2026-12-05, 2027-01-05, 2027-02-05 e 2027-03-05; última 2027-03-05; `remaining_installments` 5 |
| ct03 | projeção de 2026-11 com os seis consignados | entrada 1066988; seis saídas virtuais "Empréstimo" que somam 374670 |
| ct04 | liquidar 2026-11-05 com `account_amount` 692318 | entrada liquidada com 1066988 (diferença 0); seis saídas liquidadas com o valor de cada parcela, `installment_number` 12 na de 293723; saldo +692318 |
| ct05 | liquidar com `account_amount` 700000 | entrada liquidada com 1074670, diferença 7682 (`gain`); parcelas fixas; saldo +700000 |
| cb04 | liquidar com `account_amount` 374669 (abaixo das parcelas, CT-15) | aceito: entrada liquidada com 749339; seis saídas liquidadas; saldo +374669 |
| cb04-negativo | liquidar com `account_amount` −1 | `account_amount`/`must_not_be_negative`; nada é liquidado |
| cb05 | liquidar, desfazer ou excluir sozinha uma saída de parcela do ct04 | `installment_follows_income` (409) |
| ct06 | desfazer a liquidação do ct04 | cópia e seis saídas com exclusão lógica; ocorrência 2026-11-05 reaberta; saldo −692318; parcelas virtuais de novo |
| ct07 | consignado de 293723, parcela 12 de 48 | última parcela 2029-11-05 (48 − 12 = 36 meses); depois dela, `status` `ended` e nenhuma parcela virtual |
| cb02 | `current_installment` 49 com `total_installments` 48 | `current_installment`/`out_of_range` |
| cb03 | `ends_on` 2026-11-04 com a próxima parcela em 2026-11-05 | `ends_on`/`before_next_installment` |
| fa04 | entrada avulsa de 1066988 em 2026-11-20 com o consignado de 293723 | uma parcela virtual em 2026-11-20; liquidar com `account_amount` 773265 dá entrada 1066988; depois, `status` `ended` |

## Recomendação

1. Tabela própria `payroll_loans`, com RLS e chaves compostas com `owner_id`, ligada à entrada avulsa ou à recorrência.
2. Prazo em dois modos que se excluem, total de parcelas com a atual ou data final, com `starts_on` e status calculado.
3. Parcela aberta virtual e liquidada gravada em `transactions`, com `payroll_loan_id`, `income_transaction_id` e `installment_number`, sem `generated_from`.
4. Liquidação conjunta numa só transação do banco, com `account_amount` somado às parcelas antes do cálculo reverso; valor abaixo das parcelas aceito.
5. Desfazer conjunto, com a ocorrência reaberta como na DEC-004 e na DEC-005.
6. Categoria "Empréstimo" protegida e criada sob demanda.
7. Migração só com DDL, sem mudar nenhuma linha existente.

## O que muda no contrato da spec

| Ponto do contrato | Proposta da spec | Recomendação do estudo |
|---|---|---|
| Campos do consignado | `income_id`, `income_recurrence_id`, `name`, `contract_number`, `installment_amount`, `total_installments`, `current_installment`, `ends_on` | confirma; `current_installment` na resposta é a próxima parcela aberta |
| `status` | `active` gravado | só leitura e calculado (`active` ou `ended`) |
| Campos de leitura do consignado | nenhum | `currency`, `starts_on`, `next_installment_on`, `last_installment_on`, `remaining_installments` |
| Rotas do consignado | `GET/POST /api/v1/payroll-loans`, `GET/PATCH/DELETE /api/v1/payroll-loans/{id}` | confirma, com os filtros `income_id` e `income_recurrence_id` no `GET` |
| Ligação da parcela | `payroll_loan_id` | `payroll_loan_id`, `income_transaction_id` e `installment_number`, só leitura |
| Rotas de liquidação | `POST /api/v1/transactions/{id}/settle` | `POST/DELETE /api/v1/transactions/{id}/settlement` e `POST /api/v1/recurring-transactions/{id}/settlement`, as rotas que já existem |
| `account_amount` e `settled_amount` | `account_amount` aceito quando há consignados | exatamente um dos dois; `settled_amount` passa a ser opcional |
| Códigos de erro | não definidos | os listados em "Contrato" |
| Armazenamento | não definido | tabela própria `payroll_loans` e três colunas novas em `transactions` |

Como na DEC-014, a spec não é ajustada: as tarefas seguem esta versão do contrato, e a diferença fica registrada aqui para a finalização.

## O que muda nas tarefas

| Tarefa | Mudança | Status |
|---|---|---|
| TASK-02 | Nenhuma: o detalhamento já segue o prazo em dois modos, a categoria `SystemCategory::Loan` e os códigos deste estudo. | já detalhada assim |
| TASK-03 | Nenhuma: o detalhamento já leva `account_amount`, `settled_amount` opcional e os campos novos da movimentação ao contrato, e inclui o teste de migração. | já detalhada assim |
| TASK-04 | A liquidação conjunta exige `infrastructure/pg_transactions.rs`, `infrastructure/pg_recurring_transactions.rs`, `application/ports.rs`, `domain/recurring_transaction.rs` e `application/summaries.rs` além dos arquivos do plano. | já incluídos no detalhamento aprovado |
| TASK-05 a TASK-08 | Nenhuma: as telas já usam as rotas `/settlement`, `account_amount` e o aviso de valor abaixo das parcelas. | já detalhadas assim |

## Decisões em aberto

Nenhuma.

## Fontes

- [Estudo dos descontos e acréscimos do Financeiro](financeiro-descontos.md)
- [Recorrente e ocorrência aberta](../../apps/server/src/finance/domain/recurring_transaction.rs)
- [Projeção das ocorrências virtuais](../../apps/server/src/finance/domain/forecast.rs)
- [Categorias do sistema](../../apps/server/src/finance/domain/category.rs)
- [Liquidação, desfazer e exclusão no banco](../../apps/server/src/finance/infrastructure/pg_transactions.rs)
- [Tabela de movimentações e suas restrições](../../apps/server/src/finance/migrations/20261101070004_create-finance-transactions.sql)
- [Remoção do cartão de crédito, migração só com DDL](../../apps/server/src/finance/migrations/20261103010001_remove-credit-cards.sql)
