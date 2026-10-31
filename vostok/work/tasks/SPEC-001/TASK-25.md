---
id: TASK-25
spec: SPEC-001
title: "Telas de Lembretes"
profile: padrao
persona: ui-ux-designer
depends_on: [TASK-05, TASK-18]
wave: 7
covers: [RF-40, RF-41, RF-42, CT-25]
type: historia
labels: [SPEC-001, padrao]
status: approved
content_hash: 28fd3f8db25b3d503d69d88ab19bac0aab3570554dfd99fba2ba63b43c7e1337
adjustments: 2
adjusted_at: 2026-10-30T22:23:56Z
approved_at: 2026-10-31T00:29:40Z
approved_hash: 28fd3f8db25b3d503d69d88ab19bac0aab3570554dfd99fba2ba63b43c7e1337
attempts: 0
tests_result: null
regression_result: null
evidence_result: null
updated_at: 2026-10-30T22:23:56Z
---

# TASK-25: Telas de Lembretes

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-001-mvp.md` (RF-40, RF-41, RF-42, CT-25, RN-08, RN-19, CB-02, CB-03, CB-04, CB-14, decisões 3 e 11, premissa do Web Push, risco "Web Push indisponível na rede interna", o contrato da regra de recorrência e o recurso `/reminders`)
- `prototype/atria-prototype.html` (telas de lembretes e o pedido de permissão validados no protótipo; pelas decisões do protótipo, o template `#entity-detail` com "Voltar", "Editar" e "Mais ações", a visão geral do lembrete em `overviewHTML` (`k === 'reminder'`), o formulário `KINDS.reminder` com a grade `.screen-form .form` e o campo de data e hora (`data-dt-time`, `.time-field`))
- `docs/decisoes-do-prototipo.md` (linhas PD-11, PD-14, PD-19, PD-57, PD-59 e PD-62 e a seção "Decisões resolvidas em 30/10 (DEC-002)"; as decisões valem sobre o texto antigo desta tarefa; PD-11 não se aplica: lembretes não têm etiquetas)
- `vostok/memory/decisions.md`, por `vostok memory search decision DEC-002 DEC-003 DEC-004 DEC-008`: DEC-002 (as decisões do protótipo valem já, também nas telas); DEC-003 e DEC-004 não mudam o contexto reminders; DEC-008 (o editor da regra de recorrência é um componente da base, em `apps/web/src/shared/forms`, que as telas importam)
- `vostok/work/tasks/SPEC-001/TASK-05.md` (componentes da base: `PageHeader` com "Voltar" e ações, `MenuButton`, `SelectField`, `SegmentedField`, `DateField`, `TimeField`, `DateTimeField` (valor `YYYY-MM-DDTHH:mm`), `FormGrid`, `FormActions` e as ligações `FormSelect`, `FormSegmented`, `FormDate`, `FormTime` e `FormDateTime` de `apps/web/src/shared/forms/form-fields.tsx`; e, pela DEC-008, `RecurrenceFields`/`FormRecurrence` e `summarizeRule(rule, locale)` de `apps/web/src/shared/forms/recurrence-fields.tsx`, com a prop `with_time`, padrão `true`)
- `apps/web/src/app` (só leitura: layout, roteador raiz e onde um componente global pode ser montado pela TASK-35)
- `apps/web/src/shared` (cliente da API, interface otimista, aviso de recusa e aviso dentro do app, `Intl`, estado da listagem na URL, i18n comum, helpers de teste com axe e relógio fixo)
- `packages/ui` (lista, campos, seletor, chip de filtro, busca, alternador de visualização, cartão, diálogo de confirmação, estados vazio, carregando e erro)
- `packages/theme` (tokens e temas claro e escuro)
- `packages/contracts` (tipos gerados de `/reminders`, `/reminders/upcoming`, `/web-push/public-key`, `/push-subscriptions` e da regra de recorrência)
- `vostok/work/tasks/SPEC-001/TASK-10.md` (passo 8: rotas do contexto reminders e conteúdo da mensagem de push)
- `vostok/work/tasks/SPEC-001/TASK-06.md` (passo 8: `GET /me/preferences` com o fuso)
- `apps/server/src/reminders/interface` (rotas `GET|POST /reminders`, `GET|PATCH|DELETE /reminders/{id}`, `GET /reminders/upcoming`, `GET /web-push/public-key`, `POST /push-subscriptions`, `DELETE /push-subscriptions/{id}` e códigos `not_found`, `web_push_disabled`, `validation_failed`)
- `vostok/rules/project/frontend.md`
- `vostok/rules/project/code-style.md`
- `vostok/rules/project/testing.md`

### Mudar

