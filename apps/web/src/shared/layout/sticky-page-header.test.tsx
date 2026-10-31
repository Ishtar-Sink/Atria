import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StickyPageHeader } from './sticky-page-header';

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
});
