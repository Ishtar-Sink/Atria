# TASK-04: Ajustes nas movimentações avulsas

Arquivo gerado pelo vostok a cada mudança de estado; não edite.

- **Spec:** SPEC-004
- **Status:** done
- **Onda:** 3
- **Dependências:** TASK-02

## Arquivos

- [Execução](execucao.md): o que ler, mudar e os passos.
- [Verificação](verificacao.md): baseline, comandos e evidências.
- [Critérios](criterios.md): quando a tarefa está concluída.
- [Resumo executivo](executivo.md)
- [Detalhes técnicos](tecnico.md)
- [Registro](registro.md): etapas da execução e histórico de ajustes.

## Card

- **Título:** Ajustes nas movimentações avulsas
- **Tipo:** historia
- **Descrição:** Migração, gravação de bruto e itens, liquidação pelo líquido, prévia, desfazer e contrato da API.
- **Critérios de aceite:**
  - [x] Uma movimentação avulsa, de entrada ou de saída, aceita até 20 itens de desconto ou acréscimo, grava o bruto e os itens com o valor calculado de cada um, e o 21º item é recusado (RF-01, CB-08).
  - [x] O valor previsto da movimentação é o líquido, e é ele que entra no saldo, nas listagens e no resumo do painel; sem itens, tudo funciona como antes, com o bruto igual ao líquido (RF-08, CT-03, RN-09).
  - [x] Liquidar pelo líquido recebido ou pago calcula o bruto equivalente, mantém os valores fixos, recalcula os percentuais com a base digitada na proporção do bruto e fecha a conta exata (bruto − descontos + acréscimos = líquido), inclusive com os itens editados na liquidação (RF-09, CT-05, RN-04, RN-06, RN-07).
  - [x] A diferença da liquidação (economia, ganho ou perda) é calculada entre o líquido liquidado e o líquido previsto (RF-09, CT-08, RN-08).
  - [x] Líquido zero na liquidação usa os fixos para o bruto e é recusado com mensagem no campo dos itens quando não há bruto possível; só com fixos, o bruto é o líquido mais os descontos menos os acréscimos (RF-09, CB-01, CB-02).
  - [x] A prévia da liquidação devolve o bruto e os itens recalculados sem gravar nada (RF-09, decisão 13).
  - [x] Desfazer a liquidação reverte o saldo e devolve o bruto e os itens ao previsto (RF-15, CT-09).
  - [x] A migração não muda nenhum valor existente: saldo das contas e resumo do painel iguais, movimentações e recorrentes sem itens e com o bruto igual ao líquido, e as liquidadas antes da spec com bruto igual ao líquido e desfazer funcionando como hoje (CT-14, CB-06, RNF-03).
  - [x] O contrato gerado (`openapi.json` e `schema.ts`) traz o item de ajuste, a rota da prévia e o bruto e os itens nos pedidos e respostas, e a formatação, o clippy, o build offline e os testes do Financeiro, dos relatórios, da busca e do `http` passam ([project/api-02], [project/development-methodology-03]).
- **Rótulos:** SPEC-004, julgamento
- **Estimativa:** julgamento
- **Bloqueada por:** TASK-02
