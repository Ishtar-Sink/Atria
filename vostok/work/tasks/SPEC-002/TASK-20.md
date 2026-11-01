---
id: TASK-20
spec: SPEC-002
title: "Diário: emoções com ícone e linha do tempo"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-03, TASK-15]
wave: 4
covers: [RF-19, RF-20, RF-21, CT-18, CT-19, CT-20, CB-09]
type: historia
labels: [SPEC-002, padrao]
status: done
content_hash: 23d2f6b1f26f8a4fb63c56a458f22b9e9f6cca8bce6a5eae56b5e98e9c9eaaba
adjustments: 2
adjusted_at: 2026-11-01T13:37:38Z
approved_at: 2026-11-01T13:06:31Z
approved_hash: a89f582acf0c53d008c19535b587f3b2827abd6a9766e4260f5b8b0b9cf85319
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
updated_at: 2026-11-01T13:37:38Z
model: claude-sonnet-5-5
---

# TASK-20: Diário: emoções com ícone e linha do tempo

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md`: "Estado atual" (Diário), RF-19, RF-20, RF-21, CT-18, CT-19, CT-20, CB-09, RN-07, o contrato `GET/POST/PATCH /emotions` com o campo `icon` em "Contratos e interfaces" e a decisão 8 (resposta 8A) do "Registro de decisões".
- `vostok/work/tasks/SPEC-002/TASK-11.md`: o campo `icon` no servidor (texto livre ou lista de chaves aceitas e o código de erro de uma chave recusada).
- `vostok/work/tasks/SPEC-002/TASK-15.md`: os tipos gerados em `packages/contracts/src/schema.ts` (`EmotionResponse.icon`, pedidos de criar e renomear com `icon`).
- `vostok/work/tasks/SPEC-002/TASK-03.md` e `packages/ui/src/index.ts`: os ícones `ListIcon` e `TimelineIcon` e o `ViewSwitcher` com `icon` obrigatório.
- `vostok/rules/project/frontend.md`: [project/frontend-02], [project/frontend-08], [project/frontend-10], [project/frontend-12], [project/frontend-14] e [project/frontend-17].
- `vostok/rules/project/code-style.md`: [project/code-style-09] (lógica em hooks) e [project/code-style-10] (só tokens do tema).
- `vostok/rules/project/language.md`: [project/language-06] (textos em `i18n/pt-br.json`).
- `vostok/rules/project/testing.md`: [project/testing-04] e [project/testing-10].
- `prototype/atria-prototype.html` (linhas 562 a 576, CSS `.emo-*`; linhas 1369 a 1375, montagem do seletor): grade de 180 px, borda, `--primary-soft` quando marcada e os pontos de intensidade.
- `docs/decisoes-do-prototipo.md`: PD-55 (diário sem "Próximos 30 dias") e PD-62 (seletor de emoções).
- `apps/web/src/features/journal/emotion-picker.tsx`, `apps/web/src/features/journal/emotion-picker.module.css` e `apps/web/src/features/journal/emotion-picker.test.tsx`: o seletor atual (caixas de marcação em cartões de largura fixa).
- `apps/web/src/features/journal/emotions-page.tsx`, `apps/web/src/features/journal/emotions-page.module.css` e `apps/web/src/features/journal/emotions-page.test.tsx`: a tela de Emoções.
- `apps/web/src/features/journal/journal-list-page.tsx`, `apps/web/src/features/journal/journal-list-page.module.css` e `apps/web/src/features/journal/journal-list-page.test.tsx`: lista e linha do tempo.
- `apps/web/src/features/journal/use-emotions.ts`: `emotionLabel`, `useCreateEmotion` e `useRenameEmotion`.
- `apps/web/src/features/journal/journal-entry-form-page.test.tsx` (testes `creates an entry with date, time, text and two emotions` e `edits an existing entry`): usam o seletor.
- `apps/web/src/features/journal/i18n/pt-br.json`: chaves `journal.form.*`, `journal.list.*` e `journal.emotions.*`.
- `apps/web/src/features/reports/report-page.tsx` (fn `DownloadIcon`): molde do SVG em linha (24×24, `stroke="currentColor"`, `aria-hidden`, `focusable="false"`).
- `apps/web/src/features/journal/evidence/harness.tsx`: página de evidência das rotas do Diário (só leitura).
- `apps/web/scripts/evidence-journal.mjs`: molde do script de evidência (Vite numa porta livre, API simulada por `context.route`, `check()` com `ok`/`FALHA`, `baseChecks` com axe, prancha `sheet()`); ler por trecho: `startVite`, `installApi`, `openPage`, `baseChecks`, `gotoApp` e `sheet`.

### Mudar

- `apps/web/src/features/journal/emotion-icons.tsx` (criar): conjunto fixo de ícones de emoção, o ícone de cada chave do sistema, o ícone neutro e o campo de escolha do ícone (RF-19, CB-09).
- `apps/web/src/features/journal/emotion-picker.tsx` (alterar): cada emoção vira um botão alternável com ícone e nome; a intensidade de 1 a 5 só aparece depois de marcar (RF-20, RN-07).
- `apps/web/src/features/journal/emotion-picker.module.css` (alterar): grade sem sobreposição de nomes longos, botão marcado e pontos abaixo do botão (RF-20).
- `apps/web/src/features/journal/emotions-page.tsx` (alterar): ícone em cada linha e escolha do ícone da emoção personalizada, ao criar e depois (RF-19, CT-18).
- `apps/web/src/features/journal/emotions-page.module.css` (alterar): estilo do ícone na linha e do campo de ícones (RF-19).
- `apps/web/src/features/journal/use-emotions.ts` (alterar): `icon` no criar, `useSetEmotionIcon` e `emotionIconKey` para resolver o ícone (RF-19); necessário porque a lógica fica em hooks ([project/code-style-09]).
- `apps/web/src/features/journal/journal-list-page.tsx` (alterar): ícones no `ViewSwitcher` e cada entrada num cartão com as emoções com ícone e intensidade (RF-21).
- `apps/web/src/features/journal/journal-list-page.module.css` (alterar): linha do tempo com o cartão de cada entrada mantido e as emoções com ícone (RF-21).
- `apps/web/src/features/journal/i18n/pt-br.json` (alterar): nomes dos ícones, rótulo do campo de ícone, texto da intensidade na linha do tempo e textos da escolha de ícone ([project/language-06]).
- `apps/web/src/features/journal/emotion-icons.test.tsx` (criar): testes do conjunto de ícones e do campo de escolha.
- `apps/web/src/features/journal/emotion-picker.test.tsx` (alterar): testes do seletor com botões, mantendo os nomes dos testes existentes.
- `apps/web/src/features/journal/emotions-page.test.tsx` (alterar): testes da escolha de ícone e ajuste do teste que abria o seletor por caixa de marcação.
- `apps/web/src/features/journal/journal-list-page.test.tsx` (alterar): testes da linha do tempo em cartões com ícone e intensidade.
- `apps/web/src/features/journal/journal-entry-form-page.test.tsx` (alterar): os testes que marcavam emoções por `checkbox` passam a usar o botão alternável, mantendo os nomes.
- `apps/web/scripts/evidence-emotion-icons.mjs` (criar): vídeos do seletor e da tela de Emoções e print da linha do tempo, gravados no caminho recebido como argumento.

### Passos

1. Ler os arquivos de "Ler". Em `packages/contracts/src/schema.ts`, anotar o tipo de `EmotionResponse.icon` (esperado `icon?: string | null`) e o corpo aceito por `POST /emotions` e `PATCH /emotions/{id}`. Em `vostok/work/tasks/SPEC-002/TASK-11.md`, ver se o servidor aceita só uma lista de chaves: se aceitar, usar exatamente essa lista no passo 5 no lugar da lista abaixo, na mesma ordem; senão, usar a lista abaixo.
2. Acrescentar em `apps/web/src/features/journal/i18n/pt-br.json`: `emotions.icon_label` ("Ícone"), `emotions.icon_change` ("Trocar ícone"), `emotions.icon_change_item` ("Trocar o ícone de {name}"), `emotions.icon_save` ("Usar este ícone"), `emotions.icon.<chave>` para cada chave do passo 5 (`sun` "Sol", `rain` "Chuva", `flame` "Chama", `shield` "Escudo", `wave` "Onda", `leaf` "Folha", `heart` "Coração", `star` "Estrela", `moon` "Lua", `cloud` "Nuvem", `spark` "Brilho", `neutral` "Círculo"), `form.emotion_toggle` ("{emotion}", nome acessível do botão) e `list.emotion_intensity` ("{emotion}, intensidade {n} de 5"). Não remover chaves existentes.
3. Escrever os testes antes do código:
   - `emotion-icons.test.tsx` (novo, `describe('emotion icons')`): `maps every default emotion to its icon by system key`, `uses the chosen icon of a custom emotion`, `uses the neutral icon for a custom emotion without icon` (CB-09), `renders every icon as inline svg hidden from assistive tech`, `chooses an icon in the icon field by click and by arrow keys`, `has no axe violations`.
   - `emotion-picker.test.tsx`: nos testes existentes, trocar `getByRole('checkbox', { name })` por `getByRole('button', { name })` e `toBeChecked()` por `toHaveAttribute('aria-pressed', 'true')`, sem renomear nenhum teste; em `pd62 enables the intensity from 1 to 5 only after the emotion is marked`, conferir que o `radiogroup` "Intensidade de Alegria" não existe antes de marcar e aparece com os 5 rádios habilitados depois, e some ao desmarcar; em `pd62 shows the emotions as chips in a grid`, contar 3 botões em vez de 3 caixas; acrescentar `shows the icon of each emotion inside its button`, `keeps long names inside the button without overlapping the dots` (nome de 60 caracteres: o nome e o `radiogroup` ficam em elementos irmãos, o nome fora do grupo de pontos) e `saves an emotion without intensity` (RN-07).
   - `emotions-page.test.tsx`: em `adds a new emotion that appears in the picker`, trocar `findByRole('checkbox', { name: 'Orgulho' })` por `findByRole('button', { name: 'Orgulho' })`; acrescentar `shows the icon of each emotion in the list`, `creates a custom emotion with the chosen icon` (corpo do POST com `{ name: 'Orgulho', icon: 'star' }`), `changes the icon of a custom emotion` (PATCH com `{ icon: 'moon' }`), `does not offer the icon choice for a default emotion` e `shows the neutral icon for a custom emotion without icon` (CB-09).
   - `journal-list-page.test.tsx`: acrescentar `uses icons in the view switcher`, `shows each timeline entry in a card` (o `li` da entrada com `data-card="true"` também em `?view=timeline`) e `shows the icon and the intensity of each emotion in the timeline` (texto acessível "Ansiedade, intensidade 3 de 5" e um `svg` por emoção).
   - `journal-entry-form-page.test.tsx`: trocar `checkbox` por `button` com `aria-pressed` nos testes `creates an entry with date, time, text and two emotions` e `edits an existing entry`, sem renomeá-los.
4. Rodar `pnpm --filter @atria/web exec vitest run src/features/journal` e confirmar que os testes novos falham por falta da implementação.
5. Criar `apps/web/src/features/journal/emotion-icons.tsx`:
   - `export const EMOTION_ICON_KEYS = ['sun', 'rain', 'flame', 'shield', 'wave', 'leaf', 'heart', 'star', 'moon', 'cloud', 'spark', 'neutral'] as const;` e `export type EmotionIconKey = (typeof EMOTION_ICON_KEYS)[number];`.
   - `const SYSTEM_ICONS: Record<SystemEmotionKey, EmotionIconKey> = { joy: 'sun', sadness: 'rain', anger: 'flame', fear: 'shield', anxiety: 'wave', calm: 'leaf', gratitude: 'heart' };`.
   - `export function resolveEmotionIcon(emotion: { icon?: string | null; system_key?: SystemEmotionKey | null }): EmotionIconKey`: devolve `icon` se for uma chave de `EMOTION_ICON_KEYS`; senão o de `SYSTEM_ICONS[system_key]`; senão `'neutral'` (CB-09). Uma chave desconhecida vinda do servidor também cai no neutro.
   - `export function EmotionIcon({ icon }: { icon: EmotionIconKey })`: SVG 24×24 em linha, `width`/`height` 18, `fill="none"`, `stroke="currentColor"`, `strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `aria-hidden="true"`, `focusable="false"`, `data-icon={icon}`, no molde de `DownloadIcon`; um desenho simples por chave (sol com raios, nuvem com gotas, chama, escudo, duas ondas, folha, coração, estrela de 5 pontas, lua crescente, nuvem, brilho de 4 pontas e círculo).
   - `export function EmotionIconField({ label, value, onChange }: { label: string; value: EmotionIconKey; onChange: (icon: EmotionIconKey) => void })`: `fieldset` com `legend` e um `input type="radio"` visualmente escondido por chave, com `aria-label` de `journal.emotions.icon.<chave>`, cada um num `label` que mostra o `EmotionIcon`; setas mudam a escolha pelo comportamento nativo do grupo de rádios.
