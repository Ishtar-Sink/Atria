# TASK-06: Descontos por nome no resumo

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-004
- **Status:** done
- **Onda:** 4
- **Dependências:** TASK-04

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Descontos por nome no resumo
- **Tipo:** tarefa
- **Descrição:** Total de descontos e acréscimos do período por nome no resumo do Financeiro.
- **Critérios de aceite:**
  - [x] O resumo do período traz o total dos descontos e o dos acréscimos agrupados por nome, com o sentido de cada linha e os descontos antes dos acréscimos (RF-14, CT-12).
  - [x] Nomes que diferem só por maiúsculas, espaços ou acentos, como "INSS" e "inss" em movimentações diferentes, somam numa linha só (CB-07, RN-11).
  - [x] Liquidadas entram com os valores da liquidação; previstas e projeções, com os valores previstos; e o liquidado aparece separado (RN-11).
  - [x] Sem itens no período, o total por nome é uma lista vazia, e as transferências e as movimentações fora do período não entram (RF-14).
  - [x] O contrato gerado traz `adjustments_by_name` e `AdjustmentTotalDto`, e a formatação, o clippy e os testes do Financeiro, dos relatórios e do `http` passam ([project/api-02]).
- **Rótulos:** SPEC-004, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-04
