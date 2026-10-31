// Página de evidência da feature de Configurações: monta as rotas de `createSettingsRoutes` num
// roteador em memória, com os providers do app e dentro do layout. Só o script
// `apps/web/scripts/evidence-settings.mjs` a carrega (página virtual do Vite); o app não a importa.
// A rota inicial vem do parâmetro `to` da URL (ex.: `?to=/settings/instance`).
import { RouterProvider } from '@tanstack/react-router';
import { createMemoryHistory } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '../../../app/providers';
import { createAppRouter, rootRoute } from '../../../app/router';
import '../../../app/global.css';
import { createSettingsRoutes } from '../routes';

const params = new URLSearchParams(window.location.search);
const initial = params.get('to') ?? '/settings';

const router = createAppRouter(createSettingsRoutes(rootRoute), {
  history: createMemoryHistory({ initialEntries: [initial] }),
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