6. Alterar `apps/web/src/features/journal/use-emotions.ts`: `useCreateEmotion` passa a receber `{ name: string; icon: EmotionIconKey | null }` e envia `{ name, icon }`; o item temporário ganha `icon`; criar `useSetEmotionIcon()` (mesmo molde de `useRenameEmotion`, `PATCH /emotions/{id}` com `{ icon }` e aplicação otimista do `icon`); exportar `emotionIconKey(emotion, emotions?)`, que para um vínculo de entrada procura a emoção da lista por `emotion_id` e chama `resolveEmotionIcon` com o `icon` dela e a `system_key` do vínculo.
7. Reescrever `emotion-picker.tsx` mantendo `PickedEmotion`, `EmotionPickerProps` e o `fieldset` com `legend` e a dica: cada item é `<li className={styles.emo} data-on>` com um `<button type="button" className={styles.toggle} aria-pressed={on}>` contendo `EmotionIcon` (ícone de `resolveEmotionIcon`) e `<span className={styles.name}>` com o nome; só com a emoção marcada, abaixo do botão, o `radiogroup` "Intensidade de {emotion}" com os 5 rádios atuais (sem `disabled`); desmarcar remove a emoção e a intensidade. A intensidade continua opcional (RN-07).
8. Reescrever `emotion-picker.module.css` só com tokens: grade `repeat(auto-fill, minmax(calc(var(--space) * 45), 1fr))` como o protótipo; `.emo` em coluna (`flex-direction: column`, `align-items: stretch`, `gap: var(--s2)`); `.toggle` ocupa a largura do item, com `display: flex`, `gap: var(--s2)`, `min-height: calc(var(--space) * 11)`, borda `--border-strong`, fundo `--surface`, `text-align: start`, e `[aria-pressed='true']` com `--primary` e `--primary-soft`; `.name` com `overflow-wrap: anywhere` e `min-width: 0`, sem `white-space: nowrap` nem corte; foco visível com `outline: 2px solid var(--primary)`; transições só com `--motion-*`, sem `danger`.
9. Alterar `emotions-page.tsx`: cada linha mostra `EmotionIcon` antes do nome; o formulário de adicionar ganha `EmotionIconField` ("Ícone", começa em `neutral`) e envia `{ name, icon }`; nas emoções sem `system_key`, a linha ganha o botão "Trocar ícone" (`aria-label` "Trocar o ícone de {name}"), que abre na própria linha um `EmotionIconField` com o ícone atual, "Usar este ícone" (chama `useSetEmotionIcon`) e "Cancelar" (`common.cancel`); as emoções padrão não têm esse botão. Ajustar `emotions-page.module.css` (`.icon` alinhado ao nome, `.iconEdit` em linha com quebra), só com tokens.
10. Alterar `journal-list-page.tsx`: importar `ListIcon` e `TimelineIcon` de `@atria/ui` e passar `icon: <ListIcon />` e `icon: <TimelineIcon />` às opções do `ViewSwitcher`; o `li` de cada entrada ganha `data-card="true"`; a lista de emoções de cada entrada passa a mostrar, em cada `li`, `EmotionIcon` (por `emotionIconKey(item, emotions.data?.items)`), o nome e, quando há intensidade, os 5 pontos com os preenchidos até a intensidade, com o texto acessível `journal.list.emotion_intensity` num `span` visualmente escondido; o `Badge` sai dessa lista.
11. Alterar `journal-list-page.module.css`: em `.days[data-view='timeline'] .entry`, manter borda `--border`, raio `--radius-md` e fundo `--elevation-1` (o cartão), com o ponto do fio à esquerda do cartão; estilo de `.emotion` (ícone, nome e pontos em linha, com quebra) e do texto escondido, só com tokens; em 480 px, a linha do tempo continua sem rolagem horizontal.
12. Rodar `pnpm --filter @atria/web exec vitest run src/features/journal` até passar; depois `pnpm --filter @atria/web typecheck`, o ESLint e o Prettier da Verificação, sem nenhum warning.
13. Criar `apps/web/scripts/evidence-emotion-icons.mjs`, em Node sem dependências novas, com código próprio no molde de `apps/web/scripts/evidence-journal.mjs` (sem importá-lo): uso `node apps/web/scripts/evidence-emotion-icons.mjs <seletor|emocoes> <caminho.webm>` e `... linha-do-tempo <caminho.png>`; sobe o Vite numa porta livre com a página virtual que carrega `src/features/journal/evidence/harness.tsx` e encerra ao fim (KNW-006); simula a API com as fixtures do molde acrescidas de `icon` (as padrão com `icon: null` e "Saudade" personalizada sem ícone) e grava os corpos de POST e PATCH de `/emotions`; temas claro e escuro, em 1280 px e 360 px; confere no DOM antes de cada captura o tema, a falta de rolagem horizontal, a falta de erro de JS e o axe sem violações (inclui `color-contrast`), e mais:
    - `seletor` (`/journal/new`): marca "Ansiedade" pelo botão, escolhe "3 de 5"; confere `aria-pressed="true"`, que o `radiogroup` só existe na emoção marcada, que nenhum nome de emoção cruza a caixa dos pontos ou do item vizinho (`getBoundingClientRect`) e um `svg` em cada botão.
    - `linha-do-tempo` (`/journal?view=timeline`): confere que cada entrada tem borda e fundo de cartão (estilo computado), um `svg` por emoção e o texto "intensidade 3 de 5" na entrada com Ansiedade 3.
    - `emocoes` (`/journal/emotions`): confere o ícone neutro (`data-icon="neutral"`) em "Saudade", troca o ícone dela para "Estrela" e confere o PATCH com `{"icon":"star"}` e o `data-icon="star"` na linha; confere que as padrão não têm "Trocar ícone".
    O `seletor` e as `emocoes` também gravam um vídeo `.webm` em contexto à parte (`recordVideo` do Playwright, desktop 1280x800, tema claro, movimento normal, cursor visível no molde do modo `board-drag` de `apps/web/scripts/evidence-projects.mjs`, salvo com `page.video().saveAs(...)` depois de fechar o contexto), em ritmo de acompanhar: no `seletor`, marca "Ansiedade", a intensidade aparece e o mouse escolhe "3 de 5"; nas `emocoes`, troca o ícone da "Saudade" para "Estrela". As checagens dos dois temas e das duas larguras não gravam vídeo; a `linha-do-tempo`, sem interação, segue como prancha.
    Imprime `ok` ou `FALHA` por verificação, `video: <caminho>` nos vídeos ou, na linha do tempo, monta a prancha com as capturas rotuladas e imprime `png: <caminho> (N capturas)`, e a última linha `ok  0 falha(s)`; sai com código 1 se algo falhar.
