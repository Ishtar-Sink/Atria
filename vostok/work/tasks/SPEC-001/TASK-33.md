---
id: TASK-33
spec: SPEC-001
title: "Telas de Configurações"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-58, RF-59, RF-60, CT-31, CT-32]
type: historia
labels: [SPEC-001, padrao]
status: approved
content_hash: b777e0fe3f907183aa946a3e9638ad83bfaef2dbb1428ab3bfbf1b3bc883afb0
adjustments: 3
adjusted_at: 2026-10-30T22:20:59Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: b777e0fe3f907183aa946a3e9638ad83bfaef2dbb1428ab3bfbf1b3bc883afb0
attempts: 0
tests_result: null
regression_result: null
evidence_result: null
updated_at: 2026-10-30T22:20:59Z
---

# TASK-33: Telas de Configurações

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md`: RF-58, RF-59, RF-60, CT-31, CT-32, RN-12, RN-18, variáveis `ATRIA_SMTP_*` e `ATRIA_WEB_PUSH_VAPID_KEY_FILE`, `/admin/instance` e `/admin/instance/settings`, RNF-06, RNF-08 a RNF-10 e decisões 12, 23, 39 e 58.
- `vostok/rules/project/frontend.md`: [project/frontend-01] (tema e escolha salva), [project/frontend-09], [project/frontend-16] e [project/frontend-18].
- `vostok/rules/project/security.md`: [project/security-08] (papéis), [project/security-12] (segredos) e [project/security-17].
- `vostok/rules/project/architecture.md`: [project/architecture-10].
- `vostok/rules/project/code-style.md`: componentes sem regra de negócio, só tokens do tema.
- `vostok/rules/project/testing.md`: Vitest, Testing Library, axe e testes determinísticos.
- `vostok/rules/project/language.md`: textos em arquivo de tradução e [project/language-08].
- `vostok/rules/project/naming-convention.md`: arquivos em `kebab-case`, chaves de objetos em `snake_case`.
- `vostok/work/tasks/SPEC-001/TASK-06.md`: rotas `GET /me`, `GET|PATCH /me/preferences`, `GET /admin/instance` e `GET|PATCH /admin/instance/settings`, campos das preferências (`theme` em `light`, `dark` ou `system`, `locale`, `timezone`, `currency`, `palette_shortcut`, `search_contexts`) e da instância (`invite_required`, `web_push_enabled`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_from`), e os códigos de erro.
- `vostok/work/tasks/SPEC-001/TASK-10.md`: rota `GET /web-push/public-key`, que diz se o servidor tem chave VAPID.
- `prototype/atria-prototype.html`: telas de Configurações validadas no protótipo; pelas decisões do protótipo, `renderSettings` (seções "Suas preferências" com "Opções do botão de criar", "Dashboard" com "Blocos visíveis" e a dica do olho, "Instância" e "Papéis"), a constante `BLOCKS` (ids e nomes dos blocos do dashboard), `db.prefs.create_layout` e `db.prefs.hidden_blocks` (no protótipo as duas ficam no navegador), o menu do perfil (`openProfileMenu`, `#profile-menu`) com Configurações, e a grade `.screen-form .form`.
- `docs/decisoes-do-prototipo.md`: linhas PD-10, PD-15, PD-19, PD-23, PD-30, PD-31 e PD-62 e a seção "Decisões resolvidas em 30/10 (DEC-002)"; as decisões valem sobre o texto antigo desta tarefa; PD-11, PD-14, PD-57 e PD-59 não se aplicam: Configurações não tem etiquetas, campos de data nem página de detalhe.
- `vostok/memory/decisions.md`, por `vostok memory search decision DEC-002 DEC-003 DEC-004 DEC-008`: DEC-002 (as decisões do protótipo valem já, também nas telas); DEC-003 e DEC-004 não mudam Configurações; DEC-008 (a preferência `create_layout` fica no `preferences-context` da base, TASK-05, e as telas importam de lá).
- `vostok/work/tasks/SPEC-001/TASK-05.md`: o menu do perfil no rodapé da sidebar, com Configurações, Alternar tema e Sair (PD-23), `preferences-context.tsx` (`usePreferences()` com `locale`, `time_zone`, `currency`, `palette_shortcut` e, pela DEC-008, `create_layout` (`'grid' | 'list'`, padrão `'grid'`, gravada por usuário no navegador) e `set_create_layout(value)`; esta tarefa não altera `apps/web/src/shared`), `useCurrentUser()`, o acesso protegido ao `localStorage` de `apps/web/src/shared`, e os componentes da base: `SelectField`, `SegmentedField`, `FormGrid`, `FormActions`, `TextField` sem as setas nos campos numéricos e as ligações `FormSelect` e `FormSegmented` de `apps/web/src/shared/forms/form-fields.tsx`.
- `vostok/work/tasks/SPEC-001/TASK-21.md`: leia o arquivo atual (ela está sendo reajustada): `DASHBOARD_BLOCKS` de `apps/web/src/features/dashboard/blocks.ts` (passo 3), com os ids `today`, `reminders`, `upcoming`, `journal`, `balance` e `reading`, na ordem do protótipo, e a chave do navegador `atria.dashboard.hidden_blocks.<userId>`, onde o dashboard lê os blocos ocultos (PD-30). Os ids de `DASHBOARD_BLOCK_OPTIONS` desta tarefa têm de ser os mesmos.
- `vostok/work/tasks/SPEC-001/TASK-28.md`: o diálogo de tipo, `CreateTypeDialog` da base (`apps/web/src/shared/forms/create-type-dialog.tsx`, TASK-05), que mostra os tipos em grade ou lista conforme `usePreferences().create_layout`, a preferência gravada por esta tarefa (PD-10, DEC-008).
- `apps/web/src/app`: só leitura, para ver como o tema é aplicado (`data-theme`) e como a TASK-35 registra `routes.tsx` e `nav.ts`.
- `apps/web/src/shared`: cliente da API, mutação otimista, utilitário de tema, i18n e locale, usuário atual com o papel, e tipo do item de navegação.
- `packages/ui`: página, formulário, seletor, alternador, estados e abas.
- `packages/theme`: tokens do tema claro e escuro.
- `packages/contracts`: tipos gerados de `/me`, `/me/preferences`, `/admin/instance`, `/admin/instance/settings` e `/web-push/public-key`.

