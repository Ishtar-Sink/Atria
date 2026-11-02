---
id: SPEC-003
title: "Financeiro pronto para o lançamento"
status: implemented
author: "Victor Batalha"
created_at: 2026-11-01T15:07:51Z
updated_at: 2026-11-02T00:03:39Z
tags: []
type: improvement
source: "draft/SPEC-003-financeiro-pronto-para-o-lancamento.md"
refined_at: 2026-11-01T17:17:14Z
adjustments: 1
adjusted_at: 2026-11-01T17:33:53Z
content_hash: 38129b571e122ae2e45a12d980477b190f9337cf56b353b09b66ddab97e45702
approved_at: 2026-11-01T17:34:16Z
approved_hash: 38129b571e122ae2e45a12d980477b190f9337cf56b353b09b66ddab97e45702
---

# Financeiro pronto para o lançamento - Especificação Refinada

Deixa o Financeiro pronto para o lançamento com as seguintes mudanças:
- exclusão de recorrências e de contas;
- remoção do cartão de crédito;
- cores com sinal nos valores;
- gráficos interativos e o novo "Mês a mês";
- color picker em todo seletor de cor;
- autocomplete no filtro de categoria;
- rolagem única da página no app inteiro.

## Objetivo

O Financeiro é uma das áreas mais sensíveis do Atria e só será considerado lançado depois de ficar 100%. O uso real mostrou problemas:
- uma recorrência que não pode ser excluída e trava a exclusão da conta;
- um cartão de crédito que se comporta como conta bancária;
- valores sem cor;
- gráficos pouco informativos;
- seletores de cor e de categoria limitados;
- uma rolagem dupla na página.

O resultado esperado é o Financeiro sem esses problemas, sem perder os dados já gravados.

## Estado atual

- **Recorrências:**
  - `apps/server/src/finance/interface/mod.rs` expõe em `/recurring-transactions/{id}` só GET e PATCH, além de `/settlement`, `/skip` e `/settled-transactions`. Não há DELETE.
  - Excluir a cópia liquidada reabre a ocorrência e devolve o valor ao saldo (DEC-004), e a tela chama isso de "Excluir".
- **Contas:** `apps/server/src/finance/infrastructure/pg_accounts.rs` recusa excluir uma conta com movimentações, transferências ou recorrências ativas (`AccountHasTransactions`), e a conta padrão nunca é excluída (`ensure_deletable`).
- **Cartão de crédito:**
  - É uma conta de `kind = 'credit_card'`, com limite, fechamento e vencimento.
  - As compras ganham `statement_period` e parcelas, e a aba Faturas paga a fatura com uma transferência.
  - O saldo do cartão entra no saldo atual do painel (`apps/server/src/finance/application/summaries.rs`).
  - Uma compra liquidada sozinha deixa o saldo do cartão negativo sem tocar a conta.
- **Valores:** aparecem sem cor nem sinal de entrada ou saída. Só as diferenças de liquidação usam verde e âmbar (PD-54).
- **Gráficos:**
  - `apps/web/src/features/finance/components/panel-charts.tsx` desenha à mão, em SVG, o "Para onde foi" e o "Previsto x realizado", este com quatro barras, sem valores, sem dica e com a lista de números embaixo.
  - O servidor já calcula "Entradas e saídas por mês" no relatório `fin-flow` (`apps/server/src/reports/domain/mod.rs`).
- **Cores:**
  - A categoria guarda um de seis nomes do tema (CHECK em `20261101070002_create-finance-categories.sql`), escolhido num select.
  - O destaque do leitor guarda um de cinco nomes (CHECK em `20261101130001_create-library.sql`).
  - Só as raias de Projetos usam o `ColorField` da `@atria/ui` e guardam `#rrggbb`, como pede a PD-12.
- **Filtro de categoria:** é um `FormSelect` em `apps/web/src/features/finance/screens/transactions-screen.tsx` e em `apps/web/src/features/reports/report-filters.tsx`. A `@atria/ui` não tem autocomplete.
- **Rolagem:** a `.shell` de `apps/web/src/app/layout/app-layout.module.css` tem `height: 100vh; overflow: hidden`, e a rolagem acontece em `.page` (`overflow-y: auto`). O `StickyPageHeader` mede essa área de rolagem.

## Escopo

### Dentro do escopo

- Excluir recorrência, com a ocorrência aberta, mantendo as cópias liquidadas como histórico.
- "Desfazer liquidação" no lugar de "Excluir" na cópia liquidada, explicando que a ocorrência reabre.
- Excluir conta com movimentações, movendo tudo para outra conta escolhida.
- Remover o cartão de crédito do Financeiro: servidor, banco, contrato e telas, inclusive a aba Faturas, o parcelamento, o limite e o card Cartões.
- Cores e sinais nos valores de entrada, saída, saldo e sobra.
- Gráfico Previsto x realizado interativo e card "Mês a mês" no painel, com uma biblioteca de gráficos.
- Color picker em todo seletor de cor: categorias e destaques do leitor, com a migração das cores existentes.
- Componente de autocomplete na `@atria/ui`, usado nos filtros de categoria.
- Rolagem única da página no app inteiro, com a barra lateral e a barra superior fixas.

### Fora do escopo