14. Rodar os três comandos de "Evidências" com `VOSTOK_EVIDENCE` apontando para uma pasta temporária, corrigir o código da tarefa a cada `FALHA` e conferir os vídeos e a prancha.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/journal --reporter=verbose 2>/dev/null | grep -E '^ +(✓|×)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/journal --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/journal`

### Verificação

```bash
# evidência: journal-tests.txt
pnpm --filter @atria/web exec vitest run src/features/journal --reporter=verbose
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web exec eslint src/features/journal --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/journal scripts/evidence-emotion-icons.mjs
node --check apps/web/scripts/evidence-emotion-icons.mjs
```

### Evidências

- `journal-tests.txt` (automática, da verificação)
  - Prova: os testes do Diário passam, com os ícones por chave e o neutro, a escolha de ícone na tela de Emoções, o seletor com botões e intensidade só depois de marcar, sem intensidade também, e a linha do tempo em cartões com ícone e intensidade (RF-19, RF-20, RF-21, CT-18, CT-19, CT-20, CB-09).
  - Trecho: os arquivos `emotion-icons.test.tsx`, `emotion-picker.test.tsx`, `emotions-page.test.tsx` e `journal-list-page.test.tsx` aprovados, entre eles `uses the neutral icon for a custom emotion without icon`, `creates a custom emotion with the chosen icon` e `shows the icon and the intensity of each emotion in the timeline`, e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `emotion-picker.webm` (print): `node apps/web/scripts/evidence-emotion-icons.mjs seletor "$VOSTOK_EVIDENCE/emotion-picker.webm"`
  - Requer: `apps/web/scripts/evidence-emotion-icons.mjs`
  - Prova: o seletor do formulário de entrada mostra cada emoção como botão com ícone e nome, sem sobreposição a 360 px e a 1280 px, com a intensidade só na emoção marcada, nos temas claro e escuro (RF-20, CT-19).
  - Trecho: linhas `ok` de "botão marcado", "intensidade só na emoção marcada", "nomes sem sobreposição", "axe sem violações (inclui color-contrast)", a linha `video:` e a última `ok  0 falha(s)`; no vídeo, Ansiedade sendo marcada, os pontos de intensidade aparecendo e o "3 de 5" escolhido, com os nomes inteiros.
  - Falha: qualquer linha `FALHA` (nome cortado ou por cima dos pontos, pontos em emoção não marcada), a falta da linha `video:` ou código de saída diferente de 0.
