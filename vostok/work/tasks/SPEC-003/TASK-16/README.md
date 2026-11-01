# TASK-16: Autocomplete nos filtros de categoria

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** approved
- **Onda:** 9
- **Dependências:** TASK-08, TASK-10

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Autocomplete nos filtros de categoria
- **Tipo:** tarefa
- **Descrição:** Os filtros de categoria de Entradas, Saídas e Gastos por categoria usam o autocomplete.
- **Critérios de aceite:**
  - [ ] O filtro de categoria de Entradas, de Saídas e do relatório Gastos por categoria é o autocomplete com seleção única, e os outros filtros não mudam (RF-22).
  - [ ] Digitando, a lista filtra; as setas e o Enter escolhem uma só categoria, que filtra a lista ou o relatório e fica na URL (CT-15, RNF-05).
  - [ ] Uma busca sem resultado mostra "Nenhuma categoria encontrada", e o Esc fecha mantendo o filtro anterior (CB-10).
  - [ ] O filtro funciona em 360 px sem rolagem horizontal e sem violações de acessibilidade (CT-15).
  - [ ] Testes, lint, Prettier e checagem de tipos passam sem warning.
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-08, TASK-10
