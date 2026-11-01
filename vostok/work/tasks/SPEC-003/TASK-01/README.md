# TASK-01: Remover o cartão no servidor

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** done
- **Onda:** 1
- **Dependências:** -

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Remover o cartão no servidor
- **Tipo:** tarefa
- **Descrição:** O servidor deixa de ter cartão, faturas, parcelas e limite, e a migração converte os cartões existentes em contas comuns.
- **Critérios de aceite:**
  - [x] A migração converte os cartões existentes em contas comuns sem perder dados: as contagens de contas, movimentações, transferências e recorrências, os valores, as datas, as liquidações e os saldos ficam iguais, e o ex-cartão entra no saldo do painel (RF-10, CT-06, RNF-01).
  - [x] As parcelas de uma compra no cartão convertido viram saídas independentes, com a mesma data prevista, o mesmo valor e a mesma liquidação de antes (CB-05).
  - [x] A transferência que pagou uma fatura continua, com o mesmo valor e as mesmas contas, sem período de fatura, e os saldos não mudam (CB-06).
  - [x] O servidor não tem mais cartão de crédito: a conta não aceita nem devolve tipo, limite, fechamento ou vencimento, a movimentação não aceita parcelas nem devolve parcela ou fatura, e as rotas de fatura e de pagamento respondem 404 (RF-07).
  - [x] O resumo do Financeiro não traz mais Cartões e lista todas as contas no saldo, e o contrato OpenAPI não tem mais as rotas, os schemas nem os campos de cartão (RF-07, RF-09).
  - [x] Nenhuma migração antiga foi editada, o servidor compila sem banco com a `.sqlx` regenerada, sem aviso de formatação ou do clippy, e os testes do Financeiro, dos relatórios, da busca e do `http` continuam passando (RF-07, RNF-01).
- **Rótulos:** SPEC-003, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** -
