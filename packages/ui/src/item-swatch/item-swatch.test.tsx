import { paletteFor } from '@atria/theme';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { ItemSwatch } from './item-swatch';

function expectedBackground(id: string): string {
  const [from, to] = paletteFor(id);
  const probe = document.createElement('div');
  probe.style.background = `linear-gradient(135deg, ${from}, ${to})`;
  return probe.style.background;
}

describe('ItemSwatch', () => {
  it('has no axe violations', async () => {
    const { container } = render(<ItemSwatch id="abc">A</ItemSwatch>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('uses paletteFor for the same id', () => {
    const { container } = render(<ItemSwatch id="abc" />);
    const swatch = container.firstElementChild as HTMLElement;
    expect(swatch.style.background).toBe(expectedBackground('abc'));
  });
});
