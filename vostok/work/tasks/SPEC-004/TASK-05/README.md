# TASK-05: Ajustes nas recorrentes

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

- **Título:** Ajustes nas recorrentes
- **Tipo:** historia
- **Descrição:** Itens na regra, nas ocorrências virtuais, na liquidação com edição e na cópia liquidada.
- **Critérios de aceite:**
  - [x] Uma recorrente de entrada ou de saída aceita a mesma lista de itens da avulsa, grava o bruto e os itens da regra e mostra o líquido como valor previsto; sem itens, funciona como antes (RF-02, RN-09).
  - [x] Cada ocorrência virtual da projeção, nas listagens e no painel, tem o líquido e os itens da regra, sem gravar linhas (RF-08, CT-04).
  - [x] Liquidar a ocorrência pelo líquido grava na cópia liquidada os itens previstos e os da liquidação, com o bruto recalculado, a base do IRPF na mesma proporção e o saldo somando o líquido informado, sem mudar a regra (RF-11, CT-05).
  - [x] Os itens podem ser editados na liquidação da ocorrência; o bruto é recalculado com os itens editados e a regra da recorrente não muda (RF-10, RF-11, CT-06).
  - [x] Mudar os itens da recorrente vale para a ocorrência aberta e as seguintes, e as cópias já liquidadas não mudam (RN-10).
  - [x] Os campos novos são validados como na avulsa, e desfazer a liquidação da cópia reabre a ocorrência com os itens da regra (RF-02, RF-10).
  - [x] O contrato gerado traz o bruto e os itens da recorrente e da liquidação da ocorrência, e a formatação, o clippy, o build offline e os testes do Financeiro, dos relatórios, da busca e do `http` passam ([project/api-02]).
- **Rótulos:** SPEC-004, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-04
