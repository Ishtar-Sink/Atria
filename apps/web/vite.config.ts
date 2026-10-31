import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
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
});