- Um novo modelo de cartão como meio de pagamento (opção B do estudo do cartão).
- Outros gráficos além do Previsto x realizado e do "Mês a mês", e mudanças no relatório `fin-flow`.
- Autocomplete em outros selects além do filtro de categoria.
- Cores no dashboard inicial e em Relatórios.
- Limpar os dados de teste do banco de produção (operação do usuário).

## Requisitos funcionais

| ID | Requisito |
|---|---|
| RF-01 | O sistema deve permitir excluir uma recorrência sem liquidá-la antes. |
| RF-02 | O sistema deve, ao excluir uma recorrência, excluir também a ocorrência aberta. |
| RF-03 | O sistema deve manter as cópias liquidadas de uma recorrência excluída como saídas ou entradas avulsas do histórico, sem mudar o saldo. |
| RF-04 | A cópia liquidada deve oferecer "Desfazer liquidação" no lugar de "Excluir", com uma confirmação que explica que a ocorrência volta a ficar aberta. |
| RF-05 | O sistema deve permitir excluir uma conta com movimentações, pedindo a conta de destino. |
| RF-06 | O sistema deve mover para a conta de destino as movimentações, as transferências e as recorrências da conta excluída, recalculando os saldos das duas. |
| RF-07 | O sistema deve deixar de ter cartão de crédito: só contas comuns, sem faturas, parcelamento, limite, fechamento nem vencimento. |
| RF-08 | O Financeiro não deve ter mais a aba Faturas nem a tela de pagamento de fatura. |
| RF-09 | O painel do Financeiro não deve ter mais o card Cartões. |
| RF-10 | O sistema deve converter as contas de cartão existentes em contas comuns, mantendo as compras como saídas. |
| RF-11 | Os valores do Financeiro devem mostrar as entradas em verde com "+" e as saídas na cor do texto com "−". |
| RF-12 | Os saldos e a sobra prevista devem aparecer em verde quando positivos e em âmbar quando negativos. |
| RF-13 | O gráfico Previsto x realizado deve mostrar os valores e uma dica com o valor e a diferença ao passar o mouse ou focar pelo teclado. |
| RF-14 | O gráfico Previsto x realizado deve usar barras horizontais, com as cores de entrada e saída e textos que dizem o que cada barra é. |
| RF-15 | O painel do Financeiro deve ter um card "Mês a mês" em barras verticais, uma coluna por mês, com o realizado dos últimos 6 meses e a projeção dos próximos 6, os projetados em tom mais claro. |
| RF-16 | O card "Mês a mês" deve alternar entre "Entradas e saídas" e "Saldo". |
| RF-17 | O resumo do Financeiro deve trazer a série mensal do realizado e da projeção pelas recorrências. |
| RF-18 | A cor da categoria deve ser escolhida no color picker e guardada como `#rrggbb`. |
| RF-19 | A cor do destaque do leitor deve ser escolhida no color picker e guardada como `#rrggbb`. |
| RF-20 | O sistema deve converter as cores por nome das categorias e dos destaques existentes no HEX equivalente do tema claro. |
| RF-21 | A `@atria/ui` deve fornecer um autocomplete com busca, seleção única e seleção múltipla. |
| RF-22 | O filtro de categoria de Entradas, de Saídas e do relatório Gastos por categoria deve usar o autocomplete com seleção única. |
| RF-23 | A página deve ter uma única rolagem, da janela, com a barra lateral e a barra superior fixas e a barra lateral na altura da tela. |
| RF-24 | O `StickyPageHeader` deve continuar compactando e com o fundo de ponta a ponta com a rolagem da janela. |

## Requisitos não funcionais

| ID | Requisito | Como verificar |
|---|---|---|
| RNF-01 | Nenhuma migração perde dados do usuário: contas, movimentações, transferências e recorrências continuam com os mesmos valores e saldos. | Teste que aplica as migrações sobre um banco com cartão, compras parceladas, faturas pagas e cores por nome e confere contagens e saldos antes e depois. |
| RNF-02 | Texto sobre cor livre e valores coloridos com contraste WCAG AA nos temas claro e escuro. | Testes com axe nas telas alteradas, nos dois temas. |
| RNF-03 | Cor nunca é o único sinal: entradas e saídas têm sinal, e o gráfico tem tabela acessível. | Testes de componente que conferem o sinal e a tabela. |
| RNF-04 | A biblioteca de gráficos só é carregada no painel do Financeiro. | Teste do build que confere o chunk separado e Lighthouse do Financeiro em 90 ou mais. |
| RNF-05 | Gráficos e autocomplete operáveis pelo teclado. | Testes de componente com teclado e e2e. |
| RNF-06 | A rolagem única funciona no Chromium e no Firefox. | e2e nos projetos `desktop` e `firefox`. |

## Regras de negócio

| ID | Regra |
|---|---|
| RN-01 | Excluir uma recorrência é exclusão lógica (`deleted_at`). As cópias liquidadas perdem só a ligação com a recorrência para efeito de lista, e o valor delas continua no saldo. |
| RN-02 | Desfazer a liquidação de uma cópia reabre aquela ocorrência e devolve o valor ao saldo (DEC-004). |
| RN-03 | A conta padrão continua sem poder ser excluída. |
| RN-04 | A conta de destino de uma exclusão precisa ser outra conta ativa da mesma pessoa e da mesma moeda. |
| RN-05 | Uma transferência entre a conta excluída e a conta de destino é excluída, porque deixaria de ter origem e destino diferentes. |
| RN-06 | O sinal e a cor seguem o tipo da movimentação, nunca o sinal do número guardado: dinheiro continua em centavos positivos (code-style-05). |
| RN-07 | Vermelho não é usado para saída nem saldo negativo (frontend-14, PD-54). |
| RN-08 | A projeção do "Mês a mês" usa as ocorrências previstas das recorrências e as movimentações pontuais não liquidadas, sem gravar linhas (DEC-003). |
| RN-09 | Uma cor guardada é sempre `#rrggbb` em minúsculas. |