- `journal-timeline.png` (print): `node apps/web/scripts/evidence-emotion-icons.mjs linha-do-tempo "$VOSTOK_EVIDENCE/journal-timeline.png"`
  - Requer: `apps/web/scripts/evidence-emotion-icons.mjs`
  - Prova: a linha do tempo mostra cada entrada num cartão, com o ícone e a intensidade de cada emoção, nos dois temas e nas duas larguras (RF-21, CT-20).
  - Trecho: linhas `ok` de "entrada em cartão", "ícone por emoção" e "intensidade 3 de 5", e `ok  0 falha(s)`; na prancha, os cartões ao longo do fio.
  - Falha: linha `FALHA` (entrada sem cartão, emoção sem ícone ou sem intensidade) ou código de saída diferente de 0.
- `emotions-icons.webm` (print): `node apps/web/scripts/evidence-emotion-icons.mjs emocoes "$VOSTOK_EVIDENCE/emotions-icons.webm"`
  - Requer: `apps/web/scripts/evidence-emotion-icons.mjs`
  - Prova: a tela de Emoções mostra o ícone de cada emoção, o neutro na personalizada sem ícone e grava o ícone escolhido (RF-19, CT-18, CB-09).
  - Trecho: linhas `ok` de "ícone neutro em Saudade", "PATCH com icon star", "ícone estrela na linha" e "padrão sem Trocar ícone", a linha `video:` e a última `ok  0 falha(s)`; no vídeo, o ícone da Saudade passando do neutro para a estrela.
  - Falha: linha `FALHA`, PATCH sem `icon`, a falta da linha `video:` ou código de saída diferente de 0.

