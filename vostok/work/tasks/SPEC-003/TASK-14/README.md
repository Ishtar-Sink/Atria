# TASK-14: Cor do destaque no color picker

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** done
- **Onda:** 8
- **Dependências:** TASK-07

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Cor do destaque no color picker
- **Tipo:** tarefa
- **Descrição:** O leitor cria e troca a cor do destaque no color picker e marca o PDF com a cor HEX.
- **Critérios de aceite:**
  - [x] O destaque é criado numa cor livre escolhida no color picker do leitor, além dos cinco atalhos, e gravado como `#rrggbb` em minúsculas (RF-19, RN-09, CT-13).
  - [x] A marca no PDF usa a cor HEX do destaque (RF-19, CT-13).
  - [x] A cor de um destaque é trocada na aba Destaques pelos atalhos ou pelo color picker, e o item mostra o nome do atalho ou o HEX (RF-19, CT-13).
  - [x] O leitor e a aba Destaques seguem acessíveis nos dois temas, sem cor por nome no CSS (RNF-02, [project/code-style-10]).
  - [x] Testes do leitor, tipos do leitor, ESLint e Prettier passam sem warning.
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-07
