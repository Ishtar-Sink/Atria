# TASK-02: Cálculo no domínio do servidor

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-004
- **Status:** done
- **Onda:** 2
- **Dependências:** TASK-01

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Cálculo no domínio do servidor
- **Tipo:** tarefa
- **Descrição:** Módulo de ajustes com líquido, base digitada, bruto equivalente e centavo residual, com a tabela de casos.
- **Critérios de aceite:**
  - [x] O servidor calcula o líquido a partir do bruto com itens fixos e percentuais, no bruto ou numa base digitada, e a ordem dos itens não muda o líquido (RF-03, RF-04, RF-05, RF-06, RF-07, CT-01, CT-02).
  - [x] Cada percentual é arredondado para o centavo, meio para cima, só com inteiros (RF-05, RF-07).
  - [x] Liquidar pelo líquido calcula o bruto equivalente, escala a base digitada na proporção do bruto e põe o centavo que sobra no último percentual, com a identidade exata (RF-07, CT-07, CB-05).
  - [x] Itens inválidos são recusados com o campo e o código do problema: percentual 0% ou 100%, base digitada zero, 21 itens, nome vazio ou longo, líquido zero ou negativo e líquido sem bruto possível (CT-13, CB-03, CB-04, CB-09).
  - [x] A formatação, o clippy e os testes do domínio do Financeiro passam, e a tabela de casos é a mesma da TASK-03 (RF-07).
- **Rótulos:** SPEC-004, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-01