### Concluída quando

- [x] Cada emoção tem um ícone: as padrão pelo `system_key`, as personalizadas pelo ícone escolhido na tela de Emoções, e a personalizada sem ícone mostra o neutro (RF-19, CT-18, CB-09).

  > Como comprovar: em `journal-tests.txt`, ver aprovados os testes de `emotion-icons.test.tsx` e `creates a custom emotion with the chosen icon`, `changes the icon of a custom emotion` e `shows the neutral icon for a custom emotion without icon`; no vídeo `emotions-icons.webm`, ver a Saudade com o neutro e depois com a estrela.

- [x] O seletor mostra cada emoção como botão com ícone e nome, sem sobreposição em nomes longos, e a intensidade de 1 a 5 só depois de marcar; sem intensidade também grava (RF-20, CT-19, RN-07).

  > Como comprovar: em `journal-tests.txt`, ver aprovados `pd62 enables the intensity from 1 to 5 only after the emotion is marked`, `keeps long names inside the button without overlapping the dots` e `saves an emotion without intensity`; no vídeo `emotion-picker.webm`, ver a emoção marcada, a intensidade aparecendo e sendo escolhida; nas linhas de "nomes sem sobreposição" a 360 px e a 1280 px, conferir que nenhum nome passa por cima dos pontos.

