import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { e2eSignInPlugin } from './src/app/e2e-sign-in-plugin';

export default defineConfig(({ mode }) => ({
  // A entrada `/__test__/sign-in` só existe no preview do build e2e (TASK-35).
  plugins: [react(), ...(mode === 'e2e' ? [e2eSignInPlugin()] : [])],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/healthz': 'http://localhost:8080',
    },
  },
  build: {
    // Sem script nem recurso inline: a CSP do servidor não os aceita.
    modulePreload: { polyfill: false },
    assetsInlineLimit: 0,
  },
  css: { modules: { localsConvention: 'camelCaseOnly' } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/shared/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/**/*.e2e.ts', 'node_modules'],
    css: { include: /.+/, modules: { classNameStrategy: 'non-scoped' } },
  },
}));
