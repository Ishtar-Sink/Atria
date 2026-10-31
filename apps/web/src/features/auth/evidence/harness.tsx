// Página de evidência das telas de auth: monta `createAuthRoutes` num roteador em memória com os
// providers do app. Só é carregada por `apps/web/scripts/evidence-auth.mjs`; o app não a importa.
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '../../../app/providers';
import { createAppRouter, rootRoute } from '../../../app/router';
import '../../../app/global.css';
import { createAuthRoutes } from '../routes';

// A rota inicial vem da URL da página: `?rota=/sign-in`.
const initial = new URLSearchParams(window.location.search).get('rota') ?? '/sign-in';
const history = createMemoryHistory({ initialEntries: [initial] });
const router = createAppRouter(createAuthRoutes(rootRoute, rootRoute), {
  history,
  nav_items: [],
});

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