- [x] A linha do tempo mostra cada entrada num cartão, com o ícone e a intensidade de cada emoção, e o seletor de visualização usa ícones (RF-21, CT-20).

  > Como comprovar: em `journal-tests.txt`, ver aprovados `shows each timeline entry in a card`, `shows the icon and the intensity of each emotion in the timeline` e `uses icons in the view switcher`; na prancha `journal-timeline.png`, ver os cartões com os ícones e os pontos de intensidade.

- [x] As telas do Diário não têm violações no axe, funcionam pelo teclado e nos dois temas a partir de 360 px (RNF-03, [project/frontend-10], [project/frontend-17]).

  > Como comprovar: ver aprovados os testes `has no axe violations` e `is operable by keyboard only`; nas três execuções, só linhas `ok`, incluindo "axe sem violações" e "sem rolagem horizontal", e a última `ok  0 falha(s)`.

- [x] Testes, typecheck, ESLint e Prettier passam sem warning.

  > Como comprovar: rodar a Verificação e ver que termina sem erro.

## Descrição

### Resumo executivo

Dá a cada emoção do Diário um ícone e refaz o seletor de emoções: cada emoção vira um botão com ícone e nome, e a intensidade só aparece depois de marcar.
A linha do tempo passa a mostrar cada entrada num cartão, com o ícone e a intensidade de cada emoção, e a pessoa escolhe o ícone das emoções que criou.
Resolve os relatos de nomes sobrepostos no seletor e da linha do tempo sem cartão e sem intensidade.
Perfil padrão, risco baixo: só tela, sobre o campo de ícone já criado no servidor e no contrato.
Depende do contrato gerado e dos ícones compartilhados; não bloqueia outras tarefas.