- `apps/web/src/features/reminders/routes.tsx` (criar): rotas `/reminders`, `/reminders/new`, `/reminders/$reminderId` (detalhe, PD-14, PD-59) e `/reminders/$reminderId/edit`, exportadas por `createRemindersRoutes` para a TASK-35 registrar.
- `apps/web/src/features/reminders/nav.ts` (criar): item "Lembretes" da sidebar.
- `apps/web/src/features/reminders/i18n/pt-br.json` (criar): textos das telas, do pedido de permissão e das notificações.
- `apps/web/src/features/reminders/index.ts` (criar): exporta `ReminderNotifier` para a TASK-35 montar uma vez no layout autenticado.
- `apps/web/src/features/reminders/hooks/use-reminders.ts` (criar): listagem com filtros e busca, criação, edição e exclusão de lembretes.
- `apps/web/src/features/reminders/hooks/use-reminders.test.tsx` (criar): testes da listagem e das mutações otimistas com reversão.
- `apps/web/src/features/reminders/hooks/use-notification-permission.ts` (criar): estado da permissão do navegador e pedido explícito, só por ação da pessoa.
- `apps/web/src/features/reminders/hooks/use-notification-permission.test.tsx` (criar): testes do pedido e da permissão negada (CB-14).
- `apps/web/src/features/reminders/hooks/use-reminder-scheduler.ts` (criar): agenda as ocorrências das próximas horas e dispara a notificação com a aba aberta (RF-41).
- `apps/web/src/features/reminders/hooks/use-reminder-scheduler.test.tsx` (criar): testes do disparo com relógio falso, sem duplicar, e do aviso dentro do app sem permissão (CT-25, CB-04, CB-14).
- `apps/web/src/features/reminders/push/service-worker.ts` (criar): service worker que mostra a notificação recebida por Web Push e abre o Atria no clique (RF-42).
- `apps/web/src/features/reminders/push/handle-push.ts` (criar): funções puras de tratamento do evento `push` e do clique, usadas pelo service worker.
- `apps/web/src/features/reminders/push/handle-push.test.ts` (criar): testes do tratamento do push e do clique (CT-25).
- `apps/web/src/features/reminders/push/use-web-push.ts` (criar): registra o service worker e inscreve ou cancela a inscrição no Web Push quando a instância tem o recurso ligado.
- `apps/web/src/features/reminders/push/use-web-push.test.tsx` (criar): testes da inscrição, do recurso desligado e da permissão negada (RF-42).
- `apps/web/src/features/reminders/components/notification-settings-card.tsx` (criar): cartão com o estado das notificações, o botão "Ativar notificações" e o interruptor do Web Push.
- `apps/web/src/features/reminders/components/reminder-notifier.tsx` (criar): componente sem interface visível que liga o agendador e mostra o aviso dentro do app.
- `apps/web/src/features/reminders/screens/reminders-screen.tsx` (criar): listagem de lembretes com filtros, busca, visualização e o cartão de notificações (RF-40).
- `apps/web/src/features/reminders/screens/reminder-form-screen.tsx` (criar): criar e editar lembrete pontual ou recorrente com data e hora em rota própria.
- `apps/web/src/features/reminders/screens/reminder-screen.tsx` (criar): detalhe do lembrete com o cabeçalho (PD-14), a visão geral e as abas extras recebidas por `extra_tabs`.
- `apps/web/src/features/reminders/screens/reminder-overview.tsx` (criar): visão geral do lembrete em cartões, com "Lembrete", "Anotações" e "Registro" (PD-59).
- `apps/web/src/features/reminders/screens/reminders-screens.test.tsx` (criar): testes das telas, dos estados e do axe (CT-25).
- `apps/web/src/features/reminders/reminders.e2e.ts` (criar): fluxo ponta a ponta de CT-25 com a aba aberta e com Web Push, rodado na TASK-35.

### Passos

