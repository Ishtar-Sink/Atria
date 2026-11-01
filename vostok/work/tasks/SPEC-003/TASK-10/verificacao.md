### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/finance src/app/listing-standard.test.ts --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | grep -v -E 'use-statements|statements-screens|statement is already paid|credit card|installment|with the cards block|balance, cards|card statement' | grep -v -E '> (rf07|rf08|rf09|ct07) ' | sort`
- `pnpm --filter @atria/web exec vitest run src/features/finance --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | grep -E 'use-statements|statements-screens|statement is already paid|credit card|installment|with the cards block|balance, cards|card statement' | sort` (muda): os 15 testes de faturas, parcelas, cartão de crédito e card Cartões saem com o cartão (RF-07, RF-08, RF-09); os que continuam com outro nome levam o prefixo `rf07`, `rf09` ou `ct07`.
- `pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/finance/routes.tsx src/features/finance/components/finance-shell.tsx src/features/finance/components/transaction-row.tsx src/features/finance/screens/account-form-screen.tsx src/features/finance/screens/account-detail-screen.tsx src/features/finance/screens/accounts-screen.tsx src/features/finance/screens/transaction-form-screen.tsx src/features/finance/screens/transaction-detail-screen.tsx src/features/finance/screens/finance-panel-screen.tsx src/features/finance/hooks/use-accounts.ts src/features/finance/hooks/use-transactions.ts src/features/finance/hooks/finance-cache.ts src/features/finance/test-utils.tsx src/features/finance/hooks/use-accounts.test.tsx src/features/finance/hooks/use-transactions.test.tsx src/features/finance/hooks/use-financial-summary.test.tsx src/features/finance/screens/accounts-screens.test.tsx src/features/finance/screens/transactions-screens.test.tsx src/features/finance/screens/finance-panel-screen.test.tsx src/features/finance/components/components.test.tsx src/app/listing-standard.test.ts src/features/finance/finance.e2e.ts` (muda): depois da TASK-07 estes arquivos ainda usam os campos do cartão que saíram do contrato, e as regras com tipos podem acusar erros que a tarefa elimina.
- `pnpm --filter @atria/web exec prettier --check src/features/finance scripts/evidence-finance.mjs src/app/listing-standard.test.ts 2>&1 | tail -1`
- `node --check apps/web/scripts/evidence-finance.mjs && echo sintaxe-ok`
- `pnpm --filter @atria/web exec tsc --noEmit --pretty false 2>&1 | grep -E 'error TS' | grep -ciE "statement|credit|installment|closing_day|due_day|AccountKind|'kind'"` (muda): depois da TASK-07 há erros de tipo dos campos do cartão nas telas; a tarefa leva a contagem a 0.
- `grep -rlE 'statements-screen|statement-payment-screen|use-statements|/finance/statements|credit-cards' apps/web/src | sort` (muda): os arquivos que importam ou apontam para as telas e o hook removidos; a lista fica vazia.
- `pnpm --filter @atria/web exec playwright test --list src/features/finance/finance.e2e.ts 2>&1 | grep '›' | sed -E 's/:[0-9]+:[0-9]+ ›/ ›/' | grep -v -E 'installments fall in the right statements|ct07 ' | sort`

### Verificação

