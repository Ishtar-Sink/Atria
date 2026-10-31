import { expect, test } from '@playwright/test';
import {
  api,
  createSampleEntities,
  expectNoHorizontalScroll,
  setTheme,
  signIn,
} from './e2e-session';

// RNF-08 e RNF-10: capturas das telas principais em quatro larguras e dois temas, para a
// revisão contra o protótipo, sem rolagem horizontal. Roda uma vez, no projeto `desktop`.

const WIDTHS = [360, 480, 720, 1280];
const THEMES = ['light', 'dark'] as const;
const DIR = 'visual-screenshots';

test('capturas das telas principais em 360, 480, 720 e 1280 px, claro e escuro', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'a captura percorre as larguras sozinha');
  test.setTimeout(10 * 60 * 1000);
  await signIn(page, 'user', 'dashboard');
  const samples = await createSampleEntities(page);
  const goal = samples.find((item) => item.entity_type === 'goal');
  const project = samples.find((item) => item.entity_type === 'project');
  await api(page, 'POST', '/books', { title: 'O Nome da Rosa', reading_status: 'reading' });
  const screens = [
    { name: 'dashboard', path: '/' },
    { name: 'finance-transactions', path: '/finance/expenses' },
    { name: 'goal-connections', path: `${goal?.url ?? ''}?tab=connections` },
    { name: 'journal', path: '/journal' },
    { name: 'library-shelf', path: '/library' },
    { name: 'projects-kanban', path: `${project?.url ?? ''}?tab=board` },
  ];
  for (const screen of screens) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of THEMES) {
        await page.goto(screen.path);
        await setTheme(page, theme);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await page.waitForLoadState('networkidle');
        await expectNoHorizontalScroll(page);
        await page.screenshot({
          path: `${DIR}/${screen.name}-${String(width)}-${theme}.png`,
          fullPage: true,
          animations: 'disabled',
        });
      }
    }
  }
});
