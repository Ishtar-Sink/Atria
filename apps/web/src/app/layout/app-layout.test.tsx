import { createRoute } from '@tanstack/react-router';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PageHeader } from '@atria/ui';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeCommandPalette,
  useCommandPaletteOpen,
} from '../../shared/command-palette/palette-store';
import { registerMessages } from '../../shared/i18n/i18n';
import { useScreenInfo } from '../../shared/layout/screen-info';
import type { NavItem } from '../../shared/navigation/nav-item';
import { setViewportWidth } from '../../shared/test/setup';
import { renderWithProviders } from '../../shared/test/render';
import { rootRoute } from '../router';
import { useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';

registerMessages('demo', {
  first: 'Primeiro',
  second: 'Segundo',
  crumb_a: 'Listas',
  crumb_b: 'Detalhe',
});

function Icon(props: { 'aria-hidden': true }) {
  return <svg {...props} width="16" height="16" />;
}

const nav_items: NavItem[] = [
  { id: 'second', label_key: 'demo.second', to: '/second', icon: Icon, order: 20 },
  { id: 'first', label_key: 'demo.first', to: '/first', icon: Icon, order: 10 },
];

function PaletteProbe() {
  const open = useCommandPaletteOpen();
  return <p>{open ? 'palette-open' : 'palette-closed'}</p>;
}

function InfoPage() {
  const { set_items } = useScreenInfo();
  useEffect(() => {
    set_items([{ label: 'Total', value: '12' }]);
  }, [set_items]);
  return <PaletteProbe />;
}

function page(path: string, component: () => React.ReactNode, breadcrumb_key = 'demo.crumb_a') {
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    component,
    staticData: { title_key: 'demo.first', breadcrumb_key },
  });
}

function stubMe(body: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  closeCommandPalette();
  vi.restoreAllMocks();
});

describe('AppLayout', () => {
  it('renders the sidebar with the brand and the Principal navigation', async () => {
    renderWithProviders(<PaletteProbe />, { nav_items });
    const sidebar = await screen.findByRole('complementary');
    expect(within(sidebar).getByText('Atria')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menu da conta' })).toBeInTheDocument();
  });

  it('renders registered nav items in order', async () => {
    renderWithProviders(<PaletteProbe />, { nav_items });
    const links = await within(
      await screen.findByRole('navigation', { name: 'Principal' }),
    ).findAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Primeiro', 'Segundo']);
  });

  it('renders the topbar search trigger with the shortcut hint', async () => {
    renderWithProviders(<PaletteProbe />);
    expect(await screen.findByRole('button', { name: /buscar ou criar/i })).toHaveTextContent(
      'Ctrl K',
    );
  });

  it('shows the macOS hint on macOS', async () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    renderWithProviders(<PaletteProbe />);
    expect(await screen.findByRole('button', { name: /buscar ou criar/i })).toHaveTextContent(
      '⌘ K',
    );
  });

  it('opens the command palette from the topbar trigger', async () => {
    renderWithProviders(<PaletteProbe />);
    expect(await screen.findByText('palette-closed')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /buscar ou criar/i }));
    expect(screen.getByText('palette-open')).toBeInTheDocument();
  });

  it('renders breadcrumbs from the active routes', async () => {
    const parent = page('/listas', () => null);
    renderWithProviders(null, {
      route: '/listas',
      routes: [parent, page('/outra', () => null, 'demo.crumb_b')],
    });
    const trail = await screen.findByRole('navigation', { name: 'Trilha' });
    expect(within(trail).getByText('Listas')).toHaveAttribute('aria-current', 'page');
  });

  it('shows the screen info set by the page', async () => {
    renderWithProviders(null, { route: '/info', routes: [page('/info', InfoPage)] });
    const info = await screen.findByRole('list', { name: 'Informações da tela' });
    expect(info).toHaveTextContent('Total 12');
  });

  it('toggles the drawer below 720 px with an accessible button', async () => {
    setViewportWidth(360);
    renderWithProviders(<PaletteProbe />, { nav_items });
    const button = await screen.findByRole('button', { name: 'Abrir menu' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(button).toHaveAttribute('aria-expanded', 'false');
    act(() => {
      setViewportWidth(1280);
    });
    expect(screen.queryByRole('button', { name: 'Abrir menu' })).not.toBeInTheDocument();
  });

  it('has no axe violations', async () => {
    const { container } = renderWithProviders(<PaletteProbe />, { nav_items });
    await screen.findByText('palette-closed');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders the profile button with the name and the initials', async () => {
    stubMe({ id: 'u1', email: 'ana@exemplo.com', display_name: 'Ana Souza' });
    renderWithProviders(<PaletteProbe />, { nav_items });
    const button = await screen.findByRole('button', { name: 'Menu da conta' });
    await waitFor(() => {
      expect(button).toHaveTextContent('Ana Souza');
    });
    expect(button).toHaveTextContent('AS');
  });

  it('falls back to the email and its initials without a display name', async () => {
    stubMe({ id: 'u1', email: 'maria@exemplo.com' });
    renderWithProviders(<PaletteProbe />, { nav_items });
    const button = await screen.findByRole('button', { name: 'Menu da conta' });
    await waitFor(() => {
      expect(button).toHaveTextContent('maria@exemplo.com');
    });
    expect(button).toHaveTextContent('MA');
  });

  it('opens the account menu with Configurações, Alternar tema and Sair', async () => {
    renderWithProviders(<PaletteProbe />, { nav_items });
    await userEvent.click(await screen.findByRole('button', { name: 'Menu da conta' }));
    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Configurações', 'Tema escuro', 'Sair']);
    expect(within(menu).getByRole('menuitem', { name: 'Sair' })).toHaveAttribute(
      'data-tone',
      'danger',
    );
  });

  it('does not list Configurações in the Principal navigation', async () => {
    renderWithProviders(<PaletteProbe />, { nav_items });
    const nav = await screen.findByRole('navigation', { name: 'Principal' });
    expect(within(nav).queryByText('Configurações')).not.toBeInTheDocument();
  });

  it('focuses the page heading on route change', async () => {
    function Nav() {
      const router = useRouter();
      return (
        <>
          <PageHeader title="Primeira" />
          <button
            type="button"
            onClick={() => {
              void router.navigate({ to: '/segunda' });
            }}
          >
            ir
          </button>
        </>
      );
    }
    renderWithProviders(null, {
      route: '/primeira',
      routes: [page('/primeira', Nav), page('/segunda', () => <PageHeader title="Segunda" />)],
    });
    await userEvent.click(await screen.findByText('ir'));
    const heading = await screen.findByRole('heading', { name: 'Segunda' });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
  });
});
