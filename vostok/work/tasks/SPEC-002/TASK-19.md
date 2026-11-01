---
id: TASK-19
spec: SPEC-002
title: "Aviso de Web Push desligado em Lembretes"
profile: padrao
persona: desenvolvedor
depends_on: []
wave: 1
covers: [RF-16, CT-15, CB-07]
type: bug
labels: [SPEC-002, padrao]
status: done
content_hash: 0c10725354634a0c149a5aa7ac766e8890be25332463b4230ff9d1189912c1a6
adjustments: 0
adjusted_at: null
approved_at: 2026-11-01T02:17:06Z
approved_hash: 820ace2c194a2832cffb385c522a2ea8b2cf3f3c617d2267ca440c839ffb0fa2
attempts: 0
tests_result: passed
regression_result: passed
evidence_result: passed
model: claude-sonnet-5-5
---

# TASK-19: Aviso de Web Push desligado em Lembretes

## Execução

### Ler

- `vostok/work/specs/refined/SPEC-002-correcoes-do-uso-real-do-mvp.md` (Estado atual "Lembretes (Bug 13)"; RF-16; CT-15; CB-07; FA-05)
- `prototype/atria-prototype.html` (regras `.card`, `.field-hint` e `.check`, e o tom calmo dos avisos: sem vermelho para uma pendência comum)
- `apps/web/src/features/reminders/push/use-web-push.ts`
- `apps/web/src/features/reminders/push/use-web-push.test.tsx` (fns `installFetch`, `installBrowser` e `setup`; teste `does nothing when the instance has web push off`)
- `apps/web/src/features/reminders/components/notification-settings-card.tsx`
- `apps/web/src/features/reminders/components/notification-settings-card.module.css`
- `apps/web/src/features/reminders/hooks/use-notification-permission.ts` (estados `default`, `granted`, `denied` e `unsupported`)
- `apps/web/src/features/reminders/i18n/pt-br.json` (chaves `permission.*` e `push.*`)
- `apps/web/src/features/reminders/screens/reminders-screens.test.tsx` (só leitura: fns `installPushSupport` e o stub de `/web-push/public-key` com `web_push_disabled`, molde do teste novo)
- `apps/web/src/app/layout/sidebar.tsx` (só leitura: como o papel é lido de `useCurrentUser()` com `'role' in user`)
- `apps/web/src/shared/session/current-user.ts`
- `apps/web/src/shared/test/render.tsx` (fn `renderWithProviders`)
- `apps/web/scripts/evidence-reminders.mjs` (constante `OUT`, fns `installApi`, `installBrowserFakes`, `openPage`, `runScenarios`, o cenário `notificações ativas com Web Push` e `EVIDENCES`)
- `vostok/rules/project/frontend.md` ([project/frontend-02], [project/frontend-14], [project/frontend-15])

### Mudar

- `apps/web/src/features/reminders/push/use-web-push.ts` (alterar): devolver `unavailable_reason` (`'unsupported'`, `'disabled'` ou `null`), o motivo de o aviso com o app fechado não estar disponível (RF-16, CB-07).
- `apps/web/src/features/reminders/push/use-web-push.test.tsx` (alterar): testes do motivo da indisponibilidade.
- `apps/web/src/features/reminders/components/notification-settings-card.tsx` (alterar): aviso de push desligado na instância, de navegador sem suporte e de aparelho não inscrito, com o link para Configurações › Instância para quem administra.
- `apps/web/src/features/reminders/components/notification-settings-card.module.css` (alterar): estilo do aviso em tom neutro, com o fundo `*Soft` do estado.
- `apps/web/src/features/reminders/components/notification-settings-card.test.tsx` (criar): testes de componente do cartão nos quatro estados do push, com axe.
- `apps/web/src/features/reminders/i18n/pt-br.json` (alterar): textos dos avisos e do link.
- `apps/web/scripts/evidence-reminders.mjs` (alterar): grava a prancha em `$VOSTOK_EVIDENCE` (padrão `vostok/work/tasks/SPEC-002/evidence/TASK-19`) e ganha a evidência `push` com os avisos.

### Passos

