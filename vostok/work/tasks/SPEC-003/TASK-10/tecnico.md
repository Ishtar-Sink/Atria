<!-- Escrito na finalização da tarefa. -->

## O que mudou

**Removidos (módulos inteiros):**

- `apps/web/src/features/finance/screens/statements-screen.tsx` e `statement-payment-screen.tsx`, com os testes `statements-screens.test.tsx`;
- `apps/web/src/features/finance/hooks/use-statements.ts`, com `use-statements.test.tsx`.

**Rotas e navegação:**

- `routes.tsx`: saem a rota `/finance/statements`, a rota de pagamento de fatura e os imports correspondentes. O comentário passa a falar em seis abas.
- `components/finance-shell.tsx`: a aba Faturas sai de `FinanceTab` e de `FINANCE_TABS`.
- `hooks/finance-cache.ts`: sai a chave `statements`.

**Contas:**

- `screens/account-form-screen.tsx`: o schema tem só `name` e `visibility`, sem a validação de dias e sem o tipo, o limite e os dias. A edição e a criação enviam `{ name, visibility }`.
- `screens/account-detail-screen.tsx`: `Overview` mostra só o saldo atual. Sai o botão "Ver fatura" e o subtítulo do cabeçalho. O eyebrow "Conta" continua. A exclusão não foi mexida (fica na TASK-12).
- `screens/accounts-screen.tsx`: `accountsSearchSchema` troca `kind` por `visibility` (`all`, `personal`, `shared`, com `catch('all')`). O filtro segue na URL, com `setSearch({ visibility })`. Cada conta mostra a visibilidade no subtítulo.
- `hooks/use-accounts.ts`: `useCreateAccount` e `useRenameAccount` não otimizam mais campos de cartão.

**Movimentações:**

- `screens/transaction-form-screen.tsx`: saem `INSTALLMENTS`, o campo `installments` (schema, valores iniciais e validação), `InstallmentsResult`, o estado `created` e o campo "Parcelas". `submitCreate` envia `{ ...base, expected_date }` e, após `idempotency.renew()`, vai para o detalhe de `items[0]`.
- `screens/transaction-detail-screen.tsx`: saem o aviso de fatura paga e o fato de parcela. Menu e diálogos não foram alterados (são da TASK-11).
- `components/transaction-row.tsx`: `useTransactionTitle` devolve só a descrição (ou o rótulo do tipo, se estiver vazia), sem "(n/total)".
- `hooks/use-transactions.ts`: `useCreateTransaction` não invalida mais `statements`. `editableFields` devolve, para a movimentação liquidada, só descrição, categoria e visibilidade (DEC-005). `useUpdateTransaction` invalida o detalhe só com `transaction_already_settled`. `useUndoSettlement` virou o próprio `useMutation`, sem o estado `UndoSettlementState`. `FORM_ERRORS` perdeu `installment_not_editable`.

**Painel:**

- `screens/finance-panel-screen.tsx`: sai a função `Cards` e o item `cards` do bloco lateral, que fica com `balance`, `upcoming` e `savings`. Sai o import de `ProgressBar`.
- `screens/finance-panel-screen.module.css`: saem `.card`, `.card:last-child`, `.cardHead` e `.cardHead a`, que só o card Cartões usava.

**Textos:** `i18n/pt-br.json` perdeu as chaves de cartão, parcela, fatura e tipo de conta (cada uma foi conferida antes com `grep` para não restar uso). Ganhou `accounts.visibility_filter`, `accounts.visibility_all`, `accounts.visibility_personal` e `accounts.visibility_shared`. O texto vazio da lista e o subtítulo do formulário de conta foram reescritos.

**Testes, fixtures e e2e:** `test-utils.tsx` ficou sem cartão, faturas e parcelas, e `POST /transactions` responde com uma única movimentação. Os testes foram reescritos com os prefixos `rf07`, `rf09` e `ct07`. Foram apagados os testes de parcelas, fatura paga e cartão. O e2e de parcelas e faturas foi substituído pelo `ct07 finance has no card, statements or installments`. `listing-standard.test.ts` usa `visibility` na entrada de `/finance/accounts`.

**Script de evidência** (`apps/web/scripts/evidence-finance.mjs`): fixtures sem cartão e sem `credit_cards`. Saíram os cenários de painel com cartões, parcelas e as abas de fatura e pagamento. Entraram os cenários do grupo `sem-cartao` e o modo `sem-cartao`, que grava `finance-sem-cartao.png`.

## Decisões

- A conta de cartão que existia nas fixtures virou conta comum ("Cartão Nu", visibilidade compartilhada), conforme a decisão 3 da SPEC-003.
- O filtro de tipo deu lugar ao de visibilidade, mantendo o filtro na URL e a convenção de listagem ([project/frontend-12]).
- Os estilos `.card` e `.cardHead` foram removidos porque ficaram sem uso ([project/code-style-08]).
- As ações do detalhe ficaram em "Editar" e "Mais ações" (PD-14).

## Verificação

Comandos da Verificação:

- Vitest em `src/features/finance` e `src/app/listing-standard.test.ts`, com saída detalhada (arquivo `sem-cartao-testes.txt`);
- ESLint com `--max-warnings 0` e Prettier nos arquivos da tarefa;
- `node --check` no script de evidência;
- contagem de erros de tipo ligados ao cartão, esperada em zero;
- busca por `statements-screen`, `statement-payment-screen`, `use-statements`, `/finance/statements` e `credit-cards` em `apps/web/src`, que deve estar vazia;
- `playwright test --list` do e2e do Financeiro (arquivo `sem-cartao-e2e-list.txt`).

Resultados registrados:

- Baseline: 8 comandos. O terceiro (ESLint) já saía com código 1, por causa dos campos de cartão, e a tarefa resolve isso.
- Testes: sem falhas.
- Regressão: 4 comandos iguais ao baseline e 4 mudanças esperadas.
- Evidências: 3 arquivos em `TASK-10/evidencias/`. O print `finance-sem-cartao.png` foi conferido pelo usuário (sha256 `c22fe40c`).
