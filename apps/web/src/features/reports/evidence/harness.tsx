// Página de evidência visual da TASK-34 (fora do app e do build de produção): monta as rotas de
// `createReportsRoutes` num roteador em memória, com os providers e o layout do app, para o script
// `apps/web/scripts/evidence-reports.mjs` fotografar as telas antes de a TASK-35 registrá-las.
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '../../../app/providers';
import { createAppRouter, rootRoute } from '../../../app/router';
import '../../../app/global.css';
import { reportsNavItem } from '../nav';
import { createReportsRoutes } from '../routes';

declare global {
  interface Window {
    /** Lido pelo script de evidência para conferir a URL do roteador em memória. */
    __evidence?: { href: () => string };
  }
}

const initial = new URLSearchParams(window.location.search).get('path') ?? '/reports';
const router = createAppRouter(createReportsRoutes(rootRoute), {
  history: createMemoryHistory({ initialEntries: [initial] }),
  nav_items: [reportsNavItem],
});
window.__evidence = { href: () => router.state.location.href };

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
}