### Mudar

- `apps/web/src/features/settings/routes.tsx` (criar): rotas `/settings`, `/settings/search`, `/settings/dashboard` (PD-30) e `/settings/instance`, exportadas por `createSettingsRoutes(parent_route)`. A feature não tem `nav.ts`: Configurações sai da navegação principal e abre pelo menu do perfil da TASK-05 (PD-23).
- `apps/web/src/features/settings/i18n/pt-br.json` (criar): textos da feature.
- `apps/web/src/features/settings/settings-layout.tsx` (criar): cabeçalho e navegação entre as seções, com a da instância só para o admin.
- `apps/web/src/features/settings/user-preferences-page.tsx` (criar): tema, idioma, fuso horário, moeda, atalho da paleta e "Opções do botão de criar" (RF-58, PD-10).
- `apps/web/src/features/settings/dashboard-settings-page.tsx` (criar): "Blocos visíveis" do dashboard, com a dica do olho dos blocos sensíveis (PD-15, PD-30).
- `apps/web/src/features/settings/use-dashboard-blocks.ts` (criar): leitura e gravação dos blocos ocultos na chave do navegador do dashboard (PD-30).
- `apps/web/src/features/settings/dashboard-settings-page.test.tsx` (criar): testes dos blocos visíveis (PD-30).
- `apps/web/src/features/settings/shortcut-recorder.tsx` (criar): campo que grava a combinação de teclas do atalho da paleta.
- `apps/web/src/features/settings/search-contexts-page.tsx` (criar): contextos padrão da busca (RF-59).
- `apps/web/src/features/settings/instance-settings-page.tsx` (criar): convite obrigatório, papéis, Web Push e SMTP, só para o admin (RF-60).
- `apps/web/src/features/settings/use-user-preferences.ts` (criar): leitura e gravação otimista das preferências, aplicando tema e idioma na hora.
- `apps/web/src/features/settings/use-instance-settings.ts` (criar): leitura e gravação das configurações da instância e da disponibilidade da chave VAPID.
- `apps/web/src/features/settings/settings-options.ts` (criar): listas de fusos e moedas de `Intl.supportedValuesOf` e idiomas disponíveis.
- `apps/web/src/features/settings/user-preferences-page.test.tsx` (criar): testes das preferências.
- `apps/web/src/features/settings/shortcut-recorder.test.tsx` (criar): testes da gravação do atalho.
- `apps/web/src/features/settings/search-contexts-page.test.tsx` (criar): testes dos contextos padrão.
- `apps/web/src/features/settings/instance-settings-page.test.tsx` (criar): testes da instância.
- `apps/web/src/features/settings/settings.e2e.ts` (criar): fluxos ponta a ponta dos CT-31 e CT-32, rodados só na TASK-35.

