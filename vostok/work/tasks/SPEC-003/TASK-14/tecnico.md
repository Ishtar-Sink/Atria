<!-- Escrito na finalização da tarefa. -->

## O que mudou

**Tipos e dados (`features/reader/use-highlights.ts`):**

- `HighlightColor` e `HIGHLIGHT_COLORS` saíram. A cor passa a ser `string` em `NewHighlight` e em `useChangeHighlightColor`.
- `HIGHLIGHT_PRESETS` guarda os cinco nomes antigos (`accent`, `primary`, `success`, `warning`, `info`) com o HEX de cada um, na mesma ordem dos atalhos, conforme a migração da TASK-06.
- `normalizeHex` faz `trim` e `toLowerCase`, para cumprir a regra de guardar `#rrggbb` em minúsculas (RN-09). `useCreateHighlight` e `useChangeHighlightColor` enviam a cor já normalizada.
- `highlightColorName(hex, t)` devolve o rótulo do atalho com o mesmo HEX, ou o próprio HEX em minúsculas.
- `useHighlightColorLabels()` devolve os rótulos de `ColorField` (de `@atria/ui`), no mesmo molde de `FormColor` (chaves `common.color_*`).

**Barra de seleção (`selection-toolbar.tsx`):**

- Os atalhos saem de `HIGHLIGHT_PRESETS`. Cada botão tem `data-color` e `--swatch-color` com o próprio HEX, e mantém o rótulo "Destacar em <nome>".
- Depois dos atalhos há o botão "Outra cor", que só aparece quando o destaque é permitido.
- `HighlightColorPanel` (exportado) é o painel com o `ColorField`, o botão "Destacar" (aplica `normalizeHex` do rascunho) e "Cancelar". O painel não cancela o `mousedown`, para os campos do seletor receberem o foco.

**Página do leitor (`reader-page.tsx`):** `highlightSelection(target, color)` substitui o antigo `highlight(color)`. Um estado `picking` guarda a seleção enquanto o painel está aberto. Isso é necessário porque abrir o diálogo desfaz a seleção do documento (`pdf-viewer.tsx`, `selectionchange`).

**Marca no PDF (`pdf-page.tsx`):** `data-color` continua com o HEX (o e2e procura por ele), e `--mark-color` é passado no `style`.

**Aba Destaques (`highlights-tab.tsx`):** o ponto recebe `--swatch-color` com o HEX do item. O nome vem de `highlightColorName`. Os atalhos marcam `aria-pressed` pela igualdade do HEX. Depois dos atalhos há um `ColorField` ("Outra cor") que envia o PATCH só quando a cor muda. Com destaque pendente (`temp-`), tudo fica dentro de um `fieldset disabled`.

**CSS (`reader.module.css`):** saíram as 15 regras `[data-color=…]` de `.mark`, `.swatch` e `.dot`. Essas classes leem `var(--mark-color)` e `var(--swatch-color)`, que chegam pelo `style`. Entraram `.highlightPicker` e `.pickerFieldset`. Não há cor literal no arquivo.

**Textos:** `reader/i18n/pt-br.json` ganhou as chaves de "Outra cor", do painel de cor e do seletor. As chaves dos atalhos foram mantidas.

**Testes e e2e:**

- `highlights-tab.test.tsx`: fixtures em HEX, troca pelos atalhos com o HEX no PATCH, troca pelo seletor (`pickHex`), nome do atalho para HEX de atalho, e axe com o seletor aberto.
- `selection-toolbar.test.tsx` (novo): atalhos com HEX, "Outra cor", painel com o seletor, e axe na barra e no painel.
- `reader.e2e.ts`: novo caso `CT-13`, que cria o destaque com `#DB2777`, confere a marca após recarregar e confere o item na aba Destaques.

**Scripts de evidência:**

- `evidence-reader.mjs`: grava em `$VOSTOK_EVIDENCE`. O `POST` de destaque é simulado. O modo `highlight-color` confere os atalhos e o axe nos dois temas, e grava o vídeo `reader-highlight-color.webm` da criação de um destaque em `#db2777`.
- `evidence-library.mjs`: fixtures em HEX e o modo `highlight-color`, que monta a prancha `highlights-color.png` com a troca de cor nos dois temas e larguras.

## Decisões

- Guardar e comparar sempre em `#rrggbb` minúsculo (RN-09). A normalização acontece na escrita, então a lista compara HEX com HEX.
- Cores de atalho viram nome só na apresentação. O dado guardado é o HEX, então um destaque de cor livre aparece com o próprio código.
- Nenhum seletor de CSS por nome de cor: a cor vai pela variável no `style`, seguindo [project/code-style-10].
- A seleção do PDF é guardada em `picking` antes de abrir o painel, porque o diálogo a desfaz.

## Verificação

Os comandos da Verificação são os testes do leitor com Vitest, os tipos do leitor, ESLint e Prettier, todos sem warnings. Os scripts de evidência rodam nos modos `highlight-color`.

Resultados registrados:

- Baseline: 5 comandos, com um de código 1, que a tarefa resolve.
- Testes: sem falhas.
- Regressão: 2 comandos iguais ao baseline, 2 com acréscimo e 1 mudança esperada.
- Evidências: houve dois erros automáticos no script de evidência antes da versão que passou. A evidência final tem 4 arquivos em `TASK-14/evidencias/`. O vídeo `reader-highlight-color.webm` (sha256 `667417af`) e a prancha `highlights-color.png` (sha256 `fd81f976`) foram conferidos pelo usuário.
- Ajuste: a Verificação desta tarefa confere os tipos só do leitor. As telas do Financeiro dependem das TASK-13 e TASK-15, e isso foi registrado no histórico de ajustes.