## Fluxos

### Fluxo principal

1. A pessoa abre a recorrência do Claude Code, escolhe Excluir e confirma. A recorrência e a ocorrência aberta somem, e as cópias pagas continuam no histórico de Saídas (RF-01, RF-02, RF-03).
2. Abre a conta que era do cartão, escolhe Excluir, indica a conta principal como destino e confirma. As movimentações passam para a conta principal e a conta some (RF-05, RF-06).
3. Volta ao painel: os valores aparecem com sinal e cor, e o saldo negativo aparece em âmbar (RF-11, RF-12).
4. Passa o mouse no Previsto x realizado e vê a dica com o valor e a diferença. No "Mês a mês", alterna para Saldo (RF-13, RF-15, RF-16).
5. Em Saídas, digita no filtro de categoria e escolhe uma categoria da lista (RF-22).
6. Rola o painel até o fim: a página rola inteira, a barra lateral e a topbar ficam fixas e o cabeçalho compacta (RF-23, RF-24).

### Fluxos alternativos

- **FA-01 (passo 1):** a pessoa abre uma cópia liquidada e escolhe "Desfazer liquidação". A confirmação explica que a ocorrência reabre, e o valor volta ao saldo (RF-04).
- **FA-02 (passo 2):** a conta escolhida é a padrão. Excluir não aparece e o servidor recusa (RN-03).
- **FA-03 (passo 2):** a conta não tem movimentações. A exclusão não pede conta de destino.
- **FA-04 (passo 5):** a pessoa edita a cor de uma categoria no color picker. A cor aparece no "Para onde foi" e no detalhe (RF-18).

## Casos de borda

| ID | Situação | Comportamento esperado | Requisitos |
|---|---|---|---|
| CB-01 | Recorrência sem nenhuma cópia liquidada. | Some inteira, sem deixar histórico. | RF-01, RF-02 |
| CB-02 | Excluir a mesma recorrência duas vezes. | A segunda resposta é 404, sem mudar nada. | RF-01 |
| CB-03 | Conta de destino em outra moeda. | O servidor recusa com o código `currency_mismatch`, e a tela mostra o erro no formulário. | RF-05 |
| CB-04 | Conta com uma transferência para a própria conta de destino. | A transferência é excluída e os saldos ficam iguais aos de antes da transferência. | RF-06 |
| CB-05 | Compra parcelada no cartão convertido. | As parcelas viram saídas independentes, com a mesma data prevista e o mesmo valor. | RF-10 |
| CB-06 | Fatura já paga com transferência. | A transferência continua, sem `statement_period`, e os saldos não mudam. | RF-10 |
| CB-07 | Saldo exatamente zero. | Aparece na cor do texto, sem sinal. | RF-12 |
| CB-08 | Mês sem nenhuma movimentação no "Mês a mês". | O mês aparece com valor zero, sem quebrar a linha do tempo. | RF-15 |
| CB-09 | Cor muito clara escolhida para uma categoria. | O texto sobre ela fica escuro, o que tiver mais contraste. | RF-18 |
| CB-10 | Autocomplete sem resultado para o texto digitado. | Mostra "Nenhuma categoria encontrada" e mantém o filtro anterior. | RF-21 |
| CB-11 | Página mais curta que a tela. | Não aparece rolagem, e a barra lateral ocupa a altura da tela. | RF-23 |

## Contratos e interfaces

Mudanças na API (`/api/v1`), refletidas em `packages/contracts/openapi.json` e `packages/contracts/src/schema.ts`:

```text
DELETE /recurring-transactions/{id}                     -> 204 (exclui a recorrência e a ocorrência aberta)
DELETE /accounts/{id}?move_to=<account_id>              -> 204 (move tudo para move_to; sem move_to e com movimentações: 409 account_has_transactions)

Removidos: GET /credit-cards/{id}/statements, POST /credit-cards/{id}/statements/{period}/payment
AccountKindDto, credit_limit_amount, closing_day, due_day, installments, installment, statement_period,
StatementResponse, StatementList, PayStatementRequest, StatementPaymentResponse, InstallmentDto,
CreditCardSummaryDto, FinancialSummaryResponse.credit_cards: removidos

CategoryResponse.color, CreateCategoryRequest.color, UpdateCategoryRequest.color, WhereItemDto.color: string "#rrggbb"
HighlightResponse.color, CreateHighlightRequest.color, UpdateHighlightRequest.color: string "#rrggbb"

FinancialSummaryResponse.monthly: [
  { "month": "2026-11", "income": 1450000, "expense": 340000, "balance": 2310000, "projected": false }
]  (6 meses realizados e 6 projetados)
```

Migrações:

