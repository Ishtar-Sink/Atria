import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StickyPageHeader } from './sticky-page-header';
import sticky_css from './sticky-page-header.module.css?raw';

function setup(scroll_height: number, client_height = 600) {
  const view = render(
    <div data-page-area="">
      <StickyPageHeader title="Contas" subtitle="Tudo" />
    </div>,
  );
  const area = view.container.querySelector<HTMLElement>('[data-page-area]');
  if (!area) throw new Error('sem área da página');
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: scroll_height,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', { value: client_height, configurable: true });
  return area;
}

function scrollTo(top: number) {
  act(() => {
    Object.defineProperty(window, 'scrollY', { value: top, configurable: true });
    Object.defineProperty(window, 'pageYOffset', { value: top, configurable: true });
    window.dispatchEvent(new Event('scroll'));
  });
}

afterEach(() => {
  scrollTo(0);
  Reflect.deleteProperty(window, 'scrollY');
  Reflect.deleteProperty(window, 'pageYOffset');
  Reflect.deleteProperty(window, 'innerHeight');
  Reflect.deleteProperty(document.documentElement, 'scrollHeight');
});

const header = () => {
  const found = document.querySelector('header');
  if (!found) throw new Error('sem cabeçalho');
  return found;
};

describe('StickyPageHeader', () => {
  it('stays expanded near the top', () => {
    setup(2000);
    scrollTo(20);
    expect(header().className).not.toMatch(/compact/);
    expect(screen.getByText('Tudo')).toBeInTheDocument();
  });

  it('compacts after 48 px of scroll and expands back near the top', () => {
    setup(2000);
    scrollTo(49);
    expect(header().className).toMatch(/compact/);
    expect(screen.queryByText('Tudo')).not.toBeInTheDocument();
    scrollTo(10);
    expect(header().className).not.toMatch(/compact/);
  });

  it('does not compact on a short page', () => {
    setup(630);
    scrollTo(49);
    expect(header().className).not.toMatch(/compact/);
  });

  it('shows the blur whenever the header is stuck', () => {
    setup(2000);
    expect(header().className).not.toMatch(/stuck/);
    scrollTo(10);
    expect(header().className).toMatch(/stuck/);
    expect(header().className).not.toMatch(/compact/);
    scrollTo(0);
    expect(header().className).not.toMatch(/stuck/);
  });

  // O Lightning CSS apaga a `backdrop-filter` escrita antes de `-webkit-backdrop-filter` (ISS-001).
  it('keeps the unprefixed backdrop blur for the build to prefix', () => {
    const before = /\.sticky::before \{([^}]*)\}/.exec(sticky_css)?.[1] ?? '';
    expect(before).toMatch(/(^|[^-])backdrop-filter: blur\(/);
    expect(sticky_css).not.toContain('-webkit-backdrop-filter');
  });

  it('covers the content with the page color from edge to edge', () => {
    const before = /\.sticky::before \{([^}]*)\}/.exec(sticky_css)?.[1] ?? '';
    expect(before).toContain('background: var(--bg)');
    expect(before).toContain('bottom: 0');
    expect(before).toContain('border-bottom: 1px solid var(--border)');
    expect(before).not.toContain('55%');
    expect(before).not.toContain('linear-gradient');
    expect(before).not.toContain('mask-image');
    expect(before).toContain('left: var(--bd-l, 0px)');
    expect(before).toContain('width: var(--bd-w, 100%)');
  });

  it('renders the below slot inside the sticky wrapper', () => {
    const { container } = render(
      <StickyPageHeader title="Financeiro" below={<nav aria-label="Abas" />} />,
    );
    const wrap = container.querySelector('[data-sticky-header]');
    const nav = screen.getByRole('navigation', { name: 'Abas' });
    expect(wrap?.contains(nav)).toBe(true);
    expect(nav.previousElementSibling?.tagName).toBe('HEADER');
  });

  it('measures the backdrop from the page area', () => {
    const area = setup(2000);
    const wrap = area.querySelector<HTMLElement>('[data-sticky-header]');
    if (!wrap) throw new Error('sem cabeçalho fixo');
    vi.spyOn(area, 'getBoundingClientRect').mockReturnValue({ left: 264 } as DOMRect);
    vi.spyOn(wrap, 'getBoundingClientRect').mockReturnValue({ left: 344 } as DOMRect);
    Object.defineProperty(area, 'clientWidth', { value: 1016, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(wrap.style.getPropertyValue('--bd-l')).toBe('-80px');
    expect(wrap.style.getPropertyValue('--bd-w')).toBe('1016px');
    Object.defineProperty(area, 'clientWidth', { value: 700, configurable: true });
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(wrap.style.getPropertyValue('--bd-w')).toBe('700px');
  });

  it('rf24 follows the window scroll without a page area', () => {
    render(<StickyPageHeader title="Contas" subtitle="Tudo" />);
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 2000,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', { value: 600, configurable: true });
    scrollTo(49);
    expect(header().className).toMatch(/compact/);
    scrollTo(0);
    expect(header().className).not.toMatch(/stuck/);
  });

  it('rf24 sticks right below the topbar', () => {
    const block = /\.sticky \{([^}]*)\}/.exec(sticky_css)?.[1] ?? '';
    expect(block).toContain('top: var(--topbar-h, 0px)');
    expect(sticky_css).not.toContain('top: calc(var(--space) * -6)');
    expect(sticky_css).not.toContain('top: calc(var(--space) * -4)');
  });
});
