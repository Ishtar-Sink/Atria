### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/finance --reporter=verbose 2>&1 | grep -E '^ +(✓|×|↓) ' | sed -E 's/ [0-9]+ms$//' | grep -v 'formats values without plus or minus sign' | sort`
- `pnpm --filter @atria/web exec vitest run src/features/finance/components/components.test.tsx --reporter=verbose 2>&1 | grep -E '^ +(✓|×|↓) ' | sed -E 's/ [0-9]+ms$//' | grep 'formats values without plus or minus sign'` (muda): o teste que exigia valores sem sinal sai, porque o RF-11 pede "+" nas entradas e "−" nas saídas; os testes `rf11 …`, `rn06 …`, `rf12 …` e `cb07 …` tomam o lugar dele.
- `pnpm --filter @atria/web exec eslint src/features/finance --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/finance scripts/evidence-finance.mjs`
- `pnpm --filter @atria/web typecheck`
- `node --check apps/web/scripts/evidence-finance.mjs && echo sintaxe-ok`

### Verificação

```bash
# Valores com sinal e cor: componente, listas e painel (Vitest + Testing Library + axe)
# evidência: signs-tests.txt
pnpm --filter @atria/web exec vitest run src/features/finance/components/components.test.tsx src/features/finance/screens/finance-panel-screen.test.tsx src/features/finance/screens/transactions-screens.test.tsx --reporter=verbose
# O resto do Financeiro continua passando
pnpm --filter @atria/web exec vitest run src/features/finance
# Tipos, lint e formatação sem nenhum erro ou warning (scripts ficam fora do ESLint)
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/features/finance --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/finance scripts/evidence-finance.mjs
node --check apps/web/scripts/evidence-finance.mjs
# Sem cor literal nos CSS do Financeiro (o vermelho só fica no erro de formulário)
! grep -nE "#[0-9a-fA-F]{3,6}\b|rgba?\(" apps/web/src/features/finance/components/finance.module.css apps/web/src/features/finance/screens/finance-panel-screen.module.css
```

### Evidências

- `signs-tests.txt` (automática, da verificação)
  - Prova: entradas aparecem em verde com "+" e saídas na cor do texto com "−", pelo tipo da movimentação e nunca pelo sinal do número; saldos e sobra positivos em verde, negativos em âmbar com "−" e zero sem cor nem sinal; nenhum valor em vermelho; o sinal fica em texto ao lado da cor; sem violações no axe (RF-11, RF-12, RN-06, RN-07, CT-08, CB-07, RNF-02, RNF-03).
  - Trecho: as linhas `✓` de `rf11 shows incomes in green with plus and expenses with minus`, `rn06 takes the sign from the kind, never from the stored number`, `rf12 shows a positive balance in green and a negative one in amber`, `cb07 shows a zero balance in the text color without sign`, `rn07 never paints an amount in red`, `rnf03 keeps the sign as text next to the color`, `rnf02 has no axe violations with signed amounts`, `rf12 shows the balance and each account in green or amber`, `cb07 shows a zero surplus without color or sign` e `ct08 shows incomes with plus in green and expenses with minus in the lists`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests` ou algum desses nomes ausente.
- `finance-sinais.png` (print): `node apps/web/scripts/evidence-finance.mjs sinais`
  - Prova: com a API simulada, Entradas mostra os valores com "+" na cor de sucesso, Saídas com "−" na cor do texto, o painel mostra a sobra e a conta negativas em âmbar e o saldo zero sem cor nem sinal, sem nenhum vermelho; nos temas claro e escuro, em 1440 px e 360 px, com o contraste AA conferido pelo axe (RF-11, RF-12, CT-08, CB-07, RNF-02).
  - Trecho: as linhas `ok` de "Entradas com + em verde", "Saídas com − na cor do texto", "saldo negativo em âmbar", "saldo zero sem cor", "sem vermelho" e "axe sem violações (inclusive color-contrast)", a linha `png:` e a última linha `ok  0 falha(s)`.
  - Falha: alguma linha `FALHA` (valor sem sinal, saída colorida, saldo negativo em vermelho, contraste abaixo de AA), a falta da linha `png:` ou código de saída diferente de 0.