1. Leia os arquivos de "Ler" e anote: os nomes do cliente da API, do helper de mutação otimista, dos avisos (de recusa e dentro do app), da formatação `Intl`, do estado da listagem na URL e do relógio injetável em `apps/web/src/shared`; e as rotas do contexto reminders (TASK-10): `GET /reminders/upcoming?from=&to=` (até 31 dias; devolve `reminder_id`, `title` e `fire_at` em UTC), `GET /web-push/public-key` (devolve a chave pública VAPID, ou 404 `web_push_disabled` quando o admin não ligou o Web Push), `POST /push-subscriptions` e `DELETE /push-subscriptions/{id}`; a mensagem de push é `{"reminder_id", "title", "fire_at"}`. O fuso vem de `GET /api/v1/me/preferences`. Use esses nomes nos passos seguintes.
2. Crie `apps/web/src/features/reminders/i18n/pt-br.json` com chaves em `snake_case` agrupadas por tela e recurso (`list`, `form`, `recurrence`, `permission`, `push`, `notification`, `nav`), em tom calmo (ex.: permissão negada: "As notificações do navegador estão bloqueadas. Os lembretes continuam aparecendo aqui no Atria."). Lembrete não tem "concluir" (RN-19).
3. Escreva `hooks/use-reminders.test.tsx` e depois `use-reminders.ts`: `useReminders(filters)` com `useInfiniteQuery` por cursor e os filtros `kind` (`one_off`/`recurring`), `q`, `cursor` e `limit`; `useCreateReminder` (`POST /api/v1/reminders`, com data e hora no fuso do usuário e a regra de recorrência quando marcada; não otimista na lista porque as ocorrências vêm do servidor); `useUpdateReminder` (`PATCH /api/v1/reminders/{id}`) e `useDeleteReminder` (`DELETE /api/v1/reminders/{id}`) otimistas com reversão e aviso (RNF-09); mudar a regra de um recorrente recalcula só os próximos disparos no servidor (RN-08). Testes `lists reminders with filters from the url`, `creates a recurring reminder with time and timezone`, `deletes a reminder optimistically` e `rolls back a reminder update when refused`.
4. Escreva `hooks/use-notification-permission.test.tsx` e depois `use-notification-permission.ts`: `useNotificationPermission()` devolve `status` (`unsupported` sem `window.Notification`, ou `default`, `granted`, `denied`) e `request()`, que chama `Notification.requestPermission()` só quando chamado e só se o status for `default`; nunca pede sozinho ao montar ([project/frontend-15]); com `denied`, `request` não faz nada e não pede de novo (CB-14). Testes `never asks for permission on mount`, `asks only when the person clicks`, `does not ask again when denied` e `reports unsupported browsers`.
5. Escreva `hooks/use-reminder-scheduler.test.tsx` com `vi.useFakeTimers()`, relógio injetado em `2026-11-05T12:00:00Z`, fuso `America/Sao_Paulo` e um `Notification` falso, e depois `use-reminder-scheduler.ts`: `useReminderScheduler({ now, notify, showInApp })` busca `GET /api/v1/reminders/upcoming` de agora até 6 horas depois, agenda um `setTimeout` por disparo a partir de `fire_at` (UTC) devolvido pelo servidor (sem recalcular fuso nem horário de verão no cliente, CB-04), busca de novo a cada 15 minutos e quando a aba volta a ficar visível (`visibilitychange`), cancela os timers ao desmontar e guarda as chaves já disparadas (`<reminder_id>:<fire_at>`) para não repetir. No disparo: com permissão `granted`, `new Notification(title, { tag: '<reminder_id>:<fire_at>' })` (a mesma `tag` do push evita a notificação dupla quando o Web Push também chega); sem permissão, chama `showInApp` com o aviso dentro do app. Testes `notifies a reminder one minute from now with the tab open`, `does not notify the same occurrence twice`, `uses reminder id and fire time as notification tag`, `shows the reminder inside the app when permission is denied` e `refetches when the tab becomes visible`.
6. Escreva `push/handle-push.test.ts` e depois `handle-push.ts`: `handlePush(payload, registration)` lê `reminder_id`, `title` e `fire_at` da mensagem e chama `registration.showNotification(title, { tag: '<reminder_id>:<fire_at>', data: { path: '/reminders' } })`; mensagem sem esses campos não mostra nada; `handleNotificationClick(event, clients)` fecha a notificação e foca uma aba do Atria ou abre `data.path`. Testes `shows the pushed reminder with its tag`, `ignores an invalid push payload` e `focuses or opens the app on click`.
7. Crie `push/service-worker.ts` com `/// <reference lib="webworker" />` e `const sw = self as unknown as ServiceWorkerGlobalScope`, registrando `push` (`event.waitUntil(handlePush(event.data?.json(), sw.registration))`) e `notificationclick` (`event.waitUntil(handleNotificationClick(event, sw.clients))`). Sem cache nem lógica offline: o service worker serve só ao Web Push.
8. Escreva `push/use-web-push.test.tsx` e depois `use-web-push.ts`: importa o service worker com `import serviceWorkerUrl from './service-worker.ts?worker&url'` (o Vite empacota o arquivo dentro da própria feature, sem mudar `apps/web/public` nem `apps/web/src/app`); `useWebPush()` devolve `available` (`GET /api/v1/web-push/public-key` respondeu com a chave, e o navegador tem `serviceWorker` e `PushManager`; 404 `web_push_disabled` deixa falso), `subscribed`, `subscribe()` e `unsubscribe()`. `subscribe()` só roda por ação da pessoa e com permissão `granted` (pede pelo `request()` do passo 4 se `default`); registra o service worker, chama `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` com a chave de `/web-push/public-key` e envia a inscrição (`endpoint` e chaves) a `POST /api/v1/push-subscriptions`, guardando o id devolvido; `unsubscribe()` cancela no navegador e chama `DELETE /api/v1/push-subscriptions/{id}`. Com o recurso desligado pelo admin, `available` é falso e nada é registrado. Testes `does nothing when the instance has web push off`, `subscribes after the person turns it on`, `does not subscribe when permission is denied` e `unsubscribes in the browser and on the server`.
9. Use o `FormRecurrence` de `apps/web/src/shared/forms/recurrence-fields.tsx` (TASK-05, DEC-008), com o horário (`with_time` no padrão `true`): frequência, intervalo, dias da semana, dia do mês com a ajuda de meses curtos (CB-02, CB-03), horário em 24 h (aceita "930", "9:30" ou "09:30"), início e fim, com o fuso do usuário na regra (PD-57, PD-62). O horário é obrigatório nos Lembretes: o esquema `zod` do formulário recusa a regra sem `time`, com o erro no campo em `role="alert"`. O resumo da regra ("Todo dia", "Toda semana: seg e qua" e os demais) vem de `summarizeRule(rule, locale)`, com o `locale` de `usePreferences()`. A feature não cria editor nem resumo próprios da regra.
10. Crie `components/notification-settings-card.tsx`: mostra o estado da permissão em texto; com `default`, o botão "Ativar notificações" chama `request()`; com `denied`, mostra o texto de bloqueio sem botão de pedir de novo; com `unsupported`, explica que os lembretes aparecem só no app; quando `useWebPush().available`, mostra o interruptor "Receber com o Atria fechado" (`role="switch"`, `aria-checked`) que chama `subscribe()` ou `unsubscribe()`; sem o recurso ligado, o interruptor não aparece.
11. Crie `components/reminder-notifier.tsx` (`ReminderNotifier`), que chama `useReminderScheduler` com o relógio de `apps/web/src/shared`, o `Notification` do navegador e o aviso dentro do app (região `aria-live="polite"`), e `apps/web/src/features/reminders/index.ts` exportando `ReminderNotifier`. A TASK-35 o monta uma vez no layout autenticado.
12. Escreva `screens/reminders-screens.test.tsx` (Testing Library, `userEvent` e axe) e depois as telas. Todo teste verifica: cabeçalho com `page-heading` e subtítulo; estados carregando, vazio com texto explicativo e erro com "Tentar de novo"; erros de formulário em `role="alert"`; navegação completa por `userEvent.tab()` com foco visível; zero violações no axe.
13. `reminders-screen.tsx` em `/reminders`: o cartão de notificações no topo; filtro por tipo (pontual ou recorrente), busca e visualização em lista ou agrupada por dia do próximo disparo, com os nomes acessíveis "Filtros", "Busca" e "Visualização" (usados pelos e2e da TASK-35), na URL (`?kind=&q=&view=`); data e hora por `Intl` no fuso do usuário; o título de cada lembrete é o link para `/reminders/$reminderId`; o filtro por tipo, quando lista de opções, é o `SelectField` da TASK-05, nunca um `<select>` nativo (PD-62); excluir com diálogo de confirmação; sem ação de concluir. Testes `filters reminders through the url`, `switches between list and grouped by day`, `asks for notification permission only on click`, `shows the web push switch only when the instance has it on` e `shows empty, loading and error states`.
14. `reminder-form-screen.tsx` em `/reminders/new` e `/reminders/$reminderId/edit`: `react-hook-form` com `zod` (título obrigatório, texto opcional, data e hora obrigatórias para pontual, a repetição "Pontual" ou "Recorrente" que mostra o `FormRecurrence` da base com o horário obrigatório, visibilidade com padrão pessoal), com a base da TASK-05 (PD-19, PD-57, PD-62): o `PageHeader` com "Voltar" e o formulário numa coluna centralizada na largura do `FormGrid`; título, texto, visibilidade e o `fieldset` da recorrência com `data-span="full"`; a data e hora da pontual em `FormDateTime` (data no calendário próprio e hora em 24 h, valor `YYYY-MM-DDTHH:mm` no fuso do usuário, convertido para o envio como hoje); a repetição em `FormSegmented` ("Pontual" e "Recorrente", no lugar da caixa "Repetir"); a visibilidade em `FormSegmented` ("Pessoal" e "Compartilhada"); e o `FormActions` com "Cancelar" (`ghost`, volta ao detalhe na edição e à lista na criação) e "Salvar". Ao editar um recorrente, o texto "A mudança vale para os próximos avisos" (RN-08). Testes `creates a single reminder with date and time`, `creates a recurring reminder for one minute from now`, `pd62 lays the form in the grid with the repetition as a segmented field` (título, texto e visibilidade com `data-span="full"`, nenhum `<select>`, `<input type="date">`, `type="time"` nem `type="datetime-local"`, e "Cancelar" antes de "Salvar"), `pd57 picks the date in the custom calendar and types 930 as 09:30` (envia o instante do dia escolhido às 09:30 no fuso do usuário) e `pd19 centers the header and the form in the form column`.
15. `reminder-screen.tsx` e `reminder-overview.tsx` em `/reminders/$reminderId`: cabeçalho com "Voltar", eyebrow "Lembretes · Lembrete", título e subtítulo (próximo aviso por `Intl` e a repetição pelo `summarizeRule(rule, locale)` da base, DEC-008) e, nas ações (PD-14), "Editar" com o ícone de lápis e o `MenuButton` "⋯ Mais ações" (`aria-label="Mais ações"`) com "Excluir" em tom `danger`, que pede confirmação, chama `useDeleteReminder` e volta à lista; sem ação de concluir (RN-19). A tela recebe a propriedade `extra_tabs` (`{ id, label, render }[]`) e mostra a aba Visão geral seguida delas, para a TASK-35 montar Conexões sem esta feature importar outras. Visão geral (PD-59): zona principal com o cartão "Lembrete" (Quando e Repetição, com o resumo do `summarizeRule`, e o texto "Lembretes só avisam: não têm conclusão.") e o cartão "Anotações" só quando houver texto; lateral com o cartão "Registro" (Visibilidade, Criado em e Atualizado em, por `Intl`); uma coluna abaixo de 960 px. Testes `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações`, `deletes the reminder after confirmation from Mais ações` e `pd59 shows the overview in cards with Lembrete, Anotações and Registro` (sem texto, o cartão "Anotações" não aparece).
16. Crie `apps/web/src/features/reminders/nav.ts` exportando `remindersNav` com `path: '/reminders'`, `label_key: 'reminders.nav.title'` e o ícone SVG, no formato de item de navegação de `apps/web/src/shared`.
17. Crie `apps/web/src/features/reminders/routes.tsx` exportando `createRemindersRoutes(parent: AnyRoute)` com as quatro rotas e o esquema `zod` dos parâmetros de busca. Não altere `apps/web/src/app`.
18. Crie `apps/web/src/features/reminders/reminders.e2e.ts` com Playwright, permissão de notificações concedida pelo contexto do navegador e relógio controlado: `reminder notifies with the tab open`, `reminder shows inside the app when notifications are denied` e `web push subscription is sent when the admin turned it on`, em 360 px e desktop, com axe. Não rode: os e2e rodam na TASK-35.
19. Rode o bloco de "Verificação" e corrija até passar sem warnings.

