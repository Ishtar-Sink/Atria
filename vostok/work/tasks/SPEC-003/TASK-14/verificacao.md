### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/reader --reporter=verbose 2>&1 | grep -E '^ +(✓|×|↓) ' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/reader --max-warnings 0` (muda): se o contrato regerado pela TASK-07 já tirou o tipo `HighlightColor`, a lint com tipos do leitor falha antes desta tarefa e passa depois, com a cor em `string`; se o tipo ainda existir, a saída fica igual.
- `pnpm --filter @atria/web exec prettier --check src/features/reader scripts/evidence-reader.mjs scripts/evidence-library.mjs`
- `node --check apps/web/scripts/evidence-reader.mjs && node --check apps/web/scripts/evidence-library.mjs && echo sintaxe-ok`
- `pnpm --filter @atria/web exec playwright test --list src/features/reader/reader.e2e.ts 2>&1 | grep -E '› ' | sed -E 's/\.ts:[0-9]+:[0-9]+ /.ts /' | sort`

### Verificação

```bash
# Cor do destaque: atalhos, color picker na barra de seleção e na aba Destaques (Vitest + Testing Library + axe)
# evidência: highlight-color-tests.txt
pnpm --filter @atria/web exec vitest run src/features/reader/selection-toolbar.test.tsx src/features/reader/highlights-tab.test.tsx --reporter=verbose
# O resto do leitor continua passando
pnpm --filter @atria/web exec vitest run src/features/reader
# Tipos, lint e formatação sem nenhum erro ou warning (scripts ficam fora do ESLint).
# Os tipos são conferidos só no leitor: as telas do Financeiro só batem com o contrato
# novo depois das TASK-13 e TASK-15 (decisão do usuário na execução da onda 8).
test "$(pnpm --filter @atria/web exec tsc --noEmit --pretty false 2>&1 | grep -E 'error TS' | grep -c '^src/features/reader/')" -eq 0
pnpm --filter @atria/web exec eslint src/features/reader --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/reader scripts/evidence-reader.mjs scripts/evidence-library.mjs
node --check apps/web/scripts/evidence-reader.mjs
node --check apps/web/scripts/evidence-library.mjs
# As cores por nome saíram do leitor: sem a lista antiga e sem seletor por nome ou cor literal no CSS
! grep -rnE "HIGHLIGHT_COLORS|\bHighlightColor\b" apps/web/src
! grep -nE "data-color='(accent|primary|success|warning|info)'|#[0-9a-fA-F]{3,6}\b|rgba?\(" apps/web/src/features/reader/reader.module.css
# O e2e do CT-13 está escrito e compila (roda contra o servidor real na integração)
# evidência: highlight-color-e2e-list.txt
pnpm --filter @atria/web exec playwright test --list src/features/reader/reader.e2e.ts
```

### Evidências

- `highlight-color-tests.txt` (automática, da verificação)
  - Prova: o destaque é criado por um atalho ou por uma cor livre do color picker e tem a cor trocada pelos atalhos ou pelo picker, sempre gravada como `#rrggbb` em minúsculas; o nome do atalho aparece para os HEX conhecidos e o HEX para os demais; sem violações no axe (RF-19, RN-09, CT-13, RNF-02).
  - Trecho: as linhas `✓` de `rf19 highlights with a preset hex color`, `rf19 opens the color panel from other color`, `rf19 highlights with the hex chosen in the color panel`, `rf19 has no axe violations in the toolbar and the color panel`, `rf19 changes the color of a highlight in the color picker`, `rf19 shows the preset name for a preset hex color`, `rf19 has no axe violations with the color picker open` e `rf32 changes the color of a book highlight`, e a linha `Tests` sem falhas.
  - Falha: `×`, `FAIL`, `failed` na linha `Tests`, `No test files found` ou algum desses nomes ausente.
  - Requer: `apps/web/src/features/reader/selection-toolbar.test.tsx`
- `highlight-color-e2e-list.txt` (automática, da verificação)
  - Prova: o e2e do CT-13 está escrito e compila; contra o servidor real (integração), ele cria o destaque com um HEX do picker e confere a marca no PDF com a cor, também depois de recarregar (RF-19, CT-13).
  - Trecho: as linhas com `CT-13 highlights with a hex color from the picker and marks the pdf with it` nos projetos listados e a linha `Total:`.
  - Falha: erro de compilação, `Error:` ou o caso CT-13 ausente.
- `reader-highlight-color.webm` (print): `node apps/web/scripts/evidence-reader.mjs highlight-color`
  - Prova: no leitor com o PDF de exemplo e a API simulada, a barra de seleção mostra os cinco atalhos na cor HEX e "Outra cor"; no vídeo, com o cursor visível, a pessoa seleciona um trecho, escolhe `#DB2777` no color picker e a marca aparece no PDF nessa cor; os temas claro e escuro passam no axe (RF-19, CT-13, RNF-02).
  - Trecho: as linhas `ok` de "cinco atalhos na cor HEX", "botão Destacar em outra cor", "POST com color #db2777", "marca na cor escolhida" e "axe sem violações", a linha `video:` e a última linha `ok  0 falha(s)`; no vídeo, o trecho selecionado, o diálogo "Escolher cor" e a marca rosa sobre o texto.
  - Falha: alguma linha `FALHA` (atalho sem a cor, POST com nome de cor ou HEX em maiúsculas, marca ausente ou transparente), a falta da linha `video:` ou código de saída diferente de 0.
- `highlights-color.png` (print): `node apps/web/scripts/evidence-library.mjs highlight-color`
  - Prova: a aba Destaques do livro mostra cada destaque com o ponto na cor HEX, o atalho da cor atual marcado e o color picker "Outra cor"; trocar para `#DB2777` no picker grava o HEX e atualiza o ponto e o nome; nos temas claro e escuro, em 1440 px e 360 px (RF-19, CT-13, RNF-02).
  - Trecho: as linhas `ok` de "ponto na cor do destaque", "atalho da cor atual marcado", "PATCH com color #db2777", "nome #db2777 no item", "sem rolagem horizontal" e "axe sem violações", a linha `png:` e a última linha `ok  0 falha(s)`; na prancha, os pontos coloridos e o picker aberto.
  - Falha: alguma linha `FALHA`, a falta da linha `png:` ou código de saída diferente de 0.
