import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { DayIcon, GridIcon, ListIcon, ShelfIcon, TableIcon, TimelineIcon } from './index';

const icons = { ListIcon, GridIcon, ShelfIcon, TableIcon, DayIcon, TimelineIcon };

describe('view icons', () => {
  it.each(Object.entries(icons))('renders %s as a decorative 18 px svg', (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('width', '18');
    expect(svg).toHaveAttribute('height', '18');
    expect(svg).toHaveAttribute('fill', 'none');
    expect(svg).toHaveAttribute('stroke', 'currentColor');
  });

  it('accepts another size', () => {
    const { container } = render(<ListIcon size={16} />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '16');
  });

  it('has no axe violations', async () => {
    const { container } = render(
      <div>
        {Object.entries(icons).map(([name, Icon]) => (
          <button key={name} type="button" aria-label={name}>
            <Icon />
          </button>
        ))}
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
