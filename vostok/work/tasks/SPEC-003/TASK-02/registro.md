## O que mudou

Agora é possível excluir uma recorrência, como uma despesa fixa ou uma receita que se repete todo mês. Até aqui ela só podia ser editada.

Ao excluir uma recorrência:

- As cobranças futuras que ainda não foram pagas ou recebidas saem da agenda. O saldo não muda com isso.
- Os pagamentos e recebimentos que já tinham sido confirmados continuam no histórico, como lançamentos avulsos, com o mesmo valor e a mesma data. Eles deixam de estar ligados a uma recorrência que não existe mais.
- Se alguém desfizer a confirmação de um desses lançamentos antigos, ele volta a aparecer como previsto. Não é apagado.
- Tentar excluir de novo a mesma recorrência mostra que ela já não existe.
- Uma pessoa não consegue excluir recorrências de outra.

## Por que importa

- Compromissos que acabaram deixam de poluir a agenda de previsões.
- O histórico do que já foi pago ou recebido é preservado, então a exclusão não apaga o passado.
- Os saldos continuam os mesmos antes e depois da exclusão, porque a mudança afeta só o que ainda não aconteceu.

## Como foi verificado

- Os testes automatizados da mudança passaram. Eles cobrem a exclusão de uma recorrência com e sem pagamentos já confirmados, a tentativa de excluir duas vezes e a tentativa de excluir a recorrência de outra pessoa.
- A verificação das demais partes do sistema não mostrou falhas novas em relação ao estado anterior.
- A evidência da verificação foi registrada.

## O que foi feito

Foi adicionada a rota `DELETE /recurring-transactions/{id}`, que responde 204 ao excluir e 404 quando a recorrência não existe, já foi excluída ou pertence a outro dono (RF-01, CB-02).

A exclusão é lógica: a recorrência recebe `deleted_at`, e a trava de leitura (`lock_recurring`) já filtra as que têm `deleted_at` preenchido. Na mesma transação do banco, as cópias liquidadas ligadas à recorrência têm `generated_from` e `occurrence_date` zerados (RN-01). Elas continuam existindo como movimentações pontuais (RF-02, RF-03). A ocorrência aberta não é gravada como linha (DEC-003), então some sozinha quando a recorrência ganha `deleted_at`. Nenhum saldo muda, por isso nenhuma conta é travada.

## Arquivos alterados

Todos em `apps/server/src/finance/`:

- `domain/recurring_transaction.rs`: só o comentário `//!` do módulo, descrevendo a exclusão lógica e o destino das cópias.
- `application/ports.rs`: novo método `delete(owner_id, id, now)` em `RecurringTransactionRepository`, após `skip_occurrence`.
- `application/recurring_transactions.rs`: novo caso de uso `delete`, que chama o repositório com `env.clock.now()`. Atualizado o `//!` com a palavra "exclusão".
- `infrastructure/pg_recurring_transactions.rs`: implementação de `delete` numa transação (`begin`, `lock_recurring`, dois `UPDATE`, `commit`). Atualizado o `//!` para registrar a transação.
- `interface/mod.rs`: a rota `/recurring-transactions/{id}` passa a aceitar `delete` junto de `get` e `patch`.
- `interface/handlers.rs`: novo handler `delete_recurring_transaction`, com documentação `utoipa` (204 e 404 em `ProblemDetails`). Segue o modelo de `delete_transfer`.
- `interface/openapi.rs`: `handlers::delete_recurring_transaction` incluído em `paths(...)`, e o teste `documents_all_finance_routes` passa a esperar `["get", "patch", "delete"]` para a rota.
- `tests/recurring_transactions.rs`: testes `ct01_deleting_recurring_keeps_settled_copies_as_one_off_history`, `ct02_deleting_never_settled_recurring_leaves_no_history_and_second_delete_is_404` e `undo_settlement_of_copy_after_recurring_deletion_keeps_it_as_one_off`, mais o `//!` com os IDs cobertos.
- `tests/authorization.rs`: o `DELETE` da recorrência de outro usuário entrou no vetor `cases` de `other_user_resources_return_404`.

## Decisões

- **Desligar as cópias em vez de manter o vínculo (RN-01).** `generated_from` e `occurrence_date` são zerados juntos, porque a tabela tem o `CHECK` `(generated_from IS NULL) = (occurrence_date IS NULL)`. A alternativa descartada era manter `generated_from` e escondê-lo na resposta. Isso exigiria um `JOIN` em todas as leituras de movimentação, e desfazer a liquidação apagaria a cópia sem reabrir nada, perdendo o valor.
- **Desfazer depois da exclusão.** `undo_settlement` em `infrastructure/pg_transactions.rs` (não alterado) apaga a cópia só quando ela tem `generated_from`. Como a cópia desligada não tem, ela volta a ficar prevista como movimentação pontual. Esse comportamento depende de os vínculos estarem nulos, então a ordem dos dois `UPDATE` na transação importa.
- **Escopo do `UPDATE` das cópias.** O `UPDATE transactions ... WHERE generated_from = $2 AND owner_id = $3` pega todas as cópias ligadas à recorrência, independentemente do status, para que nenhuma linha continue apontando para uma recorrência excluída.
- **Sem gancho de exclusão.** A recorrência não é entidade de `links`, então nada além do caso de uso precisou mudar.

## Pontos de atenção

- Qualquer mudança futura nos vínculos de `transactions` precisa respeitar o `CHECK` `(generated_from IS NULL) = (occurrence_date IS NULL)` e o índice único `transactions_generated_from_occurrence_key`, definidos na migração `apps/server/src/finance/migrations/20261101070004_create-finance-transactions.sql`.
- As queries novas exigem regenerar os dados offline do `sqlx` (`.sqlx`). O procedimento foi feito com PostgreSQL temporário e `cargo sqlx prepare --workspace`, com backup prévio. A lista de arquivos alterados do registro não mostra a pasta `.sqlx`, então confira o diff para garantir que ela foi atualizada junto.
- Não rode duas compilações pesadas de `atria-server` ao mesmo tempo (KNW-007).
- O código já estava sem o campo de cartão, por causa da TASK-01. Os nomes usados são os resultantes dela.

## Verificação

- Baseline coletado antes de qualquer mudança: 4 comandos, todos com código de saída 0.
- Testes: passaram, sem falhas. A saída fica em `validation/tests.out` da pasta da tarefa.
- Regressão: os mesmos 4 comandos do baseline, sem diferença.
- Evidências: 1 registrada em `evidencias/` da pasta da tarefa.

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T18:04:46Z; modelo: claude-opus-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 4 comando(s); códigos de saída: 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline |
| 5 | 2026-11-01 | evidências | passed | 1 evidência(s) em TASK-02/evidencias/ |
| 6 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
