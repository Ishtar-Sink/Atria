# Estudo: painel do Financeiro

Estudo de referências e recomendação para a aba "Painel" do Financeiro (RF-35 da SPEC-001, "dashboard próprio" do Financeiro), feito a partir do protótipo da TASK-01. A aba é a primeira e a padrão do Financeiro, e segue o período global do módulo (PD-55 em `docs/decisoes-do-prototipo.md`).

## Pergunta

O que o painel do Financeiro precisa responder, num relance, a uma pessoa que controla o próprio dinheiro sem orçamento por categoria e sem sincronização com o banco?

As três perguntas que o painel deve responder, nesta ordem:

1. Como fecho o período?
2. Para onde está indo o dinheiro?
3. O que vem pela frente?

## O que o protótipo faz hoje

- **Três cartões de peso igual**, numa grade automática: "Saldo por conta" (barras), "Previsto x realizado no mês" (colunas) e "Economias e perdas" (dois números grandes).
- **Não responde "como fecho o mês"**: não há saldo previsto ao fim do período nem a sobra (entradas menos saídas).
- **Não mostra para onde vai o dinheiro**: não há gasto por categoria, que já é cadastrada e tem cor.
- **Não mostra o que vem pela frente**: as contas previstas só aparecem no dashboard geral.
- **O cartão de crédito some no saldo**: a fatura aberta e o limite usado não aparecem.

## Referências

| Ferramenta | O que o painel mostra | O que serve para o Atria |
|---|---|---|
| Monarch Money | Dashboard de widgets que a pessoa monta: patrimônio, fluxo de caixa, gasto do mês x mês anterior, orçamento, próximas contas e transações recentes. | O gasto do período comparado ao período anterior, como texto ("R$ 320 a menos que em setembro"), sem gráfico de linha. |
| Copilot Money | No topo, o gráfico do gasto acumulado no mês com a linha do ritmo ideal e o "livre para gastar". Logo abaixo, a lista horizontal das próximas recorrências, com "ver tudo". As recorrências previstas ficam fora do gráfico de gasto. | A seção "Próximas" das contas previstas e a separação entre o que já foi gasto e o que ainda vai sair. O ritmo ideal exige orçamento, que o MVP não tem. |
| YNAB (Reflect) | Relatórios separados: gastos por categoria (pizza ou barras), entradas x saídas por período e "idade do dinheiro". | Gastos por categoria em barras horizontais. A idade do dinheiro depende do método YNAB e fica de fora. |
| Mobills e Organizze | Tela inicial com saldo atual, saldo previsto do mês (contando lançamentos previstos e faturas), receitas x despesas, gastos por categoria, cartões com a barra do limite usado e a opção de esconder valores. | O saldo previsto ao fim do período, o cartão com a fatura aberta e o limite usado, e o esconder valores (já no dashboard, PD-15). São as referências brasileiras: mesma moeda e mesmo vocabulário (fatura, limite, previsto). |
| Estudo do dashboard (`docs/estudos/dashboard.md`) | Calma: hierarquia por posição e tamanho, sem vermelho para alarme e no máximo 5 itens por bloco. | As mesmas regras: perda em âmbar, número grande só para o fechamento do período, e listas curtas com "ver tudo". |

## Recomendação

### 1. Layout

Duas zonas, como o dashboard geral e a visão geral do projeto. A zona principal (cerca de 2/3) responde "como fecho" e "para onde vai". A lateral (cerca de 1/3) responde "onde está o dinheiro" e "o que vem". Abaixo de 960 px, uma coluna só.

### 2. Blocos

| Zona | Bloco | Conteúdo |
|---|---|---|
| Principal | Fechamento do período | Três números na mesma linha: Entradas, Saídas e Sobra (entradas menos saídas), cada um com o realizado e "de R$ X previstos" embaixo. Uma frase comparando ao período anterior de mesmo tamanho ("Você gastou R$ 320 a menos que no período anterior"). |
| Principal | Para onde foi | Barras horizontais das saídas do período por categoria, na cor da categoria, ordenadas pelo valor, até 6 categorias, mais "Outras". Cada barra leva à aba Saídas filtrada. |
| Principal | Previsto x realizado | As colunas que já existem (entradas e saídas, previsto e realizado). |
| Lateral | Saldo | Saldo total e saldo previsto ao fim do período (saldo atual mais as entradas e menos as saídas ainda previstas até o fim do período). Embaixo, o saldo de cada conta em lista. |
| Lateral | Cartões | Para cada cartão de crédito: fatura aberta, vencimento e barra do limite usado ("R$ 1.864 de R$ 5.000"). |
| Lateral | Próximas contas | Até 5 saídas previstas nos próximos 30 dias, com data e valor e "Ver todas" na aba Saídas. |
| Lateral | Economias e perdas | O que se economizou e o que se perdeu nas liquidações do período, em texto de tamanho normal. A perda aparece em âmbar. |

### 3. Regras

- **Período global:** todos os blocos seguem o período do cabeçalho, menos "Saldo" e "Cartões", que são o estado de agora, e "Próximas contas", que olha sempre os próximos 30 dias.
- **Data de cada movimentação:** a da liquidação, quando liquidada, e a prevista nos outros casos (como em PD-55).
- **Transferências fora dos totais** de entradas e saídas (RN-05).
- **Sem alarme:** sobra negativa e perda em âmbar, nunca em vermelho, e sem contador de contas atrasadas. Conta vencida aparece em "Próximas contas" como "Era para 28/10".
- **Vazio sem culpa:** sem movimentações no período, o bloco mostra "Nada registrado neste período." e o botão "Novo registro".
- **Fora do MVP:** orçamento por categoria com ritmo de gasto (Copilot e Monarch), patrimônio ao longo do tempo e idade do dinheiro.

## O que muda nas tarefas

| Tarefa | Mudança | Status |
|---|---|---|
| TASK-01 (protótipo) | Painel em duas zonas com os blocos acima. | Aplicada no protótipo. |
| TASK-22 (Telas do Financeiro) | O painel deixa de ser os três gráficos de peso igual e passa a ter os blocos e regras acima. | Contradiz a tarefa: decidir na hora (PD-58). |
| TASK-07 (Contexto finance) | A API do painel precisa devolver gasto por categoria, comparação com o período anterior, saldo previsto ao fim do período e fatura aberta com o limite usado. | A conferir na tarefa: pode faltar o endpoint de resumo. |

## Decisões em aberto

1. A comparação com o período anterior entra no MVP?
2. "Para onde foi" leva à aba Saídas filtrada pela categoria? Hoje não há filtro de categoria na listagem.

## Fontes

- [Monarch: Customizing your dashboard](https://help.monarch.com/hc/en-us/articles/360058127551)
- [Experian: Monarch Money review](https://www.experian.com/blogs/ask-experian/monarch-money-review)
- [Copilot Money: Dashboard tab overview](https://help.copilot.money/en/articles/6045480-dashboard-tab-overview)
- [Money with Katie: Copilot review](https://moneywithkatie.com/copilot-review-a-budgeting-app-that-finally-gets-it-right/)
- [YNAB: Reflect in YNAB](https://support.ynab.com/en_us/reflect-in-ynab-B1GJsrWkj)
- [Canaltech: Organizze ou Mobills](https://canaltech.com.br/apps/organizze-ou-mobills-qual-aplicativo-melhor-para-controlar-gastos/)
- [Showmetech: review do Mobills](https://www.showmetech.com.br/review-mobills-gerenciador-financeiro/)
