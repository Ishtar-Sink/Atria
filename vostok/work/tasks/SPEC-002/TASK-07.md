---
id: TASK-07
spec: SPEC-002
title: "Configurações: tema e espaçamento"
profile: padrao
persona: desenvolvedor
depends_on: []
wave: 1
covers: [RF-17, RF-18, CT-16, CT-17, CB-08]
type: bug
labels: [SPEC-002, padrao]
status: done
content_hash: f22a3113ddc04d35015b58c4720deea871c779733006c24da3968b029a2b26de
adjustments: 1
adjusted_at: 2026-11-01T09:18:59Z
approved_at: 2026-11-01T02:17:06Z
approved_hash: 490701b0fff7328b3e0e8d0a56c830e21ef50bacba9d05b516dca0accfdc0f97
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
updated_at: 2026-11-01T09:18:59Z
---

# TASK-07: Configurações: tema e espaçamento

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md` (Estado atual "Tema (Bug 14)"; RF-17, RF-18; CT-16, CT-17; CB-08; RN-06; decisão 13, inferência E)
- `prototype/atria-prototype.html` (função `renderSettings`, perto da linha 2464: cada grupo é um `<section class="card form">` com `<h2 class="section-title">`, dentro de um `.stack` com `gap: var(--s4)`; regras `.card`, `.stack` e `.section-title` no `<style>`)
- `docs/decisoes-do-prototipo.md` (PD-19, PD-23 e PD-62: coluna do formulário, Configurações pelo menu do perfil e campos da base)
- `apps/web/src/app/theme/theme-provider.tsx`
- `apps/web/src/app/theme/theme-provider.test.tsx`
- `apps/web/src/app/providers.tsx`
- `apps/web/src/app/layout/sidebar.tsx` (fn `Sidebar`, item `theme` de `menu_items`)
- `apps/web/src/app/layout/app-layout.test.tsx` (teste `opens the account menu with Configurações, Alternar tema and Sair`)
- `apps/web/src/features/settings/use-user-preferences.ts`
- `apps/web/src/features/settings/user-preferences-page.tsx`
- `apps/web/src/features/settings/user-preferences-page.test.tsx`
- `apps/web/src/features/settings/instance-settings-page.tsx`
- `apps/web/src/features/settings/instance-settings-page.test.tsx`
- `apps/web/src/features/settings/settings.module.css`
- `apps/web/src/features/settings/test-support.tsx` (stub da API usado pelos testes de Configurações)
- `apps/web/src/features/settings/i18n/pt-br.json` (só leitura: as chaves `section_preferences`, `section_instance`, `smtp` e `roles` já existem e servem de título dos cartões)
- `apps/web/src/features/command-palette/use-palette-search.ts` (só leitura: já lê `GET /me/preferences` com a mesma chave `['me', 'preferences']`)
- `apps/web/src/shared/test/setup.ts` (fn `setPrefersDark`)
- `packages/ui/src/form-layout/form-layout.module.css` (o `FormGrid` já é um cartão: fundo, borda, raio e 20 px de respiro)
- `apps/web/scripts/evidence-settings.mjs` (fns `mockApi`, `openPage`, `runScenarios`, `sheet`, objeto `scenarios` e `EVIDENCES`)
- `vostok/rules/project/frontend.md` ([project/frontend-01], [project/frontend-04], [project/frontend-18])
- `vostok/rules/project/code-style.md` ([project/code-style-09], [project/code-style-10])

### Mudar

- `apps/web/src/app/theme/theme-provider.tsx` (alterar): guardar o modo (`light`, `dark` ou `system`) em vez de um tema fixo, resolver o tema pelo sistema em tempo real no modo `system` e expor `mode`, `setMode` e `toggleTheme` que devolve o tema novo (RF-17, CB-08).
- `apps/web/src/app/theme/theme-provider.test.tsx` (alterar): testes do modo `system` gravado e acompanhando o sistema, e do `toggleTheme` que devolve o tema novo.
- `apps/web/src/app/providers.tsx` (alterar): montar `ServerTheme` dentro do `ThemeProvider`, para aplicar a preferência do servidor ao abrir o app (RN-06).
- `apps/web/src/app/layout/sidebar.tsx` (alterar): o item "Alternar tema" do menu do perfil grava a preferência no servidor (RF-17).
- `apps/web/src/app/layout/app-layout.test.tsx` (alterar): teste de que "Alternar tema" envia `PATCH /me/preferences`.
- `apps/web/src/features/settings/use-user-preferences.ts` (alterar): `useApplyTheme` passa a aplicar o modo (inclusive `system`) sem gravar valor fixo; novos `useServerTheme` e `useToggleThemePreference`.
- `apps/web/src/features/settings/user-preferences-page.tsx` (alterar): título "Suas preferências" no cartão e o tema aplicado pelo modo.
- `apps/web/src/features/settings/user-preferences-page.test.tsx` (alterar): testes da preferência do servidor prevalecendo, de abrir Configurações sem mudar o tema, de "Seguir o sistema" em tempo real e do cartão com título.
- `apps/web/src/features/settings/instance-settings-page.tsx` (alterar): grupos da aba Instância em três cartões com título (Instância, E-mail (SMTP) e Papéis), empilhados com o espaçamento do protótipo (RF-18).
- `apps/web/src/features/settings/instance-settings-page.test.tsx` (alterar): teste dos três cartões com título.
- `apps/web/src/features/settings/settings.module.css` (alterar): pilha de cartões com `gap: var(--s4)` e título de seção no tamanho do protótipo.
- `apps/web/scripts/evidence-settings.mjs` (alterar): grava a prancha em `$VOSTOK_EVIDENCE` (padrão `vostok/work/tasks/SPEC-002/evidence/TASK-07`), confere os cartões com título e ganha a evidência `tema`.
- `apps/web/src/features/auth/test-server.ts` (alterar): o `mockApi` deixa de registrar em `calls` a leitura `GET /me/preferences` que o `ServerTheme` faz ao abrir o app.
- `apps/web/src/features/connections/connections-tab.test.tsx` (alterar): o stub de `fetch` responde `GET /api/v1/me/preferences` sem registrar a chamada.
- `apps/web/src/features/connections/use-linked-titles.test.tsx` (alterar): o mesmo no stub de `fetch`.
- `apps/web/src/features/reports/exports-page.test.tsx` (alterar): o mesmo no stub de `fetch`.
- `apps/web/src/features/goals/hooks/use-goals.test.tsx` (alterar): o mesmo no stub de `fetch`.
- `apps/web/src/features/notes/hooks/use-notes.test.tsx` (alterar): o mesmo no stub de `fetch`.

### Passos

1. Leia os arquivos de "Ler". Anote que o `FormGrid` da `@atria/ui` já desenha um cartão (fundo `--elevation-1`, borda, raio e `padding: var(--s5)`), que a paleta de comandos já consulta `GET /me/preferences` com a chave `['me', 'preferences']` (a mesma de `PREFERENCES_KEY`) e que `setPrefersDark(true|false)` de `apps/web/src/shared/test/setup.ts` simula a troca do tema do sistema nos testes.
2. Em `apps/web/src/app/theme/theme-provider.test.tsx`, escreva antes do código os testes `saves the system mode and follows the system without a fixed theme` (um `Probe` chama `setMode('system')`: `localStorage.getItem('atria_theme')` vira `'system'`; com `setPrefersDark(true)` o `data-theme` do `<html>` vira `dark` e com `setPrefersDark(false)` volta a `light`, sem recarregar) e `returns the next theme from toggleTheme` (com o tema `light`, `toggleTheme()` devolve `'dark'`). Mantenha os quatro testes que já existem, com os mesmos nomes. Rode `pnpm --filter @atria/web exec vitest run src/app/theme` e confirme que os novos falham.
3. Em `apps/web/src/app/theme/theme-provider.tsx`:
   - exporte `type ThemeMode = Theme | 'system'`;
   - `readSaved()` passa a devolver `ThemeMode | undefined`, aceitando `'light'`, `'dark'` e `'system'`; `saveChoice(mode: ThemeMode)` grava o modo em `atria_theme` (o valor só evita o piscar ao abrir, RN-06);
   - o estado vira `const [mode, setModeState] = useState<ThemeMode>(() => readSaved() ?? 'system')`, e `const theme = mode === 'system' ? system : mode`; o efeito que escreve `document.documentElement.dataset['theme']` e o que escuta `prefers-color-scheme` continuam;
   - `setMode(next: ThemeMode)` grava e muda o estado; `setTheme(next: Theme)` continua existindo e chama `setMode(next)`; `toggleTheme(): Theme` calcula `const next = theme === 'dark' ? 'light' : 'dark'`, chama `setMode(next)` e devolve `next`;
   - `ThemeValue` passa a ser `{ theme: Theme; mode: ThemeMode; setMode: (mode: ThemeMode) => void; setTheme: (theme: Theme) => void; toggleTheme: () => Theme }`, e o contexto padrão ganha `mode: 'system'`, `setMode: () => undefined` e `toggleTheme: () => 'light'`.
   Rode de novo os testes de `src/app/theme` até passarem.
4. Em `apps/web/src/features/settings/user-preferences-page.test.tsx`, escreva antes do código, com o stub de `test-support.tsx`:
   - `applies the server theme on open over the browser saved theme`: `localStorage` com `atria_theme` = `light`, servidor com `theme: 'dark'`; ao montar a página, `data-theme` fica `dark` (RN-06);
   - `does not change the theme when opening settings`: `atria_theme` = `light`, servidor com `theme: 'light'` e `setPrefersDark(true)`; ao montar, `data-theme` continua `light` e nenhum `PATCH /me/preferences` é enviado (CT-16);
   - `follows the system at once with Seguir o sistema`: com o servidor em `light`, marcar "Seguir o sistema" no grupo "Tema" envia `PATCH /me/preferences` com `{ theme: 'system' }`, grava `atria_theme` = `system`, e `setPrefersDark(true)` troca `data-theme` para `dark` sem remontar (CT-16, CB-08);
   - `shows the preferences in a card titled Suas preferências`: existe um `heading` de nível 2 "Suas preferências" dentro do formulário "Suas preferências" (RF-18).
   Mantenha os testes existentes com os mesmos nomes; ajuste só as asserções que dependiam de gravar um tema fixo.
5. Em `apps/web/src/features/settings/use-user-preferences.ts`:
   - `useUserPreferences(enabled = true)` passa o `enabled` ao `useQuery` (o resto igual);
   - `useApplyTheme` deixa de receber parâmetro e de ter efeito: devolve `apply(value: string | undefined)`, que chama `setMode(value)` do `useTheme()` quando `value` é `'light'`, `'dark'` ou `'system'` e não faz nada nos outros casos;
   - nova `useServerTheme()`: lê `useCurrentUser()` (de `../../shared/session/current-user`), chama `useUserPreferences(Boolean(user))` e, num efeito sobre `data?.theme`, aplica o modo com `apply`; é a fonte única do tema (RF-17), e quando uma mutação é recusada o cache volta ao valor anterior e o efeito devolve o tema;
   - nova `useToggleThemePreference()`: usa `toggleTheme` do `useTheme()` e `useUpdatePreferences()`, e devolve uma função que chama `const next = toggleTheme()` e `update.mutate({ theme: next })`.
6. Em `apps/web/src/app/providers.tsx`, crie no arquivo `function ServerTheme() { useServerTheme(); return null; }` (importando `useServerTheme` de `../features/settings/use-user-preferences`) e renderize `<ServerTheme />` como primeiro filho do `<ThemeProvider>`, antes do `<ScreenInfoProvider>`.
7. Em `apps/web/src/features/settings/user-preferences-page.tsx`, troque `const applyTheme = useApplyTheme(data?.theme)` por `const applyTheme = useApplyTheme()` (o efeito de sincronizar fica no `ServerTheme`) e acrescente como primeiro filho do `FormGrid` um `<h2 className={styles.sectionTitle} data-span="full">{t('settings.section_preferences')}</h2>`. Rode `pnpm --filter @atria/web exec vitest run src/features/settings` até passar.
8. Em `apps/web/src/app/layout/app-layout.test.tsx`, escreva antes do código `saves the theme toggle in the server preference`: com o stub de `fetch` do arquivo respondendo `GET /me`, `GET /me/preferences` (`theme: 'light'`) e `PATCH /me/preferences`, abrir o menu do perfil e escolher "Alternar tema" deixa `data-theme` em `dark` e envia `PATCH /me/preferences` com `{ theme: 'dark' }`. Em `apps/web/src/app/layout/sidebar.tsx`, troque `const { toggleTheme } = useTheme()` por `const toggleTheme = useToggleThemePreference()` (de `../../features/settings/use-user-preferences`) e retire o import de `useTheme` se ele ficar sem uso. Rode `pnpm --filter @atria/web exec vitest run src/app/layout` até passar.
9. Em `apps/web/src/features/settings/instance-settings-page.test.tsx`, escreva antes do código `separates access, e-mail and roles in titled cards`: há três `heading` de nível 2, "Instância", "E-mail (SMTP)" e "Papéis", cada um num contêiner diferente com a classe do `FormGrid`, e "Cadastro só com convite" fica no cartão "Instância" (RF-18, CT-17).
10. Em `apps/web/src/features/settings/instance-settings-page.tsx`, no retorno final:
    - troque o `<div>` externo por `<div className={styles.stack}>`;
    - o `<form aria-label={t('settings.section_instance')}>` continua (o nome "Instância" é usado pelos testes e pela evidência) e recebe `className={styles.stack}`; dentro dele, um primeiro `<FormGrid>` com `<h2 className={styles.sectionTitle} data-span="full">{t('settings.section_instance')}</h2>` e os dois grupos de caixa (convite e Web Push); um segundo `<FormGrid>` com o `<h2>` de `t('settings.smtp')`, os quatro campos SMTP, a dica da senha, o erro de validação e o `FormActions`;
    - a `<section aria-labelledby="settings-roles">` dos papéis fica depois do formulário, como está.
    Não mude a lógica de salvar nem os textos.
11. Em `apps/web/src/features/settings/settings.module.css`, acrescente `.stack { display: flex; flex-direction: column; gap: var(--s4); min-width: 0; }` e mude `.sectionTitle` para `margin: 0 0 var(--s3); font-family: var(--font-display); font-size: var(--font-size-xl); font-weight: 700; letter-spacing: -0.5px;` (20 px do protótipo arredondado ao token `--font-size-xl`). Só tokens do tema, nenhum valor literal de cor, raio ou espaço. As abas Busca e Dashboard já são um cartão cada, com o título da aba; elas ganham o novo `.sectionTitle` só pelo CSS e não mudam de estrutura.
12. Em `apps/web/scripts/evidence-settings.mjs`:
    - troque a constante `OUT` por `const OUT = process.env.VOSTOK_EVIDENCE ?? join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-002', 'evidence', 'TASK-07');` e atualize o comentário do topo e os títulos das pranchas para "TASK-07 (SPEC-002)";
    - em `mockApi`, aceite a opção `server_theme` (padrão: o mesmo `theme`) para o `theme` inicial de `prefs`, e em `openPage` repasse `server_theme` e uma opção `prefers` (`'light'` ou `'dark'`, padrão igual a `theme`) para `colorScheme` de `browser.newContext`;
    - no cenário `preferências`, acrescente `check(`${tag}: cartão com o título "Suas preferências"`, ...)` conferindo que `page.getByRole('heading', { level: 2, name: 'Suas preferências' })` está visível;
    - no cenário `instância`, acrescente `check(`${tag}: três cartões com título e 16 px entre eles`, ...)`: os `h2` "Instância", "E-mail (SMTP)" e "Papéis" estão visíveis e, medindo `getBoundingClientRect()` do `closest('[class*="grid"]')` de cada título, o espaço vertical entre um cartão e o seguinte fica entre 15 e 17 px;
    - acrescente em `scenarios` o grupo `tema` com dois cenários, rodados em desktop e 360 px nos dois temas: `abrir Configurações não muda o tema` (`theme` do navegador igual ao do servidor, `prefers` oposto; ao abrir `/settings`, `document.documentElement.dataset.theme` continua o tema do servidor e a lista `patches` fica vazia) e `Seguir o sistema acompanha o sistema` (marcar o rádio "Seguir o sistema" com `check({ force: true })`, conferir um `PATCH` para `/me/preferences`, chamar `page.emulateMedia({ colorScheme: 'dark' })` e esperar `data-theme` = `dark`, depois `'light'` e esperar `light`, capturando a tela no fim); e um cenário `alternar tema grava no servidor` (abre o menu do perfil, clica "Alternar tema" e confere o `PATCH` em `/me/preferences` e o `data-theme` trocado);
    - registre em `EVIDENCES` a chave `tema`, que roda o grupo `tema` e grava `settings-tema.png`, e atualize a mensagem de uso para "Use temas, estados ou tema".
