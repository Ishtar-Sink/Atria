// Página de evidência visual da TASK-27 (não entra no app nem no build de produção): monta as rotas
// de `createJournalRoutes` num roteador em memória, com os providers e o layout do app, para o
// script `apps/web/scripts/evidence-journal.mjs` fotografar as telas antes de a TASK-35 registrá-las.
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '../../../app/providers';
import { createAppRouter, rootRoute } from '../../../app/router';
import '../../../app/global.css';
import { journalNavItem } from '../nav';
import { createJournalRoutes } from '../routes';

declare global {
  interface Window {
    /** Lido pelo script de evidência para conferir a URL do roteador em memória. */
    __evidence?: { href: () => string };
  }
}

const initial = new URLSearchParams(window.location.search).get('path') ?? '/journal';
const history = createMemoryHistory({ initialEntries: [initial] });
const router = createAppRouter(createJournalRoutes(rootRoute), {
  history,
  nav_items: [journalNavItem],
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