1. Leia os arquivos de "Ler". Hoje `useWebPush` devolve `available: false` tanto quando o navegador não tem `serviceWorker`/`PushManager` (a consulta da chave nem roda) quanto quando o servidor responde 404 `web_push_disabled` em `GET /web-push/public-key` (a consulta devolve `null`), e o cartão só esconde o bloco do interruptor.
2. Em `apps/web/src/features/reminders/push/use-web-push.test.tsx`, escreva antes do código `reports disabled when the instance has web push off` (com `web_push_on = false` e o navegador com suporte, `result.current.unavailable_reason` fica `'disabled'` depois da consulta da chave) e `reports unsupported when the browser has no push manager` (sem `PushManager` em `window`, `unavailable_reason` é `'unsupported'` e `GET /web-push/public-key` não é chamado); e acrescente ao teste `subscribes after the person turns it on` a asserção `unavailable_reason === null`. Rode `pnpm --filter @atria/web exec vitest run src/features/reminders/push` e confirme que os novos falham.
3. Em `apps/web/src/features/reminders/push/use-web-push.ts`, exporte `type PushUnavailableReason = 'unsupported' | 'disabled'`, guarde `const supported = browserSupportsPush()` (use no `enabled` da consulta) e calcule `const unavailable_reason: PushUnavailableReason | null = !supported ? 'unsupported' : key.data === null ? 'disabled' : null;` (enquanto a consulta carrega ou falha por outro motivo, `key.data` é `undefined` e o motivo fica `null`). Devolva `unavailable_reason` junto dos campos atuais. Rode os testes do passo 2 até passarem.
4. Em `apps/web/src/features/reminders/i18n/pt-br.json`, acrescente depois de `push.error`:
   - `"push.disabled": "O aviso com o Atria fechado está desligado nesta instância. Quem administra pode ligar em Configurações › Instância."`
   - `"push.disabled_admin": "O aviso com o Atria fechado está desligado nesta instância. Ligue em Configurações › Instância."`
   - `"push.open_instance_settings": "Abrir Configurações › Instância"`
   - `"push.unsupported": "Este navegador não oferece o aviso com o Atria fechado. Os lembretes continuam aparecendo aqui no Atria."`
   - `"push.not_subscribed": "Este aparelho ainda não recebe o aviso com o Atria fechado. Ligue o interruptor para receber."`
5. Crie `apps/web/src/features/reminders/components/notification-settings-card.test.tsx` antes de mudar o cartão, com `renderWithProviders(<NotificationSettingsCard />)`, `Notification` com permissão `granted` e um stub de `fetch` que responde `GET /me` (com `role: 'user'` ou `role: 'admin'`) e `GET /web-push/public-key` (200 com a chave ou 404 `{ code: 'web_push_disabled' }`), no molde de `installPushSupport` de `reminders-screens.test.tsx`. Testes:
   - `explains that web push is off in the instance for a regular person`: com 404, aparece o texto de `push.disabled`, sem link e sem interruptor (RF-16, CT-15);
   - `links the admin to the instance settings when web push is off`: com 404 e `role: 'admin'`, aparece `push.disabled_admin` e um link "Abrir Configurações › Instância" com `href` `/settings/instance` (CT-15, FA-05);
   - `says the browser does not offer web push`: sem `PushManager` em `window`, aparece `push.unsupported` e não há link para o administrador nem pedido da chave (CB-07);
   - `asks to turn the switch on when the device is not subscribed`: com a chave e sem inscrição guardada, aparecem o interruptor "Receber com o Atria fechado" com `aria-checked="false"` e o texto de `push.not_subscribed`; depois de inscrito, o texto some;
   - `has no axe violations in every push state`: `axe(container)` sem violações nos quatro estados.
   Rode `pnpm --filter @atria/web exec vitest run src/features/reminders/components` e confirme que falham.
6. Em `apps/web/src/features/reminders/components/notification-settings-card.tsx`:
   - leia `const { data: user } = useCurrentUser()` (de `../../../shared/session/current-user`) e `const is_admin = user !== undefined && 'role' in user && user.role === 'admin'`, como a barra lateral;
   - mantenha o bloco do interruptor quando `push.available`; dentro de `.text`, depois de `push.help`, mostre `<p className={styles.notice}>{t('reminders.push.not_subscribed')}</p>` quando `!push.subscribed`;
   - quando `push.unavailable_reason === 'disabled'`, mostre `<div className={styles.notice}>` com `<p>{t(is_admin ? 'reminders.push.disabled_admin' : 'reminders.push.disabled')}</p>` e, só para `is_admin`, `<Link to="/settings/instance" className={styles.noticeLink}>{t('reminders.push.open_instance_settings')}</Link>` (`Link` de `@tanstack/react-router`);
   - quando `push.unavailable_reason === 'unsupported'`, mostre `<p className={styles.notice}>{t('reminders.push.unsupported')}</p>`, sem link;
   - o aviso não usa `role="alert"` (não é erro) nem a cor de perigo ([project/frontend-14]).
