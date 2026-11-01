# TASK-03: Excluir conta com conta de destino no servidor

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** done
- **Onda:** 3
- **Dependências:** TASK-02

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Excluir conta com conta de destino no servidor
- **Tipo:** tarefa
- **Descrição:** DELETE da conta com `move_to`, movendo movimentações, transferências e recorrências e recalculando os saldos.
- **Critérios de aceite:**
  - [x] Uma conta com movimentações pode ser excluída indicando outra conta, e as movimentações, as transferências e as recorrências passam para ela, com o saldo total da pessoa igual ao de antes (RF-05, RF-06, CT-04).
  - [x] Uma transferência entre a conta excluída e a de destino é excluída, e a conta de destino fica com o saldo das duas de antes da transferência (RN-05, CB-04).
  - [x] Uma conta de destino em outra moeda é recusada com o código `currency_mismatch` (422), e a conta padrão continua sem poder ser excluída, mesmo com destino (RN-03, RN-04, CT-05, CB-03).
  - [x] Sem conta de destino, a conta com movimentações é recusada com `account_has_transactions`; destino igual à própria conta, de outra pessoa ou já excluído é recusado sem mudar nada; e a conta sem movimentações continua sendo excluída sem destino (RF-05, RN-04).
  - [x] A mudança de conta, a exclusão das transferências e os dois saldos acontecem numa única transação do banco, com as travas na ordem do resto do contexto (RF-06, [project/database-03]).
  - [x] A formatação, o clippy, o build offline com a `.sqlx` regenerada e os testes do Financeiro, dos relatórios e do `http` passam, e o OpenAPI documenta o parâmetro `move_to` (RF-05).
- **Rótulos:** SPEC-003, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-02