### Baseline

- `pnpm --filter @atria/web typecheck`

### Verificação

```bash
# Testes de componente, de hook e do tratamento do push (Vitest + Testing Library + axe)
pnpm --filter @atria/web test -- src/features/reminders
# Tipos e lint sem nenhum erro ou warning
pnpm --filter @atria/web typecheck
pnpm --filter @atria/web lint
# e2e escrito (roda na TASK-35)
test -s apps/web/src/features/reminders/reminders.e2e.ts
# A permissão nunca é pedida fora do hook de permissão
test "$(grep -rln 'requestPermission' apps/web/src/features/reminders --include=*.ts --include=*.tsx | grep -v '\.test\.' )" = "apps/web/src/features/reminders/hooks/use-notification-permission.ts"
# Nenhuma cor literal fora dos tokens do tema
! grep -rnE '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\(' apps/web/src/features/reminders --include=*.tsx --include=*.ts --include=*.css
# Nenhum controle nativo que a base da TASK-05 substitui (PD-57, PD-62)
! grep -rnE '<select|type="(date|time|datetime-local)"' apps/web/src/features/reminders --include=*.tsx
# Editor e resumo da regra da base, sem cópia local (DEC-008)
test ! -e apps/web/src/features/reminders/components/recurrence-fields.tsx
! grep -rnE "features/reminders/components/recurrence-fields|['\"]\.\.?/(components/)?recurrence-fields['\"]|function (RecurrenceFields|FormRecurrence|summarizeRule)" apps/web/src/features/reminders
grep -rq 'FormRecurrence' apps/web/src/features/reminders/screens/reminder-form-screen.tsx
grep -rq 'summarizeRule' apps/web/src/features/reminders/screens
```