13. Rode o bloco de "Verificação" e corrija até passar sem warnings. Depois rode `node apps/web/scripts/evidence-settings.mjs temas` e `node apps/web/scripts/evidence-settings.mjs tema`, corrija o código da tarefa a cada linha `FALHA` até a última linha ser `ok  0 falha(s)` e abra as pranchas para conferir os cartões, os temas e as larguras. Apague a pasta `vostok/work/tasks/SPEC-002/evidence/TASK-07` só se ela não tiver sido criada pelo `vostok`.
14. Com o `ServerTheme` no `AppProviders`, toda tela montada com sessão lê `GET /me/preferences`, e onze testes que conferem a lista exata de chamadas passam a ver essa leitura a mais. Nos stubs de `fetch` de `connections-tab.test.tsx`, `use-linked-titles.test.tsx`, `exports-page.test.tsx`, `use-goals.test.tsx` e `use-notes.test.tsx`, logo depois do tratamento de `/api/v1/me`, acrescente `if (url.pathname === '/api/v1/me/preferences')` respondendo `{ theme: 'system' }` com status 200, sem registrar a chamada. Em `apps/web/src/features/auth/test-server.ts`, registre a chamada em `calls` só quando `path !== '/me/preferences'`, mantendo a resposta. Não mude as asserções nem os nomes dos testes. Rode `pnpm --filter @atria/web exec vitest run` e confirme `0 failed` em `Test Files`.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/app/theme src/app/layout src/features/settings --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec vitest run 2>&1 | grep -E "Test Files" | grep -oE "[0-9]+ failed" || echo "0 failed"`
- `pnpm --filter @atria/web exec eslint src/app/theme src/app/layout/sidebar.tsx src/app/layout/app-layout.test.tsx src/app/providers.tsx src/features/settings --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/app/theme src/app/layout/sidebar.tsx src/app/layout/app-layout.test.tsx src/app/providers.tsx src/features/settings scripts/evidence-settings.mjs 2>&1 | tail -1`
- `pnpm --filter @atria/web typecheck`
- `node --check apps/web/scripts/evidence-settings.mjs && echo sintaxe-ok`

### Verificação

```bash
# Testes do tema, da barra lateral e de Configurações (Vitest + Testing Library + axe)
# evidência: tema-testes.txt
pnpm --filter @atria/web exec vitest run src/app/theme src/app/layout src/features/settings --reporter=verbose
# Suíte inteira do web: a leitura da preferência ao abrir não quebra os testes de outras telas
pnpm --filter @atria/web exec vitest run
# Lint, formatação e tipos sem nenhum erro ou warning
pnpm --filter @atria/web exec eslint src/app/theme src/app/layout/sidebar.tsx src/app/layout/app-layout.test.tsx src/app/providers.tsx src/features/settings src/features/auth/test-server.ts src/features/connections src/features/reports/exports-page.test.tsx src/features/goals/hooks/use-goals.test.tsx src/features/notes/hooks/use-notes.test.tsx --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/app/theme src/app/layout/sidebar.tsx src/app/layout/app-layout.test.tsx src/app/providers.tsx src/features/settings scripts/evidence-settings.mjs src/features/auth/test-server.ts src/features/connections src/features/reports/exports-page.test.tsx src/features/goals/hooks/use-goals.test.tsx src/features/notes/hooks/use-notes.test.tsx
pnpm --filter @atria/web typecheck
node --check apps/web/scripts/evidence-settings.mjs
# Nenhuma cor literal no CSS de Configurações
! grep -nE '#[0-9a-fA-F]{3,6}\b|rgba?\(' apps/web/src/features/settings/settings.module.css
```

### Evidências

- `tema-testes.txt` (automática, da verificação)
  - Prova: a preferência do servidor é a fonte única do tema, abrir Configurações não muda o tema, "Seguir o sistema" acompanha o sistema na hora, o botão da barra lateral grava a preferência e as abas têm cartões com título (RF-17, RF-18, CT-16, CT-17, CB-08, RN-06).
  - Trecho: as linhas `✓` de `saves the system mode and follows the system without a fixed theme`, `returns the next theme from toggleTheme`, `applies the server theme on open over the browser saved theme`, `does not change the theme when opening settings`, `follows the system at once with Seguir o sistema`, `shows the preferences in a card titled Suas preferências`, `saves the theme toggle in the server preference` e `separates access, e-mail and roles in titled cards`, e o resumo sem falhas.
  - Falha: `FAIL`, `×` em algum teste, ou um desses nomes ausente.
- `settings-themes-widths.png` (print): `node apps/web/scripts/evidence-settings.mjs temas`
  - Prova: as abas de Configurações com os grupos em cartões com título e o espaçamento do protótipo, nos dois temas, em desktop e em 360 px (RF-18, CT-17, RNF-02, RNF-03).
  - Trecho: as linhas `ok ... cartão com o título "Suas preferências"` e `ok ... três cartões com título e 16 px entre eles`, `ok ... axe sem violações` em cada captura, a linha `png:` e a última linha `ok  0 falha(s)`; na imagem, a aba Instância com os cartões "Instância", "E-mail (SMTP)" e "Papéis" separados.
  - Falha: qualquer linha `FALHA`, a ausência da linha `png:`, código de saída diferente de 0 ou, na imagem, grupos colados num cartão só.
- `settings-tema.png` (print): `node apps/web/scripts/evidence-settings.mjs tema`
  - Prova: no app montado, abrir Configurações mantém o tema, "Seguir o sistema" troca o tema quando o sistema muda, sem recarregar, e "Alternar tema" grava no servidor (RF-17, CT-16, CB-08).
  - Trecho: as linhas `ok` dos cenários `abrir Configurações não muda o tema`, `Seguir o sistema acompanha o sistema` e `alternar tema grava no servidor`, a linha `png:` e a última linha `ok  0 falha(s)`.
  - Falha: `FALHA` em algum cenário (tema trocado ao abrir, `PATCH` ausente, tema parado depois de `emulateMedia`), código de saída diferente de 0 ou `Evidência desconhecida`.

### Concluída quando

- [x] A preferência de tema do servidor é aplicada ao abrir o app e prevalece sobre o valor do navegador (RF-17, RN-06).

  > Como comprovar: em `tema-testes.txt`, ver aprovado `applies the server theme on open over the browser saved theme`.

- [x] Abrir Configurações não muda o tema e o botão de tema da barra lateral grava a preferência no servidor (RF-17, CT-16).

  > Como comprovar: em `tema-testes.txt`, ver aprovados `does not change the theme when opening settings` e `saves the theme toggle in the server preference`; em `settings-tema.png`, os cenários `abrir Configurações não muda o tema` e `alternar tema grava no servidor` com `ok`.

- [x] "Seguir o sistema" acompanha o tema do sistema na hora, sem recarregar e sem gravar um tema fixo (RF-17, CT-16, CB-08).

  > Como comprovar: em `tema-testes.txt`, ver aprovados `saves the system mode and follows the system without a fixed theme` e `follows the system at once with Seguir o sistema`; em `settings-tema.png`, o cenário `Seguir o sistema acompanha o sistema` com `ok`.

- [x] A aba Instância separa os grupos em cartões com título e as preferências têm o cartão com título, com o espaçamento do protótipo (RF-18, CT-17).

  > Como comprovar: em `tema-testes.txt`, ver aprovados `separates access, e-mail and roles in titled cards` e `shows the preferences in a card titled Suas preferências`; abrir `settings-themes-widths.png` e conferir os cartões "Instância", "E-mail (SMTP)" e "Papéis" separados, nos dois temas e larguras.

- [x] As telas seguem acessíveis nos dois temas, sem rolagem horizontal em 360 px, e nada regrediu no resto do app (RNF-02, RNF-03).

  > Como comprovar: em `settings-themes-widths.png` e `settings-tema.png`, a última linha `ok  0 falha(s)`; o baseline da suíte inteira continua com `0 failed`; o bloco de "Verificação" termina sem erro.

## Descrição

### Resumo executivo

Corrige o tema que mudava sozinho ao abrir Configurações e faz "Seguir o sistema" acompanhar o sistema na hora.
A preferência gravada na conta passa a valer em qualquer aparelho, e o botão de tema da barra lateral grava essa preferência.
A aba Instância de Configurações ganha os grupos em cartões com título, como no protótipo.
Perfil padrão, risco baixo: muda a casca do app e Configurações, sem contrato novo.
Não depende de outra tarefa e não bloqueia nenhuma.

### Detalhes técnicos

**Abordagem.** O `ThemeProvider` passa a guardar o modo (`light`, `dark` ou `system`) e a resolver o tema pelo `prefers-color-scheme` em tempo real no modo `system`. A preferência do servidor vira a fonte única: um componente `ServerTheme` no `AppProviders` lê `GET /me/preferences` (só com sessão) e aplica o modo ao abrir; o valor no `localStorage` serve só para evitar o piscar (RN-06). O "Alternar tema" da barra lateral troca o tema e envia `PATCH /me/preferences` pela mutação otimista que já existe; numa recusa, o cache volta e o `ServerTheme` devolve o tema.

**Causa confirmada.** `useApplyTheme` convertia "Seguir o sistema" num tema fixo e o gravava no navegador; o botão da barra lateral gravava só no navegador. Abrir Configurações reaplicava a preferência do servidor por cima da escolha local.

**Componentes.** `theme-provider.tsx`, `providers.tsx`, `sidebar.tsx`, `use-user-preferences.ts`, `user-preferences-page.tsx`, `instance-settings-page.tsx`, `settings.module.css`, os testes vizinhos e o script de evidência `evidence-settings.mjs`.

**Decisões.**
- Modo guardado no provedor, com `system` resolvido em tempo real. Descartada: continuar convertendo `system` em `light`/`dark` na hora de aplicar, que é a causa do Bug 14.
- Sincronização num componente do `AppProviders`, reaproveitando a chave `['me', 'preferences']` que a paleta de comandos já consulta. Descartada: sincronizar só na tela de Configurações, que não aplica a preferência ao abrir o app (RF-17).
- Sem tema salvo, o padrão continua sendo seguir o sistema, como hoje ([project/frontend-01]).
- Instância em três cartões (`FormGrid`, que já é o cartão do protótipo) com os títulos de chaves que já existem ("Instância", "E-mail (SMTP)", "Papéis"), sem textos novos. O formulário mantém o nome acessível "Instância". Descartado: um `Card` novo por grupo dentro do `FormGrid`, que aninharia cartões.
- As abas Busca e Dashboard já são um cartão cada, com o título da aba; recebem o padrão só pelo CSS. Descartado: mexer nelas, que o plano não atribui a esta tarefa.

**Evidências visuais.** O script `apps/web/scripts/evidence-settings.mjs` (TASK-33 da SPEC-001) sobe o Vite com o harness da feature e a API simulada; esta tarefa o faz gravar em `$VOSTOK_EVIDENCE`, confere os cartões e cria a evidência `tema`, que troca o tema do sistema com `page.emulateMedia`.

**Riscos.** Com a sincronização no `AppProviders`, todo teste que monta o app com `GET /me` respondendo passa a pedir `GET /me/preferences`; os stubs que respondem 404 deixam o tema como está, e o baseline da suíte inteira (`0 failed`) mostra qualquer quebra. A TASK-01 (mesma onda) muda `current-user.ts`, usado aqui só pela leitura de `useCurrentUser()`. No baseline, as evidências de print rodam com o script antigo, que grava em `vostok/work/tasks/SPEC-001/evidence/TASK-33`; essa pasta pode ser apagada depois.

**Referências.** RF-17, RF-18; CT-16, CT-17; CB-08; RN-06; decisão 13 (inferência E); PD-19, PD-23, PD-62; [project/frontend-01].

**Arquivos em comum na onda 1.** Nenhum dos componentes é dividido. `apps/web/src/app/layout/app-layout.test.tsx` e `apps/web/src/app/providers.tsx` podem ser tocados pelos testes da TASK-01 (proteção das rotas); se a TASK-01 também os mudar, o Coordenador executa as duas em sequência.

### Card

- **Título:** Configurações: tema e espaçamento
- **Tipo:** bug
- **Descrição:** O tema passa a vir da preferência da conta, "Seguir o sistema" acompanha o sistema na hora e a aba Instância de Configurações ganha cartões com título.
- **Critérios de aceite:**
  - [ ] Abrir Configurações não muda o tema.
  - [ ] O botão de tema da barra lateral grava a preferência da conta.
  - [ ] "Seguir o sistema" acompanha a troca do tema do sistema sem recarregar.
  - [ ] A aba Instância mostra os grupos em cartões com título e o espaçamento do protótipo.
  - [ ] Telas acessíveis nos dois temas, em 360 px e desktop.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 6 comando(s); códigos de saída: 0, 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | ajuste | in_progress | Seis arquivos de teste com stub de fetch incluídos em Mudar; passo 14 para os stubs ignorarem a leitura de GET /me/preferences; suíte inteira do web e lint/prettier desses arquivos na Verificação |
| 4 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 5 | 2026-11-01 | regressão | passed | 5 comando(s) iguais ao baseline; 1 com acréscimo |
| 6 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 7 | 2026-11-01 | conferência | usuário | print settings-themes-widths.png conferido pelo usuário (sha256 9e4098d1) |
| 8 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 9 | 2026-11-01 | conferência | usuário | print settings-tema.png conferido pelo usuário (sha256 f5e7e3c5) |
| 10 | 2026-11-01 | evidências | passed | 3 evidência(s) em evidence/TASK-07/ |
| 11 | 2026-11-01 | conferência | usuário | print settings-tema.png conferido pelo usuário (sha256 f5e7e3c5) |
| 12 | 2026-11-01 | evidências | passed | 3 evidência(s) em evidence/TASK-07/ |
| 13 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-11-01 | agente | Seis arquivos de teste com stub de fetch incluídos em Mudar; passo 14 para os stubs ignorarem a leitura de GET /me/preferences; suíte inteira do web e lint/prettier desses arquivos na Verificação |
