### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/finance/hooks/use-accounts.test.tsx src/features/finance/screens/accounts-screens.test.tsx --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | grep -v -E '> (rf05|rf06|ct04|ct05) ' | grep -v 'offers rename or the transactions when the account has transactions' | sort`
- `pnpm --filter @atria/web exec vitest run src/features/finance/screens/accounts-screens.test.tsx --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | grep 'offers rename or the transactions when the account has transactions'` (muda): a conta com movimentações deixa de oferecer "Renomear" e "Ver movimentações" e passa a pedir a conta de destino (RF-05); o comportamento novo fica em `rf05 asks for the destination account when the account has transactions`.
- `pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/finance/screens/account-detail-screen.tsx src/features/finance/hooks/use-accounts.ts src/features/finance/hooks/use-accounts.test.tsx src/features/finance/screens/accounts-screens.test.tsx src/features/finance/finance.e2e.ts`
- `pnpm --filter @atria/web exec prettier --check src/features/finance/screens/account-detail-screen.tsx src/features/finance/hooks/use-accounts.ts src/features/finance/hooks/use-accounts.test.tsx src/features/finance/screens/accounts-screens.test.tsx src/features/finance/finance.e2e.ts src/features/finance/i18n/pt-br.json scripts/evidence-finance.mjs 2>&1 | tail -1`
- `node --check apps/web/scripts/evidence-finance.mjs && echo sintaxe-ok`
- `pnpm --filter @atria/web exec tsc --noEmit --pretty false 2>&1 | grep -E '^src/features/finance/(screens/(account-detail-screen|accounts-screens\.test)|hooks/use-accounts|finance\.e2e)' | sort`
- `pnpm --filter @atria/web exec playwright test --list src/features/finance/finance.e2e.ts 2>&1 | grep '›' | sed -E 's/:[0-9]+:[0-9]+ ›/ ›/' | grep -v 'ct04 ' | sort`

### Verificação

```bash
# Testes de tela e de hook da exclusão da conta (Vitest + Testing Library + axe)
# evidência: excluir-conta-testes.txt
pnpm --filter @atria/web exec vitest run src/features/finance/hooks/use-accounts.test.tsx src/features/finance/screens/accounts-screens.test.tsx --reporter=verbose
# Lint e formatação sem nenhum erro ou warning (o script fica fora do ESLint)
pnpm --filter @atria/web exec eslint --max-warnings 0 src/features/finance/screens/account-detail-screen.tsx src/features/finance/hooks/use-accounts.ts src/features/finance/hooks/use-accounts.test.tsx src/features/finance/screens/accounts-screens.test.tsx src/features/finance/finance.e2e.ts
pnpm --filter @atria/web exec prettier --check src/features/finance/screens/account-detail-screen.tsx src/features/finance/hooks/use-accounts.ts src/features/finance/hooks/use-accounts.test.tsx src/features/finance/screens/accounts-screens.test.tsx src/features/finance/finance.e2e.ts src/features/finance/i18n/pt-br.json scripts/evidence-finance.mjs
node --check apps/web/scripts/evidence-finance.mjs
# Nenhum erro de tipo nos arquivos da tarefa (o typecheck do app inteiro depende das TASK-13 e TASK-14)
test "$(pnpm --filter @atria/web exec tsc --noEmit --pretty false 2>&1 | grep -cE '^src/features/finance/(screens/(account-detail-screen|accounts-screens\.test)|hooks/use-accounts|finance\.e2e)')" -eq 0
# e2e do CT-04 escrito e compilando (roda contra o servidor real na integração)
# evidência: excluir-conta-e2e-list.txt
pnpm --filter @atria/web exec playwright test --list src/features/finance/finance.e2e.ts
```

### Evidências

- `excluir-conta-testes.txt` (automática, da verificação)
  - Prova: a conta com movimentações pede a conta de destino no próprio diálogo, com a escolha obrigatória, e só lista as outras contas; a exclusão manda `move_to`, soma na hora o saldo da excluída ao da destino, atualiza movimentações, transferências e saldos e volta para Contas com o aviso; a destino em outra moeda aparece como erro no diálogo, sem aviso solto e com a lista restaurada; a conta sem movimentações continua com uma só confirmação e a padrão continua sem "Excluir"; sem violações no axe (RF-05, RF-06, CT-04, CT-05, CB-03, FA-02, FA-03, [project/frontend-09], [project/frontend-18]).
  - Trecho: as linhas `✓` de `rf05 asks for the destination account when the account has transactions`, `rf05 asks to choose the destination before deleting`, `ct05 shows a destination in another currency inside the dialog`, `rf05 sends the destination account in move_to`, `rf06 adds the balance of the deleted account to the destination right away`, `rf06 refreshes transactions, transfers and balances after moving`, `rf05 keeps a destination in another currency inside the dialog`, `deletes a common account after confirmation` e `disables delete for the default account with a hint`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests` ou algum desses nomes ausente.
  - Espera: `rf05 asks for the destination account when the account has transactions`
- `excluir-conta-e2e-list.txt` (automática, da verificação)
  - Prova: o e2e do CT-04 está escrito e compila; contra o servidor real (integração), exclui uma conta com uma saída liquidada escolhendo a Conta principal e confere que a saída passou para ela (CT-04, RF-06).
  - Trecho: a linha com `ct04 deleting an account with transactions moves them to the destination` e a de `default account cannot be deleted`.
  - Falha: erro de compilação, `Error:` ou algum dos dois casos ausente.
  - Espera: `ct04 deleting an account with transactions moves them to the destination`
- `finance-excluir-conta.webm` (print): `node apps/web/scripts/evidence-finance.mjs excluir-conta`
  - Prova: no Chromium, com a API simulada, a exclusão da conta que era do cartão pelo "Mais ações", o diálogo com a conta de destino, a escolha da Conta principal, a conta fora da lista com o saldo da destino somado e a compra movida para a Conta principal; as checagens do diálogo, da moeda diferente e da conta sem movimentações nos temas claro e escuro, em desktop e em 360 px (RF-05, RF-06, CT-04, CT-05, PD-14, RNF-02).
  - Trecho: uma linha `ok` por conferência dos cenários `excluir-conta` em cada tema e largura (incluindo axe sem violações e sem rolagem horizontal), as linhas `ok` de `vídeo: Cartão Nu fora da lista de Contas`, `vídeo: saldo da Conta principal em R$ 5.600,00` e `vídeo: compra movida para a Conta principal`, a linha `video:` com `finance-excluir-conta.webm` e a última linha `ok  0 falha(s)`; no vídeo, o cursor visível abrindo o menu, confirmando, escolhendo a conta de destino e voltando para Contas.
  - Falha: alguma linha `FALHA`, `Evidência desconhecida`, a ausência da linha `video:`, código de saída diferente de 0, ou no vídeo a conta excluída ainda na lista, o saldo da Conta principal sem a soma ou a compra na conta excluída.
  - Espera: `0 falha(s)`