### Evidências

- `reminders-tests.txt` (automática): `pnpm --filter @atria/web test -- src/features/reminders --reporter=verbose`
  - Prova: lembretes pontuais e recorrentes, a notificação com a aba aberta, o pedido de permissão só por clique, o aviso dentro do app com permissão negada e a inscrição no Web Push passam nos testes, com axe sem violações (RF-40, RF-41, RF-42, CT-25, RNF-06, RNF-09).
  - Trecho: as linhas `✓` de `creates a recurring reminder for one minute from now`, `notifies a reminder one minute from now with the tab open`, `does not notify the same occurrence twice`, `never asks for permission on mount`, `shows the reminder inside the app when permission is denied`, `subscribes after the person turns it on`, `does nothing when the instance has web push off` e `shows the pushed reminder with its tag`, e o resumo sem falhas.
  - Falha: `FAIL`, `✗` ou `×` em algum teste, ou a mensagem de que nenhum arquivo de teste foi encontrado.
- `reminders-pd-tests.txt` (automática): `pnpm --filter @atria/web test -- src/features/reminders --reporter=verbose -t "pd[0-9]"`
  - Prova: as telas seguem as decisões do protótipo: cabeçalho do detalhe, visão geral em cartões, formulário na grade, data no calendário próprio com a hora em 24 h e coluna centralizada (DEC-002, PD-14, PD-19, PD-57, PD-59, PD-62).
  - Trecho: as linhas `✓` de `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações`, `pd59 shows the overview in cards with Lembrete, Anotações and Registro`, `pd62 lays the form in the grid with the repetition as a segmented field`, `pd57 picks the date in the custom calendar and types 930 as 09:30` e `pd19 centers the header and the form in the form column`.
  - Falha: `FAIL`, `✗` ou `×` em algum teste, ou a mensagem de que nenhum arquivo de teste foi encontrado.
