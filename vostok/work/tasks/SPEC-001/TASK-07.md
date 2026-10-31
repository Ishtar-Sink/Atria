---
id: TASK-07
spec: SPEC-001
title: "Contexto finance"
profile: julgamento
persona: desenvolvedor
depends_on: [TASK-04]
wave: 4
covers: [RF-24, RF-25, RF-26, RF-27, RF-28, RF-29, RF-30, RF-31, RF-32, RF-33, RF-34, RF-35, CT-17, CT-18, CT-19, CT-20, CT-21, CT-22]
type: historia
labels: [SPEC-001, julgamento]
status: done
content_hash: 222b1ecd5a8671436404e95cf9eba5461265acbac23fdc68145432a315de099d
adjustments: 3
adjusted_at: 2026-10-30T21:38:00Z
approved_at: 2026-10-30T14:38:10Z
approved_hash: 044eb6c895a72a188b8e5dbd4e82f0ea116bc002eee447fae3b2e3eb21b31bb0
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: opus
updated_at: 2026-10-30T21:38:00Z
---

# TASK-07: Contexto finance

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md` (RF-24 a RF-35, RN-01 a RN-09, RN-18, CB-01, CB-02, CB-03, CB-09, CB-10, CB-15, CT-17 a CT-22, contratos "Movimentação financeira" e "Regra de recorrência", decisões 7, 17, 18, 19, 20, 22, 42, 55, 56)
- `docs/decisoes-do-prototipo.md` (linhas PD-49 a PD-58 e a seção "Decisões resolvidas em 30/10 (DEC-002)")
- `docs/estudos/financeiro-painel.md` (blocos e regras do painel do Financeiro, PD-58)
- `prototype/atria-prototype.html` (funções `renderFinancePanel` e a liquidação da recorrente, com `from_recurring`, como referência do comportamento)
- `vostok/memory/decisions.md` (só pelas consultas `vostok memory search decision DEC-002` e `vostok memory search decision DEC-003`)
- `vostok/work/tasks/SPEC-001/TASK-15.md` (contrato do gancho `EntityDeletedHook` chamado ao excluir, CB-06)
- `apps/server/src/finance` (código da primeira execução desta tarefa, que este ajuste refaz em parte)
- `apps/server/Cargo.toml`
- `apps/server/src/main.rs`
- `apps/server/src/shared` (erros `problem+json`, UUID v7, relógio injetável, dinheiro, regra de recorrência, visibilidade)
- `apps/server/src/http` (`AppState`, extrator da sessão, CSRF e auxiliares de teste)
- `vostok/rules/project/api.md`
- `vostok/rules/project/database.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`
- `vostok/rules/project/security.md`
- `vostok/rules/project/architecture.md`

### Mudar

- `apps/server/src/finance/mod.rs` (alterar): mantém as camadas, `router()`, `migrator()` e `FinanceApi`; só confere que declara os módulos novos de domínio e de testes.
- `apps/server/src/finance/domain/mod.rs` (alterar): declara o módulo novo `forecast`.
- `apps/server/src/finance/domain/account.rs` (alterar): sem mudança de regra neste ajuste; continua a conta, o tipo, a conta padrão e a regra de exclusão (RN-04).
- `apps/server/src/finance/domain/transaction.rs` (alterar): troca `recurrence_id` da movimentação gravada por `generated_from` (cópia liquidada de uma recorrente) e acrescenta a data efetiva (liquidação ou prevista) e o status `settled`, `open`, `overdue`, `forecast` (PD-51, PD-55, DEC-003). Acrescenta a edição (campos aceitos conforme a liquidação) e o desfazer da liquidação (DEC-005).
- `apps/server/src/finance/domain/settlement.rs` (alterar): sem mudança de regra neste ajuste (RN-01, RN-02, RN-03).
- `apps/server/src/finance/domain/credit_card.rs` (alterar): sem mudança de regra neste ajuste; o resumo usa `statement_for` e `due_date` para a fatura aberta.
- `apps/server/src/finance/domain/transfer.rs` (alterar): sem mudança de regra neste ajuste (RN-05).
- `apps/server/src/finance/domain/category.rs` (alterar): tipo `income`/`expense` e cor da categoria, e a substituição na exclusão só por categoria do mesmo tipo (PD-49, PD-58, CB-15).
- `apps/server/src/finance/domain/recurring_transaction.rs` (alterar): ocorrência aberta única, liquidação com cópia, pulo, atraso e mudança de regra ou valor só na aberta e nas seguintes, no lugar da materialização (PD-51, DEC-003, RN-08, RN-09).
- `apps/server/src/finance/domain/forecast.rs` (criar): itens da listagem e do painel, com a projeção virtual das ocorrências seguintes num intervalo, marcadas como previsão, e a ordenação pela data efetiva (PD-51, PD-55).
- `apps/server/src/finance/domain/summary.rs` (alterar): resumo de um período livre: fechamento realizado e previsto, comparação com o período anterior de mesmo tamanho, "Para onde foi", previsto x realizado, economias e perdas, saldo, cartões e próximas contas (PD-55, PD-58, RF-35).
- `apps/server/src/finance/domain/error.rs` (alterar): códigos novos `occurrence_not_open`, `recurrence_ended` e `category_kind_mismatch`. Acrescenta `statement_already_paid`, `installment_not_editable` e `transaction_not_settled` (DEC-005).
- `apps/server/src/finance/application/mod.rs` (alterar): exporta os casos de uso novos.
- `apps/server/src/finance/application/ports.rs` (alterar): portas da ocorrência aberta (liquidar com cópia, pular) e dos filtros novos da listagem; o alias `EntityDeletedHook` continua com a grafia da TASK-15. Acrescenta as portas de edição, de desfazer a liquidação, da listagem das cópias e do filtro `q` (DEC-005).
- `apps/server/src/finance/application/accounts.rs` (alterar): sem mudança de regra neste ajuste.
- `apps/server/src/finance/application/transactions.rs` (alterar): listagem por período livre pela data efetiva, com os filtros de categoria e de repetição e as ocorrências virtuais; registro recusa categoria de outro tipo. Acrescenta a edição (`PATCH`), o desfazer da liquidação e a busca `q` (DEC-005).
- `apps/server/src/finance/application/credit_cards.rs` (alterar): sem mudança de regra neste ajuste.
- `apps/server/src/finance/application/transfers.rs` (alterar): listagem com `from` e `to`. Acrescenta a busca `q` (DEC-005).
- `apps/server/src/finance/application/categories.rs` (alterar): tipo e cor no cadastro, filtro por tipo e destino do mesmo tipo na exclusão.
- `apps/server/src/finance/application/recurring_transactions.rs` (alterar): criação, alteração (só aberta e seguintes), liquidação com cópia e pulo; remove a materialização até uma data. Acrescenta a listagem paginada das cópias liquidadas (DEC-005).
- `apps/server/src/finance/application/summaries.rs` (alterar): resumo por `from` e `to` com os blocos do painel (PD-58).
- `apps/server/src/finance/infrastructure/mod.rs` (alterar): sem mudança neste ajuste.
- `apps/server/src/finance/infrastructure/pg_accounts.rs` (alterar): sem mudança neste ajuste.
- `apps/server/src/finance/infrastructure/pg_transactions.rs` (alterar): filtro pela coluna `effective_date`, por `category_id` e por repetição, e gravação de `generated_from`. Acrescenta o `UPDATE` da edição, o desfazer da liquidação com reversão do saldo e o filtro `q` com `finance_unaccent` (DEC-005).
- `apps/server/src/finance/infrastructure/pg_transfers.rs` (alterar): filtro por `transferred_on` entre `from` e `to`. Acrescenta o filtro `q` (DEC-005).
- `apps/server/src/finance/infrastructure/pg_categories.rs` (alterar): colunas `kind` e `color` e filtro por tipo.
- `apps/server/src/finance/infrastructure/pg_recurring_transactions.rs` (alterar): coluna `last_closed_on`, liquidação com cópia e pulo numa transação SQL com `FOR UPDATE`; remove a materialização. Acrescenta a reabertura da ocorrência ao desfazer a liquidação de uma cópia e a listagem das cópias (DEC-005).
- `apps/server/src/finance/infrastructure/pg_idempotency.rs` (alterar): sem mudança neste ajuste.
- `apps/server/src/finance/interface/mod.rs` (alterar): rotas novas `POST /recurring-transactions/{id}/settlement` e `POST /recurring-transactions/{id}/skip`. Acrescenta `PATCH /transactions/{id}`, `DELETE /transactions/{id}/settlement` e `GET /recurring-transactions/{id}/settled-transactions` (DEC-005).
- `apps/server/src/finance/interface/dto.rs` (alterar): consultas com `from`, `to`, `category_id` e `repetition`; item da listagem com status e campos da ocorrência; categoria com `kind` e `color`; resposta nova do resumo. Acrescenta o corpo da edição, o parâmetro `q` e a página das cópias (DEC-005).
- `apps/server/src/finance/interface/handlers.rs` (alterar): handlers da liquidação e do pulo da ocorrência aberta, validação do período e dos filtros novos. Acrescenta os handlers da edição, do desfazer da liquidação e da listagem das cópias (DEC-005).
- `apps/server/src/finance/interface/openapi.rs` (alterar): rotas e esquemas novos.
- `apps/server/src/finance/migrations/20261101070001_create-finance-accounts.sql` (alterar): sem mudança neste ajuste.
- `apps/server/src/finance/migrations/20261101070002_create-finance-categories.sql` (alterar): colunas `kind` e `color` e unicidade do nome por tipo.
- `apps/server/src/finance/migrations/20261101070003_create-finance-recurring-transactions.sql` (alterar): troca `generated_from DATE` por `last_closed_on DATE NULL`.
- `apps/server/src/finance/migrations/20261101070004_create-finance-transactions.sql` (alterar): troca `recurrence_id` por `generated_from` e acrescenta a coluna gerada `effective_date` com índice. Acrescenta a extensão `unaccent` e a função `finance_unaccent` para a busca `q` (DEC-005).
- `apps/server/src/finance/migrations/20261101070005_create-finance-idempotency-keys.sql` (alterar): sem mudança neste ajuste.
- `apps/server/src/finance/tests/mod.rs` (alterar): `create_category` recebe tipo e cor; auxiliares `settle_occurrence` e `skip_occurrence`.
- `apps/server/src/finance/tests/accounts.rs` (alterar): sem mudança neste ajuste (CT-17, CB-01).
- `apps/server/src/finance/tests/transactions.rs` (alterar): categorias criadas com tipo; caso novo de categoria de outro tipo (CT-18, CB-09). Acrescenta os testes da edição e do desfazer da liquidação (DEC-005).
- `apps/server/src/finance/tests/credit_cards.rs` (alterar): mantém os testes atuais (CT-19, CB-10) e acrescenta o caso de desfazer a liquidação de parcela de fatura paga (DEC-005).
- `apps/server/src/finance/tests/transfers.rs` (alterar): categorias com tipo e cor e destino do mesmo tipo (CT-20, CB-15, PD-49).
- `apps/server/src/finance/tests/recurring_transactions.rs` (alterar): testes do modelo de ocorrência aberta (CT-21, PD-51, DEC-003). Acrescenta o desfazer da liquidação de cópia e a listagem das cópias (DEC-005).
- `apps/server/src/finance/tests/listings.rs` (criar): testes do período livre e dos filtros de categoria e de repetição (PD-52, PD-55, PD-58). Acrescenta a busca `q` (DEC-005).
- `apps/server/src/finance/tests/summaries.rs` (alterar): testes do painel por período (CT-22, PD-58).
- `apps/server/src/finance/tests/deletion_hook.rs` (alterar): remove o caso da regeneração de ocorrências, que deixa de existir (CB-06). Acrescenta o gancho ao desfazer a liquidação de uma cópia (DEC-005).
- `apps/server/src/finance/tests/authorization.rs` (alterar): casos de 404 nas rotas novas da ocorrência aberta. Acrescenta os casos das rotas de edição, desfazer a liquidação e listagem das cópias (DEC-005).

### Passos

1. Confira as pré-condições da TASK-04: `apps/server/src/main.rs` declara o módulo `finance` (o registro do `router()` e do `migrator()` fica com a TASK-18); `apps/server/src/shared` tem o erro `problem+json`, o gerador de UUID v7, o relógio injetável, o tipo de dinheiro em centavos (`i64` com moeda), a regra de recorrência com o cálculo das ocorrências e a visibilidade; `apps/server/src/http` tem o `AppState`, o extrator do usuário da sessão, o CSRF e o auxiliar de testes que monta um app com sessão; `apps/server/Cargo.toml` tem `sqlx` (postgres, uuid, chrono, migrate), `utoipa`, `thiserror` e, em dev-dependencies, `testcontainers` com o módulo postgres. Se algo faltar, PARE e reporte ao Coordenador: esta tarefa não altera `main.rs`, `http`, `shared` nem `Cargo.toml`.
2. O contexto já existe da primeira execução. Mantenha o que este ajuste não cita (contas, liquidação, cartão, parcelas, transferências, idempotência, gancho de exclusão, RLS) e refaça só as partes dos passos 3 a 10. Rode `vostok memory search decision DEC-002 DEC-003` e leia as linhas PD-49 a PD-58 de `docs/decisoes-do-prototipo.md`: elas são a fonte das divergências com a spec.
3. Escreva primeiro os testes unitários do domínio, num `#[cfg(test)] mod tests` em cada arquivo, e confirme que os novos falham (`cargo test -p atria-server finance::domain`):
   - `settlement.rs`, `account.rs`, `credit_card.rs` e `transfer.rs`: mantenha os testes atuais (RN-01 a RN-07, RF-26, RF-28, CB-10).
   - `category.rs`: mantenha `deleting_category_in_use_requires_replacement` e `replacement_cannot_be_the_deleted_category` (CB-15) e acrescente `replacement_must_have_same_kind` e `category_color_accepts_only_theme_tones` (PD-49, PD-58).
   - `recurring_transaction.rs`: mantenha `monthly_on_31_falls_on_last_day_of_short_months` (CB-02) e `yearly_on_feb_29_falls_on_feb_28_in_common_year` (CB-03); troque `rule_change_affects_only_future_unsettled_occurrences` por `rule_or_amount_change_affects_open_and_following_occurrences_only` (RN-08) e reescreva `each_occurrence_is_settled_separately` (RN-09) no modelo novo; acrescente `open_occurrence_is_first_rule_date_after_last_closed`, `settling_open_occurrence_returns_settled_copy_without_recurrence`, `skipping_open_occurrence_advances_without_copy`, `unsettled_open_occurrence_is_overdue_and_does_not_advance` e `recurrence_without_dates_after_ends_on_has_no_open_occurrence` (PD-51, DEC-003).
   - `forecast.rs`: `forecast_projects_following_rule_dates_in_range_as_virtual`, `forecast_starts_after_open_occurrence`, `effective_date_is_settlement_date_when_settled_and_expected_date_otherwise` e `items_are_ordered_by_effective_date_then_key` (PD-51, PD-55).
   - `summary.rs`: mantenha `transfers_are_excluded_from_income_and_expense_totals` (RN-05) e `savings_and_losses_are_summed_from_settled_transactions`; troque `month_summary_sums_expected_and_settled_by_kind` por `period_totals_split_realized_and_forecast`; acrescente `previous_period_has_same_length_and_ends_the_day_before`, `where_it_went_keeps_top_six_categories_and_sums_the_rest_as_others`, `forecast_balance_adds_pending_items_until_period_end`, `forecast_balance_is_absent_when_period_ended_before_today`, `card_used_limit_sums_unsettled_and_settled_in_open_statement` e `upcoming_bills_cover_overdue_and_next_30_days` (PD-58).
   - `transaction.rs` (DEC-005): `unsettled_transaction_edit_accepts_all_editable_fields`, `settled_transaction_edit_allows_only_description_category_and_visibility`, `installment_edit_refuses_account_and_date` e `undo_settlement_restores_open_state_and_reverts_balance_effect`.
   Os testes usam relógio e ids fixos de `shared`, nunca a data atual (testing-07).