7. Em `apps/web/src/features/reminders/components/notification-settings-card.module.css`, acrescente `.notice { margin: var(--s3) 0 0; padding: var(--s2) var(--s3); border-radius: var(--radius-md); background: var(--info-soft); color: var(--text); font-size: var(--font-size-sm); }`, `.notice p { margin: 0; }` e `.noticeLink { display: inline-block; margin-top: var(--s1); color: var(--primary); font-weight: 600; }` com `.noticeLink:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: var(--radius-sm); }`. Só tokens do tema. Rode os testes do passo 5 até passarem.
8. Em `apps/web/scripts/evidence-reminders.mjs`:
   - troque `OUT` por `const OUT = process.env.VOSTOK_EVIDENCE ?? join(ROOT, 'vostok', 'work', 'tasks', 'SPEC-002', 'evidence', 'TASK-19');` e atualize o comentário do topo;
   - `installApi(context, mode, gate, { push = 'on', role = 'user' } = {})`: `GET /me` devolve também `role`, e `GET /web-push/public-key` responde 404 `{ title: 'Web Push desligado', code: 'web_push_disabled' }` quando `push === 'off'`; `openPage` repassa `sc.push` e `sc.role`, e `installBrowserFakes(context, permission, { push_support = true } = {})` não define `PushManager` nem `navigator.serviceWorker` quando `push_support` é `false` (apague `window.PushManager` no script de início);
   - crie a lista `pushScenarios`, todos em `path: '/reminders'` e `permission: 'granted'`, desktop e 360 px nos dois temas: `push desligado · pessoa comum` (`push: 'off'`; confere o texto "está desligado nesta instância" visível e nenhum link "Abrir Configurações › Instância"), `push desligado · administrador` (`push: 'off'`, `role: 'admin'`; confere o link com `href` `/settings/instance`), `navegador sem Web Push` (`push_support: false`; confere o texto "Este navegador não oferece o aviso") e `aparelho não inscrito` (confere o interruptor com `aria-checked="false"` e o texto "Este aparelho ainda não recebe"); em todos, `check(`${tag}: aviso sem vermelho`, ...)` com a cor calculada do aviso diferente da de `--danger`;
   - registre em `EVIDENCES` a chave `push`, que roda `pushScenarios` e grava `reminders-push.png`, e mude a mensagem de uso para "Use telas ou push".
9. Rode o bloco de "Verificação" e corrija até passar sem warnings. Depois rode `node apps/web/scripts/evidence-reminders.mjs push` e `node apps/web/scripts/evidence-reminders.mjs telas`, corrija o código da tarefa a cada linha `FALHA` até a última linha ser `ok  0 falha(s)` e abra a prancha `reminders-push.png` para conferir os avisos nos dois temas e larguras.

### Baseline

- `pnpm --filter @atria/web exec vitest run src/features/reminders --reporter=verbose 2>&1 | grep -E '^\s*(✓|×|↓)' | sed -E 's/ [0-9]+ms$//' | sort`
- `pnpm --filter @atria/web exec eslint src/features/reminders --max-warnings 0`
- `pnpm --filter @atria/web exec prettier --check src/features/reminders scripts/evidence-reminders.mjs 2>&1 | tail -1`
- `pnpm --filter @atria/web typecheck`
- `node --check apps/web/scripts/evidence-reminders.mjs && echo sintaxe-ok`

### Verificação

```bash
# Testes do push e do cartão de notificações (Vitest + Testing Library + axe)
# evidência: push-testes.txt
pnpm --filter @atria/web exec vitest run src/features/reminders --reporter=verbose
# Lint, formatação e tipos sem nenhum erro ou warning
pnpm --filter @atria/web exec eslint src/features/reminders --max-warnings 0
pnpm --filter @atria/web exec prettier --check src/features/reminders scripts/evidence-reminders.mjs
pnpm --filter @atria/web typecheck
node --check apps/web/scripts/evidence-reminders.mjs
# Nenhuma cor literal no CSS do cartão
! grep -nE '#[0-9a-fA-F]{3,6}\b|rgba?\(' apps/web/src/features/reminders/components/notification-settings-card.module.css
```

