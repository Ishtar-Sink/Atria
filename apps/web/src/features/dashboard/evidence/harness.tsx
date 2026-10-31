// Página de evidência do Dashboard: monta as rotas da feature num roteador em memória, com os
// providers e o layout do app. Só o script `scripts/evidence-dashboard.mjs` a carrega (página
// virtual do Vite); o app e `src/app` não a importam, então ela fica fora do build de produção.
import { RouterProvider } from '@tanstack/react-router';
import { createMemoryHistory } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '../../../app/providers';
import { createAppRouter, rootRoute } from '../../../app/router';
import '../../../app/global.css';
import { dashboardNav } from '../nav';
import { createDashboardRoutes } from '../routes';

const router = createAppRouter([createDashboardRoutes(rootRoute)], {
  history: createMemoryHistory({ initialEntries: ['/'] }),
  nav_items: [dashboardNav],
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
