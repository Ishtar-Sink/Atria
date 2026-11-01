### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/finance --reporter=verbose 2>&1 | grep -E '^ +(✓|×|↓) ' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/finance --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/finance scripts/evidence-finance.mjs`
- `pnpm --filter @atria/web typecheck`
- `node --check apps/web/scripts/evidence-finance.mjs && echo sintaxe-ok`
- `node -e "const p=require('./apps/web/package.json');console.log(Object.keys(p.dependencies).sort().join('\n'))"` (muda): as dependências do app ganham `react-is` e `recharts`, a biblioteca de gráficos escolhida nesta tarefa ([project/stack-12]).

### Verificação

```bash
# Gráficos do painel: Previsto x realizado e Mês a mês (Vitest + Testing Library + axe)
# evidência: charts-tests.txt
pnpm --filter @atria/web exec vitest run src/features/finance/components/components.test.tsx src/features/finance/screens/finance-panel-screen.test.tsx src/features/finance/hooks/use-financial-summary.test.tsx --reporter=verbose
# O resto do Financeiro continua passando
pnpm --filter @atria/web exec vitest run src/features/finance
# Tipos, lint e formatação sem nenhum erro ou warning (scripts ficam fora do ESLint)
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/features/finance --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/finance scripts/evidence-finance.mjs scripts/check-chart-chunk.mjs
node --check apps/web/scripts/evidence-finance.mjs
node --check apps/web/scripts/check-chart-chunk.mjs
# Versão exata da biblioteca e da dependência par (stack-12)
node -e "const d=require('./apps/web/package.json').dependencies;process.exit(d.recharts==='3.10.1'&&d['react-is']==='19.3.1'?0:1)"
# Sem cor literal nos CSS do Financeiro e sem as colunas antigas
! grep -nE "#[0-9a-fA-F]{3,6}\b|rgba?\(" apps/web/src/features/finance/components/finance.module.css apps/web/src/features/finance/screens/finance-panel-screen.module.css
! grep -rn "ExpectedVsSettledColumns\|columnBar\|legendValues" apps/web/src
# Build de produção e o chunk separado da biblioteca de gráficos (RNF-04)
pnpm --filter @atria/web build
# evidência: charts-chunk.txt
node apps/web/scripts/check-chart-chunk.mjs
```

### Evidências

- `charts-tests.txt` (automática, da verificação)
  - Prova: o Previsto x realizado desenha barras horizontais com os valores e os rótulos, nas cores de entrada e saída, e mostra a dica com o valor e a diferença também pelo teclado; o "Mês a mês" desenha uma coluna por mês, os projetados em tom mais claro, o mês zerado e o saldo negativo em âmbar, alterna para Saldo pela URL e fica abaixo do Fechamento; as duas tabelas acessíveis continuam (RF-13, RF-14, RF-15, RF-16, CT-09, CT-10, CB-08, RN-07, RNF-03, RNF-05).
  - Trecho: as linhas `✓` de `rf14 draws expected and settled as horizontal bars with labels`, `rf13 shows the value and the difference in the tooltip on focus`, `rnf03 keeps the accessible table with the difference`, `rf15 draws one column per month with the projected months lighter`, `cb08 shows a month without transactions as zero`, `rn07 shows a negative balance in amber, never red`, `rnf05 moves the monthly tooltip with the keyboard`, `rf15 shows the monthly card below the closing` e `rf16 switches the monthly card between incomes and expenses and balance through the url`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests` ou algum desses nomes ausente.
- `charts-chunk.txt` (automática, da verificação)
  - Prova: no build de produção, a biblioteca de gráficos (recharts 3.10.1, licença MIT) não está em nenhum chunk inicial do app e só num chunk carregado sob demanda a partir do painel do Financeiro (RNF-04, [project/stack-12]).
  - Trecho: a linha `recharts 3.10.1 · licença MIT`, a linha `biblioteca nos iniciais: 0` e as linhas `biblioteca sob demanda:` e `importado por:` com chunks do painel.
  - Falha: `FALHA`, `biblioteca nos iniciais:` maior que 0, a lista sob demanda vazia ou código de saída diferente de 0.
  - Requer: `apps/web/scripts/check-chart-chunk.mjs`
- `finance-graficos.png` (print): `node apps/web/scripts/evidence-finance.mjs graficos`
  - Prova: com a API simulada, o painel mostra o Previsto x realizado em barras horizontais com valores e rótulos e o "Mês a mês" em colunas verticais, 6 realizados e 6 projetados em tom mais claro, com a dica pelo mouse e pelo teclado e o modo Saldo com o mês negativo em âmbar; nos temas claro e escuro, em 1440 px e 360 px, com o axe sem violações (RF-13, RF-14, RF-15, RF-16, CT-09, CT-10, RNF-02, RNF-05).
  - Trecho: as linhas `ok` de "Previsto x realizado em barras horizontais", "Mês a mês em colunas", "dica pelo mouse", "dica pelo teclado", "Mês a mês em Saldo", "sem vermelho", "sem rolagem horizontal" e "axe sem violações (inclusive color-contrast)", a linha `png:` e a última linha `ok  0 falha(s)`.
  - Falha: alguma linha `FALHA` (barras na orientação errada, projetados no mesmo tom, dica ausente, vermelho no saldo), a falta da linha `png:` ou código de saída diferente de 0.
- `finance-graficos.webm` (print): `node apps/web/scripts/evidence-finance.mjs graficos-video`
  - Prova: no Chromium, com o cursor visível, a dica do Previsto x realizado aparece ao passar o mouse e ao navegar pelo teclado com o foco visível, e o "Mês a mês" mostra a dica de um mês projetado e troca para Saldo (RF-13, RF-15, RF-16, CT-09, CT-10, RNF-05).
  - Trecho: as linhas `ok` das etapas do vídeo, a linha `video:` e a última linha `ok  0 falha(s)`; no vídeo, a dica com o valor e a diferença, o contorno de foco no gráfico e as colunas mudando para o saldo.
  - Falha: alguma linha `FALHA`, a falta da linha `video:` ou código de saída diferente de 0.
