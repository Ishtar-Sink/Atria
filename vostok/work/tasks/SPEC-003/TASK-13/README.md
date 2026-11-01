# TASK-13: Cor da categoria no color picker

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** done
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

- **Título:** Cor da categoria no color picker
- **Tipo:** tarefa
- **Descrição:** O formulário de categoria usa o color picker e as telas mostram a cor HEX.
- **Critérios de aceite:**
  - [x] A cor da categoria é escolhida no color picker, ao criar e ao editar, e gravada como `#rrggbb` em minúsculas (RF-18, RN-09, CT-12).
  - [x] A cor HEX aparece em Configurações, no detalhe da categoria e nas barras do "Para onde foi" (RF-18, CT-12, FA-04).
  - [x] O texto sobre uma cor clara fica escuro e sobre uma cor escura fica claro, com contraste AA nos dois temas (CB-09, RNF-02).
  - [x] As cores por nome saíram do Financeiro: sem `tone.ts`, sem a lista de seis cores e sem cor literal no CSS (RF-18, [project/code-style-10]).
  - [x] Testes do Financeiro, tipos, ESLint e Prettier passam sem warning.
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-10
