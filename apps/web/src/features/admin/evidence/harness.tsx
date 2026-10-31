// Página de evidência da feature de administração: monta as rotas de `createAdminRoutes` num
// roteador em memória, com os providers do app e dentro do layout. Só o script
// `apps/web/scripts/evidence-admin.mjs` a carrega (página virtual do Vite); o app não a importa.
// A rota inicial vem do parâmetro `to` da URL (ex.: `?to=/admin/users?view=table`).
import { RouterProvider } from '@tanstack/react-router';
import { createMemoryHistory } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '../../../app/providers';
import { createAppRouter, rootRoute } from '../../../app/router';
import '../../../app/global.css';
import { adminNav } from '../nav';
import { createAdminRoutes } from '../routes';

const params = new URLSearchParams(window.location.search);
const initial = params.get('to') ?? '/admin/users';

const router = createAppRouter(createAdminRoutes(rootRoute), {
  history: createMemoryHistory({ initialEntries: [initial] }),
  nav_items: [adminNav],
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