```sql
-- apps/server/src/finance/migrations/20261103010001_remove-credit-cards.sql
-- contas de cartão viram comuns; parcelas e faturas viram movimentações simples; colunas e checks saem
-- apps/server/src/finance/migrations/20261103010002_categories-color-hex.sql
-- primary -> #6d28d9 e as demais pelo tema claro; CHECK (color ~ '^#[0-9a-f]{6}$')
-- apps/server/src/library/migrations/20261103010003_highlights-color-hex.sql
-- mesma conversão para highlights.color
```

Componentes da `@atria/ui` e da tela:

```ts
interface AutocompleteProps<T> {
  label: string;
  options: readonly { value: T; label: string }[];
  multiple?: boolean;               // false no filtro de categoria
  value: T | T[] | null;
  onChange: (value: T | T[] | null) => void;
  empty_text: string;
}
// Valor com sinal e cor do Financeiro
interface MoneyAmountProps { amount: number; currency: string; kind: 'income' | 'expense' | 'balance' }
```

## Componentes afetados

| Caminho | Ação | Motivo |
|---|---|---|
| `apps/server/src/finance/migrations/20261103010001_remove-credit-cards.sql` | criar | Converter cartões e remover colunas de cartão (RF-07, RF-10). |
| `apps/server/src/finance/migrations/20261103010002_categories-color-hex.sql` | criar | Cores das categorias em HEX (RF-18, RF-20). |
| `apps/server/src/library/migrations/20261103010003_highlights-color-hex.sql` | criar | Cores dos destaques em HEX (RF-19, RF-20). |
| `apps/server/src/finance/domain/credit_card.rs` | remover | Fim do cartão (RF-07). |
| `apps/server/src/finance/application/credit_cards.rs` | remover | Fim das faturas (RF-07). |
| `apps/server/src/finance/tests/credit_cards.rs` | remover | Testes do cartão (RF-07). |
| `apps/server/src/finance/domain/account.rs` | alterar | Tirar o tipo cartão (RF-07). |
| `apps/server/src/finance/domain/transaction.rs` | alterar | Tirar parcela e fatura (RF-07). |
| `apps/server/src/finance/domain/transfer.rs` | alterar | Tirar `statement_period` (RF-07). |
| `apps/server/src/finance/domain/recurring_transaction.rs` | alterar | Exclusão da recorrência e fim da fatura na liquidação (RF-01, RF-07). |
| `apps/server/src/finance/domain/summary.rs` | alterar | Fim do uso do cartão e série mensal (RF-09, RF-17). |
| `apps/server/src/finance/domain/category.rs` | alterar | Cor em HEX (RF-18). |
| `apps/server/src/finance/domain/error.rs` | alterar | Erros do cartão saem; erro de moeda da conta de destino (RF-07, RF-05). |
| `apps/server/src/finance/domain/mod.rs` | alterar | Tirar o módulo do cartão (RF-07). |
| `apps/server/src/finance/application/mod.rs` | alterar | Tirar o módulo das faturas (RF-07). |
| `apps/server/src/finance/application/accounts.rs` | alterar | Exclusão com conta de destino (RF-05, RF-06). |
| `apps/server/src/finance/application/transactions.rs` | alterar | Tirar parcelas (RF-07). |
| `apps/server/src/finance/application/recurring_transactions.rs` | alterar | Excluir recorrência (RF-01, RF-02, RF-03). |
| `apps/server/src/finance/application/summaries.rs` | alterar | Tirar Cartões e calcular a série mensal (RF-09, RF-17). |
| `apps/server/src/finance/application/categories.rs` | alterar | Cor em HEX (RF-18). |
| `apps/server/src/finance/application/transfers.rs` | alterar | Tirar `statement_period` (RF-07). |
| `apps/server/src/finance/application/ports.rs` | alterar | Operações de excluir recorrência e mover conta; sair as de fatura (RF-01, RF-06, RF-07). |
| `apps/server/src/finance/infrastructure/mod.rs` | alterar | Linhas sem colunas de cartão (RF-07). |
| `apps/server/src/finance/infrastructure/pg_accounts.rs` | alterar | Exclusão com mudança de conta na mesma transação (RF-06). |
| `apps/server/src/finance/infrastructure/pg_transactions.rs` | alterar | Tirar fatura e parcela (RF-07). |
| `apps/server/src/finance/infrastructure/pg_transfers.rs` | alterar | Tirar `statement_period` (RF-07). |
| `apps/server/src/finance/infrastructure/pg_recurring_transactions.rs` | alterar | Excluir recorrência e ocorrência aberta (RF-01, RF-02). |
| `apps/server/src/finance/infrastructure/pg_categories.rs` | alterar | Cor em HEX (RF-18). |
| `apps/server/src/finance/interface/mod.rs` | alterar | DELETE da recorrência e fim das rotas de fatura (RF-01, RF-07). |
| `apps/server/src/finance/interface/handlers.rs` | alterar | Handlers novos e fim dos de fatura (RF-01, RF-05, RF-07). |
| `apps/server/src/finance/interface/dto.rs` | alterar | DTOs sem cartão, cor em HEX e série mensal (RF-07, RF-17, RF-18). |
| `apps/server/src/finance/interface/openapi.rs` | alterar | Documentar as rotas e schemas (RF-01, RF-05, RF-07). |
| `apps/server/src/finance/mod.rs` | alterar | Documentação do módulo sem cartões (RF-07). |
| `apps/server/src/finance/tests/mod.rs` | alterar | Ajudantes sem cartão (RF-07). |
| `apps/server/src/finance/tests/accounts.rs` | alterar | Exclusão com conta de destino (RF-05, RF-06). |
| `apps/server/src/finance/tests/recurring_transactions.rs` | alterar | Exclusão da recorrência (RF-01, RF-02, RF-03). |
| `apps/server/src/finance/tests/summaries.rs` | alterar | Sem Cartões e com série mensal (RF-09, RF-17). |
| `apps/server/src/finance/tests/transactions.rs` | alterar | Sem parcelas (RF-07). |
| `apps/server/src/finance/tests/categories.rs` | alterar | Cor em HEX (RF-18). |
| `apps/server/src/finance/tests/transfers.rs` | alterar | Cor em HEX nos ajudantes (RF-18). |
| `apps/server/src/finance/tests/authorization.rs` | alterar | Rotas novas e sem fatura (RF-01, RF-07). |
| `apps/server/src/library/domain/highlight.rs` | alterar | Cor do destaque em HEX (RF-19). |
| `apps/server/src/library/application/mod.rs` | alterar | Cor do destaque em HEX (RF-19). |
| `apps/server/src/library/infrastructure/pg_item_notes.rs` | alterar | Cor do destaque em HEX (RF-19). |
| `apps/server/src/library/interface/dto.rs` | alterar | Cor do destaque em HEX (RF-19). |
| `apps/server/src/library/interface/openapi.rs` | alterar | Schema da cor do destaque (RF-19). |
| `apps/server/src/library/tests/highlights.rs` | alterar | Cor em HEX (RF-19). |
| `apps/server/src/reports/infrastructure/mod.rs` | alterar | Exportação sem colunas de cartão e com cores em HEX (RF-07, RF-20). |
| `packages/contracts/openapi.json` | alterar | Contrato gerado. |
| `packages/contracts/src/schema.ts` | alterar | Tipos gerados. |
| `packages/ui/src/autocomplete` | criar | Autocomplete com seleção única e múltipla (RF-21). |
| `packages/ui/src/index.ts` | alterar | Exportar o autocomplete (RF-21). |
| `apps/web/package.json` | alterar | Biblioteca de gráficos (RF-13, RF-15). |
| `pnpm-lock.yaml` | alterar | Biblioteca de gráficos. |
| `apps/web/src/features/finance/screens/statements-screen.tsx` | remover | Fim da aba Faturas (RF-08). |
| `apps/web/src/features/finance/screens/statement-payment-screen.tsx` | remover | Fim do pagamento de fatura (RF-08). |
| `apps/web/src/features/finance/screens/statements-screens.test.tsx` | remover | Testes da aba Faturas (RF-08). |
| `apps/web/src/features/finance/hooks/use-statements.ts` | remover | Dados das faturas (RF-08). |
| `apps/web/src/features/finance/hooks/use-statements.test.tsx` | remover | Testes das faturas (RF-08). |
| `apps/web/src/features/finance/routes.tsx` | alterar | Tirar as rotas de fatura (RF-08). |
| `apps/web/src/features/finance/components/finance-shell.tsx` | alterar | Tirar a aba Faturas (RF-08). |
| `apps/web/src/features/finance/screens/account-form-screen.tsx` | alterar | Tirar o tipo cartão (RF-07). |
| `apps/web/src/features/finance/screens/account-detail-screen.tsx` | alterar | Tirar "Ver fatura" e excluir com conta de destino (RF-05, RF-07). |
| `apps/web/src/features/finance/screens/accounts-screen.tsx` | alterar | Tirar o filtro de cartões (RF-07). |
| `apps/web/src/features/finance/screens/transaction-form-screen.tsx` | alterar | Tirar parcelas (RF-07). |
| `apps/web/src/features/finance/screens/transaction-detail-screen.tsx` | alterar | "Desfazer liquidação" e sem parcela (RF-04, RF-07). |
| `apps/web/src/features/finance/screens/recurrence-detail-screen.tsx` | alterar | Excluir a recorrência (RF-01). |
| `apps/web/src/features/finance/screens/transactions-screen.tsx` | alterar | Autocomplete de categoria e valores com sinal (RF-11, RF-22). |
| `apps/web/src/features/finance/screens/finance-panel-screen.tsx` | alterar | Sem Cartões, com "Mês a mês" e cores (RF-09, RF-12, RF-15). |
| `apps/web/src/features/finance/screens/finance-panel-screen.module.css` | alterar | Layout do card "Mês a mês" (RF-15). |
| `apps/web/src/features/finance/screens/category-form-screen.tsx` | alterar | Color picker (RF-18). |
| `apps/web/src/features/finance/screens/category-detail-screen.tsx` | alterar | Cor em HEX (RF-18). |
| `apps/web/src/features/finance/screens/finance-settings-screen.tsx` | alterar | Cor em HEX (RF-18). |
| `apps/web/src/features/finance/components/panel-charts.tsx` | alterar | Gráficos com a biblioteca, interativos (RF-13, RF-14). |
| `apps/web/src/features/finance/components/monthly-chart.tsx` | criar | Card "Mês a mês" (RF-15, RF-16). |
| `apps/web/src/features/finance/components/money-amount.tsx` | criar | Valor com sinal e cor (RF-11, RF-12). |
| `apps/web/src/features/finance/components/transaction-row.tsx` | alterar | Valor com sinal e sem parcela (RF-07, RF-11). |
| `apps/web/src/features/finance/components/tone.ts` | remover | Cores por nome saem (RF-18). |
| `apps/web/src/features/finance/components/finance.module.css` | alterar | Cores de entrada, saída e saldo; fim das classes por nome (RF-11, RF-18). |
| `apps/web/src/features/finance/hooks/use-accounts.ts` | alterar | Exclusão com conta de destino e sem cartão (RF-05, RF-07). |
| `apps/web/src/features/finance/hooks/use-transactions.ts` | alterar | Sem fatura e parcela (RF-07). |
| `apps/web/src/features/finance/hooks/use-recurring-transactions.ts` | alterar | Excluir recorrência (RF-01). |
| `apps/web/src/features/finance/hooks/use-categories.ts` | alterar | Cor em HEX (RF-18). |
| `apps/web/src/features/finance/hooks/use-financial-summary.ts` | alterar | Série mensal e sem Cartões (RF-09, RF-17). |
| `apps/web/src/features/finance/hooks/finance-cache.ts` | alterar | Sem chave de faturas (RF-08). |
| `apps/web/src/features/finance/i18n/pt-br.json` | alterar | Textos novos e sem cartão (RF-04, RF-07, RF-15). |
| `apps/web/src/features/finance/test-utils.tsx` | alterar | Fixtures sem cartão e com HEX (RF-07, RF-18). |
| `apps/web/src/features/finance/finance.e2e.ts` | alterar | e2e sem cartão e com as exclusões (RF-01, RF-05, RF-07). |
| `apps/web/scripts/evidence-finance.mjs` | alterar | Evidências sem cartão e com os novos estados (RF-07, RF-15). |
| `apps/web/src/app/listing-standard.test.ts` | alterar | Fixture sem cartão (RF-07). |
| `apps/web/src/features/reports/report-filters.tsx` | alterar | Autocomplete de categoria (RF-22). |
| `apps/web/src/features/reader/use-highlights.ts` | alterar | Cor em HEX (RF-19). |
| `apps/web/src/features/reader/selection-toolbar.tsx` | alterar | Color picker ao criar o destaque (RF-19). |
| `apps/web/src/features/reader/highlights-tab.tsx` | alterar | Color picker ao trocar a cor (RF-19). |
| `apps/web/src/features/reader/reader-page.tsx` | alterar | Cor em HEX (RF-19). |
| `apps/web/src/features/reader/pdf-page.tsx` | alterar | Marca do destaque com a cor HEX (RF-19). |
| `apps/web/src/features/reader/reader.module.css` | alterar | Fim dos seletores por nome de cor (RF-19). |
| `apps/web/src/app/layout/app-layout.tsx` | alterar | Rolagem da janela (RF-23). |
| `apps/web/src/app/layout/app-layout.module.css` | alterar | Barra lateral e topbar fixas (RF-23). |
| `apps/web/src/shared/layout/sticky-page-header.tsx` | alterar | Medir a rolagem da janela (RF-24). |
| `apps/web/src/shared/layout/sticky-page-header.module.css` | alterar | Posição com a rolagem da janela (RF-24). |
| `apps/web/src/shared/layout/sticky-page-header.e2e.ts` | alterar | Conferir a rolagem única (RF-23, RF-24). |

