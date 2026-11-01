import { defineConfig, devices, type Project } from '@playwright/test';

// Saída fora de `test-results/`, que o Prettier do lint percorreria.
const OUTPUT_DIR = 'node_modules/.cache/atria-e2e/test-results';
/** Sessão de uma pessoa comum, gravada pelo projeto `setup` (TASK-35). */
export const USER_STATE = 'node_modules/.cache/atria-e2e/user.json';

// Estes e2e supõem a sessão já aberta; os demais entram por `/__test__/sign-in` ou pelas telas.
const WITH_SESSION = /features\/(finance|tasks|journal)\/.*\.e2e\.ts$/;

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'w720', viewport: { width: 720, height: 900 } },
  { name: 'w480', viewport: { width: 480, height: 900 } },
  { name: 'w360', viewport: { width: 360, height: 780 } },
];

// O usuário usa o Zen (Firefox): os e2e marcados `@firefox` rodam também no Firefox com
// `ATRIA_E2E_FIREFOX=1` (RNF-06). Sem a variável, o `pnpm e2e` da CI, que instala só o
// Chromium, mantém os 9 projetos de hoje.
const FIREFOX_PROJECTS: Project[] = [
  {
    name: 'firefox',
    grep: /@firefox/,
    testIgnore: WITH_SESSION,
    use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } },
  },
  {
    name: 'firefox-session',
    grep: /@firefox/,
    testMatch: WITH_SESSION,
    dependencies: ['setup'],
    use: {
      ...devices['Desktop Firefox'],
      viewport: { width: 1280, height: 800 },
      storageState: USER_STATE,
    },
  },
];

const projects: Project[] = [
  { name: 'setup', testMatch: /e2e-auth\.setup\.ts$/ },
  ...VIEWPORTS.flatMap(({ name, viewport }) => [
    { name, testIgnore: WITH_SESSION, use: { ...devices['Desktop Chrome'], viewport } },
    {
      name: `${name}-session`,
      testMatch: WITH_SESSION,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], viewport, storageState: USER_STATE },
    },
  ]),
  ...(process.env['ATRIA_E2E_FIREFOX'] === '1' ? FIREFOX_PROJECTS : []),
];

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.e2e.ts',
  outputDir: OUTPUT_DIR,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    // O modo `e2e` liga a entrada `/__test__/sign-in` do preview (TASK-35).
    command:
      'pnpm exec tsc --noEmit && pnpm exec vite build --mode e2e && pnpm exec vite preview --mode e2e --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
  },
  projects,
});
