// Página de evidência das telas de Metas: monta as rotas de `createGoalsRoutes` num roteador em
// memória, com os providers e o layout do app. Só o script `apps/web/scripts/evidence-goals.mjs`
// a carrega (por uma página virtual do Vite); o app e `apps/web/src/app` não a importam.
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '../../../app/providers';
import { createAppRouter, rootRoute } from '../../../app/router';
import '../../../app/global.css';
import { goalsNav } from '../nav';
import { createGoalsRoutes } from '../routes';

// A rota inicial vem de `?path=` (por exemplo, `/goals?view=grid`); sem ela, abre a lista.
const initial = new URLSearchParams(window.location.search).get('path') ?? '/goals';

const router = createAppRouter(createGoalsRoutes(rootRoute), {
  history: createMemoryHistory({ initialEntries: [initial] }),
  nav_items: [goalsNav],
});

// O roteador em memória não muda o endereço do navegador; o script lê a URL daqui.
(window as unknown as { __atria_router?: typeof router }).__atria_router = router;

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