### Evidências

- `push-testes.txt` (automática, da verificação)
  - Prova: o cartão de notificações explica o Web Push desligado na instância, o navegador sem suporte e o aparelho não inscrito, e leva quem administra a Configurações › Instância, sem violações no axe (RF-16, CT-15, CB-07).
  - Trecho: as linhas `✓` de `reports disabled when the instance has web push off`, `reports unsupported when the browser has no push manager`, `explains that web push is off in the instance for a regular person`, `links the admin to the instance settings when web push is off`, `says the browser does not offer web push`, `asks to turn the switch on when the device is not subscribed` e `has no axe violations in every push state`, e o resumo sem falhas.
  - Falha: `FAIL`, `×` em algum teste ou um desses nomes ausente.
- `reminders-push.png` (print): `node apps/web/scripts/evidence-reminders.mjs push`
  - Prova: na tela de Lembretes montada com a API simulada, os avisos aparecem para a pessoa comum, para o administrador com o link, para o navegador sem suporte e para o aparelho não inscrito, nos dois temas, em desktop e 360 px, sem vermelho (RF-16, CT-15, CB-07, FA-05, RNF-03).
  - Trecho: as linhas `ok` dos cenários `push desligado · pessoa comum`, `push desligado · administrador`, `navegador sem Web Push` e `aparelho não inscrito`, `ok ... aviso sem vermelho`, `ok ... axe sem violações`, a linha `png:` e a última linha `ok  0 falha(s)`; na imagem, o aviso dentro do cartão de notificações.
  - Falha: qualquer linha `FALHA`, `Evidência desconhecida`, a ausência da linha `png:` ou código de saída diferente de 0.

### Concluída quando

- [x] Com o Web Push desligado na instância, o cartão de notificações explica que o aviso com o app fechado está desligado e como ligar (RF-16, CT-15).

  > Como comprovar: em `push-testes.txt`, ver aprovados `reports disabled when the instance has web push off` e `explains that web push is off in the instance for a regular person`; em `reminders-push.png`, o cenário `push desligado · pessoa comum` com `ok` e o aviso visível.

- [x] Quem administra vê o link para Configurações › Instância (RF-16, CT-15, FA-05).

  > Como comprovar: em `push-testes.txt`, ver aprovado `links the admin to the instance settings when web push is off`; em `reminders-push.png`, o cenário `push desligado · administrador` com `ok`.

- [x] Num navegador sem Web Push, o cartão diz que o navegador não oferece o aviso, sem pedir ao administrador (CB-07).

  > Como comprovar: em `push-testes.txt`, ver aprovados `reports unsupported when the browser has no push manager` e `says the browser does not offer web push`; em `reminders-push.png`, o cenário `navegador sem Web Push` com `ok`.

- [x] Com o recurso ligado e o aparelho não inscrito, o cartão pede para ligar o interruptor (RF-16).

  > Como comprovar: em `push-testes.txt`, ver aprovado `asks to turn the switch on when the device is not subscribed`; em `reminders-push.png`, o cenário `aparelho não inscrito` com `ok`.

- [x] Os avisos ficam em tom calmo, sem vermelho, acessíveis nos dois temas e em 360 px.

  > Como comprovar: em `push-testes.txt`, ver aprovado `has no axe violations in every push state`; em `reminders-push.png`, `aviso sem vermelho` com `ok` e a última linha `ok  0 falha(s)`.

## Descrição

### Resumo executivo

Faz o cartão de notificações de Lembretes explicar por que o aviso com o Atria fechado não está disponível, em vez de esconder a opção.
A pessoa entende se o recurso está desligado na instância, se o navegador não o oferece ou se falta ligar no aparelho, e quem administra ganha o atalho para ligar.
Perfil padrão, risco baixo: muda só textos e o cartão, sem contrato novo.
Não depende de outra tarefa e não bloqueia nenhuma.

### Detalhes técnicos