## Premissas e dependências

- A SPEC-002 está finalizada e implantada no servidor, com backup diário em `~/backups/atria`.
- O protótipo e `docs/decisoes-do-prototipo.md` continuam a referência visual (DEC-007). A PD-12 já pede o color picker com HEX livre.
- A biblioteca de gráficos é React, desenha em SVG, tem licença compatível com a AGPL-3.0 e é carregada sob demanda.
- As decisões DEC-003 (projeção sem gravar linhas) e DEC-004 (desfazer a cópia reabre a ocorrência) continuam valendo.

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| A migração do cartão errar saldos ou perder compras. | alto | Teste sobre banco com cartão, parcelas e fatura paga, conferindo contagens e saldos, e backup antes do deploy. |
| Mover a conta deixar saldos inconsistentes. | alto | Mudança e recálculo na mesma transação do banco, com teste de saldos (database-03). |
| A biblioteca de gráficos pesar no bundle. | médio | Carregar só no painel, com teste do chunk e Lighthouse. |
| A rolagem da janela quebrar o cabeçalho fixo e telas com rolagem própria. | médio | e2e do cabeçalho no Chromium e no Firefox e revisão visual das telas. |
| Cores livres ficarem ilegíveis. | médio | Texto preto ou branco pelo contraste e axe nos dois temas. |
| Escopo amplo para uma spec. | médio | Plano por área: servidor, contrato, componentes, telas e layout, com tarefas paralelas. |