4. Implemente o domínio até os testes passarem, com estas decisões:
   - Dinheiro sempre no tipo de centavos de `shared`; nenhuma conta com ponto flutuante. As regras de liquidação, fatura, parcelas e transferência não mudam.
   - Categoria: `kind` (`income`, `expense`), imutável depois da criação, e `color` entre `primary`, `accent`, `success`, `warning`, `danger` e `info` (as cores do protótipo). A categoria de uma movimentação ou recorrente tem o mesmo tipo dela; senão, `category_kind_mismatch`. A categoria de destino na exclusão tem o mesmo tipo da excluída.
   - Recorrência (PD-51, DEC-003): a recorrente guarda a regra de `shared` (com o fuso de origem), o modelo da movimentação e `last_closed_on`, a data da última ocorrência liquidada ou pulada. A ocorrência aberta é a primeira data da regra depois de `last_closed_on` (ou a primeira a partir de `starts_on`, quando nulo) e não passa de `ends_on`; sem data, a recorrente terminou e não tem ocorrência aberta. A aberta é única e não é gravada como linha.
   - Liquidar a aberta devolve uma cópia: movimentação liquidada com o modelo e o valor atuais da recorrente, `expected_date` e `occurrence_date` iguais à data da ocorrência, `generated_from` igual ao id da recorrente e sem recorrência; `last_closed_on` passa a ser a data da ocorrência, e a recorrente vai para a seguinte, como prevista. Pular só move `last_closed_on`, sem cópia. Liquidar ou pular uma data que não é a aberta dá `occurrence_not_open`; numa recorrente terminada, `recurrence_ended`.
   - Atraso: a aberta com data anterior a hoje tem status `overdue` e não avança sozinha. Hoje é a data do relógio injetável no fuso da regra; para as movimentações gravadas, que não guardam fuso, a data do relógio em UTC (code-style-06).
   - Previsão virtual: num intervalo `[from, to]`, a aberta (status `open` ou `overdue`) e as datas seguintes da regra (status `forecast`) viram itens sem `id`, com `recurrence_id` e `occurrence_date`, o valor da recorrente e nada gravado. Sem `to`, a listagem não tem limite final de data para as gravadas e, das recorrentes, só a aberta aparece (DEC-004).
   - Mudar a regra, o valor, a conta, a categoria ou a descrição atualiza a recorrente: vale para a aberta e as seguintes, e as cópias liquidadas não mudam (RN-08). Com a regra nova, a aberta é recalculada pela regra nova a partir de `last_closed_on`.
   - Data efetiva de cada item: `settled_at` quando liquidado e `expected_date` nos outros casos (PD-55). Status das gravadas: `settled`, ou `open`/`overdue` pela data prevista. Ordem: data efetiva e depois a chave (`id` da gravada, `recurrence_id` da virtual).
   - Resumo de `[from, to]` (PD-58): valor de um item é `settled_amount` quando liquidado e o valor previsto nos outros casos. Entradas e saídas: realizado é a soma dos liquidados; previsto é a soma dos valores de todos os itens do período, gravados e virtuais. Sobra: entradas menos saídas, no realizado e no previsto. Sem `from`, o início é a data efetiva da primeira movimentação gravada do usuário (hoje, se não houver nenhuma); sem `to`, o fim é hoje (DEC-004). Período anterior, só quando `from` e `to` vêm na consulta: de `from - n` a `from - 1`, com `n = to - from + 1` dias, com os mesmos totais; sem um deles, `previous_period` e `previous_totals` são nulos. "Para onde foi": saídas do período por categoria, pelo valor, em ordem decrescente, até 6 categorias (com nome e cor), o resto somado num item "Outras" e as saídas sem categoria num item próprio. Previsto x realizado: por tipo, a soma dos valores previstos e a dos liquidados. Economias e perdas: soma das diferenças `saving` e `gain` e das `loss` liquidadas no período. Transferências ficam fora de todos os totais (RN-05).
   - Blocos que não seguem o período (PD-58): saldo atual (soma dos saldos de todas as contas), saldo por conta (só contas `standard`) e saldo previsto no fim do período (atual mais as entradas e menos as saídas não liquidadas até `to`, inclusive atrasadas e virtuais; nulo se `to` é anterior a hoje); cartões: fatura aberta (período de `statement_for(hoje)`, soma dos valores das movimentações do cartão nesse período), vencimento (`due_date` desse período), limite e limite usado (não liquidadas do cartão mais as liquidadas da fatura aberta); próximas contas: saídas não liquidadas, gravadas e virtuais, com data até hoje + 30 dias, inclusive as atrasadas, por data.
   - Edição (DEC-005): uma movimentação não liquidada aceita `description`, `expected_amount`, `expected_date`, `account_id`, `category_id` (do mesmo tipo, senão `category_kind_mismatch`) e `visibility`. Liquidada (inclusive a cópia de uma recorrente) aceita só `description`, `category_id` e `visibility`; qualquer outro campo dá 409 `transaction_already_settled`. Parcela (`installment_group_id` preenchido) não muda `account_id` nem `expected_date` (409 `installment_not_editable`). Numa conta `credit_card`, `statement_period` é recalculado por `statement_for(expected_date)` quando a data ou a conta mudam.
   - Desfazer a liquidação (DEC-005): numa movimentação comum, limpa `settled_amount`, `settled_at`, `difference_amount` e `difference_kind` e reverte o efeito no saldo. Numa cópia de recorrente (`generated_from` preenchido), apaga a cópia (exclusão lógica), reverte o saldo e reabre a ocorrência pela regra da DEC-004 (só se for a cópia do último fechamento). Movimentação de um cartão cuja fatura do `statement_period` já foi paga (transferência com esse `statement_period` para o cartão) dá 409 `statement_already_paid`. Não liquidada dá 409 `transaction_not_settled`.
