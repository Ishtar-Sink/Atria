import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers';
import { APP_SHELL } from './app/app-shell';
import { featureRoutes, NAV_ITEMS } from './app/feature-registry';
import { createAppRouter, rootRoute } from './app/router';
import './app/global.css';

// O registro é a única fonte das rotas e da sidebar (RF-20).
const router = createAppRouter(featureRoutes(rootRoute), {
  nav_items: NAV_ITEMS,
  shell: APP_SHELL,
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