## Casos de teste

| ID | Cenário | Passos | Resultado esperado | Requisitos |
|---|---|---|---|---|
| CT-01 | Excluir recorrência | Criar uma recorrência, liquidar duas ocorrências e excluir. | 204; a recorrência e a ocorrência aberta somem; as duas cópias ficam no histórico e o saldo não muda. | RF-01, RF-02, RF-03 |
| CT-02 | Recorrência sem cópia | Excluir uma recorrência nunca liquidada. | Some sem histórico; a segunda exclusão responde 404. | RF-01, RF-02 |
| CT-03 | Desfazer liquidação | Na cópia liquidada, escolher "Desfazer liquidação" e confirmar. | A confirmação explica a reabertura; a ocorrência volta aberta e o saldo é devolvido. | RF-04 |
| CT-04 | Excluir conta com movimentações | Excluir uma conta com movimentações, transferência e recorrência, escolhendo outra conta. | Tudo passa para a conta de destino, os saldos batem e a conta some. | RF-05, RF-06 |
| CT-05 | Conta de destino inválida | Excluir uma conta escolhendo uma de outra moeda, e tentar excluir a padrão. | 422 `currency_mismatch`, e a padrão recusada. | RF-05 |
| CT-06 | Migração do cartão | Aplicar as migrações sobre um banco com cartão, parcelas e fatura paga. | Conta comum, parcelas como saídas, transferência mantida, mesmas contagens e saldos. | RF-07, RF-10 |
| CT-07 | Telas sem cartão | Abrir o Financeiro, o formulário de conta e o de saída. | Sem aba Faturas, sem tipo cartão, sem parcelas e sem o card Cartões. | RF-07, RF-08, RF-09 |
| CT-08 | Valores com sinal e cor | Abrir Entradas, Saídas e o painel com saldo negativo. | Entradas verdes com "+", saídas com "−", saldo negativo âmbar e zero sem cor. | RF-11, RF-12 |
| CT-09 | Previsto x realizado | Passar o mouse e focar com Tab as barras. | Barras horizontais; dica com o valor e a diferença; valores e rótulos visíveis; tabela acessível presente. | RF-13, RF-14 |
| CT-10 | Mês a mês | Abrir o painel com movimentações em meses passados e recorrências. | Barras verticais, uma coluna por mês: 6 realizados e 6 projetados em tom mais claro; alternar para Saldo. | RF-15, RF-16 |
| CT-11 | Série mensal no servidor | Pedir o resumo com movimentações e recorrências. | `monthly` com 12 meses, os projetados com `projected: true`, sem gravar linhas. | RF-17 |
| CT-12 | Cor da categoria | Criar e editar uma categoria escolhendo uma cor no picker. | Grava `#rrggbb`; a cor aparece no detalhe e no "Para onde foi". | RF-18 |
| CT-13 | Cor do destaque | Criar um destaque e trocar a cor no picker. | Grava `#rrggbb`; a marca no PDF usa a cor. | RF-19 |
| CT-14 | Migração das cores | Aplicar as migrações sobre categorias e destaques com cores por nome. | Cada nome vira o HEX do tema claro, e nenhum registro fica sem cor. | RF-20 |
| CT-15 | Autocomplete | Digitar no filtro de categoria de Saídas e do relatório, escolher pelo teclado. | A lista filtra, setas e Enter escolhem, Esc fecha; uma só categoria. | RF-21, RF-22 |
| CT-16 | Autocomplete múltiplo | Renderizar o autocomplete com seleção múltipla. | Escolhe várias opções e remove cada uma. | RF-21 |
| CT-17 | Rolagem única | Rolar o painel e um formulário no Chromium e no Firefox. | Só a janela rola, barra lateral e topbar fixas, sem espaço em branco, e o cabeçalho compacta. | RF-23, RF-24 |