5. Altere as migrações em `apps/server/src/finance/migrations`, nos nomes da lista "Mudar" (a tarefa ainda não foi entregue, então as migrações são reescritas, sem migração nova):
   - `categories`: `kind TEXT NOT NULL CHECK (kind IN ('income','expense'))`, `color TEXT NOT NULL CHECK (color IN ('primary','accent','success','warning','danger','info'))`; o índice único passa a `(owner_id, kind, lower(name)) WHERE deleted_at IS NULL`; índice `(owner_id, kind)`.
   - `recurring_transactions`: remova `generated_from DATE` e acrescente `last_closed_on DATE NULL`.
   - `transactions`: troque `recurrence_id` por `generated_from UUID NULL` com FK `(generated_from, owner_id)` para `recurring_transactions (id, owner_id)`; o `CHECK` de coerência passa a `(generated_from IS NULL) = (occurrence_date IS NULL)`; o único passa a `(generated_from, occurrence_date) WHERE deleted_at IS NULL` (uma cópia por ocorrência, RN-09); acrescente `effective_date DATE GENERATED ALWAYS AS (COALESCE(settled_at, expected_date)) STORED` e o índice `(owner_id, effective_date, id) WHERE deleted_at IS NULL`; troque o índice de `recurrence_id` pelo de `generated_from` (database-07).
   - Busca (DEC-005), na migração de movimentações: `CREATE EXTENSION IF NOT EXISTS unaccent;` e a função `finance_unaccent(input text) RETURNS text IMMUTABLE` que chama `public.unaccent('public.unaccent'::regdictionary, input)`, como em `apps/server/src/library/migrations/20261101130001_create-library.sql`.
   - As demais tabelas, a RLS forçada e as políticas não mudam (database-09).