- `reminders-e2e-specs.txt` (automática): `grep -n "test(" apps/web/src/features/reminders/reminders.e2e.ts`
  - Prova: os fluxos ponta a ponta de CT-25 estão escritos para a TASK-35.
  - Trecho: as linhas com `reminder notifies with the tab open`, `reminder shows inside the app when notifications are denied` e `web push subscription is sent when the admin turned it on`.
  - Falha: `No such file or directory` ou saída vazia.
- `reminders-telas.png` (manual): prints da lista de lembretes em lista e agrupada por dia, da lista vazia, carregando e com erro, do formulário na grade com a recorrência aberta e com o calendário da data aberto, do detalhe com a visão geral em cartões e o "Mais ações" aberto, do cartão de notificações nos estados "não pedida", "bloqueada" e "ativa com Web Push", do aviso dentro do app e de uma notificação do navegador disparada com a aba aberta, nos temas claro e escuro, em 360 px e em desktop, mais um print com o foco visível pelo teclado no botão "Ativar notificações". Capture com `pnpm --filter @atria/web dev`, montando localmente as rotas de `createRemindersRoutes` e o `ReminderNotifier` sem salvar mudança em `apps/web/src/app`.
  - Prova: identidade visual, tom calmo, os dois temas, 360 px e desktop, os estados da tela e da permissão e o foco por teclado (RNF-06, RNF-08, RNF-10).
  - Trecho: nenhum pedido de permissão antes do clique, o texto de bloqueio sem novo pedido e o anel de foco visível.
  - Falha: pedido de permissão ao abrir a tela, rolagem horizontal em 360 px, estado sem texto ou foco invisível.

### Concluída quando

- [ ] Lembretes pontuais e recorrentes são cadastrados com data e hora, numa listagem com filtros, busca e visualização na URL (RF-40, CT-25).

  > Como comprovar: em `reminders-tests.txt`, ver aprovados `creates a single reminder with date and time`, `creates a recurring reminder for one minute from now`, `filters reminders through the url` e `switches between list and grouped by day`.

- [ ] Com o Atria aberto numa aba e a permissão dada, o lembrete aparece como notificação do navegador uma única vez (RF-41, CT-25).

  > Como comprovar: em `reminders-tests.txt`, ver aprovados `notifies a reminder one minute from now with the tab open`, `does not notify the same occurrence twice` e `refetches when the tab becomes visible`.

- [ ] A permissão só é pedida quando a pessoa clica, e com a permissão negada o lembrete aparece dentro do app sem novo pedido (RF-41, CB-14).

  > Como comprovar: em `reminders-tests.txt`, ver aprovados `never asks for permission on mount`, `asks only when the person clicks`, `does not ask again when denied` e `shows the reminder inside the app when permission is denied`; a Verificação confirma que só o hook de permissão chama `requestPermission`.

- [ ] Com o Web Push ligado pelo admin e a permissão dada, a pessoa se inscreve e recebe o lembrete com a aba fechada; com o recurso desligado, nada é registrado (RF-42, CT-25).

  > Como comprovar: em `reminders-tests.txt`, ver aprovados `subscribes after the person turns it on`, `does nothing when the instance has web push off`, `shows the web push switch only when the instance has it on` e `shows the pushed reminder with its tag`.

- [ ] Editar e excluir aparecem na hora e são desfeitos com aviso se o servidor recusar (RNF-09).

  > Como comprovar: em `reminders-tests.txt`, ver aprovados `deletes a reminder optimistically` e `rolls back a reminder update when refused`.

- [ ] As telas têm estados vazio, carregando e erro, navegam por teclado e não têm violações no axe (RNF-06).

  > Como comprovar: em `reminders-tests.txt`, ver aprovado `shows empty, loading and error states` e o resumo sem falhas.

- [ ] As telas funcionam em 360 px e desktop, nos dois temas, em tom calmo e só com tokens do tema (RNF-08, RNF-10).

  > Como comprovar: abrir os prints de `reminders-telas.png` e conferir as telas e os estados da permissão nos dois temas e larguras; o último comando da Verificação não encontra cor literal.