### Passos

1. Ler os arquivos de "Ler" e anotar os nomes exportados por `apps/web/src/shared` (utilitário de tema, troca de idioma, usuário atual com o papel), `packages/ui` e `packages/contracts` (`/me` com o papel do usuário, `/me/preferences`, `/admin/instance/settings` e `/web-push/public-key`).
2. Criar `i18n/pt-br.json` com chaves em `snake_case` sob `settings`: `nav`, `title`, `subtitle`, `section_preferences`, `section_search`, `section_instance`, `theme`, `theme_light`, `theme_dark`, `theme_system`, `language`, `timezone`, `currency`, `palette_shortcut`, `shortcut_record`, `shortcut_press_keys`, `shortcut_reset`, `shortcut_invalid`, `search_contexts`, `search_contexts_hint`, `invite_required`, `roles`, `roles_hint`, `roles_manage`, `web_push`, `web_push_unavailable`, `smtp`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_from`, `smtp_password_hint` (a senha vem só do arquivo `ATRIA_SMTP_PASSWORD_FILE` do servidor), `save`, `saved`, `loading`, `error`, `forbidden` e `undo_notice`, e as mensagens dos códigos de erro da API.
3. Escrever os testes antes do código, com o cliente da API simulado e o usuário atual simulado:
   - `user-preferences-page.test.tsx`: `changes the theme at once and keeps it after reload`, `changes the language at once`, `lists time zones and currencies from Intl`, `uses BRL as the default currency` (RN-18), `saves the timezone and currency`, `rolls back and shows the undo notice when the server rejects` (RNF-09), `shows the validation error inside the form with role alert`, `has no axe violations`, `pd10 switches the create options between grid and list` (o `radiogroup` "Opções do botão de criar" com "Em grade" e "Em lista"; escolher "Em lista" chama `set_create_layout('list')` e `usePreferences().create_layout` passa a `list` na hora; nenhum `PATCH /me/preferences` leva `create_layout`), `pd10 defaults to grid without a saved choice` (sem escolha gravada, "Em grade" vem marcado, o padrão `grid` da preferência), `pd10 saves the layout per user and reads it after remount` (com o `PreferencesProvider` real da TASK-05, escolher "Em lista", desmontar e montar de novo a tela mostra "Em lista" marcado; outro usuário vê "Em grade") e `pd10 ignores storage errors` (com o `localStorage` lançando exceção, a escolha muda na sessão e a tela não quebra), `pd62 uses the custom select and the segmented theme` (tema em `radiogroup` com "Seguir o sistema", "Claro" e "Escuro"; idioma, fuso e moeda no `SelectField` próprio, com busca por letra; nenhum `<select>` nativo) e `pd19 centers the header and the form in the form column`.
   - `dashboard-settings-page.test.tsx`: `pd30 matches the dashboard block ids` (os ids de `DASHBOARD_BLOCK_OPTIONS` são `today`, `reminders`, `upcoming`, `journal`, `balance` e `reading`, nessa ordem, os mesmos de `DASHBOARD_BLOCKS` da TASK-21), `pd30 lists the dashboard blocks with a visibility toggle` (Tarefas de hoje, Lembretes de hoje, Próximos dias, Diário, Dinheiro e Leituras, todos marcados sem nada gravado), `pd30 hides a block and saves it in the dashboard key` (desmarcar "Leituras" grava `["reading"]` em `atria.dashboard.hidden_blocks.<userId>`; marcar de novo tira), `pd30 ignores storage errors`, `pd15 explains the eye of the sensitive blocks` (a dica "Nos blocos com informação sensível (Diário e Dinheiro), o olho esconde o conteúdo sem tirar o bloco.") e `has no axe violations`.
   - `shortcut-recorder.test.tsx`: `records a key combination`, `rejects a combination without modifier`, `resets to the default shortcut`, `is operable by keyboard only`.
   - `search-contexts-page.test.tsx`: `saves the default search contexts`, `requires at least one context`, `has no axe violations`.
   - `settings-layout` (em `user-preferences-page.test.tsx`): `pd23 lists Suas preferências, Busca, Dashboard and Instância in the settings sections` (Instância só para o admin).
   - `instance-settings-page.test.tsx`: `pd62 types the smtp port without the browser arrows` (o campo da porta é o `TextField` numérico da base), `turns off the required invite`, `turns on web push when the vapid key is configured`, `disables web push with an explanation when the key is missing`, `saves smtp host, port, user and sender without a password field`, `links roles to the admin users screen`, `shows the forbidden state for non admin users` (RN-12), `shows the loading and error states`, `has no axe violations`.
4. Rodar `pnpm --filter @atria/web test -- src/features/settings` e confirmar que falham por falta da implementação.
5. Implementar `use-dashboard-blocks.ts` (PD-30): `DASHBOARD_BLOCK_OPTIONS`, a lista dos blocos do protótipo (`BLOCKS`) sem o bloco "Metas", que depende da PD-31 em aberto: `today` (Tarefas de hoje), `reminders` (Lembretes de hoje), `upcoming` (Próximos dias), `journal` (Diário), `balance` (Dinheiro) e `reading` (Leituras), com a chave de tradução de cada um. Os ids e a ordem são os mesmos de `DASHBOARD_BLOCKS` da TASK-21 (`apps/web/src/features/dashboard/blocks.ts`): antes de escrever, confira no arquivo atual da TASK-21, que está sendo reajustada; se lá os ids mudaram, use os de lá e registre a diferença no Registro de execução; e `useDashboardBlocks(userId)`, que lê e grava a lista de ids ocultos em JSON na chave `atria.dashboard.hidden_blocks.<userId>` do `localStorage`, a mesma que o dashboard da TASK-21 lê, com leitura e escrita em `try/catch` (sem armazenamento, todos os blocos ficam visíveis e a mudança vale só na sessão). A feature não importa nada de `apps/web/src/features/dashboard`.
6. Implementar `settings-options.ts` (`Intl.supportedValuesOf('timeZone')` e `Intl.supportedValuesOf('currency')`, com nomes por `Intl.DisplayNames` no locale do usuário, e os idiomas disponíveis nas traduções, hoje `pt-br`).
7. Implementar `use-user-preferences.ts`: `GET` e `PATCH /me/preferences`, com gravação otimista; ao mudar o tema, aplica na hora pelo utilitário de tema de `apps/web/src/shared` (que também guarda a escolha no navegador, [project/frontend-01]); ao mudar o idioma, troca o idioma do i18n. Implementar `use-instance-settings.ts` com `GET` e `PATCH /admin/instance/settings` e `GET /web-push/public-key` (sem chave, o Web Push fica indisponível); o papel vem de `GET /me`.
8. Implementar `shortcut-recorder.tsx`: botão "Gravar" que escuta a próxima combinação, exige um modificador (Ctrl, Meta, Alt), grava no formato do atalho da paleta (`mod+k`) e anuncia o valor num `aria-live`; botão para voltar ao padrão.
9. Implementar as telas em rota própria com `react-hook-form` e `zod`, com a base da TASK-05 (PD-19, PD-62): cada tela com o cabeçalho e o formulário numa coluna centralizada na largura do `FormGrid`, as escolhas obrigatórias de até três opções em `FormSegmented` (tema: "Seguir o sistema", "Claro" e "Escuro"; "Opções do botão de criar": "Em grade" e "Em lista"), as listas que crescem em `FormSelect` (idioma, fuso horário e moeda), a porta do SMTP no `TextField` numérico sem setas e, nos formulários com envio, o `FormActions` com "Cancelar" (`ghost`) e "Salvar". `settings-layout.tsx` (cabeçalho com título e subtítulo e as seções Suas preferências, Busca, Dashboard e Instância; a da instância só aparece para o admin; Configurações não está na navegação principal e é aberta pelo menu do perfil da TASK-05, PD-23), `user-preferences-page.tsx` (com "Opções do botão de criar", que lê `usePreferences().create_layout` e grava por `set_create_layout(value)` do `preferences-context` da TASK-05, `grid` ou `list`, fora do `PATCH /me/preferences`; o `CreateTypeDialog` da base lê a mesma preferência, PD-10, DEC-008; a feature não guarda cópia própria da preferência nem acessa a chave dela no `localStorage`), `dashboard-settings-page.tsx` (seção "Dashboard": `fieldset` "Blocos visíveis" com uma caixa por bloco de `DASHBOARD_BLOCK_OPTIONS`, marcada quando o bloco aparece, e a dica "Os blocos desmarcados somem do dashboard. Nos blocos com informação sensível (Diário e Dinheiro), o olho esconde o conteúdo sem tirar o bloco.", PD-15, PD-30; a mudança vale na hora, sem botão de salvar), `search-contexts-page.tsx` (botões alternáveis com `aria-pressed` para cada contexto da busca, ao menos um) e `instance-settings-page.tsx` (convite obrigatório, Web Push desligado com explicação quando o servidor não tem chave VAPID, SMTP com servidor, porta, usuário e remetente, sem campo de senha e com a dica `smtp_password_hint`, e a seção Papéis com a descrição dos papéis e o link para a tela de usuários do admin). Para quem não é admin, a tela da instância mostra o estado `forbidden` e não envia nada (RN-12). Erros no formulário com `role="alert"`.
10. Criar `routes.tsx` com `createSettingsRoutes(parent_route)` e as quatro rotas. Não criar `nav.ts` nem `settingsNavItem` (PD-23).
11. Criar `settings.e2e.ts` (Playwright) com o CT-31 (tema, idioma, fuso, moeda, atalho da paleta e contextos padrão valendo na hora e depois de recarregar) e o CT-32 (o admin liga o Web Push, configura o SMTP e desliga o convite), mais `settings opens from the profile menu` (PD-23) e `hidden dashboard block disappears from the dashboard` (PD-30), em 360 px e desktop, com axe. Não rodar: ele roda na TASK-35.
12. Rodar a Verificação até passar sem nenhum warning de lint.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
pnpm --filter @atria/web test -- src/features/settings
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
test -f apps/web/src/features/settings/settings.e2e.ts
# Configurações fora da navegação principal (PD-23)
test ! -e apps/web/src/features/settings/nav.ts
# Opções do botão de criar pela preferência da base, sem cópia local (PD-10, DEC-008)
grep -q 'set_create_layout' apps/web/src/features/settings/user-preferences-page.tsx
test ! -e apps/web/src/features/settings/create-layout.ts
test ! -e apps/web/src/features/settings/create-layout.test.tsx
! grep -rnE 'useCreateLayout|create-layout|atria\.settings\.create_layout' apps/web/src/features/settings
# Nenhum controle nativo que a base da TASK-05 substitui (PD-62)
! grep -rnE '<select|type="(date|number)"' apps/web/src/features/settings --include=*.tsx
```

