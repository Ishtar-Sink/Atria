## Resumo

Agora é possível excluir uma conta que tem movimentações, desde que a pessoa escolha outra conta dela para recebê-las. Antes, o sistema recusava a exclusão de qualquer conta com movimentações.

## O que acontece ao excluir uma conta

Ao escolher a conta de destino, tudo o que estava na conta excluída passa para ela:

- os lançamentos, realizados ou previstos;
- as recorrências, como contas que se repetem todo mês;
- as transferências com outras contas;
- o saldo que restava na conta excluída.

As transferências feitas entre a conta excluída e a conta de destino deixam de existir, pois transferir dinheiro de uma conta para ela mesma não faz sentido. O efeito dessas transferências nos saldos é desfeito antes, então nenhum valor se perde.

Contas sem movimentações continuam sendo excluídas normalmente, sem precisar escolher destino.

## Quando a exclusão é recusada

- A conta principal da pessoa nunca pode ser excluída, mesmo com outro destino escolhido.
- O destino precisa ser outra conta ativa da mesma pessoa, na mesma moeda. Caso contrário, a exclusão é recusada com uma mensagem explicando o motivo: conta igual à que está sendo excluída, conta inexistente ou já excluída, conta que não é da pessoa, ou conta em outra moeda.
- Quando a exclusão é recusada, nada muda: a conta e seus lançamentos continuam exatamente como estavam.

## Valor para o negócio

- O total de dinheiro da pessoa não muda com a exclusão.
- Os lançamentos, as recorrências e o saldo da conta excluída não se perdem: passam para a conta de destino.
- Quando duas operações acontecem ao mesmo tempo sobre a mesma conta, o sistema as coordena para não falhar.

## Como foi verificado

- Foram criados testes automatizados para os principais cenários: exclusão com destino, tratamento das transferências entre as duas contas, recusa por moeda diferente, recusa da conta principal, recusa sem destino e recusa de destino inválido. Todos passaram.
- A verificação de que o restante do sistema não foi afetado também passou.
- Foi registrada 1 evidência da entrega.

## Pontos de atenção

- Quem usa a função de excluir contas precisa passar a perguntar a conta de destino quando a conta tiver movimentações. Sem ela, a exclusão será recusada.

## O que foi feito

`DELETE /accounts/{id}` passou a aceitar `move_to` (query, opcional). Quando a conta tem movimentações, a exclusão lógica só acontece depois que as movimentações, as transferências ativas e as recorrências ativas são movidas para a conta de destino. As transferências entre as duas contas são excluídas, e os dois saldos são recalculados. Tudo ocorre em uma única transação, em `apps/server/src/finance/infrastructure/pg_accounts.rs`.

## Arquivos alterados

- `apps/server/src/finance/domain/error.rs` (+5/-1): nova variante `CurrencyMismatch` (código `currency_mismatch`). A mensagem de `AccountHasTransactions` passou a pedir conta de destino; o código continua `account_has_transactions`. `codes_are_stable` cobre o novo código.
- `apps/server/src/finance/application/accounts.rs` (+34/-3): `delete` recebe `move_to: Option<Uuid>` e devolve os ids das transferências excluídas. Nova função pura `check_destination`, que recusa destino igual à conta. Módulo de teste unitário `destination_must_differ_from_deleted_account`.
- `apps/server/src/finance/application/ports.rs` (+16/-2): `AccountRepository::delete(owner_id, id, move_to, now)` devolve `Outcome<Vec<Uuid>>`, com a documentação do contrato.
- `apps/server/src/finance/infrastructure/pg_accounts.rs` (+155/-11): reescrita de `delete` (travas, validações, movimentação, reversão de saldos e exclusão). Função local `locked` lê uma conta com `FOR UPDATE`.
- `apps/server/src/finance/interface/dto.rs` (+9): `DeleteAccountQuery` com `move_to`, documentado como obrigatório quando a conta tem movimentações.
- `apps/server/src/finance/interface/handlers.rs` (+33/-4): `delete_account` lê `move_to` e avisa o gancho das transferências excluídas antes do aviso de conta excluída. `api_error` mapeia `CurrencyMismatch` para 422. O `#[utoipa::path]` documenta a resposta 422.
- `apps/server/src/finance/interface/openapi.rs` (+14/-1): o teste `documents_all_finance_routes` confere o parâmetro `move_to` em `DELETE /api/v1/accounts/{id}`.
- `apps/server/src/finance/tests/accounts.rs` (+194/-3): auxiliar `delete_moving` e seis testes de integração novos: `ct04_deleting_account_moves_transactions_transfers_and_recurring_to_destination`, `cb04_transfer_between_deleted_and_destination_account_is_deleted`, `ct05_destination_in_other_currency_is_refused_with_currency_mismatch`, `ct05_default_account_is_refused_even_with_destination`, `account_with_transactions_without_destination_is_refused` e `destination_must_be_another_active_account_of_the_owner`. O `//!` do arquivo foi atualizado. O relógio é fixo em 2026-11-01.

