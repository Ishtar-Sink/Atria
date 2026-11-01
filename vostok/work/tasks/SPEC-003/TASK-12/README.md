# TASK-12: Excluir conta com conta de destino na tela

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** approved
- **Onda:** 9
- **Dependências:** TASK-10

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Excluir conta com conta de destino na tela
- **Tipo:** tarefa
- **Descrição:** A exclusão da conta pede a conta de destino quando houver movimentações.
- **Critérios de aceite:**
  - [ ] Uma conta com movimentações pode ser excluída: o diálogo de exclusão pede a conta de destino, lista só as outras contas e não deixa seguir sem escolher (RF-05, CT-04).
  - [ ] Ao confirmar, a conta some, o saldo da destino já aparece somado e as movimentações, transferências e saldos são relidos do servidor (RF-06, CT-04, [project/frontend-18]).
  - [ ] A conta de destino em outra moeda aparece como erro dentro do diálogo, com a lista restaurada e sem aviso solto, e a conta padrão continua sem "Excluir" (RF-05, CT-05, CB-03, FA-02, [project/frontend-09]).
  - [ ] A conta sem movimentações continua sendo excluída com uma só confirmação, sem pedir a conta de destino (FA-03, RF-05).
  - [ ] O diálogo da conta de destino não tem violações de acessibilidade nem rolagem horizontal, nos temas claro e escuro e em desktop e 360 px (RNF-02, [project/frontend-10]).
  - [ ] O e2e do CT-04 está escrito e compila (CT-04).
  - [ ] Os arquivos da tarefa passam no ESLint e no Prettier sem warnings e sem erros de tipo ([project/code-style-01]).
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-10