### Evidências

- `settings-tests.txt` (automática): `pnpm --filter @atria/web test -- src/features/settings`
  - Prova: os testes de Configurações passam, cobrindo preferências do usuário, atalho da paleta, contextos padrão da busca, configurações da instância, restrição ao admin, estados, axe e interface otimista (RF-58, RF-59, RF-60, CT-31, CT-32, RNF-06, RNF-09).
  - Trecho: os arquivos `user-preferences-page.test.tsx`, `shortcut-recorder.test.tsx`, `search-contexts-page.test.tsx` e `instance-settings-page.test.tsx` aprovados e a linha `Tests` sem falhas.
  - Falha: `FAIL`, `failed` na linha `Tests` ou `No test files found`.
- `settings-pd-tests.txt` (automática): `pnpm --filter @atria/web test -- src/features/settings --reporter=verbose -t "pd[0-9]"`
  - Prova: Configurações segue as decisões do protótipo: "Opções do botão de criar", blocos visíveis do dashboard com a dica do olho, seções sem item na navegação principal e formulários com os seletores da base numa coluna centralizada (DEC-002, PD-10, PD-15, PD-19, PD-23, PD-30, PD-62).
  - Trecho: as linhas `✓` de `pd10 switches the create options between grid and list`, `pd10 defaults to grid without a saved choice`, `pd10 saves the layout per user and reads it after remount`, `pd10 ignores storage errors`, `pd30 matches the dashboard block ids`, `pd30 lists the dashboard blocks with a visibility toggle`, `pd30 hides a block and saves it in the dashboard key`, `pd15 explains the eye of the sensitive blocks`, `pd23 lists Suas preferências, Busca, Dashboard and Instância in the settings sections`, `pd62 uses the custom select and the segmented theme` e `pd19 centers the header and the form in the form column`.
  - Falha: `FAIL`, `×` em algum desses testes ou nenhum teste encontrado com o filtro.
