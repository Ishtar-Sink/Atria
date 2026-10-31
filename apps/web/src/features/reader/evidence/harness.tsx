// Página de evidência visual da TASK-29 (não entra no app nem no build de produção): monta as rotas
// de `createReaderRoutes` num roteador em memória, com os providers do app e fora do layout (como a
// TASK-35 as registra), para o script `apps/web/scripts/evidence-reader.mjs` fotografar o leitor.
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '../../../app/providers';
import { createAppRouter, rootRoute } from '../../../app/router';
import '../../../app/global.css';
import { createReaderRoutes } from '../routes';

declare global {
  interface Window {
    /** Lido pelo script de evidência para conferir a URL do roteador em memória. */
    __evidence?: { href: () => string };
  }
}

const initial = new URLSearchParams(window.location.search).get('path') ?? '/';
const history = createMemoryHistory({ initialEntries: [initial] });
const router = createAppRouter(createReaderRoutes(rootRoute), { history, nav_items: [] });
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
