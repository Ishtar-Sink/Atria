import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StickyPageHeader } from './sticky-page-header';
import sticky_css from './sticky-page-header.module.css?raw';

function setup(scroll_height: number, client_height = 600) {
  const view = render(
    <div data-scroll-area="">
      <StickyPageHeader title="Contas" subtitle="Tudo" />
    </div>,
  );
  const area = view.container.querySelector<HTMLElement>('[data-scroll-area]');
  if (!area) throw new Error('sem área de rolagem');
  Object.defineProperty(area, 'scrollHeight', { value: scroll_height, configurable: true });
  Object.defineProperty(area, 'clientHeight', { value: client_height, configurable: true });
  return area;
}

function scrollTo(area: HTMLElement, top: number) {
  act(() => {
    area.scrollTop = top;
    area.dispatchEvent(new Event('scroll'));
  });
}

const header = () => {
  const found = document.querySelector('header');
  if (!found) throw new Error('sem cabeçalho');
  return found;
};

describe('StickyPageHeader', () => {
  it('stays expanded near the top', () => {
    const area = setup(2000);
    scrollTo(area, 20);
    expect(header().className).not.toMatch(/compact/);
    expect(screen.getByText('Tudo')).toBeInTheDocument();
  });

  it('compacts after 48 px of scroll and expands back near the top', () => {
    const area = setup(2000);
    scrollTo(area, 49);
    expect(header().className).toMatch(/compact/);
    expect(screen.queryByText('Tudo')).not.toBeInTheDocument();
    scrollTo(area, 10);
    expect(header().className).not.toMatch(/compact/);
  });

  it('does not compact on a short page', () => {
    const area = setup(630);
    scrollTo(area, 49);
    expect(header().className).not.toMatch(/compact/);
  });

  it('shows the blur whenever the header is stuck', () => {
    const area = setup(2000);
    expect(header().className).not.toMatch(/stuck/);
    scrollTo(area, 10);
    expect(header().className).toMatch(/stuck/);
    expect(header().className).not.toMatch(/compact/);
    scrollTo(area, 0);
    expect(header().className).not.toMatch(/stuck/);
  });

  // O Lightning CSS apaga a `backdrop-filter` escrita antes de `-webkit-backdrop-filter` (ISS-001).
  it('keeps the unprefixed backdrop blur for the build to prefix', () => {
    const before = /\.sticky::before \{([^}]*)\}/.exec(sticky_css)?.[1] ?? '';
    expect(before).toMatch(/(^|[^-])backdrop-filter: blur\(/);
    expect(sticky_css).not.toContain('-webkit-backdrop-filter');
  });

  it('tints the background with the page color and fades it at the bottom', () => {
    const before = /\.sticky::before \{([^}]*)\}/.exec(sticky_css)?.[1] ?? '';
    expect(before).toContain('color-mix(in srgb, var(--bg) 55%, transparent)');
    expect(before).toContain('left: var(--bd-l, 0px)');
    expect(before).toContain('width: var(--bd-w, 100%)');
    expect(before).toContain('mask-image');
  });

  it('measures the backdrop from the scroll area', () => {
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
});