### Detalhes técnicos

- **Abordagem:** um módulo `emotion-icons.tsx` concentra o conjunto fixo de chaves, o desenho de cada ícone, a resolução do ícone (`icon` válido, senão o da `system_key`, senão o neutro) e o campo de escolha; o seletor, a tela de Emoções e a linha do tempo só consomem esse módulo. A lógica de dados (criar com ícone, trocar ícone, achar o ícone de um vínculo de entrada pela lista de emoções) fica em `use-emotions.ts`.
- **Componentes:** `emotion-icons.tsx` (novo), `emotion-picker.tsx` e CSS, `emotions-page.tsx` e CSS, `journal-list-page.tsx` e CSS, `use-emotions.ts` e `i18n/pt-br.json`; usa `ListIcon`, `TimelineIcon` e `ViewSwitcher` da `@atria/ui` (TASK-03) e o campo `icon` de `EmotionResponse` (TASK-11, TASK-15).
- **Decisões:**
  - Botão alternável com `aria-pressed` para cada emoção (RF-20, "botão com ícone e nome"); descartada a caixa de marcação atual estilizada como botão, porque o pedido é um botão e a caixa dentro do cartão de largura fixa é a causa da sobreposição.
  - Intensidade renderizada só com a emoção marcada; descartados os pontos desabilitados sempre visíveis (estado atual), que dividem a largura com o nome.
  - Ícone do vínculo da entrada resolvido pela lista de emoções (`emotion_id`); descartado pedir `icon` no vínculo de `journal-entries`, que o contrato da spec não muda.
  - Chave desconhecida vinda do servidor cai no ícone neutro, como a emoção sem ícone (CB-09); descartado erro na tela.
  - Ícones desenhados no próprio módulo, em SVG em linha ([project/frontend-08]); descartada biblioteca de ícones ([project/stack-12]).
  - Escolha de ícone só nas emoções personalizadas (RF-19, decisão 8A); as padrão seguem pela `system_key`.
  - `use-emotions.ts` e `i18n/pt-br.json` entram em "Mudar" além dos componentes do plano porque a criação com ícone, a troca de ícone e os textos novos não cabem nos arquivos de tela ([project/code-style-09], [project/language-06]).