- `settings-files.txt` (automática): `find apps/web/src/features/settings -type f | sort`
  - Prova: a feature tem rotas, traduções, telas, hooks, testes e o e2e dos CT-31 e CT-32, sem item de menu próprio (PD-23).
  - Trecho: `routes.tsx`, `i18n/pt-br.json`, `dashboard-settings-page.tsx` e `settings.e2e.ts` na lista, e nenhum `nav.ts`.
  - Falha: `No such file or directory`, algum desses arquivos ausente ou `nav.ts` na lista.
- `settings-themes-widths.png` (manual): prints das preferências do usuário (com o tema em grupo segmentado, o fuso aberto no seletor próprio e "Opções do botão de criar"), da seção Dashboard com os blocos visíveis, do menu do perfil aberto com Configurações e das configurações da instância nos temas claro e escuro, em 360 px e em desktop, capturados no app local (`pnpm --filter @atria/web dev`) com as rotas da feature registradas só na cópia de trabalho, sem manter a alteração em `apps/web/src/app`.
  - Prova: a troca de tema vale na hora, a identidade visual nos dois temas e o layout funcional a partir de 360 px (RF-58, RNF-08, RNF-10).
  - Trecho: as capturas com os campos legíveis e sem rolagem horizontal.
  - Falha: campos cortados em 360 px ou contraste baixo no tema escuro.
