### Baseline

- `pnpm --filter @atria/web exec vitest run src/app/layout src/shared/layout --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | grep -v -E '> (rf23|rf24) |measures the backdrop from the' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec vitest run src/features/library/book-form-page src/features/notes/screens --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/app/layout src/shared/layout --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/app/layout src/shared/layout`
- `pnpm --filter @atria/web typecheck`
- `pnpm --filter @atria/web exec playwright test --list src/shared/layout/sticky-page-header.e2e.ts --project=desktop 2>&1 | grep '›' | grep -v -E '(ct17|cb11) ' | sed -E 's/:[0-9]+:[0-9]+//' | sort`

### Verificação

```bash
# evidência: layout-tests.txt
pnpm --filter @atria/web exec vitest run src/app/layout src/shared/layout --reporter=verbose
pnpm --filter @atria/web exec vitest run src/features/library/book-form-page src/features/notes/screens
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/app/layout src/shared/layout --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/app/layout src/shared/layout
# evidência: rolagem-e2e-list.txt
ATRIA_E2E_FIREFOX=1 pnpm --filter @atria/web exec playwright test --list src/shared/layout/sticky-page-header.e2e.ts --project=desktop --project=firefox
```

Resultado esperado: código 0; no primeiro comando, as linhas `✓` de `app-layout.test.tsx` e `sticky-page-header.test.tsx`, inclusive `rf23 lets the window scroll with no inner scroll area`, `rf24 exposes the topbar height to the sticky header` e `rf24 follows the window scroll without a page area`, e nenhuma `×`; no último, os casos `ct17` e `cb11` nos projetos `desktop` e `firefox`.

### Evidências

- `layout-tests.txt` (automática, da verificação)
  - Prova: o CSS do layout deixa a janela rolar, sem rolagem dentro da página, com a topbar e a barra lateral presas; a altura da topbar chega ao cabeçalho fixo, que compacta pela rolagem da janela e cola logo abaixo dela; as telas com cabeçalho fixo continuam passando (RF-23, RF-24).
  - Trecho: `✓ src/app/layout/app-layout.test.tsx > AppLayout > rf23 lets the window scroll with no inner scroll area`, `rf23 marks the main as the page area`, `rf24 exposes the topbar height to the sticky header`, `✓ src/shared/layout/sticky-page-header.test.tsx > StickyPageHeader > rf24 follows the window scroll without a page area`, `rf24 sticks right below the topbar` e `compacts after 48 px of scroll and expands back near the top`.
  - Falha: uma linha `×`, `FAIL` ou `No test files found`.
- `rolagem-e2e-list.txt` (automática, da verificação)
  - Prova: os e2e da rolagem única e da página curta existem e compilam nos projetos do Chromium e do Firefox (CT-17, CB-11, RNF-06).
  - Trecho: as linhas `[desktop]` e `[firefox]` com `ct17 só a janela rola no painel, com a barra lateral e a topbar fixas`, `ct17 só a janela rola no formulário e o cabeçalho cola na topbar` e `cb11 página curta: sem rolagem e barra lateral na altura da tela`.
  - Falha: erro de compilação, `Error:` ou um dos casos ausente.
- `rolagem-chromium-e2e.txt` (automática): `pnpm --filter @atria/web exec playwright test src/shared/layout/sticky-page-header.e2e.ts --project=desktop`
  - Prova: no build real, no Chromium, só a janela rola no painel e no formulário, a barra lateral fica na altura da tela e a topbar no topo, sem espaço em branco embaixo, o cabeçalho compacta colado na topbar e a página curta não rola; os quatro casos do fundo do cabeçalho continuam passando (CT-17, CB-11, RF-23, RF-24).
  - Trecho: `7 passed` (o vídeo fica `skipped` sem `ATRIA_E2E_VIDEO`).
  - Falha: `failed`, `Timed out`, `No tests found` ou menos de 7 aprovados.
  - Tempo-limite: 600
- `rolagem-firefox-e2e.txt` (automática): `ATRIA_E2E_FIREFOX=1 pnpm --filter @atria/web exec playwright test src/shared/layout/sticky-page-header.e2e.ts --project=firefox`
  - Prova: no Firefox (o navegador do usuário é o Zen), as mesmas medidas da rolagem única, da página curta e do cabeçalho passam; o Firefox do Playwright não desenha o `backdrop-filter`, então o fundo é conferido pelas propriedades calculadas (CT-17, CB-11, RNF-06).
  - Trecho: `7 passed`.
  - Falha: `Executable doesn't exist` (Firefox sem instalar), `failed`, `Timed out` ou `No tests found`.
  - Tempo-limite: 600
- `rolagem-unica.webm` (print): `ATRIA_E2E_VIDEO="$VOSTOK_EVIDENCE/rolagem-unica.webm" pnpm --filter @atria/web exec playwright test src/shared/layout/sticky-page-header.e2e.ts --project=desktop -g 'ct17 vídeo'`
  - Prova: no Chromium, em 1280x800 e tema claro, com o cursor visível, a roda do mouse rola a página inteira no painel do Financeiro e no formulário de livro, a barra lateral e a topbar ficam paradas, o cabeçalho compacta e ganha o fundo desfocado colado na topbar, e não sobra faixa em branco no fim (CT-17, RF-23, RF-24).
  - Trecho: na saída, `1 passed`; no vídeo, uma única barra de rolagem na borda da janela, a sidebar e a topbar fixas durante toda a rolagem e o título compacto logo abaixo da topbar.
  - Falha: `failed` ou `skipped`, ou no vídeo uma segunda barra de rolagem dentro da página, a sidebar ou a topbar subindo com o conteúdo, uma faixa entre o cabeçalho e a topbar ou espaço em branco embaixo.
  - Tempo-limite: 600
- `pagina-curta.png` (print): `ATRIA_E2E_SHOT_SHORT_PAGE="$VOSTOK_EVIDENCE/pagina-curta.png" pnpm --filter @atria/web exec playwright test src/shared/layout/sticky-page-header.e2e.ts --project=desktop -g 'cb11'`
  - Prova: numa página mais curta que a tela, não aparece rolagem e a barra lateral ocupa a altura da tela (CB-11).
  - Trecho: na imagem, a lista de notas vazia com "Nenhuma nota ainda", a sidebar de cima a baixo com o rodapé no fim da tela e nenhuma barra de rolagem; na saída, `1 passed`.
  - Falha: a sidebar mais curta que a tela, uma barra de rolagem ou a saída com `failed`.
  - Tempo-limite: 600
- `rolagem-firefox-zen.png` (manual): print do Zen, tirado pelo usuário, com a prévia do build e2e (`http://localhost:4173`, entrada por `/__test__/sign-in?role=user`) no `/finance` com algumas saídas, rolado até o fim.
  - Prova: no navegador do usuário, só a janela rola, a barra lateral e a topbar ficam fixas e o cabeçalho compacto cola na topbar com o fundo desfocado (CT-17, RNF-06).
  - Trecho: na imagem, uma única barra de rolagem na borda da janela, a sidebar inteira à esquerda, a topbar no topo e o título compacto logo abaixo dela.
  - Falha: duas barras de rolagem, a sidebar cortada ou a topbar fora do topo, ou uma faixa entre o cabeçalho e a topbar.
