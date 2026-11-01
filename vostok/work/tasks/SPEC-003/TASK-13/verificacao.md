### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/finance --reporter=verbose 2>&1 | grep -E '^ +(✓|×|↓) ' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/finance --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/finance`
- `pnpm --filter @atria/web typecheck`
- `grep -rlE "from '(\.\./components/|\./)tone'" apps/web/src | sort` (muda): os três arquivos que importam `tone.ts` (`panel-charts.tsx`, `category-detail-screen.tsx` e `finance-settings-screen.tsx`) deixam de importá-lo, porque o arquivo é removido (RF-18).

### Verificação

```bash
# Cor da categoria: formulário, detalhe, configurações, "Para onde foi" e contraste (Vitest + Testing Library + axe)
# evidência: category-color-tests.txt
pnpm --filter @atria/web exec vitest run src/features/finance/screens/categories-screens.test.tsx src/features/finance/hooks/use-categories.test.tsx src/features/finance/components/components.test.tsx src/features/finance/screens/finance-panel-screen.test.tsx --reporter=verbose
# O resto do Financeiro continua passando com as fixtures em HEX
pnpm --filter @atria/web exec vitest run src/features/finance
# Tipos, lint e formatação sem nenhum erro ou warning (scripts ficam fora do ESLint)
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/features/finance --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/finance scripts/evidence-category-color.mjs
node --check apps/web/scripts/evidence-category-color.mjs
# As cores por nome saíram: sem tone.ts, sem toneClass, sem a lista de nomes e sem cor literal no CSS
test ! -e apps/web/src/features/finance/components/tone.ts
! grep -rnE "toneClass|CATEGORY_COLORS|finance\.colors\." apps/web/src
! grep -nE "#[0-9a-fA-F]{3,6}\b|rgba?\(" apps/web/src/features/finance/components/finance.module.css
```

### Evidências

- `category-color-tests.txt` (automática, da verificação)
  - Prova: a categoria é criada e editada no color picker e gravada como `#rrggbb` em minúsculas; o HEX aparece na lista de Configurações, no detalhe e nas barras do "Para onde foi"; o texto sobre uma cor clara fica escuro e sobre uma escura fica claro, sem violações no axe (RF-18, RN-09, CT-12, CB-09, RNF-02).
  - Trecho: as linhas `✓` de `creates and renames a category`, `rf18 starts a new category with the default hex color`, `rf18 shows the hex color of the category in the detail`, `cb09 writes dark text on a light category color and light text on a dark one`, `cb09 picks the text color with more contrast on the category color`, `rn09 normalizes the hex color to lowercase`, `rf18 paints each bar in the hex color of its category` e `rf18 shows where it went in the category colors`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests` ou algum desses nomes ausente.
- `category-color.png` (print): `node apps/web/scripts/evidence-category-color.mjs telas`
  - Requer: `apps/web/scripts/evidence-category-color.mjs`
  - Prova: com a API simulada, Configurações, o detalhe da categoria e o painel mostram a cor HEX de cada categoria; a amostra de uma cor clara tem texto escuro e a de uma cor escura tem texto claro; o seletor de cor abre no formulário; tudo nos temas claro e escuro, em 1440 px e 360 px, com o axe sem violações (RF-18, CT-12, CB-09, RNF-02).
  - Trecho: as linhas `ok` de "ponto com o HEX da categoria", "amostra legível em Clara", "amostra legível em Noite", "barras na cor da categoria", "diálogo Escolher cor aberto" e "axe sem violações (inclusive color-contrast)", a linha `png:` e a última linha `ok  0 falha(s)`; na prancha, as cores das categorias e as amostras legíveis nos dois temas.
  - Falha: qualquer linha `FALHA` (cor por nome, amostra ilegível, barra sem a cor da categoria, rolagem horizontal), a falta da linha `png:` ou código de saída diferente de 0.
- `category-color.webm` (print): `node apps/web/scripts/evidence-category-color.mjs video`
  - Requer: `apps/web/scripts/evidence-category-color.mjs`
  - Prova: no Chromium, com o cursor visível, a pessoa cria a categoria "Viagens" escolhendo `#0EA5E9` no color picker, edita para `#F59E0B` e vê a nova cor no "Para onde foi"; o servidor simulado recebe as cores em minúsculas (RF-18, RN-09, CT-12, FA-04).
  - Trecho: as linhas `ok` de "POST com color #0ea5e9", "amostra #0ea5e9 no detalhe", "PATCH com color #f59e0b" e "barra de Viagens na nova cor", a linha `video:` e a última linha `ok  0 falha(s)`; no vídeo, o diálogo "Escolher cor" aberto, o HEX digitado e a cor aplicada no detalhe e no painel.
  - Falha: alguma linha `FALHA`, corpo com cor em maiúsculas ou por nome, a falta da linha `video:` ou código de saída diferente de 0.