- `settings-states-focus.png` (manual): prints da tela da instância carregando, com erro e no estado sem acesso para um usuário comum, e da gravação do atalho com o foco visível navegando só pelo teclado.
  - Prova: os estados da tela, a restrição ao admin e o foco por teclado (RN-12, [project/frontend-10], RNF-06).
  - Trecho: o indicador de carregamento, a mensagem de erro, o texto de sem acesso e o anel de foco no botão "Gravar".
  - Falha: tela da instância editável para quem não é admin, estado sem texto ou foco invisível.

### Concluída quando

- [ ] O usuário ajusta tema, idioma, fuso horário, moeda e o atalho da paleta, e cada preferência vale na hora e depois de recarregar (RF-58, CT-31).

  > Como comprovar: na saída `settings-tests.txt`, ver aprovados os casos da `user-preferences-page.test.tsx` e da `shortcut-recorder.test.tsx`.

- [ ] A pessoa escolhe os contextos padrão da busca, com ao menos um (RF-59, CT-31).

  > Como comprovar: ver aprovados `saves the default search contexts` e `requires at least one context`.

- [ ] O admin ajusta o convite obrigatório, os papéis, o Web Push e o SMTP, sem a senha passar pela tela (RF-60, CT-32).

  > Como comprovar: ver aprovados `turns off the required invite`, `turns on web push when the vapid key is configured`, `saves smtp host, port, user and sender without a password field` e `links roles to the admin users screen`.

- [ ] Quem não é admin não altera as configurações da instância (RF-60, CT-32).

  > Como comprovar: ver aprovado `shows the forbidden state for non admin users` e o texto de sem acesso no print `settings-states-focus.png`.

- [ ] As mudanças aparecem na hora e são desfeitas com aviso se o servidor recusar (RNF-09).

  > Como comprovar: ver aprovado `rolls back and shows the undo notice when the server rejects`.

- [ ] As telas não têm violações no axe, funcionam só pelo teclado e nos dois temas, a partir de 360 px (RNF-06, RNF-08, RNF-10).

  > Como comprovar: ver aprovados os casos `has no axe violations` e `is operable by keyboard only`, e conferir os prints `settings-themes-widths.png` e `settings-states-focus.png`.

- [ ] A pessoa escolhe as "Opções do botão de criar" em grade ou em lista, gravadas na preferência `create_layout` da base, a mesma que o diálogo de tipo lê, sem cópia na feature (PD-10, DEC-008).

  > Como comprovar: em `settings-pd-tests.txt`, ver aprovados `pd10 switches the create options between grid and list`, `pd10 defaults to grid without a saved choice`, `pd10 saves the layout per user and reads it after remount` e `pd10 ignores storage errors`; a Verificação acha `set_create_layout` na tela e não acha `create-layout.ts`, `useCreateLayout` nem a chave antiga na feature.

- [ ] A seção Dashboard escolhe os blocos visíveis, gravados onde o dashboard os lê, com a explicação do olho dos blocos sensíveis (PD-15, PD-30).

  > Como comprovar: em `settings-pd-tests.txt`, ver aprovados `pd30 matches the dashboard block ids`, `pd30 lists the dashboard blocks with a visibility toggle`, `pd30 hides a block and saves it in the dashboard key` e `pd15 explains the eye of the sensitive blocks`.

- [ ] Configurações não aparece na navegação principal: abre pelo menu do perfil (PD-23).

  > Como comprovar: a Verificação confirma que não existe `nav.ts` na feature; em `settings-pd-tests.txt`, ver aprovado `pd23 lists Suas preferências, Busca, Dashboard and Instância in the settings sections`.