## Critérios de aceite

- [ ] CA-01: Uma recorrência pode ser excluída sem liquidar, e as cópias pagas continuam no histórico sem mudar o saldo (RF-01, RF-02, RF-03).
- [ ] CA-02: A cópia liquidada oferece "Desfazer liquidação" com a explicação da reabertura (RF-04).
- [ ] CA-03: Uma conta com movimentações pode ser excluída, movendo tudo para outra conta e mantendo os saldos (RF-05, RF-06).
- [ ] CA-04: O Financeiro não tem mais cartão, faturas, parcelas nem o card Cartões, e os cartões existentes viraram contas comuns sem perder dados (RF-07, RF-08, RF-09, RF-10).
- [ ] CA-05: Os valores têm sinal e cor, sem vermelho, e o saldo negativo aparece em âmbar (RF-11, RF-12).
- [ ] CA-06: O Previsto x realizado usa barras horizontais e é interativo, com valores e dica pelo mouse e pelo teclado (RF-13, RF-14).
- [ ] CA-07: O painel tem o "Mês a mês" em barras verticais, com realizado e projeção, alternando para Saldo (RF-15, RF-16, RF-17).
- [ ] CA-08: Todo seletor de cor usa o color picker, e as cores antigas foram convertidas (RF-18, RF-19, RF-20).
- [ ] CA-09: O filtro de categoria é um autocomplete com busca e seleção única, e o componente aceita seleção múltipla (RF-21, RF-22).
- [ ] CA-10: A página tem uma única rolagem, com a barra lateral e a topbar fixas e o cabeçalho fixo funcionando (RF-23, RF-24).

## Referências

