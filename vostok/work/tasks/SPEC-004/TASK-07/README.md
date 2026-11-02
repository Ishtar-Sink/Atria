# TASK-07: Editor de ajustes no formulário e no detalhe

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-004
- **Status:** approved
- **Onda:** 5
- **Dependências:** TASK-03, TASK-05

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Editor de ajustes no formulário e no detalhe
- **Tipo:** historia
- **Descrição:** Editor com a base digitada, líquido ao vivo no formulário e detalhamento no detalhe da movimentação e da recorrente.
- **Critérios de aceite:**
  - [ ] O formulário da movimentação tem o editor de descontos e acréscimos, com nome, sentido, valor fixo ou percentual e a caixa "Base diferente do bruto" que mostra o campo da base, e explica que o percentual é a alíquota efetiva (RF-13).
  - [ ] O líquido previsto muda a cada edição do bruto e dos itens e é igual ao da tabela de casos usada pelo servidor (RF-13, CT-11).
  - [ ] O formulário recusa líquido zerado ou negativo, base marcada sem valor e mais de 20 itens, com o erro no próprio formulário.
  - [ ] O detalhe da movimentação mostra o bruto, cada item com o valor calculado e o líquido, no previsto e no liquidado, e o detalhe da recorrente mostra os itens; sem itens, a tela fica como antes (RF-12, CT-10).
  - [ ] Editor e detalhamento são acessíveis e funcionam em 360 px sem rolagem horizontal, sem vermelho (RNF-04, RNF-05).
  - [ ] Testes do Financeiro, ESLint, Prettier e tipos passam sem warning.
- **Rótulos:** SPEC-004, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-03, TASK-05