- [ ] Os formulários usam a base da TASK-05: tema e opções de criar em grupo segmentado, idioma, fuso e moeda no seletor próprio, porta sem setas, numa coluna centralizada (PD-19, PD-62).

  > Como comprovar: em `settings-pd-tests.txt`, ver aprovados `pd62 uses the custom select and the segmented theme` e `pd19 centers the header and the form in the form column`; o último comando da Verificação não encontra controle nativo.

- [ ] Testes, typecheck e lint passam sem warning, e o e2e dos CT-31 e CT-32 está escrito para a TASK-35.

  > Como comprovar: rodar a Verificação e ver que termina sem erro; `settings.e2e.ts` aparece em `settings-files.txt`.

## Descrição

### Resumo executivo

Entrega as telas de Configurações: as preferências de cada pessoa (tema, idioma, fuso, moeda, atalho da paleta e contextos da busca) e as configurações da instância para o admin (convite, papéis, Web Push e e-mail).
Cada pessoa adapta o Atria ao seu jeito, e o admin controla a instância sem editar arquivos.
Perfil padrão, risco baixo: as decisões estão tomadas e o servidor já guarda preferências e configurações.
Libera a integração do frontend e o atalho configurável da paleta.

### Detalhes técnicos

- **Abordagem:** feature React em `apps/web/src/features/settings` com três rotas (`/settings`, `/settings/search`, `/settings/instance`) sob um layout de seções. Preferências e configurações da instância ficam no contexto `auth` do servidor (decisão 58, TASK-06), em `GET|PATCH /me/preferences` e `GET|PATCH /admin/instance/settings`; a disponibilidade do Web Push vem de `GET /web-push/public-key` (TASK-10) e o papel de `GET /me`.
- **Componentes:** layout de seções, preferências do usuário, gravador do atalho, contextos padrão da busca, configurações da instância, hooks de preferências e de instância e as listas de opções; usa `@atria/ui`, `@atria/theme`, `@atria/contracts` e `apps/web/src/shared`.
- **Decisões:** configurações do usuário e da instância separadas (decisão 23), descartada uma tela só; fusos e moedas de `Intl.supportedValuesOf`, descartada uma lista fixa no código; o tema muda na hora pelo utilitário de tema da TASK-05, que também guarda a escolha no navegador ([project/frontend-01]); a senha do SMTP não aparece na tela: vem só de `ATRIA_SMTP_PASSWORD_FILE` no servidor (TASK-06, [project/security-12]), descartado um campo de senha gravado no banco; Web Push desligado com explicação quando o servidor não tem chave VAPID; a seção Papéis descreve os papéis e leva à tela de usuários do admin (TASK-20), descartado duplicar aqui a concessão de papéis. A tela da instância fica bloqueada para quem não é admin, inclusive `elevated` (RN-12); a autorização real é do servidor, que responde 403 ao `elevated` no `PATCH` ([project/security-04]).
- **Integração:** o atalho gravado aqui é lido pela paleta (TASK-32) pelas preferências do usuário, no formato `mod+k`. Configurações sai da navegação principal e é aberta pelo menu do perfil da TASK-05 (PD-23): a feature não exporta `settingsNavItem`, e a TASK-35 não a coloca na sidebar.
- **Decisões do protótipo (DEC-002, DEC-008):** "Opções do botão de criar" (PD-10) em Suas preferências, lida em `usePreferences().create_layout` e gravada por `set_create_layout(value)` do `preferences-context` da TASK-05, que a guarda por usuário no navegador (como o protótipo, em `db.prefs`); o `CreateTypeDialog` da base lê a mesma preferência. Esta tarefa não altera `apps/web/src/shared` e não tem módulo próprio da preferência. Descartados: um campo novo em `/me/preferences`, que mudaria o contexto auth (TASK-06), e o módulo `create-layout.ts` na feature, substituído pela DEC-008 porque telas da mesma onda (TASK-22, TASK-28) o importariam. "Blocos visíveis" numa seção Dashboard (PD-30), gravados na chave do navegador que o dashboard da TASK-21 lê (`atria.dashboard.hidden_blocks.<userId>`), com os ids do protótipo e sem o bloco "Metas", que depende da PD-31 em aberto. Os ids de `DASHBOARD_BLOCK_OPTIONS` (`today`, `reminders`, `upcoming`, `journal`, `balance` e `reading`) e os de `DASHBOARD_BLOCKS` da TASK-21 (`apps/web/src/features/dashboard/blocks.ts`, conferidos no arquivo atual dela) precisam bater: um id que só um lado conhece faz o bloco escondido continuar aparecendo, e o teste `pd30 matches the dashboard block ids` fixa a lista; descartado o menu "Blocos" no próprio dashboard. A dica do olho (PD-15) explica que esconder os valores do Diário e do Dinheiro não tira o bloco; o olho fica no dashboard. Formulários com a base da TASK-05 (PD-19, PD-62).
- **Riscos:** idioma só `pt-br` no MVP (o seletor já lista o que houver nas traduções); fuso inválido salvo pelo navegador (mitigado com a lista de `Intl` e validação `zod`).
- **Referências da spec:** RF-58, RF-59, RF-60, CT-31, CT-32, RN-12, RN-18, decisões 12, 23, 39 e 58, RNF-06, RNF-08 a RNF-10; DEC-002, DEC-008; PD-10, PD-15, PD-19, PD-23, PD-30 e PD-62 de `docs/decisoes-do-prototipo.md`.
- **Arquivos em comum na onda 7:** nenhum. Contratos entre features da onda: a chave `atria.dashboard.hidden_blocks.<userId>` e os ids dos blocos, gravados aqui e lidos pela TASK-21. A preferência `create_layout` é da base (TASK-05): esta tarefa grava, e o `CreateTypeDialog` usado pela TASK-22 e pela TASK-28 lê.

