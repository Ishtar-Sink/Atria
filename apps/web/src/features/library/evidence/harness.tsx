// Página de evidência visual da TASK-28 (não entra no app nem no build de produção): monta as rotas
// de `createLibraryRoutes` num roteador em memória, com os providers e o layout do app, para o
// script `apps/web/scripts/evidence-library.mjs` fotografar as telas antes de a TASK-35 registrá-las. Monta também as abas extras de livro e artigo (Destaques e
// Conexões) com `entityExtraTabs`, como o app.
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '../../../app/providers';
import { entityExtraTabs } from '../../../app/entity-layout';
import { createAppRouter, rootRoute } from '../../../app/router';
import '../../../app/global.css';
import { libraryNavItem } from '../nav';
import { createLibraryRoutes } from '../routes';

declare global {
  interface Window {
    /** Lido pelo script de evidência para conferir a URL do roteador em memória. */
    __evidence?: { href: () => string };
  }
}

const initial = new URLSearchParams(window.location.search).get('path') ?? '/library';
const history = createMemoryHistory({ initialEntries: [initial] });
const router = createAppRouter(
  createLibraryRoutes(rootRoute, {
    book_extra_tabs: entityExtraTabs('/library/books/$bookId'),
    article_extra_tabs: entityExtraTabs('/library/articles/$articleId'),
  }),
  {
    history,
    nav_items: [libraryNavItem],
  },
);
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
