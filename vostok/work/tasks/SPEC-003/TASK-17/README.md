# TASK-17: Valores com sinal e cor

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** approved
- **Onda:** 11
- **Dependências:** TASK-15, TASK-16

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Valores com sinal e cor
- **Tipo:** tarefa
- **Descrição:** Entradas verdes com "+", saídas com "−" e saldos em verde ou âmbar no Financeiro.
- **Critérios de aceite:**
  - [ ] As entradas aparecem em verde com "+" e as saídas na cor do texto com "−", nas listas e no painel (RF-11, CT-08).
  - [ ] O sinal e a cor seguem o tipo da movimentação, nunca o sinal do número guardado (RN-06).
  - [ ] Saldos e sobra prevista aparecem em verde quando positivos, em âmbar com "−" quando negativos e, quando zero, na cor do texto sem sinal (RF-12, CB-07, CT-08).
  - [ ] Nenhum valor usa vermelho, o sinal fica em texto ao lado da cor e o contraste é AA nos dois temas (RN-07, RNF-02, RNF-03).
  - [ ] Testes do Financeiro, tipos, ESLint e Prettier passam sem warning.
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-15, TASK-16