- [ ] O lembrete tem detalhe com "Editar" com lápis, "Mais ações" com "Excluir" em vermelho e a visão geral em cartões (Lembrete, Anotações e Registro), sem ação de concluir (PD-14, PD-59, RN-19).

  > Como comprovar: em `reminders-pd-tests.txt`, ver aprovados `pd14 shows Editar with the pencil and Excluir in danger tone inside Mais ações` e `pd59 shows the overview in cards with Lembrete, Anotações and Registro`; em `reminders-tests.txt`, `deletes the reminder after confirmation from Mais ações`.

- [ ] O formulário usa a base da TASK-05: grade numa coluna centralizada, data no calendário próprio e hora em 24 h, repetição e visibilidade em grupo segmentado e as ações à direita (PD-19, PD-57, PD-62).

  > Como comprovar: em `reminders-pd-tests.txt`, ver aprovados `pd62 lays the form in the grid with the repetition as a segmented field`, `pd57 picks the date in the custom calendar and types 930 as 09:30` e `pd19 centers the header and the form in the form column`; o último comando da Verificação não encontra controle nativo.

- [ ] O formulário de recorrência usa o `FormRecurrence` da base com o horário obrigatório, e o detalhe mostra a repetição pelo `summarizeRule` da base, sem cópia local do editor (DEC-008, CB-02, CB-03).

  > Como comprovar: em `reminders-tests.txt`, ver aprovados `creates a recurring reminder for one minute from now` e `creates a recurring reminder with time and timezone`; a Verificação não acha `components/recurrence-fields.tsx` na feature e acha `FormRecurrence` no formulário e `summarizeRule` nas telas.

- [ ] Typecheck e lint passam sem warning, e o e2e da feature está escrito para a TASK-35.

  > Como comprovar: rodar o bloco de "Verificação" e ver que termina sem erro; `reminders-e2e-specs.txt` lista os três fluxos.

## Descrição

### Resumo executivo

Entrega as telas de Lembretes, pontuais e recorrentes, e os avisos no navegador com o Atria aberto, mais o recebimento com o Atria fechado quando o administrador liga esse recurso.
A permissão de notificações só é pedida quando a pessoa escolhe, e quem não quer notificações continua vendo os lembretes dentro do app.
Perfil padrão, risco médio: depende do comportamento de notificações de cada navegador, coberto por testes com relógio controlado.
Depende da base do frontend e dos contratos do servidor; destrava a integração final do frontend.

### Detalhes técnicos

**Abordagem.** Feature isolada em `apps/web/src/features/reminders`: telas sem regra de negócio, hooks do TanStack Query, um agendador para a aba aberta, um hook de permissão e um service worker só para o Web Push. As ocorrências e o horário em UTC vêm do servidor (TASK-10); o cliente só agenda e mostra. A feature exporta `createRemindersRoutes`, `remindersNav` e `ReminderNotifier` (em `index.ts`), que a TASK-35 monta uma vez no layout autenticado.

**Componentes.** Lista (`/reminders`, com `?kind=&q=&view=`), detalhe (`/reminders/$reminderId`) com a visão geral em cartões, formulário em rota própria (`/reminders/new`, `/reminders/$reminderId/edit`), cartão de notificações, `ReminderNotifier`, `service-worker.ts` com as funções puras de `handle-push.ts`.

**Decisões.**
- Com a aba aberta, agendamento no cliente: busca `GET /reminders/upcoming` (rota extra da TASK-10) das próximas 6 horas, agenda `setTimeout`, busca de novo a cada 15 minutos e ao voltar a aba. Descartadas: consultar o servidor a cada minuto (carga sem necessidade) e um canal de eventos do servidor (SSE), que não está no contrato.
- Notificação com `tag` igual a `<reminder_id>:<fire_at>`, nas duas vias, para o navegador substituir em vez de duplicar quando o Web Push também chega com a aba aberta.
- Permissão só por clique em "Ativar notificações" ([project/frontend-15]); negada, o lembrete aparece num aviso dentro do app e nunca se pede de novo (CB-14). Descartada: pedir ao abrir a tela, que os navegadores penalizam e a regra proíbe.
- Service worker dentro da feature, importado com `?worker&url` do Vite, sem cache e sem lógica offline (não é PWA, que está fora do escopo). Descartada: `apps/web/public/sw.js`, que fica fora do componente da tarefa. O escopo do service worker é a pasta dos assets, o que basta para o Web Push.
- Web Push só aparece quando a instância o ligou (RF-42, decisão 11); sem ele, o padrão é a notificação com a aba aberta (risco "Web Push indisponível na rede interna").
- Horário de verão (CB-04) resolvido no servidor: o cliente agenda pelo instante em UTC recebido, sem recalcular fuso.
- Campos de recorrência pelo `FormRecurrence` da base (DEC-008), com o horário obrigatório pelo `zod` desta feature, e a repetição resumida pelo `summarizeRule` da base; Financeiro e Tarefas (TASK-22 e TASK-24) usam o mesmo componente. Descartado: um `recurrence-fields.tsx` próprio da feature, que repetia o das outras duas e que a DEC-008 troca pelo componente da base.
- Detalhe próprio em `/reminders/$reminderId` (DEC-002, PD-14, PD-59), que a tarefa não tinha e que a aba Conexões da TASK-31 e o registro da TASK-35 já esperam; cabeçalho com "Editar" e "Mais ações", "Excluir" só dentro do menu. Descartado: só a listagem e o formulário, que deixariam a visão geral da PD-59 sem tela.
- Formulário com a base da TASK-05 (PD-19, PD-57, PD-62): `FormGrid`, `FormActions`, data e hora em `FormDateTime` (calendário próprio e hora em 24 h), repetição e visibilidade em `FormSegmented`, frequência em `FormSelect`, datas da regra em `FormDate` e horário em `FormTime`. A nota da PD-57 de que data e hora continuariam nativas foi superada pela PD-62 e pelo `DateTimeField` da TASK-05, criado para lembretes e diário. Descartado: `<input type="datetime-local">`, que muda em cada sistema.