**Abordagem.** O hook `useWebPush` passa a devolver `unavailable_reason`: `'unsupported'` quando o navegador não tem `serviceWorker` e `PushManager`, `'disabled'` quando `GET /web-push/public-key` responde 404 `web_push_disabled`, e `null` nos demais casos. O `NotificationSettingsCard` mostra um aviso para cada motivo e, com o recurso ligado e o aparelho não inscrito, uma linha pedindo para ligar o interruptor. Para quem tem papel `admin`, lido de `GET /me` como na barra lateral, o aviso traz o link para `/settings/instance`.

**Causa confirmada.** Com o Web Push desligado na instância, o cartão escondia o bloco do push sem explicação (Estado atual, Bug 13).

**Componentes.** `use-web-push.ts`, `notification-settings-card.tsx` e o CSS dele, `i18n/pt-br.json` de Lembretes, os testes vizinhos e o script de evidência `evidence-reminders.mjs`.

**Decisões.**
- Motivo calculado no hook, a tela só escolhe o texto ([project/code-style-09]). Descartado: o cartão inspecionar o navegador e a resposta da API.
- Papel lido de `useCurrentUser()` como na barra lateral. Descartado: importar `useViewerRole` de `features/settings`, que ligaria Lembretes a Configurações.
- Aviso em tom neutro com `--info-soft`, sem `role="alert"` e sem vermelho ([project/frontend-14], [project/frontend-02]). Descartado: o estilo de erro, reservado para falha ao mudar o recebimento.
- Navegador sem suporte não sugere procurar o administrador (CB-07).

**Evidências visuais.** O script `apps/web/scripts/evidence-reminders.mjs` (TASK-25 da SPEC-001) sobe o Vite com o harness de Lembretes, a API simulada e o navegador com `Notification` e `pushManager` simulados; esta tarefa o faz gravar em `$VOSTOK_EVIDENCE` e cria a evidência `push`.

**Riscos.** A TASK-18 (onda 2) muda `reminders-screen.tsx`, que monta este cartão, e usa `reminders-screens.test.tsx`; esta tarefa não altera esses dois arquivos. No baseline, o print roda com o script antigo, que não conhece `push` e sai com código 2; a pasta `vostok/work/tasks/SPEC-001` que ele possa criar pode ser apagada depois.

**Referências.** RF-16; CT-15; CB-07; FA-05; [project/frontend-14], [project/frontend-15].

**Arquivos em comum na onda 1.** Nenhum: os arquivos são só de Lembretes.

### Card

- **Título:** Aviso de Web Push desligado em Lembretes
- **Tipo:** bug
- **Descrição:** O cartão de notificações de Lembretes explica quando o aviso com o app fechado está desligado na instância, não é oferecido pelo navegador ou não está ligado no aparelho, com o caminho para ligar.
- **Critérios de aceite:**
  - [ ] Com o Web Push desligado na instância, aparece o aviso com o caminho para ligar.
  - [ ] O administrador vê o link para Configurações › Instância.
  - [ ] Navegador sem suporte recebe um aviso próprio, sem pedir ao administrador.
  - [ ] Aparelho não inscrito recebe o pedido para ligar o interruptor.
  - [ ] Avisos em tom calmo, acessíveis nos dois temas e em 360 px.
- **Rótulos:** SPEC-002, padrao
- **Estimativa:** padrao
- **Bloqueada por:** -

## Registro de execução

| # | Data | Etapa | Resultado | Detalhe |
|---|---|---|---|---|
| 1 | 2026-11-01 | início | in_progress | aprovada em 2026-11-01T02:17:06Z; modelo: claude-sonnet-5-5 |
| 2 | 2026-11-01 | baseline | coletado | 5 comando(s); códigos de saída: 0, 0, 0, 0, 0 |
| 3 | 2026-11-01 | testes | passed | Verificação sem falhas; saída em validation/tests.out |
| 4 | 2026-11-01 | regressão | passed | 4 comando(s) iguais ao baseline; 1 com acréscimo |
| 5 | 2026-11-01 | evidências | pending | print sem conferência humana |
| 6 | 2026-11-01 | conferência | usuário | print reminders-push.png conferido pelo usuário (sha256 f4c05947) |
| 7 | 2026-11-01 | evidências | passed | 2 evidência(s) em evidence/TASK-19/ |
| 8 | 2026-11-01 | conclusão | done | testes, regressão e evidências passed; critérios de conclusão marcados |

## Histórico de ajustes

| # | Data | Origem | Resumo |
|---|---|---|---|
