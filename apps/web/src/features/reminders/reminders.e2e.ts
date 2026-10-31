import { expect, test, type Page } from '@playwright/test';
import { createECDH, randomBytes } from 'node:crypto';
import { api, expectNoAxeViolations, signIn as signInAs } from '../../app/e2e-session';
import { withInstanceSettings } from '../admin/e2e-support';

// Fluxo ponta a ponta de CT-25. Roda na TASK-35, com o servidor e as rotas de Lembretes
// registradas e o `ReminderNotifier` montado no layout: a pessoa cria um lembrete para daqui a
// um minuto e o Atria avisa uma vez, como notificação do navegador (permissão dada), como aviso
// dentro do app (permissão negada) ou por Web Push (recurso ligado pelo admin). Os projetos do
// Playwright cobrem o desktop e as larguras de 720, 480 e 360 px, com o axe no fim.

declare global {
  interface Window {
    __notifications: { title: string; tag: string | undefined }[];
    __push_keys: number[];
  }
}

async function signIn(page: Page) {
  await signInAs(page, 'user');
}

/**
 * Guarda as notificações criadas pela página, para a prova de que só uma apareceu. O Chromium sem
 * janela responde `denied` mesmo com a permissão concedida ao contexto: a permissão dada é
 * simulada aqui, como a negada no teste ao lado.
 */
async function recordNotifications(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window.Notification, 'permission', { get: () => 'granted' });
    window.__notifications = [];
    const Original = window.Notification;
    class Recorder extends Original {
      constructor(title: string, options?: NotificationOptions) {
        super(title, options);
        window.__notifications.push({ title, tag: options?.tag });
      }
    }
    window.Notification = Recorder;
  });
}

/**
 * O Chromium sem janela não tem serviço de push e fecha a página no `pushManager.subscribe`: o
 * dublê troca só o serviço de push do navegador (externo, como na rede sem internet) e guarda a
 * chave VAPID recebida. Registro do service worker, chave do servidor e envio da inscrição seguem
 * os do app.
 */
async function fakePushService(page: Page) {
  // Chaves válidas do navegador (P-256 e 16 bytes de `auth`): o servidor confere o formato.
  const ecdh = createECDH('prime256v1');
  const keys = {
    p256dh: ecdh.generateKeys().toString('base64url'),
    auth: randomBytes(16).toString('base64url'),
  };
  await page.addInitScript((keys) => {
    let current: PushSubscription | null = null;
    window.__push_keys = [];
    PushManager.prototype.subscribe = function (options?: PushSubscriptionOptionsInit) {
      const key = options?.applicationServerKey;
      window.__push_keys.push(
        key instanceof ArrayBuffer ? key.byteLength : (key as Uint8Array).length,
      );
      const endpoint = 'https://push.e2e.test/send/1';
      current = {
        endpoint,
        expirationTime: null,
        options: { userVisibleOnly: true, applicationServerKey: null },
        getKey: () => null,
        toJSON: () => ({ endpoint, keys }),
        unsubscribe: () => {
          current = null;
          return Promise.resolve(true);
        },
      };
      return Promise.resolve(current);
    };
    PushManager.prototype.getSubscription = () => Promise.resolve(current);
  }, keys);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

/** Cria um lembrete recorrente diário, uma vez por dia, no minuto seguinte ao relógio da página. */
/**
 * Cria o lembrete para o início de um minuto a pelo menos 60 s de agora e devolve esse instante.
 * Com `now + 60 s` truncado ao minuto, o horário podia cair a poucos segundos, e salvar e navegar
 * sob carga passava dele (a ocorrência ia para o dia seguinte).
 */
async function createReminderForNextMinute(page: Page, title: string): Promise<number> {
  await page.goto('/reminders/new');
  await page.getByLabel('Título').fill(title);
  await page.getByRole('radio', { name: 'Recorrente' }).click();
  const { hhmm, at } = await page.evaluate(() => {
    const date = new Date(Date.now() + 120_000);
    date.setSeconds(0, 0);
    const two = (value: number) => String(value).padStart(2, '0');
    return { hhmm: `${two(date.getHours())}${two(date.getMinutes())}`, at: date.getTime() };
  });
  await page.getByRole('textbox', { name: /Horário/ }).fill(hhmm);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  return at;
}

/**
 * Abre a lista e espera o agendador ler `/reminders/upcoming`: um timer criado depois do avanço
 * do relógio teria atraso negativo e seria descartado.
 */
async function openRemindersWithSchedule(page: Page) {
  const upcoming = page.waitForResponse((response) =>
    response.url().includes('/api/v1/reminders/upcoming'),
  );
  await page.goto('/reminders');
  await (await upcoming).finished();
  // O timer nasce depois de o corpo da resposta ser lido; o relógio falso não anda sozinho.
  await page.waitForTimeout(200);
}

/** Avança o relógio da página até 1 s depois do horário do lembrete. */
async function fastForwardPast(page: Page, at: number) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.fastForward(Math.max(at - now, 0) + 1_000);
}