### Card

- **Título:** Telas de Configurações
- **Tipo:** historia
- **Descrição:** Telas de Configurações com as preferências do usuário (tema, idioma, fuso, moeda, atalho da paleta e contextos da busca) e as configurações da instância para o admin.
- **Critérios de aceite:**
  - [ ] Tema, idioma, fuso, moeda e atalho valem na hora e depois de recarregar.
  - [ ] Contextos padrão da busca gravados, com ao menos um.
  - [ ] "Opções do botão de criar" em grade ou lista, gravadas na preferência da base que o diálogo de tipo lê, sem cópia na feature, e blocos visíveis do dashboard escolhidos em Configurações, com os mesmos ids do dashboard.
  - [ ] Configurações abre pelo menu do perfil, fora da navegação principal, com os seletores da base.
  - [ ] Admin ajusta convite, papéis, Web Push e SMTP; quem não é admin não altera a instância.
  - [ ] Interface otimista, estados e sem violações no axe, nos dois temas e a partir de 360 px.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler com docs/decisoes-do-prototipo.md, DEC-002 a DEC-004, TASK-05 (menu do perfil, preferences-context e componentes), TASK-21 (chave dos blocos ocultos) e TASK-28 (create_layout); PD-23: nav.ts e settingsNavItem removidos, Configurações pelo menu do perfil, teste pd23, e2e e Verificação; PD-10: Opções do botão de criar em grade ou lista em create_layout de usePreferences, teste pd10; PD-30: rota /settings/dashboard com Blocos visíveis gravados em atria.dashboard.hidden_blocks.<userId>, sem o bloco Metas (PD-31 em aberto), use-dashboard-blocks.ts e testes pd30; PD-15: dica do olho dos blocos sensíveis, teste pd15; PD-62 e PD-19: tema e opções de criar em FormSegmented, idioma, fuso e moeda em FormSelect, porta sem setas, coluna centralizada; evidências settings-pd-tests.txt e settings-files.txt, Concluída quando, Detalhes técnicos e card atualizados; linha test -e da pasta da feature removida da Baseline, que a validação recusa |
| 2 | 2026-10-30 | agente | Opções do botão de criar (create_layout, PD-10) fora do preferences-context e de shared: gravada em create-layout.ts da própria feature, na chave atria.settings.create_layout.<userId>, exposta por useCreateLayout() que as telas de criação importam, com create-layout.test.tsx, passo 5a, testes pd10 e checagens na Verificação; ids dos blocos do dashboard iguais aos de DASHBOARD_BLOCKS da TASK-21 atual, com o teste pd30 matches the dashboard block ids e a citação em Detalhes técnicos; Ler, Evidências, Concluída quando e card atualizados |
| 3 | 2026-10-30 | agente | DEC-008: create-layout.ts e create-layout.test.tsx removidos de Mudar e passo 5a removido; Opções do botão de criar lê usePreferences().create_layout e grava por set_create_layout da TASK-05 (passo 9, Ler); testes pd10 mantidos em user-preferences-page.test.tsx, voltados à preferência (pd10 defaults, saves per user, ignores storage errors); Verificação com grep que rejeita create-layout.ts, useCreateLayout e a chave antiga na feature; Evidências, Concluída quando, Detalhes técnicos e card atualizados |
