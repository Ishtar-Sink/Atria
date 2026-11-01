# TASK-04: Série mensal no resumo do Financeiro

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** approved
- **Onda:** 4
- **Dependências:** TASK-03

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Série mensal no resumo do Financeiro
- **Tipo:** tarefa
- **Descrição:** O resumo traz 6 meses realizados e 6 projetados pelas recorrências.
- **Critérios de aceite:**
  - [ ] O resumo do Financeiro traz `monthly` com 12 meses em ordem: os 6 realizados, até o mês de hoje, e os 6 seguintes marcados como projetados (RF-17, CT-11).
  - [ ] Nos meses realizados, entradas e saídas são os valores liquidados do mês e o saldo é o do fim do mês; nos projetados, entram as movimentações não liquidadas e as ocorrências das recorrentes pela data prevista, e o saldo é o previsto no fim do mês (RF-17, RN-08).
  - [ ] Pedir o resumo não grava nenhuma linha, e a série é a mesma qualquer que seja o período pedido (RN-08, DEC-003).
  - [ ] Um mês sem nenhuma movimentação aparece com valor zero, sem quebrar a sequência de meses (CB-08).
  - [ ] O OpenAPI documenta `monthly` e `MonthlyTotalsDto`, e a formatação, o clippy e os testes do Financeiro, dos relatórios e do `http` passam (RF-17).
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-03