- **Riscos:** a lista de chaves precisa bater com a do servidor se a TASK-11 validar as chaves (passo 1 manda usar a dela); os testes que marcavam emoções por `checkbox` mudam de corpo, mas mantêm os nomes para o baseline comparar.
- **Referências da spec:** RF-19, RF-20, RF-21, CT-18, CT-19, CT-20, CB-09, RN-07, contrato `GET/POST/PATCH /emotions` com `icon`, decisão 8 (resposta 8A); protótipo PD-62 e PD-55.
- **Evidências visuais:** dois vídeos (seletor e tela de Emoções) e um print (linha do tempo) gerados por `apps/web/scripts/evidence-emotion-icons.mjs` sobre o harness do Diário, conferidos pelo usuário na finalização.
- **Arquivos em comum na onda 4:** nenhum.

### Card

- **Título:** Diário: emoções com ícone e linha do tempo
- **Tipo:** historia
- **Descrição:** Emoções do Diário com ícone, seletor de emoções com botões e intensidade depois de marcar, escolha de ícone na tela de Emoções e linha do tempo em cartões com ícone e intensidade.
- **Critérios de aceite:**
  - [ ] Emoções padrão com ícone pela chave, personalizadas com o ícone escolhido e neutro quando não há ícone.
  - [ ] Seletor com botões de ícone e nome, sem sobreposição, e intensidade só depois de marcar.
  - [ ] Linha do tempo com cada entrada num cartão, com ícone e intensidade das emoções.
  - [ ] Sem violações no axe, pelo teclado, nos dois temas e a partir de 360 px.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-03, TASK-15

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T13:06:31Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 3 comando(s); códigos de saída: 0, 0, 0 |
| 3 | 2026-11-01 | ajuste | in_progress | Evidências do seletor e da tela de Emoções passam a vídeo .webm (recordVideo, desktop 1280x800, tema claro, cursor visível); linha do tempo segue como print; passo do script, Evidências e Como comprovar atualizados |
| 4 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 5 | 2026-11-01 | regressão | passed | 2 comando(s) iguais ao baseline; 1 com acréscimo |
| 6 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 7 | 2026-11-01 | conferência | usuário | print emotion-picker.webm conferido pelo usuário (sha256 f5a7ffb5) |
| 8 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 9 | 2026-11-01 | conferência | usuário | print journal-timeline.png conferido pelo usuário (sha256 4377c8b8) |
| 10 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 11 | 2026-11-01 | conferência | usuário | print emotions-icons.webm conferido pelo usuário (sha256 fcad5eb3) |
| 12 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 13 | 2026-11-01 | conferência | usuário | print emotion-picker.webm conferido pelo usuário (sha256 c1d6b5a6) |
| 14 | 2026-11-01 | conferência | usuário | print journal-timeline.png conferido pelo usuário (sha256 4377c8b8) |
| 15 | 2026-11-01 | conferência | usuário | print emotions-icons.webm conferido pelo usuário (sha256 07aace85) |
| 16 | 2026-11-01 | evidências | passed | 4 evidência(s) em evidence/TASK-20/ |
| 17 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | ESLint da Verificação sem o script de evidência, que o eslint.config.js do web ignora (o aviso de arquivo ignorado virava erro com --max-warnings 0); o script segue conferido por node --check e Prettier |
| 2 | 2026-11-01 | agente | Evidências do seletor e da tela de Emoções passam a vídeo .webm (recordVideo, desktop 1280x800, tema claro, cursor visível); linha do tempo segue como print; passo do script, Evidências e Como comprovar atualizados |
