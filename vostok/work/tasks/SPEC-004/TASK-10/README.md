# TASK-10: E2E e evidências

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-004
- **Status:** approved
- **Onda:** 7
- **Dependências:** TASK-08, TASK-09

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** E2E e evidências
- **Tipo:** tarefa
- **Descrição:** Fluxo completo nos e2e com axe e evidências em 360 px e desktop.
- **Critérios de aceite:**
  - [ ] O fluxo completo roda contra o servidor real: entrada com descontos, liquidada pelo líquido, com o bruto recalculado na prévia e o líquido no saldo e no painel (RF-08, RF-09, CT-05).
  - [ ] Uma saída com desconto e acréscimo tira do saldo só o líquido (RF-08, FA-02).
  - [ ] Formulário, detalhe e painel passam no axe e não têm rolagem horizontal em 360 px nem em desktop (RNF-04, RNF-05).
  - [ ] O vídeo do fluxo mostra o líquido ao vivo, a prévia da liquidação e o cartão do painel.
  - [ ] Os e2e de antes do Financeiro continuam passando, e tipos, ESLint e Prettier passam sem warning.
- **Rótulos:** SPEC-004, mecanica
- **Estimativa:** mecanica
- **Bloqueada por:** TASK-08, TASK-09
