# TASK-09: Rolagem única do app

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

- **Título:** Rolagem única do app
- **Tipo:** tarefa
- **Descrição:** A janela rola, com a barra lateral e a topbar fixas, e o cabeçalho fixo segue funcionando.
- **Critérios de aceite:**
  - [x] A página tem uma única rolagem, a da janela, no painel e nos formulários, sem rolagem dentro da área da página (RF-23, CT-17).
  - [x] A barra lateral fica na altura da tela e a topbar no topo durante toda a rolagem, sem espaço em branco no fim (RF-23, CT-17).
  - [x] O cabeçalho fixo continua compactando depois de 48 px, colado logo abaixo da topbar, com o fundo de ponta a ponta (RF-24, CT-17).
  - [x] As abas do Financeiro ficam presas sob o título durante a rolagem, e o conteúdo não aparece por trás do cabeçalho, mesmo no navegador que não desenha o desfoque; o fundo vai da barra lateral à borda da janela e termina numa linha logo abaixo das abas, sem faixa em degradê (RF-24, CT-17).
  - [x] Numa página mais curta que a tela, não aparece rolagem e a barra lateral ocupa a altura da tela (CB-11).
  - [x] A rolagem única funciona no Chromium e no Firefox (RNF-06).
  - [x] O leitor, o quadro de Projetos e a paleta de comandos continuam com a própria rolagem (RF-23).
  - [x] Testes, lint, Prettier e checagem de tipos passam sem warning.
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** -