Não foi alterado: `apps/server/src/finance/infrastructure/mod.rs` (somente leitura, usa `lock_account`, `add_to_balance`, `begin`, `commit` e `storage`), nem a migração de transações.

## Fluxo da exclusão (`pg_accounts.rs`)

1. Trava, `FOR UPDATE` e em ordem de id, as linhas ativas da conta excluída: transações, recorrências e transferências (de origem ou destino).
2. Trava as duas contas (excluída e destino) em ordem de id, com `locked`. Conta excluída ausente vira `NotFound`; destino ausente vira `invalid("move_to", "not_found")`.
3. `ensure_deletable()` (conta padrão). Com destino, moeda diferente vira `CurrencyMismatch`.
4. Consulta `in_use`. Se há uso e não há destino, `AccountHasTransactions`.
5. Com destino, exclui as transferências entre as duas contas e acumula a reversão nos dois saldos (`source_delta` e `target_delta`).
6. Move as linhas ativas com `account_id`/`from_account_id`/`to_account_id` apontando para o destino, com `updated_at = now`.
7. Soma no destino `target_delta + (saldo da conta excluída + source_delta)` via `add_to_balance`.
8. Zera o saldo da conta excluída e grava `deleted_at`.

## Decisões

- **Transferência entre a conta excluída e o destino é excluída, não movida.** Mover violaria o `CHECK transfers_distinct_accounts` (origem igual ao destino). Recusar a exclusão contrariaria a decisão 15 da spec. A reversão acontece antes de mover o restante.
- **Saldos incrementais, não recalculados.** Recalcular a partir da soma de liquidações e transferências poderia divergir do saldo gravado e alterar valores que a pessoa já vê. O incremento mantém o saldo total da pessoa (RNF-01) e entrega ao destino exatamente o que as movimentações movidas representam.
- **Ordem das travas: linhas antes das contas, contas em ordem de id.** É a mesma ordem de `settle`, `undo_settlement` e exclusão de movimentação/transferência, o que evita `deadlock detected` (500) com liquidação simultânea. Travar as contas primeiro, como faz o pagamento de fatura, inverte essa ordem e foi descartado.
- **Validação do destino no mesmo padrão da exclusão de categoria** (`replacement_for_deletion`). Um `move_to` informado é sempre validado, mesmo em conta sem movimentações; FA-03 continua sem exigir destino quando a conta está vazia.
- **Só linhas ativas (`deleted_at IS NULL`) mudam de conta.** As já excluídas ficam na conta excluída. Isso também evita que uma transferência excluída entre as duas contas viole o `CHECK`.

## Contrato da API (respostas de erro)

- Sem `move_to` e com movimentações: 409 `account_has_transactions`.
- Conta padrão (com ou sem destino): 409 `default_account_not_deletable`.
- Destino igual à conta: 422 `validation_failed` (`move_to`, `same_account`).
- Destino inexistente, excluído ou de outra pessoa: 422 `validation_failed` (`move_to`, `not_found`), sem revelar dado de outra pessoa.
- Destino em outra moeda: 422 `currency_mismatch`.
- Sucesso: 204.

## Pontos de atenção

- **Ordem de travas.** O pagamento de fatura trava as contas antes das movimentações, ao contrário de `settle` e `undo_settlement`. Esta exclusão não segue esse padrão. Vale revisar se ela pode competir com o pagamento de fatura pela mesma conta.
- **Dados do `.sqlx` regenerados.** As queries novas e alteradas precisam dos dados offline. O procedimento previsto foi: backup de `.sqlx` em `${TMPDIR:-/tmp}/atria-sqlx-backup-spec003-task03`, Postgres 17 temporário na porta 55432, `cargo sqlx prepare --workspace` com `DATABASE_URL`, remoção do container e `SQLX_OFFLINE=true cargo build -q -p atria-server` sem `DATABASE_URL`. Se falhar, restaurar o backup. Datas passam como `now as _` nas macros do sqlx (KNW-009).
- **Compilação pesada uma por vez** no servidor (KNW-007).
- **Trava de conta padrão no banco** ([project/database-04]) continua valendo. A exclusão grava `deleted_at` diretamente, então depende dessa trava.
- **Notificação.** As transferências excluídas são avisadas pelo gancho `notify_deleted` com o tipo `transfer` antes do aviso de `account`.
- **Dependências da tarefa.** O código já estava sem cartão (TASK-01) e sem a exclusão de recorrente (TASK-02). Os nomes usados são os que ficaram depois delas.
- **Mensagem alterada.** O texto de `AccountHasTransactions` mudou; o código não. Clientes que comparam o código não são afetados.

## Verificação

- Testes: `cargo test -p atria-server finance::` sem falhas (saída registrada em `validation/tests.out`, conforme o registro de execução).
- Regressão: 4 comandos, todos com código de saída 0, iguais ao baseline coletado antes das mudanças.
- Evidências: 1 registrada em `evidencias/` da tarefa.

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T18:04:46Z; modelo: claude-opus-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 4 comando(s); códigos de saída: 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline |
| 5 | 2026-11-01 | evidências | passed | 1 evidência(s) em TASK-03/evidencias/ |
| 6 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
