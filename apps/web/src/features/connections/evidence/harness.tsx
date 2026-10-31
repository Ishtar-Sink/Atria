// Página de evidência visual da TASK-31 (não entra no app nem no build de produção): monta as rotas
// de `createConnectionsRoutes` e uma rota de teste com `ConnectionsTab` (uma nota de exemplo) num
// roteador em memória, com os providers e o layout do app, para o script
// `apps/web/scripts/evidence-connections.mjs` fotografar as telas antes de a TASK-35 registrá-las.
import { RouterProvider, createMemoryHistory, createRoute } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '../../../app/providers';
import { createAppRouter, rootRoute } from '../../../app/router';
import '../../../app/global.css';
import { StickyPageHeader } from '../../../shared/layout/sticky-page-header';
import { ConnectionsTab } from '../connections-tab';
import { createConnectionsRoutes } from '../routes';

declare global {
  interface Window {
    /** Lido pelo script de evidência para conferir a URL do roteador em memória. */
    __evidence?: { href: () => string };
  }
}

/** Nota de exemplo cuja aba Conexões é fotografada. */
const NOTE_ID = '0b6f7d52-3c1e-4a50-9f7b-1d2a8e4c5a01';

function NoteConnectionsPage() {
  return (
    <>
      <StickyPageHeader title="Ideias para a viagem de janeiro" eyebrow="Notas · Conexões" />
      <ConnectionsTab entity_type="note" entity_id={NOTE_ID} />
    </>
  );
}

const noteTab = createRoute({
  getParentRoute: () => rootRoute,
  path: '/evidence/note',
  component: NoteConnectionsPage,
  staticData: { title_key: 'connections.tab_title', breadcrumb_key: 'connections.tab_title' },
});

const initial = new URLSearchParams(window.location.search).get('path') ?? '/evidence/note';
const history = createMemoryHistory({ initialEntries: [initial] });
const router = createAppRouter([...createConnectionsRoutes(rootRoute), noteTab], {
  history,
  nav_items: [],
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
