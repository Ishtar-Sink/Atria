import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fluxo ponta a ponta de CT-25. Roda na TASK-35, com o servidor e as rotas de Lembretes
// registradas e o `ReminderNotifier` montado no layout: a pessoa cria um lembrete para daqui a
// um minuto e o Atria avisa uma vez, como notificação do navegador (permissão dada), como aviso
// dentro do app (permissão negada) ou por Web Push (recurso ligado pelo admin) — em 360 px e em
// desktop, com o axe no fim.

const SIZES = [
  { name: '360', width: 360, height: 760 },
  { name: 'desktop', width: 1280, height: 800 },
];

declare global {
  interface Window {
    __notifications: { title: string; tag: string | undefined }[];
  }
}

async function signIn(page: Page) {
  await page.goto('/__test__/sign-in?role=user');
}

/** Guarda as notificações criadas pela página, para a prova de que só uma apareceu. */
async function recordNotifications(page: Page) {
  await page.addInitScript(() => {
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

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
}

/** Cria um lembrete recorrente diário, uma vez por dia, no minuto seguinte ao relógio da página. */
async function createReminderForNextMinute(page: Page, title: string) {
  await page.goto('/reminders/new');
  await page.getByLabel('Título').fill(title);
  await page.getByRole('radio', { name: 'Recorrente' }).click();
  const next = await page.evaluate(() => {
    const date = new Date(Date.now() + 60_000);
    const two = (value: number) => String(value).padStart(2, '0');
    return `${two(date.getHours())}${two(date.getMinutes())}`;
  });
  await page.getByRole('textbox', { name: /Horário/ }).fill(next);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

for (const size of SIZES) {
  test.describe(`lembretes em ${size.name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      permissions: ['notifications'],
    });

    test('reminder notifies with the tab open', async ({ page }) => {
      await recordNotifications(page);
      await page.clock.install();
      await signIn(page);
      await createReminderForNextMinute(page, 'Beber água');
      await page.goto('/reminders');
      await expect(page.getByText('Notificações ativas', { exact: false })).toBeVisible();

      await page.clock.fastForward(61_000);

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

  test.describe(`lembretes sem permissão em ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('reminder shows inside the app when notifications are denied', async ({ page }) => {
      await page.addInitScript(() => {
        Object.defineProperty(window.Notification, 'permission', { get: () => 'denied' });
      });
      await page.clock.install();
      await signIn(page);
      await createReminderForNextMinute(page, 'Beber água');
      await page.goto('/reminders');
      await expect(
        page.getByText(
          'As notificações do navegador estão bloqueadas. Os lembretes continuam aparecendo aqui no Atria.',
        ),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ativar notificações' })).toHaveCount(0);

      await page.clock.fastForward(61_000);

      await expect(page.getByText(/Lembrete às .*: Beber água/)).toBeVisible();
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
    });
  });

  test.describe(`web push em ${size.name}`, () => {
    test.use({
      viewport: { width: size.width, height: size.height },
      permissions: ['notifications'],
    });

    test('web push subscription is sent when the admin turned it on', async ({ page }) => {
      await signIn(page);
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
      expect(subscriptions[0]).toMatchObject({
        endpoint: expect.any(String),
        keys: { p256dh: expect.any(String), auth: expect.any(String) },
      });
      await expectNoHorizontalScroll(page);
      await expectNoAxeViolations(page);
    });
  });
}
