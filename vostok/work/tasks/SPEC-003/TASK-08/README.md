# TASK-08: Autocomplete na @atria/ui

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

- **Título:** Autocomplete na @atria/ui
- **Tipo:** tarefa
- **Descrição:** Componente de autocomplete com busca, seleção única e múltipla, operável pelo teclado.
- **Critérios de aceite:**
  - [x] A `@atria/ui` exporta um autocomplete que filtra as opções enquanto se digita, sem diferenciar maiúsculas nem acentos (RF-21, CT-16).
  - [x] Pelo teclado, as setas movem a opção ativa, o Enter escolhe e o Esc fecha sem mudar o valor (RF-21, RNF-05).
  - [x] Sem resultado para o texto digitado, aparece "Nenhuma categoria encontrada" e o valor anterior continua (CB-10).
  - [x] Na seleção múltipla, várias opções são escolhidas e cada uma é removida pelo × ou pelo Backspace (RF-21, CT-16).
  - [x] O autocomplete tem a altura e o visual do seletor da biblioteca, mostra erro e desabilitado nos dois temas e não tem violações de acessibilidade (RF-21).
  - [x] Testes, lint, Prettier e checagem de tipos da `@atria/ui` e do `@atria/web` passam sem warning.
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** -
