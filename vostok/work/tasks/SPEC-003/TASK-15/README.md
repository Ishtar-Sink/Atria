# TASK-15: Gráficos interativos e Mês a mês

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-003
- **Status:** done
- **Onda:** 10
- **Dependências:** TASK-13

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Gráficos interativos e Mês a mês
- **Tipo:** historia
- **Descrição:** Previsto x realizado em barras horizontais interativas e o card Mês a mês em barras verticais, com a biblioteca de gráficos.
- **Critérios de aceite:**
  - [x] O Previsto x realizado usa barras horizontais nas cores de entrada e saída, com os valores e os textos que dizem o que cada barra é (RF-14, CT-09).
  - [x] Passar o mouse ou focar pelo teclado no Previsto x realizado mostra a dica com o valor e a diferença (RF-13, CT-09, RNF-05).
  - [x] O painel tem o card "Mês a mês" abaixo do Fechamento, em barras verticais, uma coluna por mês, com 6 meses realizados e 6 projetados em tom mais claro, e o mês sem movimentação aparece com zero (RF-15, CT-10, CB-08).
  - [x] O "Mês a mês" alterna entre "Entradas e saídas" e "Saldo", a escolha fica na URL e o saldo negativo aparece em âmbar, sem vermelho (RF-16, RN-07, CT-10).
  - [x] Os dois gráficos têm tabela acessível e funcionam pelo teclado, com contraste AA nos dois temas (RNF-02, RNF-03, RNF-05).
  - [x] A biblioteca de gráficos (recharts 3.10.1, MIT) está com versão exata e só é carregada no painel do Financeiro, num chunk separado (RNF-04, [project/stack-12]).
  - [x] Testes do Financeiro, tipos, ESLint, Prettier e o build passam sem warning.
- **Rótulos:** SPEC-003, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-13