6. Escreva os testes de integração em `apps/server/src/finance/tests/` antes dos serviços e handlers, com o PostgreSQL em container, o `migrator()` do contexto e o auxiliar de testes com relógio e ids fixos. Confirme que os novos falham:
   - `mod.rs`: `create_category(session, name, kind, color)`, `settle_occurrence(session, recurrence_id, occurrence_date, amount, settled_at)` e `skip_occurrence(session, recurrence_id, occurrence_date)`; ajuste as chamadas existentes de `create_category` em `transactions.rs`, `transfers.rs` e `authorization.rs`.
   - `accounts.rs` e `credit_cards.rs`: sem mudança.
   - `transactions.rs`: mantenha os testes atuais e acrescente `transaction_with_category_of_other_kind_is_refused` (422 `category_kind_mismatch`, PD-49).
   - `transfers.rs`: mantenha `transfer_moves_both_balances_and_stays_out_of_totals`, `deleting_category_in_use_requires_replacement` (CT-20, CB-15) e `creates_renames_and_deletes_category` (RF-30), e acrescente `category_has_kind_and_color`, `categories_list_filters_by_kind` e `replacement_category_of_other_kind_is_refused` (PD-49).
   - `recurring_transactions.rs`: reescreva `monthly_rent_on_31_falls_on_last_day_and_change_from_third_month_affects_only_future` (CT-21, fuso `America/Sao_Paulo`): aluguel mensal no dia 31 a partir de 31/01/2027; liquidar janeiro e fevereiro gera cópias em 31/01 e 28/02 com o valor antigo; mudar o valor deixa a aberta em 31/03 com o valor novo, a previsão de abril em 30/04 com o valor novo e as duas cópias intactas. Acrescente `settling_recurring_creates_copy_linked_by_generated_from_and_advances`, `unsettled_occurrence_stays_open_and_overdue_until_settled_or_skipped`, `skipping_occurrence_advances_without_copy`, `future_period_lists_virtual_forecast_without_persisting` (conferindo em SQL que nenhuma linha nova existe em `transactions`), `settling_occurrence_that_is_not_open_is_refused` (409 `occurrence_not_open`) e `duplicate_idempotency_key_on_occurrence_settlement_returns_same_copy` (CB-09).
   - `listings.rs`: `transactions_filter_by_settlement_date_when_settled_and_expected_date_otherwise`, `transfers_filter_by_period`, `period_with_from_after_to_is_refused` (422 `validation_failed`), `transactions_filter_by_category` e `repetition_filter_separates_recurring_and_one_off` (`repetition=all` traz tudo, `recurring` só os itens das recorrentes, `one_off` só as gravadas, inclusive as cópias liquidadas) (PD-52, PD-55, PD-58).
   - `summaries.rs`: troque `month_summary_matches_transactions` por `period_summary_matches_transactions` (CT-22, com `from` e `to`) e acrescente `summary_compares_with_previous_period_of_same_length`, `where_it_went_groups_top_six_categories_plus_others_with_color`, `summary_balance_has_current_forecast_at_period_end_and_per_account`, `summary_cards_show_open_statement_due_date_and_used_limit`, `upcoming_bills_cover_next_30_days_regardless_of_period`, `summary_without_period_goes_from_first_transaction_to_today_without_comparison` e `period_with_more_than_3660_days_is_refused` (PD-55, PD-58, DEC-004).
   - `deletion_hook.rs`: remova `rule_change_calls_hook_for_removed_occurrences` (a mudança de regra não remove mais ocorrências) e mantenha `deleting_account_transaction_and_transfer_calls_entity_deleted_hook`, `deleting_settled_transaction_reverts_balance` e `delete_without_hook_still_succeeds` (CB-06).
   - `recurring_transactions.rs`: acrescente `deleting_last_settled_copy_reverts_balance_and_reopens_occurrence` (liquidar janeiro e fevereiro, excluir a cópia de fevereiro: o saldo volta, a aberta volta a ser 28/02 e a cópia de janeiro fica) e `deleting_older_settled_copy_only_reverts_balance` (excluir a cópia de janeiro: o saldo volta e a aberta continua em 31/03) (DEC-004).
   - `listings.rs`: acrescente `listing_without_period_has_no_date_limit` (DEC-004).
   - `transactions.rs` (DEC-005): `updates_unsettled_transaction_fields`, `settled_transaction_accepts_only_description_category_and_visibility` (409 nos outros campos), `update_with_category_of_other_kind_is_refused` (422 `category_kind_mismatch`), `undo_settlement_reverts_balance_and_clears_difference` e `undo_settlement_of_unsettled_transaction_is_refused` (409 `transaction_not_settled`).
   - `credit_cards.rs` (DEC-005): `undo_settlement_of_installment_in_paid_statement_is_refused` (409 `statement_already_paid`).
   - `recurring_transactions.rs` (DEC-005): `undo_settlement_of_last_copy_deletes_copy_and_reopens_occurrence`, `undo_settlement_of_older_copy_deletes_copy_and_keeps_open_occurrence` e `lists_settled_copies_of_recurring_with_pagination` (duas páginas com `limit=1`, da ocorrência mais recente para a mais antiga).
   - `listings.rs` (DEC-005): `search_matches_description_ignoring_case_and_accents` (`q=agua` acha "Água"), `search_also_filters_virtual_recurring_items`, `transfers_search_by_description` e `search_with_more_than_100_characters_is_refused` (422 `validation_failed`).
   - `deletion_hook.rs` (DEC-005): `undo_settlement_of_recurring_copy_calls_entity_deleted_hook` (uma chamada `(owner_id, "transaction", id)` depois do commit).
   - `authorization.rs`: acrescente em `other_user_resources_return_404` os casos `POST /recurring-transactions/{id}/settlement` e `POST /recurring-transactions/{id}/skip`, e mantenha `row_level_security_hides_other_owner_rows` e `mutation_without_csrf_is_refused`. Acrescente também `PATCH /transactions/{id}`, `DELETE /transactions/{id}/settlement` e `GET /recurring-transactions/{id}/settled-transactions` (DEC-005).