| Tipo | Referência | Uso |
|---|---|---|
| arquivo | `vostok/work/specs/draft/SPEC-003-financeiro-pronto-para-o-lancamento.md` | Itens relatados pelo usuário e o estudo do cartão. |
| memória | DEC-003 | Projeção das recorrências sem gravar linhas. |
| memória | DEC-004 | Excluir a cópia liquidada reabre a ocorrência. |
| memória | DEC-007 | Protótipo como referência visual. |
| documentação | `docs/decisoes-do-prototipo.md` | PD-12 (color picker com HEX), PD-51 (recorrência), PD-54 (âmbar para perda), PD-58 (painel). |
| documentação | `docs/estudos/financeiro-painel.md` | Desenho atual do painel, base do estudo dos gráficos. |
| arquivo | `apps/server/src/finance/infrastructure/pg_accounts.rs` | Regra atual de exclusão de conta. |
| arquivo | `apps/server/src/finance/infrastructure/pg_transactions.rs` | Pagamento de fatura e saldo do cartão. |
| arquivo | `apps/server/src/finance/interface/mod.rs` | Rotas da recorrência sem DELETE. |
| arquivo | `apps/server/src/reports/domain/mod.rs` | Relatório `fin-flow` com entradas e saídas por mês. |
| arquivo | `apps/web/src/features/finance/components/panel-charts.tsx` | Gráficos atuais em SVG. |
| arquivo | `packages/ui/src/color-field/color-field.tsx` | Color picker que grava HEX, usado nas raias. |
| arquivo | `apps/web/src/app/layout/app-layout.module.css` | Rolagem dentro de `.page`. |
| arquivo | `vostok/rules/project/frontend.md` | frontend-14, sem vermelho para pendência comum. |

## O que mudou

| # | Assunto | Estado no Original | Estado Refinado |
|---|---|---|---|
| 1 | Exclusão de recorrência | Não é possível excluir sem liquidar. | Exclui a recorrência e a ocorrência aberta, mantendo as cópias pagas. |
| 2 | Saída que volta à lista | Continua na lista depois de excluída. | Explicada pela DEC-004; a ação vira "Desfazer liquidação", e quem quer encerrar exclui a recorrência. |
| 3 | Cartão e aba Faturas | Remover a aba e decidir o cartão. | Cartão removido por inteiro, com a migração das contas de cartão. |
| 4 | Exclusão de conta | Não é possível excluir. | Exclui movendo tudo para outra conta. |
| 5 | Cores nos números | Pedido genérico. | Entradas verdes com "+", saídas com "−", saldo negativo âmbar, sem vermelho. |
| 6 | Gráficos | Melhorar e estudar outros. | Previsto x realizado interativo em barras horizontais e card "Mês a mês" em barras verticais, com biblioteca de gráficos. |
| 7 | Rolagem | Rolagem dupla no painel. | Rolagem única no app inteiro. |
| 8 | Color picker | Todo seletor de cor. | Categorias e destaques em HEX, com migração. |
| 9 | Autocomplete | Filtro de categoria. | Componente na `@atria/ui`, nos filtros de Entradas, Saídas e Gastos por categoria. |

## Registro de decisões

| # | Decisão | Alternativa descartada | Motivo |
|---|---|---|---|
| 1 | Excluir a recorrência mantém as cópias liquidadas como histórico. | Excluir as cópias e devolver o saldo. | resposta 1A |
| 2 | Manter a DEC-004 e chamar a ação da cópia de "Desfazer liquidação". | Excluir a cópia sem reabrir a ocorrência. | resposta 2A |
| 3 | A migração converte as contas de cartão em contas comuns. | Recusar a migração e zerar o banco. | resposta 3A |
| 4 | Excluir conta move tudo para outra conta escolhida. | Excluir com o histórico; continuar recusando. | resposta 4A |
| 5 | Entradas verdes com "+", saídas na cor do texto com "−" e saldo negativo âmbar. | Saídas em âmbar; vermelho mudando a frontend-14. | resposta 5A |
| 6 | Card "Mês a mês" no painel, abaixo do Fechamento do período. | Aba Gráficos; só em Relatórios. | resposta 6A |
| 7 | Gráficos com uma biblioteca, carregada só no painel. | SVG próprio. | resposta 6, corrigindo a inferência F |
| 8 | Rolagem única corrigida nesta spec para o app inteiro. | Spec própria de layout. | resposta 7A |
| 9 | Tipo `improvement`. | `fix`. | inferência A |
| 10 | Cores antigas convertidas no HEX do tema claro. | Cor neutra para todas. | inferência B |
| 11 | Texto sobre cor livre em preto ou branco pelo contraste. | Cor fixa de texto. | inferência C |
| 12 | Destaques do leitor também no color picker. | Só as categorias. | inferência D |
| 13 | Autocomplete na `@atria/ui`, nos filtros de Entradas, Saídas e Gastos por categoria. | Só em Saídas. | inferência E |
| 14 | "Ver fatura" e o card Cartões saem com o cartão; o dashboard inicial não muda. | Manter o card Cartões. | inferência G |
| 15 | Transferência entre a conta excluída e a de destino é excluída. | Recusar a exclusão. | inferência H, derivada da resposta 4A |
| 16 | A biblioteca de gráficos é escolhida na tarefa, com a justificativa da stack-12, entre as que desenham em SVG, são React e têm licença compatível. | Fixar a biblioteca na spec. | inferência I |
| 17 | Previsto x realizado em barras horizontais e "Mês a mês" em barras verticais, com os meses projetados em tom mais claro. | Linha do tempo com o futuro em traço claro. | ajuste 1 |

## Pendências

| # | Pendência | Opções em aberto |
|---|---|---|
| - | Nenhuma | - |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | RF-14: Previsto x realizado em barras horizontais; RF-15: Mês a mês em barras verticais com os projetados em tom mais claro; CT-09, CT-10, CA-06 e CA-07 atualizados |
