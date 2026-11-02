# TASK-01: Estudo dos descontos

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-004
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

- **Título:** Estudo dos descontos
- **Tipo:** tarefa
- **Descrição:** Documento com a pesquisa contábil de 2026, o modelo de dados, o arredondamento, o cálculo reverso e a recomendação.
- **Critérios de aceite:**
  - [x] O estudo `docs/estudos/financeiro-descontos.md` existe, no formato dos estudos do Financeiro, com todas as seções pedidas (RF-16, CT-15).
  - [x] A prática contábil da folha de 2026 (INSS por faixas, IRRF sobre o bruto menos o INSS com o redutor da Lei 15.270/2025 e contribuição sindical) aparece como exemplo, com o aviso de que o sistema não calcula as tabelas oficiais (RF-16, CT-15).
  - [x] O modelo de dados compara a tabela de itens com a coluna `JSONB`, recomenda uma das duas e explica as colunas novas, o `expected_amount` como líquido, a restrição `transactions_settlement_coherent` e a migração sem mudar valores existentes (RF-16, CT-15).
  - [x] O arredondamento e o cálculo reverso trazem a regra em inteiros e os mesmos números da tabela de casos das TASK-02 e TASK-03 (RF-16, CT-15).
  - [x] A recomendação diz, ponto a ponto, o que confirma ou muda no contrato da spec, e o impacto no forecast e no resumo está descrito (RF-16, CT-15).
- **Rótulos:** SPEC-004, padrao
- **Estimativa:** padrao
- **Bloqueada por:** -