**Riscos.** Abas em segundo plano podem atrasar `setTimeout`; o refetch ao voltar a aba e a verificação dos ids já disparados reduzem isso. A inscrição e a chave seguem as rotas extras da TASK-10 (`/web-push/public-key`, `/push-subscriptions`); o corpo exato de `POST /push-subscriptions` deve ser conferido em `@atria/contracts`. A mistura das libs `dom` e `webworker` no typecheck pode exigir o `tsconfig` de `apps/web` da TASK-05 aceitar o `/// <reference lib="webworker" />` do arquivo.

**Referências.** RF-40, RF-41, RF-42; CT-25; RN-08, RN-19; CB-02, CB-03, CB-04, CB-14; RNF-06, RNF-07, RNF-08, RNF-09, RNF-10; decisões 3 e 11 da spec; [project/frontend-15]; DEC-002, DEC-008; PD-14, PD-19, PD-57, PD-59 e PD-62 de `docs/decisoes-do-prototipo.md`.

**Arquivos em comum na onda 7.** Nenhum: cada feature só cria arquivos na própria pasta. O `FormRecurrence` e o `summarizeRule` vêm da base (TASK-05) e são só importados, também pela TASK-22 e pela TASK-24.

### Card

- **Título:** Telas de Lembretes
- **Tipo:** historia
- **Descrição:** Telas de Lembretes pontuais e recorrentes, com notificação no navegador com o Atria aberto e inscrição no Web Push quando o admin o ligou.
- **Critérios de aceite:**
  - [ ] Lembretes pontuais e recorrentes são cadastrados com data e hora.
  - [ ] Com a aba aberta, o lembrete notifica no navegador uma única vez.
  - [ ] A permissão só é pedida por clique, e negada o lembrete aparece no app.
  - [ ] Com o Web Push ligado, a pessoa se inscreve e recebe com a aba fechada.
  - [ ] O lembrete tem detalhe com "Editar", "Mais ações" com "Excluir" e a visão geral em cartões.
  - [ ] O formulário segue a grade da base, com a data no calendário próprio e a hora em 24 h.
  - [ ] A recorrência usa o editor e o resumo da regra da base, com horário obrigatório, sem cópia local.
  - [ ] Telas acessíveis, com estados vazio, carregando e erro, em 360 px e desktop, nos dois temas.
- **Rótulos:** SPEC-001, padrao
- **Estimativa:** padrao
- **Bloqueada por:** TASK-05, TASK-18

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
| 1 | 2026-10-30 | agente | Ler com docs/decisoes-do-prototipo.md, DEC-002 a DEC-004 e os componentes da TASK-05; PD-14 e PD-59: detalhe /reminders/$reminderId com Editar, Mais ações com Excluir e visão geral em cartões Lembrete, Anotações e Registro, com extra_tabs; PD-62, PD-57 e PD-19: FormGrid, FormActions, data e hora em FormDateTime, repetição e visibilidade em FormSegmented, frequência em FormSelect, datas da regra em FormDate, horário em FormTime e coluna centralizada; filtro por tipo no SelectField; Verificação sem controles nativos; evidência reminders-pd-tests.txt, Concluída quando, Detalhes técnicos e card atualizados; linha test -e da pasta da feature removida da Baseline, recusada pela validação |
| 2 | 2026-10-30 | agente | DEC-008: components/recurrence-fields.tsx removido de Mudar; passo 9 usa FormRecurrence da base com o horário (obrigatório pelo zod da feature) e summarizeRule(rule, locale) para a repetição; formulário (passo 14) e detalhe (passo 15) apontam para os componentes da base; Ler com a API da TASK-05 e DEC-008; Verificação com grep que rejeita a cópia local e exige FormRecurrence e summarizeRule; testes da tela mantidos; Concluída quando, Detalhes técnicos e card atualizados |
