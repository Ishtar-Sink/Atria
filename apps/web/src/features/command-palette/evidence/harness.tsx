// Página de evidência visual da TASK-32 (não entra no app nem no build de produção): a feature não
// tem rotas, então monta `CommandPaletteProvider` e `PaletteTrigger` sobre uma tela de exemplo num
// roteador em memória, com os providers e o layout do app, para o script
// `apps/web/scripts/evidence-command-palette.mjs` fotografar a paleta antes de a TASK-35 montá-la.
import { createMemoryHistory, createRoute, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '../../../app/providers';
import { createAppRouter, rootRoute } from '../../../app/router';
import '../../../app/global.css';
import { CommandPaletteProvider } from '../command-palette-provider';
import { PaletteTrigger } from '../palette-trigger';
import './harness.css';

function SampleScreen() {
  return (
    <CommandPaletteProvider>
      <section className="harness-screen">
        <h1>Início</h1>
        <p>Tela de exemplo para a paleta de comandos.</p>
        <PaletteTrigger />
        <label className="harness-field">
          Campo de texto
          <input type="text" className="harness-input" />
        </label>
        <ul className="harness-cards">
          <li>Pagar o aluguel</li>
          <li>Ler o capítulo 4</li>
          <li>Meta: correr 5 km</li>
        </ul>
      </section>
    </CommandPaletteProvider>
  );
}

const sampleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: SampleScreen,
  staticData: { title_key: 'common.brand', breadcrumb_key: 'common.brand' },
});

const router = createAppRouter([sampleRoute], {
  history: createMemoryHistory({ initialEntries: ['/'] }),
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