```bash
# Testes do Financeiro e do padrão de listagem (Vitest + Testing Library + axe)
# evidência: sem-cartao-testes.txt
pnpm --filter @atria/web exec vitest run src/features/finance src/app/listing-standard.test.ts --reporter=verbose
# Lint e formatação sem nenhum erro ou warning nos arquivos da tarefa (o script fica fora do ESLint)
pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/finance/routes.tsx src/features/finance/components/finance-shell.tsx src/features/finance/components/transaction-row.tsx src/features/finance/screens/account-form-screen.tsx src/features/finance/screens/account-detail-screen.tsx src/features/finance/screens/accounts-screen.tsx src/features/finance/screens/transaction-form-screen.tsx src/features/finance/screens/transaction-detail-screen.tsx src/features/finance/screens/finance-panel-screen.tsx src/features/finance/hooks/use-accounts.ts src/features/finance/hooks/use-transactions.ts src/features/finance/hooks/finance-cache.ts src/features/finance/test-utils.tsx src/features/finance/hooks/use-accounts.test.tsx src/features/finance/hooks/use-transactions.test.tsx src/features/finance/hooks/use-financial-summary.test.tsx src/features/finance/screens/accounts-screens.test.tsx src/features/finance/screens/transactions-screens.test.tsx src/features/finance/screens/finance-panel-screen.test.tsx src/features/finance/components/components.test.tsx src/app/listing-standard.test.ts src/features/finance/finance.e2e.ts
pnpm --filter @atria/web exec prettier --check src/features/finance scripts/evidence-finance.mjs src/app/listing-standard.test.ts
node --check apps/web/scripts/evidence-finance.mjs
# Nenhum erro de tipo ligado ao cartão (os erros de cor da categoria e do destaque ficam para a TASK-13 e a TASK-14)
test "$(pnpm --filter @atria/web exec tsc --noEmit --pretty false 2>&1 | grep -E 'error TS' | grep -ciE "statement|credit|installment|closing_day|due_day|AccountKind|'kind'")" -eq 0
# Nada mais importa as telas e o hook removidos nem aponta para a aba Faturas
test -z "$(grep -rlE 'statements-screen|statement-payment-screen|use-statements|/finance/statements|credit-cards' apps/web/src)"
# e2e do CT-07 escrito e compilando (roda contra o servidor real na integração)
# evidência: sem-cartao-e2e-list.txt
pnpm --filter @atria/web exec playwright test --list src/features/finance/finance.e2e.ts
```

### Evidências

- `sem-cartao-testes.txt` (automática, da verificação)
  - Prova: o Financeiro não tem mais a aba Faturas, o tipo cartão, o limite, os dias de fechamento e vencimento, as parcelas nem o card Cartões; a conta é criada só com nome e visibilidade, a saída é criada sem parcelas em qualquer conta, o detalhe da conta não oferece "Ver fatura", e a lista de contas mantém busca, visualização e filtro (de visibilidade) na URL, sem violações no axe (RF-07, RF-08, RF-09, CT-07).
  - Trecho: as linhas `✓` de `rf07 creates an account without card fields`, `rf07 creates an account without the card type`, `rf07 shows edit and more actions on the account detail without the statement`, `rf07 creates an expense without installments on any account`, `rf09 shows balance, upcoming bills and savings and losses without the cards block`, `ct07 shows the finance tabs without Faturas` e `/finance/accounts keeps q, view and filters in the URL`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests`, ou algum desses nomes ausente.
  - Espera: `ct07 shows the finance tabs without Faturas`
- `sem-cartao-e2e-list.txt` (automática, da verificação)
  - Prova: o e2e do CT-07 está escrito e compila, e o e2e de parcelas e faturas saiu; contra o servidor real (integração), ele abre o painel, o formulário de conta e o de saída e confere que não há Faturas, Cartões, tipo cartão nem Parcelas (CT-07).
  - Trecho: as linhas com `ct07 finance has no card, statements or installments` e a ausência de `installments fall in the right statements and payment settles them`.
  - Falha: erro de compilação, `Error:`, a linha do `ct07` ausente ou a linha de parcelas ainda presente.
  - Espera: `ct07 finance has no card, statements or installments`
- `finance-sem-cartao.png` (print): `node apps/web/scripts/evidence-finance.mjs sem-cartao`
  - Prova: no Chromium, com a API simulada, o painel com seis abas e sem o card Cartões, a nova conta sem tipo, limite e dias, a nova saída sem "Parcelas" mesmo na conta que era cartão, a lista de contas com os chips de visibilidade e o detalhe da conta sem "Ver fatura", nos temas claro e escuro, em desktop e em 360 px (RF-07, RF-08, RF-09, CT-07, RNF-02).
  - Trecho: uma linha `ok` por conferência dos cinco cenários `sem-cartao` em cada tema e largura, as linhas de axe sem violações e sem rolagem horizontal, a linha `png:` com `finance-sem-cartao.png` e a última linha `ok  0 falha(s)`; na prancha, nenhuma aba Faturas, nenhum card Cartões e nenhum campo de cartão ou de parcelas.
  - Falha: alguma linha `FALHA`, `Evidência desconhecida`, a ausência da linha `png:`, código de saída diferente de 0, ou na prancha a aba Faturas, o card Cartões, o campo "Parcelas" ou o tipo "Cartão de crédito".
  - Espera: `0 falha(s)`
