import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    { name: 'w720', use: { ...devices['Desktop Chrome'], viewport: { width: 720, height: 900 } } },
    { name: 'w480', use: { ...devices['Desktop Chrome'], viewport: { width: 480, height: 900 } } },
    { name: 'w360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } } },
  ],
});