test.describe('lembretes', () => {
  test.use({
    permissions: ['notifications'],
  });

  test('reminder notifies with the tab open', async ({ page }) => {
    await recordNotifications(page);
    await page.clock.install();
    await signIn(page);
    const at = await createReminderForNextMinute(page, 'Beber água');
    await openRemindersWithSchedule(page);
    await expect(page.getByText('Notificações ativas', { exact: false })).toBeVisible();

    await fastForwardPast(page, at);

    await expect
      .poll(() => page.evaluate(() => window.__notifications.map((item) => item.title)))
      .toEqual(['Beber água']);
    // Uma única vez, mesmo com a consulta seguinte.
    await page.clock.fastForward(16 * 60_000);
    const total = await page.evaluate(() => window.__notifications.length);
    expect(total).toBe(1);
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });
});

test.describe('lembretes sem permissão', () => {
  test('reminder shows inside the app when notifications are denied', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.Notification, 'permission', { get: () => 'denied' });
    });
    await page.clock.install();
    await signIn(page);
    const at = await createReminderForNextMinute(page, 'Beber água');
    await openRemindersWithSchedule(page);
    await expect(
      page.getByText(
        'As notificações do navegador estão bloqueadas. Os lembretes continuam aparecendo aqui no Atria.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ativar notificações' })).toHaveCount(0);

    await fastForwardPast(page, at);

    await expect(page.getByText(/Lembrete às .*: Beber água/)).toBeVisible();
    await expectNoHorizontalScroll(page);
    await expectNoAxeViolations(page);
  });
});

test.describe('web push', () => {
  test.use({
    permissions: ['notifications'],
  });

  test('web push subscription is sent when the admin turned it on', async ({ page, browser }) => {
    // Sem a chave VAPID o servidor não liga o Web Push: o servidor dos e2e precisa de
    // ATRIA_WEB_PUSH_VAPID_KEY_FILE (`docker-compose.e2e.yml`) para este teste.
    await recordNotifications(page);
    await fakePushService(page);
    await signIn(page);
    test.setTimeout(3 * 60_000);
    await withInstanceSettings(browser, async (before, admin) => {
      test.skip(
        !before.web_push_configured,
        'servidor dos e2e sem ATRIA_WEB_PUSH_VAPID_KEY_FILE: o Web Push não pode ser ligado',
      );
      await api(admin, 'PATCH', '/admin/instance/settings', { web_push_enabled: true });
      await expectSubscription(page);
    });
  });
});

/** A pessoa liga o interruptor e o navegador manda a inscrição do Web Push uma vez. */
async function expectSubscription(page: Page) {
  const subscriptions: unknown[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/push-subscriptions')) {
      subscriptions.push(request.postDataJSON());
    }
  });
  await page.goto('/reminders');

  const toggle = page.getByRole('switch', { name: 'Receber com o Atria fechado' });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(subscriptions).toHaveLength(0);

  await toggle.click();

  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(subscriptions).toHaveLength(1);
  // A chave pública VAPID do servidor (P-256 sem compressão, 65 bytes) chegou ao navegador.
  expect(await page.evaluate(() => window.__push_keys)).toEqual([65]);
  expect(subscriptions[0]).toMatchObject({
    endpoint: 'https://push.e2e.test/send/1',
    keys: { p256dh: expect.any(String), auth: expect.any(String) },
  });
  await expectNoHorizontalScroll(page);
  await expectNoAxeViolations(page);
}
