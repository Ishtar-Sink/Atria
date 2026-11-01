# TASK-02: Excluir recorrência no servidor

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** approved
- **Onda:** 2
- **Dependências:** TASK-01

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Excluir recorrência no servidor
- **Tipo:** tarefa
- **Descrição:** DELETE da recorrência, com a ocorrência aberta, mantendo as cópias liquidadas como histórico.
- **Critérios de aceite:**
  - [ ] Uma recorrente pode ser excluída sem liquidar antes, com resposta 204, e some junto com a ocorrência aberta das listas (RF-01, RF-02, CT-01).
  - [ ] As cópias já liquidadas continuam no histórico como movimentações pontuais, sem ligação com a recorrente, e o saldo da conta não muda (RF-03, RN-01, CT-01).
  - [ ] Uma recorrente nunca liquidada some sem deixar histórico, e excluir a mesma recorrente de novo responde 404 sem mudar nada (CT-02, CB-01, CB-02).
  - [ ] Outra pessoa recebe 404 ao excluir a recorrente, e o OpenAPI documenta o `DELETE /recurring-transactions/{id}` (RF-01).
  - [ ] A formatação, o clippy, o build offline com a `.sqlx` regenerada e os testes do Financeiro, dos relatórios e do `http` passam (RF-01).
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-01
