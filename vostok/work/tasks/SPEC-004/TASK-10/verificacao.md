### Baseline

- `pnpm --filter @atria/web exec playwright test --list src/features/finance/finance.e2e.ts --project=desktop-session --project=w360-session 2>&1 | grep '›' | sed -E 's/:[0-9]+:[0-9]+ ›/ ›/' | sort`
- `pnpm --filter @atria/web exec eslint src/features/finance/finance.e2e.ts --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/finance/finance.e2e.ts scripts/evidence-finance.mjs`
- `node --check apps/web/scripts/evidence-finance.mjs && echo sintaxe-ok`
- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
# Fluxo completo dos descontos contra o servidor real, em desktop e em 360 px, com axe (precisa da pilha do passo 2)
# evidência: descontos-e2e.txt
pnpm --filter @atria/web exec playwright test src/features/finance/finance.e2e.ts --project=desktop-session --project=w360-session --reporter=list
# Tipos, lint e formatação sem erro nem warning (o script fica fora do ESLint)
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/features/finance/finance.e2e.ts --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/finance/finance.e2e.ts scripts/evidence-finance.mjs
node --check apps/web/scripts/evidence-finance.mjs
```

### Evidências

- `descontos-e2e.txt` (automática, da verificação)
  - Prova: contra o servidor real, em desktop e em 360 px, uma entrada de R$ 8.000,00 com INSS 11% e IRPF 15% sobre a base de R$ 7.120,00 mostra o líquido previsto de R$ 6.052,00 no formulário; liquidada por R$ 6.500,00, a prévia mostra o bruto de R$ 8.592,20 e a base de R$ 7.647,06, o detalhe guarda o liquidado, o saldo da conta recebe R$ 6.500,00 e o painel mostra o líquido no Fechamento e INSS e IRPF no cartão "Descontos do período"; uma saída de R$ 200,00 com desconto de 10% e taxa de R$ 5,00 tira R$ 185,00 do saldo; o axe não acha violações e não há rolagem horizontal em nenhuma tela; os e2e de antes do Financeiro continuam passando (RF-08, RF-09, CT-05, FA-02, RNF-04, RNF-05).
  - Trecho: as linhas `ok` de `ct05 settles an income with deductions by the net and the balance gets the net` e de `fa02 an expense with discount and fee takes the net from the balance` em `[desktop-session]` e em `[w360-session]`, e a linha final `passed` sem `failed`.
  - Falha: `failed`, `✘`, `Error:` ou algum dos dois testes ausente em uma das larguras.
  - Espera: `ct05 settles an income with deductions by the net and the balance gets the net`
  - Tempo-limite: 900
- `finance-descontos.webm` (print): `node apps/web/scripts/evidence-finance.mjs descontos-video`
  - Prova: no Chromium, com a API simulada e o cursor visível, o formulário recebe o bruto e os itens com o líquido mudando na hora, a liquidação pelo líquido mostra a prévia com o bruto recalculado e a edição dos itens, o detalhe mostra o liquidado e o painel mostra o cartão "Descontos do período" (RF-08, RF-09, CT-05, RNF-04).
  - Trecho: as linhas `ok` de `vídeo: líquido previsto ao vivo`, `vídeo: prévia com o bruto recalculado`, `vídeo: liquidado no detalhe` e `vídeo: cartão Descontos do período`, a linha `video:` e a última linha `ok  0 falha(s)`.
  - Falha: alguma linha `FALHA`, `Evidência desconhecida`, a falta da linha `video:` ou código de saída diferente de 0; no vídeo, o líquido parado ao editar ou a prévia sem o bruto novo.
  - Espera: `0 falha(s)`