7. Implemente as portas, os serviços de aplicação e os repositórios até os testes de integração passarem:
   - As regras atuais seguem: `set_config('app.current_user_id', ...)` em cada transação, filtro por `owner_id` (security-04), `FinanceError::NotFound` para registro de outro dono, saldo na mesma transação SQL com `FOR UPDATE` (database-03) e "Conta principal" preguiçosa.
   - Remova a materialização das ocorrências até a data `to` e o `effective_from`: nenhuma leitura grava linha.
   - Liquidar a aberta, numa só transação SQL: `SELECT ... FOR UPDATE` na recorrente, conferência de que a data pedida é a aberta, `INSERT` da cópia em `transactions`, atualização do saldo da conta e de `last_closed_on`. Pular: `FOR UPDATE`, conferência e atualização de `last_closed_on`.
   - Listagem de movimentações: lê as gravadas pela `effective_date` em `[from, to]` (limites opcionais) e calcula os itens virtuais das recorrentes ativas no mesmo intervalo; junta e ordena pela data efetiva e pela chave e corta em `limit`. O cursor opaco passa a ser a data efetiva e a chave da última linha, em base64url. Filtros `account_id`, `category_id`, `kind`, `settled` e `repetition`.
   - Resumo e listagens: `from` e `to` opcionais (DEC-004). Quando os dois vêm, `from` menor ou igual a `to` e, no resumo, no máximo 3660 dias, para limitar a projeção; senão, 422 `validation_failed`. Sem eles, o resumo usa o intervalo do passo 4, que termina hoje e por isso projeta só as abertas atrasadas.
   - Excluir uma cópia liquidada (`DELETE /transactions/{id}` de uma movimentação com `generated_from`), numa só transação SQL: `SELECT ... FOR UPDATE` na recorrente, reversão do saldo e, se `occurrence_date` da cópia é igual a `last_closed_on` (a cópia do último fechamento), `last_closed_on` volta para o fechamento anterior: a data da regra atual imediatamente anterior a essa ocorrência, ou nulo se não houver desde `starts_on`. Com isso, a ocorrência excluída volta a ser a aberta. Cópia mais antiga, ou com um pulo depois dela, só reverte o saldo (DEC-004).
   - O `Idempotency-Key` vale também em `POST /recurring-transactions/{id}/settlement` e `POST /recurring-transactions/{id}/skip`, com as mesmas regras (mesma chave e mesmo corpo devolvem a resposta gravada; outro corpo dá 422 `idempotency_key_reused`).
   - Edição e desfazer a liquidação (DEC-005) numa só transação SQL, com `SELECT ... FOR UPDATE` na movimentação e na conta (e na recorrente, quando for cópia); a edição de valor ou conta de uma não liquidada não mexe no saldo (RN-01). O desfazer confere a fatura paga com uma consulta em `transfers` por `to_account_id` e `statement_period`.
   - Busca `q` (DEC-005): de 1 a 100 caracteres, aparada; `finance_unaccent(lower(description)) LIKE '%' || finance_unaccent(lower($q)) || '%' ESCAPE '\'`, com `%`, `_` e `\` escapados no valor; nas virtuais, o mesmo critério sobre a descrição da recorrente, aplicado na consulta das recorrentes. Sem `q`, nenhum filtro.
   - Cópias de uma recorrente (DEC-005): movimentações com `generated_from` igual ao id, não excluídas, por `occurrence_date` decrescente e `id`, com cursor opaco dessas duas colunas em base64url e `limit` como nas outras listagens; recorrente de outro dono dá 404.
8. Ajuste `interface`, mantendo as rotas atuais, com estas mudanças: `GET /categories` aceita `kind`; `POST /categories` exige `kind` e `color`; `PATCH /categories/{id}` aceita `name` e `color`; `GET /transactions` aceita `from`, `to`, `category_id`, `kind`, `account_id`, `settled`, `repetition` (`all`, `recurring`, `one_off`; padrão `all`), `cursor` e `limit`, e devolve itens com `id` (nulo nos virtuais), `status` (`settled`, `open`, `overdue`, `forecast`), `effective_date`, `recurrence_id`, `generated_from` e `occurrence_date`, além dos campos do contrato "Movimentação financeira"; `GET /transfers` aceita `from` e `to`; `PATCH /recurring-transactions/{id}` perde `effective_from`; `GET /recurring-transactions` devolve a ocorrência aberta de cada uma (data e status, ou nula); novas `POST /recurring-transactions/{id}/settlement` (corpo `occurrence_date`, `settled_amount`, `settled_at`; responde 201 com a cópia) e `POST /recurring-transactions/{id}/skip` (corpo `occurrence_date`; responde 200 com a recorrente); `GET /financial-summaries?from=YYYY-MM-DD&to=YYYY-MM-DD` no lugar de `month`, com `period`, `previous_period`, `totals` e `previous_totals` (`income`, `expense` e `surplus`, cada um com `realized` e `forecast`), `where_it_went` (`category_id`, `name`, `color`, `group` = `category`, `uncategorized` ou `others`, `amount`), `expected_vs_settled`, `savings_and_losses`, `balance` (`current`, `forecast_at_period_end`, `accounts`), `credit_cards` (`account_id`, `name`, `statement_period`, `open_statement_amount`, `due_date`, `credit_limit_amount`, `used_limit_amount`), `upcoming_bills` e `currency`. Valide tipos e limites na borda (security-09) e converta os códigos novos (`occurrence_not_open` 409, `recurrence_ended` 409, `category_kind_mismatch` 422) em `problem+json`. Acrescente também (DEC-005): `PATCH /transactions/{id}` (corpo com os campos opcionais do passo 4; responde 200 com a movimentação); `DELETE /transactions/{id}/settlement` (responde 200 com a movimentação desfeita ou 204 quando a cópia é apagada); `GET /recurring-transactions/{id}/settled-transactions` (`cursor`, `limit`); `q` em `GET /transactions` e `GET /transfers`; códigos `statement_already_paid` (409), `installment_not_editable` (409) e `transaction_not_settled` (409).
9. Remoção das ligações ao excluir (CB-06): mantenha o alias `EntityDeletedHook` com a grafia da TASK-15 e as chamadas depois do commit em `DELETE /accounts/{id}`, `DELETE /transactions/{id}` e `DELETE /transfers/{id}`. Retire a chamada da regeneração de ocorrências, que deixou de existir. Uma cópia liquidada excluída segue a regra de `DELETE /transactions/{id}` (reverte o saldo e chama o gancho com `"transaction"`) e, se for a do último fechamento, reabre a ocorrência como no passo 7 (DEC-004).
10. Atualize `interface/openapi.rs` com as rotas e os esquemas novos e o teste `documents_all_finance_routes`, que confere a presença de cada caminho, inclusive `/recurring-transactions/{id}/settlement` e `/recurring-transactions/{id}/skip`. Inclua também `/transactions/{id}/settlement` com `DELETE` e `/recurring-transactions/{id}/settled-transactions` (DEC-005).
11. Rode `cargo fmt`, `cargo clippy -p atria-server -- -D warnings` e `cargo test -p atria-server finance::` até passarem sem aviso. Não use `unwrap`, `expect` nem `panic!` fora dos testes e não registre valores nem descrições em log (security-13).

### Baseline

- `test -e apps/server/src/finance && echo finance-existe || echo finance-ausente`
- `test -e apps/server/src/shared && echo shared-existe || echo shared-ausente`

### Verificação

```bash
# Formatação e lint sem aviso (code-style-02)
cargo fmt --check
cargo clippy -p atria-server -- -D warnings
# Testes unitários e de integração do contexto: esperado "test result: ok" e 0 failed
cargo test -p atria-server finance::
# Toda tabela do contexto com RLS forçada: esperado sem saída do grep -L
! grep -L "FORCE ROW LEVEL SECURITY" apps/server/src/finance/migrations/*.sql | grep .
# Modelo antigo de materialização removido (PD-51): esperado sem saída
! grep -rn "materialize\|effective_from" apps/server/src/finance | grep .
# Cópia liquidada ligada à recorrente e categoria com tipo: esperado uma linha em cada
grep -n "generated_from UUID" apps/server/src/finance/migrations/20261101070004_create-finance-transactions.sql
grep -n "kind TEXT NOT NULL" apps/server/src/finance/migrations/20261101070002_create-finance-categories.sql
# Busca sem diferenciar acentos (DEC-005): esperado uma linha
grep -n "CREATE FUNCTION finance_unaccent" apps/server/src/finance/migrations/20261101070004_create-finance-transactions.sql
```

### Evidências

- `cargo-test-finance.txt` (automática): `cargo test -p atria-server finance::`
  - Prova: as regras do domínio e os endpoints do Financeiro passam, com liquidação, economia e perda, cartão e parcelas, transferências, categorias por tipo, recorrência com ocorrência aberta e cópia liquidada, período livre, filtros de categoria e repetição, painel, idempotência e autorização (RF-24 a RF-35, CT-17 a CT-22, PD-49, PD-51, PD-52, PD-55, PD-58).
  - Trecho: as linhas `test finance::tests::transactions::settlement_records_saving_loss_gain_and_loss ... ok`, `test finance::tests::credit_cards::installments_land_on_right_statements_and_payment_settles ... ok`, `test finance::tests::recurring_transactions::settling_recurring_creates_copy_linked_by_generated_from_and_advances ... ok`, `test finance::tests::listings::repetition_filter_separates_recurring_and_one_off ... ok`, `test finance::tests::summaries::where_it_went_groups_top_six_categories_plus_others_with_color ... ok`, `test finance::tests::recurring_transactions::deleting_last_settled_copy_reverts_balance_and_reopens_occurrence ... ok`, `test finance::tests::transactions::settled_transaction_accepts_only_description_category_and_visibility ... ok`, `test finance::tests::recurring_transactions::undo_settlement_of_last_copy_deletes_copy_and_reopens_occurrence ... ok`, `test finance::tests::listings::search_matches_description_ignoring_case_and_accents ... ok`, `test finance::tests::authorization::other_user_resources_return_404 ... ok` e `test result: ok`.
  - Falha: `FAILED`, `test result: FAILED`, erro de compilação, `running 0 tests` ou ausência de um dos testes citados.
- `rls-finance.txt` (automática): `grep -c "FORCE ROW LEVEL SECURITY" apps/server/src/finance/migrations/20261101070001_create-finance-accounts.sql apps/server/src/finance/migrations/20261101070002_create-finance-categories.sql apps/server/src/finance/migrations/20261101070003_create-finance-recurring-transactions.sql apps/server/src/finance/migrations/20261101070004_create-finance-transactions.sql apps/server/src/finance/migrations/20261101070005_create-finance-idempotency-keys.sql`
  - Prova: cada migração do contexto liga a Row Level Security forçada (RNF-02, database-09).
  - Trecho: cada arquivo seguido de `:1` ou mais (`:2` na migração de movimentações e transferências).
  - Falha: algum arquivo com `:0` ou `No such file or directory`.
- `finance-model.txt` (automática): `grep -n "generated_from UUID\|last_closed_on\|effective_date DATE\|color TEXT NOT NULL" apps/server/src/finance/migrations/20261101070002_create-finance-categories.sql apps/server/src/finance/migrations/20261101070003_create-finance-recurring-transactions.sql apps/server/src/finance/migrations/20261101070004_create-finance-transactions.sql`
  - Prova: o banco tem o modelo novo: categoria com tipo e cor, recorrente com a última ocorrência fechada, cópia liquidada ligada por `generated_from` e a data efetiva indexável (PD-49, PD-51, PD-55, DEC-003).
  - Trecho: uma linha com `color TEXT NOT NULL` na migração de categorias, `last_closed_on` na de recorrentes, e `generated_from UUID` e `effective_date DATE` na de movimentações (o `kind` da categoria é conferido na Verificação).
  - Falha: saída vazia ou faltando alguma das quatro colunas (o modelo antigo, com `recurrence_id` e `generated_from DATE`, não produz essas linhas).

### Concluída quando

- [x] Contas são criadas, renomeadas e excluídas, e a "Conta principal" existe para cada usuário, pode ser renomeada e nunca é excluída, nem direto no banco (RF-24, RF-25, CT-17).

  > Como comprovar: rodar `cargo test -p atria-server finance::` e ver `ok` em `creates_renames_and_deletes_account`, `refuses_deleting_default_account_with_problem_json`, `default_account_is_created_once_per_user` e `database_refuses_deleting_default_account` (evidência `cargo-test-finance.txt`).

- [x] O cartão de crédito é uma conta com limite, fechamento e vencimento; a compra parcelada gera uma movimentação por parcela na fatura certa, inclusive depois do fechamento, e o pagamento da fatura é uma transferência que liquida a fatura (RF-26, RF-28, RF-34, CT-19).

  > Como comprovar: ver `ok` em `installments_land_on_right_statements_and_payment_settles`, `purchase_after_closing_day_enters_next_statement` e `creates_credit_card_account` na mesma saída.

- [x] Entradas e saídas têm valor e data previstos, conta e categoria do mesmo tipo; o saldo só muda na liquidação e a diferença sai como economia, perda, ganho e perda nos quatro casos (RF-27, RF-32, RF-33, CT-18, PD-49).

  > Como comprovar: ver `ok` em `balance_changes_only_on_settlement`, `settlement_records_saving_loss_gain_and_loss`, `transaction_with_category_of_other_kind_is_refused` e nos testes unitários de `finance::domain::settlement`.

- [x] Um envio repetido com o mesmo `Idempotency-Key` não duplica a movimentação nem a cópia liquidada de uma recorrente (RF-27, CB-09).

  > Como comprovar: ver `ok` em `duplicate_idempotency_key_returns_same_transaction`, `reused_idempotency_key_with_other_body_is_refused` e `duplicate_idempotency_key_on_occurrence_settlement_returns_same_copy`.

- [x] Transferências mudam os saldos das duas contas e ficam fora dos totais; categorias têm tipo (entrada ou saída) e cor, são criadas, renomeadas e excluídas, e a exclusão de uma em uso pede uma categoria de destino do mesmo tipo (RF-29, RF-30, CT-20, CB-15, PD-49).

  > Como comprovar: ver `ok` em `transfer_moves_both_balances_and_stays_out_of_totals`, `creates_renames_and_deletes_category`, `deleting_category_in_use_requires_replacement`, `category_has_kind_and_color`, `categories_list_filters_by_kind` e `replacement_category_of_other_kind_is_refused`.

- [x] A recorrente tem uma única ocorrência aberta: liquidá-la cria uma cópia liquidada, sem recorrência e ligada por `generated_from`, e a recorrente passa para a ocorrência seguinte; a não liquidada fica aberta e atrasada até ser liquidada ou pulada, e pular avança sem cópia (RF-31, RN-09, PD-51, DEC-003).

  > Como comprovar: ver `ok` em `settling_recurring_creates_copy_linked_by_generated_from_and_advances`, `unsettled_occurrence_stays_open_and_overdue_until_settled_or_skipped`, `skipping_occurrence_advances_without_copy` e `settling_occurrence_that_is_not_open_is_refused`.

- [x] Períodos futuros mostram a previsão calculada pela regra, marcada como previsão e sem gravar linhas; a mensal no dia 31 cai no último dia dos meses curtos, a anual em 29/02 cai em 28/02, e mudar o valor a partir do 3º mês muda só a aberta e as seguintes, com as cópias liquidadas intactas (RF-31, RN-08, CT-21, CB-02, CB-03, PD-51).

  > Como comprovar: ver `ok` em `monthly_rent_on_31_falls_on_last_day_and_change_from_third_month_affects_only_future`, `future_period_lists_virtual_forecast_without_persisting`, `monthly_on_31_falls_on_last_day_of_short_months`, `yearly_on_feb_29_falls_on_feb_28_in_common_year` e `rule_or_amount_change_affects_open_and_following_occurrences_only`.

- [x] As listagens de movimentações e transferências aceitam um período livre (`from` e `to`), pela data da liquidação quando liquidada e pela prevista nos outros casos, sem limite de data quando o período não vem, e as movimentações filtram por categoria e por repetição (todas, recorrentes ou pontuais) (PD-52, PD-55, PD-58, DEC-004).

  > Como comprovar: ver `ok` em `transactions_filter_by_settlement_date_when_settled_and_expected_date_otherwise`, `transfers_filter_by_period`, `period_with_from_after_to_is_refused`, `listing_without_period_has_no_date_limit`, `transactions_filter_by_category` e `repetition_filter_separates_recurring_and_one_off`.

- [x] O resumo de um período livre traz entradas, saídas e sobra (realizado e previsto), a comparação com o período anterior de mesmo tamanho, "Para onde foi" (até 6 categorias, com a cor, mais "Outras"), previsto x realizado e economias e perdas, que batem com as movimentações; e, fora do período, o saldo (atual, previsto no fim do período e por conta), os cartões (fatura aberta, vencimento e limite usado) e as próximas contas dos 30 dias; sem período, o resumo vai da primeira movimentação até hoje, sem comparação (RF-35, CT-22, PD-58, DEC-004).

  > Como comprovar: ver `ok` em `period_summary_matches_transactions`, `summary_without_period_goes_from_first_transaction_to_today_without_comparison`, `summary_compares_with_previous_period_of_same_length`, `where_it_went_groups_top_six_categories_plus_others_with_color`, `summary_balance_has_current_forecast_at_period_end_and_per_account`, `summary_cards_show_open_statement_due_date_and_used_limit`, `upcoming_bills_cover_next_30_days_regardless_of_period` e `transfers_are_excluded_from_income_and_expense_totals`.

- [x] Dado de outro usuário responde 404 em todo endpoint, inclusive na liquidação e no pulo da ocorrência aberta, na edição, no desfazer da liquidação e na listagem das cópias, as mutações exigem CSRF e a Row Level Security está forçada em todas as tabelas do contexto (RNF-01, RNF-02).

  > Como comprovar: ver `ok` em `other_user_resources_return_404`, `row_level_security_hides_other_owner_rows` e `mutation_without_csrf_is_refused`, e na evidência `rls-finance.txt` nenhum arquivo com `:0`.

- [x] Uma movimentação é editada (descrição, valor e data previstos, conta, categoria do mesmo tipo e visibilidade); liquidada, só aceita descrição, categoria e visibilidade, e o resto dá 409 (RF-27, DEC-005).

  > Como comprovar: ver `ok` em `updates_unsettled_transaction_fields`, `settled_transaction_accepts_only_description_category_and_visibility` e `update_with_category_of_other_kind_is_refused`.

- [x] Desfazer a liquidação reverte o saldo; na cópia de uma recorrente, apaga a cópia e reabre a ocorrência quando é a do último fechamento; parcela de fatura paga é recusada com 409 (RN-01, DEC-004, DEC-005).

  > Como comprovar: ver `ok` em `undo_settlement_reverts_balance_and_clears_difference`, `undo_settlement_of_last_copy_deletes_copy_and_reopens_occurrence`, `undo_settlement_of_older_copy_deletes_copy_and_keeps_open_occurrence`, `undo_settlement_of_installment_in_paid_statement_is_refused` e `undo_settlement_of_recurring_copy_calls_entity_deleted_hook`.

- [x] As cópias liquidadas de uma recorrente são listadas com paginação, e as listagens de movimentações e transferências buscam por texto na descrição sem diferenciar maiúsculas e acentos (DEC-005).

  > Como comprovar: ver `ok` em `lists_settled_copies_of_recurring_with_pagination`, `search_matches_description_ignoring_case_and_accents`, `search_also_filters_virtual_recurring_items` e `transfers_search_by_description`, e o `grep` de `finance_unaccent` da Verificação com uma linha.

- [x] Excluir uma cópia liquidada reverte o saldo e, se ela é a do último fechamento, reabre aquela ocorrência; uma cópia mais antiga só reverte o saldo (RN-01, PD-51, DEC-004).

  > Como comprovar: ver `ok` em `deleting_last_settled_copy_reverts_balance_and_reopens_occurrence` e `deleting_older_settled_copy_only_reverts_balance`.

- [x] Excluir uma conta, uma movimentação (inclusive uma cópia liquidada) ou uma transferência chama o gancho de exclusão depois do commit com o tipo certo, para as ligações sumirem dos dois lados; sem o gancho a exclusão funciona igual (CB-06).

  > Como comprovar: ver `ok` em `deleting_account_transaction_and_transfer_calls_entity_deleted_hook`, `deleting_settled_transaction_reverts_balance` e `delete_without_hook_still_succeeds` (evidência `cargo-test-finance.txt`).

- [x] O banco tem o modelo novo (categoria com tipo e cor, `last_closed_on`, `generated_from` e `effective_date`) e nenhum resto da materialização, e o contexto expõe `router()`, `migrator()` e `FinanceApi` com todas as rotas, passando no `cargo fmt --check` e no `cargo clippy` sem aviso.

  > Como comprovar: ver as quatro colunas na evidência `finance-model.txt` e a linha `kind TEXT NOT NULL` na migração de categorias, `ok` em `documents_all_finance_routes` e a verificação terminar sem erro (o `grep` de `materialize` sem saída).

## Descrição

### Resumo executivo

Entrega o motor do Financeiro no servidor: contas, conta principal, cartão de crédito com fatura e parcelas, entradas, saídas, transferências, categorias de entrada e de saída, recorrências e liquidação com economia, ganho e perda, além dos dados do painel do Financeiro.
O benefício é ter o saldo sempre correto, mudando só quando a pessoa confirma o valor efetivo, contas fixas que só avançam quando pagas ou puladas, e um painel que responde como o período fecha, para onde foi o dinheiro e o que vem pela frente.
Perfil julgamento: é a área de maior risco de erro de cálculo (fatura, parcelas, fim de mês, fuso e previsão), por isso as regras ficam cobertas por testes antes do código.
Depende do núcleo do servidor e libera a busca, os relatórios e, depois da integração do servidor, as telas do Financeiro e o Dashboard.

### Detalhes técnicos

**Abordagem.** Contexto delimitado `finance` em `apps/server/src/finance`, nas quatro camadas de [project/architecture-02]: o domínio puro calcula liquidação, fatura, parcelas, ocorrência aberta, previsão e resumo; a aplicação orquestra os casos de uso sobre portas; a infraestrutura implementa as portas com `sqlx` e PostgreSQL; a interface expõe as rotas axum e o `FinanceApi` do `utoipa`. O contexto só expõe `router()`, `migrator()` e `FinanceApi`; o registro no `main.rs` e no `http` é da TASK-18. O código da primeira execução é mantido e só as partes de recorrência, período, painel, filtros e categorias são refeitas.

**Divergências com a spec planejada.** A spec SPEC-001 está `planned` e não muda. Por decisão do usuário, o servidor segue as decisões do protótipo (DEC-002, com a PD-51 detalhada pela DEC-003), e estas são a fonte das diferenças em relação ao texto da spec:
- Recorrência (PD-51, DEC-003): ocorrência aberta única, cópia liquidada ligada por `generated_from` e previsão virtual, no lugar da materialização das ocorrências e da mudança "a partir de uma data". RN-08, RN-09, CT-21, CB-02 e CB-03 continuam valendo: as cópias liquidadas nunca mudam, cada ocorrência é liquidada uma vez, e as datas seguem a regra de `shared`.
- Período livre (PD-55): `GET /financial-summaries` e as listagens recebem `from` e `to`, e a data usada é a da liquidação ou a prevista; a spec fala em "previsto x realizado do mês" (RF-35).
- Painel (PD-58, `docs/estudos/financeiro-painel.md`): o resumo traz, além do que RF-35 e CT-22 pedem, a comparação com o período anterior, "Para onde foi", o saldo previsto, os cartões e as próximas contas.
- Filtros (PD-52, PD-58): categoria e repetição na listagem de movimentações.
- Categorias por tipo (PD-49): `kind` de entrada ou saída e a cor que "Para onde foi" usa.

**Decisões e critérios de escolha.**
- Recorrente na tabela própria `recurring_transactions`, com `last_closed_on`, e a ocorrência aberta calculada (a primeira data da regra depois dela). Descartados: materializar as ocorrências até uma data, que contradiz a PD-51 e a DEC-003; gravar a ocorrência aberta como linha de `transactions`, como faz o protótipo, que obrigaria a mover a linha a cada liquidação e a reescrevê-la a cada mudança de regra; guardar a data da aberta, que perde a referência para recalculá-la quando a regra muda. Critério: um único lugar com o estado (`last_closed_on`), sem linha a sincronizar.
- Cópia liquidada como movimentação comum, com `generated_from` e `occurrence_date` e único `(generated_from, occurrence_date)`: liquidação, saldo, fatura, gancho de exclusão e idempotência seguem iguais, e a mesma ocorrência não é liquidada duas vezes (RN-09). Descartado: guardar o histórico dentro da recorrente, que tiraria as liquidações das listagens e dos totais.
- Liquidação e pulo com `occurrence_date` no corpo e 409 `occurrence_not_open` se ela não é a aberta. Descartado: liquidar "a aberta" sem data, que liquidaria a ocorrência seguinte num clique repetido ou numa tela desatualizada.
- Previsão virtual calculada na leitura, com itens sem `id` e status `forecast`. Descartado: gerar linhas previstas, que a DEC-003 descarta. Sem `to`, a listagem não tem limite de data (DEC-004), mas não projeta além da aberta, para não gerar uma lista infinita.
- `effective_date` como coluna gerada (`COALESCE(settled_at, expected_date)`) com índice, para o filtro do período e o cursor (database-07). Descartado: `OR` entre as duas datas na query, que não usa um índice só.
- Listagem que junta gravadas e virtuais, com o cursor pela data efetiva e pela chave (`id` ou `recurrence_id`), estável porque uma recorrente tem no máximo um item por data. Descartado: uma rota separada para a previsão, que obrigaria a tela a juntar e paginar duas listas.
- Filtro `repetition`: `recurring` traz só os itens das recorrentes (aberta e previsões) e `one_off` as gravadas, inclusive as cópias, que são "sem recorrência", como no protótipo.
- Resumo pelos valores do protótipo: valor de um item é o liquidado ou o previsto; previsto de entradas e saídas é a soma dos valores do período, e o realizado só a dos liquidados; saldo atual soma todas as contas e a lista por conta mostra só as `standard`; saldo previsto no fim é nulo quando o período já terminou. Descartado: calcular no frontend, que repetiria a regra de totais, de transferências e da previsão.
- `from` e `to` opcionais no resumo (DEC-004): sem eles, da primeira movimentação até hoje e sem comparação, que precisa do tamanho do período; com eles, no máximo 3660 dias para limitar a projeção virtual. Descartado: exigir sempre os dois, que a DEC-004 descarta.
- Excluir a cópia do último fechamento reabre a ocorrência (DEC-004), voltando `last_closed_on` para a data anterior da regra atual. Descartados: só reverter o saldo, que a DEC-004 descarta; guardar o histórico de fechamentos para achar o anterior, porque os fechamentos são datas consecutivas da regra e a anterior é calculável. Com a regra mudada depois da liquidação, a aberta reabre na primeira data da regra nova depois desse fechamento anterior.
- Categoria com `kind` imutável e `color` entre os seis tons do protótipo; nome único por dono e tipo. Descartados: cor livre em hexadecimal, que fugiria dos tokens do tema ([project/code-style-10]); cor derivada do id ([project/frontend-11]), porque a PD-58 pede a cor da categoria.
- "Hoje" para o atraso: a data do relógio injetável no fuso da regra, nas recorrentes, e em UTC nas movimentações gravadas, que não guardam fuso ([project/code-style-06]).
- Migrações reescritas em vez de uma migração nova, porque a tarefa ainda não foi entregue nem integrada (TASK-18).
- Edição, desfazer a liquidação, cópias e busca (DEC-005), fora do contrato da spec e pedidos pelas telas da TASK-22. Liquidada só muda descrição, categoria e visibilidade, porque valor, data e conta já entraram no saldo e na diferença. Desfazer numa cópia apaga a cópia, em vez de deixá-la não liquidada, porque uma cópia só existe como histórico de liquidação (DEC-003); a reabertura segue a DEC-004. Parcela de fatura paga é recusada, porque o pagamento já liquidou o período (RN-06). Descartado: desfazer pela exclusão (`DELETE /transactions/{id}`), que numa movimentação comum apagaria o registro. Rota das cópias como subrecurso `settled-transactions` ([project/naming-convention-13]); descartado um filtro `generated_from` em `GET /transactions`, que misturaria a paginação com as virtuais. Busca com `LIKE` sobre `finance_unaccent(lower(...))`, como no `library`; descartados o `tsvector` com índice GIN, que é da TASK-16, e um índice `pg_trgm` agora, porque as listagens já filtram por dono e período.
- Mantidas da primeira execução: diferença como `settled_amount - expected_amount` (decisão 17); cartão como conta `credit_card` (decisão 42) com parcelas e resto na primeira; pagamento de fatura como transferência (RN-06); "Conta principal" preguiçosa (decisão 19); conta padrão garantida no banco ([project/database-04]); idempotência em tabela própria ([project/api-06]); `owner_id` sem FK para `auth` com RLS forçada ([project/security-04], [project/database-09]); gancho `EntityDeletedHook` da TASK-15 depois do commit (CB-06), sem a chamada da regeneração de ocorrências, que deixou de existir.

**Riscos técnicos.** Erro no cálculo de fatura e parcelas (risco alto da spec), mitigado pelos testes de RN-06, RN-07 e CB-10; recorrência em fim de mês, 29/02 e fuso, mitigada pelos testes de CB-02 e CB-03 e pelo cálculo de "hoje" no fuso da regra; corrida na liquidação da ocorrência aberta, mitigada por `FOR UPDATE` na recorrente e pelo único `(generated_from, occurrence_date)`; custo da projeção virtual, limitado pelo tamanho máximo do período; paginação que junta gravadas e virtuais, coberta pelos testes de `listings.rs`. A TASK-16 e a TASK-17, de ondas seguintes, leem os serviços de `finance/application`: a listagem passa a usar a data efetiva e o filtro de repetição, e a adequação fica para os ajustes delas, não para esta tarefa. Pré-condição: o `main.rs` da TASK-04 precisa declarar o módulo `finance` para os testes compilarem.

**Referências da spec.** RF-24 a RF-35, RN-01 a RN-09, RN-18, CB-01, CB-02, CB-03, CB-06, CB-09, CB-10, CB-15, CT-17 a CT-22, RNF-01, RNF-02, decisões 7, 17, 18, 19, 20, 22, 42, 55 e 56. Decisões da memória: DEC-002, DEC-003, DEC-004 e DEC-005. Decisões do protótipo: PD-49, PD-51, PD-52, PD-55 e PD-58.

**Arquivos em comum na onda.** Nenhum: a tarefa só muda arquivos em `apps/server/src/finance`.

### Card

- **Título:** Contexto finance
- **Tipo:** historia
- **Descrição:** Implementa no servidor o contexto Financeiro: contas com conta principal, cartão com fatura e parcelas, movimentações, transferências, categorias de entrada e saída, recorrências com ocorrência aberta e cópia liquidada, liquidação com economia, ganho e perda, o resumo do painel por período, edição, desfazer da liquidação, cópias de recorrentes e busca por texto, com isolamento por usuário.
- **Critérios de aceite:**
  - [ ] Contas e categorias com cadastro, renomeação e exclusão, categorias com tipo e cor, e a conta principal nunca é excluída.
  - [ ] O saldo só muda na liquidação, com economia, ganho e perda calculados.
  - [ ] Parcelas caem nas faturas certas e o pagamento liquida a fatura como transferência.
  - [ ] A recorrente tem uma ocorrência aberta: liquidar cria uma cópia ligada e avança, a não liquidada fica atrasada até ser liquidada ou pulada, e o futuro mostra a previsão sem gravar linhas.
  - [ ] Recorrências respeitam fim de mês e 29/02, e mudanças de regra ou valor não alteram as cópias liquidadas.
  - [ ] Listagens por período livre, pela data da liquidação ou prevista, com filtros de categoria e de repetição.
  - [ ] O resumo do painel traz fechamento, comparação com o período anterior, "Para onde foi", previsto x realizado, economias e perdas, saldo, cartões e próximas contas.
  - [ ] Sem período, o resumo vai da primeira movimentação até hoje, sem comparação, e as listagens não têm limite de data.
  - [ ] Excluir a cópia do último fechamento reverte o saldo e reabre aquela ocorrência.
  - [ ] Movimentações são editadas (a liquidada só em descrição, categoria e visibilidade) e a liquidação pode ser desfeita, revertendo o saldo e reabrindo a ocorrência da recorrente.
  - [ ] As cópias liquidadas de uma recorrente são listadas, e as listagens buscam por texto sem diferenciar acentos.
  - [ ] Envio repetido não duplica movimentação e dado alheio responde 404.
- **Rótulos:** SPEC-001, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-04

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-10-30 | início | in_progress | aprovada em 2026-10-30T14:38:10Z; modelo: opus |
| 2 | 2026-10-30 | baseline | coletado | 2 comando(s); códigos de saída: 0, 0; 2 evidência(s) automática(s) gravada(s) para comparação |
| 3 | 2026-10-30 | ajuste | in_progress | Recorrência no modelo da PD-51 e DEC-003 (ocorrência aberta única, cópia liquidada com generated_from, atraso, pulo e previsão virtual) no lugar da materialização; período livre from/to no resumo e nas listagens pela data efetiva (PD-55); resumo do painel com fechamento realizado e previsto, período anterior, Para onde foi, previsto x realizado, economias e perdas, saldo, cartões e próximas contas (PD-58); filtros de categoria e de repetição na listagem (PD-52, PD-58); categorias com tipo e cor (PD-49) |
| 4 | 2026-10-30 | ajuste | in_progress | Resumo sem from/to da primeira movimentação até hoje, sem comparação, e listagens sem limite de data (DEC-004); exclusão da cópia liquidada reverte o saldo e, sendo a do último fechamento, reabre a ocorrência voltando last_closed_on, com dois testes (DEC-004); adequação da TASK-16/17 registrada nos Detalhes técnicos |
| 5 | 2026-10-30 | ajuste | in_progress | PATCH /transactions/{id} com campos restritos na liquidada (DEC-005); DELETE /transactions/{id}/settlement revertendo o saldo, apagando a cópia e reabrindo a ocorrência, com 409 em fatura paga (DEC-005); GET /recurring-transactions/{id}/settled-transactions paginado (DEC-005); busca q com finance_unaccent nas listagens de movimentações e transferências (DEC-005); testes, Verificação, Evidências, critérios e card atualizados |
| 6 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 7 | 2026-10-30 | regressão | failed | comandos diferentes do baseline; bloqueada |
| 8 | 2026-10-30 | retomada | validating | decisão do usuário: usuário aceitou [1]: pasta finance criada pela própria tarefa (defeito da issue 6); aceito(s): 1 |
| 9 | 2026-10-30 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 10 | 2026-10-30 | regressão | passed | 1 igual(is) ao baseline, 1 aceito(s) pelo usuário |
| 11 | 2026-10-30 | evidências | passed | 3 evidência(s) em evidence/TASK-07/ |
| 12 | 2026-10-30 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Recorrência no modelo da PD-51 e DEC-003 (ocorrência aberta única, cópia liquidada com generated_from, atraso, pulo e previsão virtual) no lugar da materialização; período livre from/to no resumo e nas listagens pela data efetiva (PD-55); resumo do painel com fechamento realizado e previsto, período anterior, Para onde foi, previsto x realizado, economias e perdas, saldo, cartões e próximas contas (PD-58); filtros de categoria e de repetição na listagem (PD-52, PD-58); categorias com tipo e cor (PD-49) |
| 2 | 2026-10-30 | agente | Resumo sem from/to da primeira movimentação até hoje, sem comparação, e listagens sem limite de data (DEC-004); exclusão da cópia liquidada reverte o saldo e, sendo a do último fechamento, reabre a ocorrência voltando last_closed_on, com dois testes (DEC-004); adequação da TASK-16/17 registrada nos Detalhes técnicos |
| 3 | 2026-10-30 | agente | PATCH /transactions/{id} com campos restritos na liquidada (DEC-005); DELETE /transactions/{id}/settlement revertendo o saldo, apagando a cópia e reabrindo a ocorrência, com 409 em fatura paga (DEC-005); GET /recurring-transactions/{id}/settled-transactions paginado (DEC-005); busca q com finance_unaccent nas listagens de movimentações e transferências (DEC-005); testes, Verificação, Evidências, critérios e card atualizados |
