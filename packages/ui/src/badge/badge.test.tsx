import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Badge } from './badge';

const css = readFileSync(join(import.meta.dirname, 'badge.module.css'), 'utf8');

describe('Badge', () => {
  it('has no axe violations', async () => {
    const { container } = render(<Badge tone="warning">Pendente</Badge>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders children', () => {
    render(<Badge>Novo</Badge>);
    expect(screen.getByText('Novo')).toBeInTheDocument();
  });

  it('maps each tone to the soft background', () => {
    for (const tone of ['primary', 'accent', 'success', 'warning', 'danger', 'info']) {
      expect(css).toMatch(
        new RegExp(
          `\\.${tone}\\s*\\{[^}]*background:\\s*var\\(--${tone}-soft\\);[^}]*color:\\s*var\\(--${tone}\\)`,
        ),
      );
    }
    render(<Badge tone="success">Ok</Badge>);
    expect(screen.getByText('Ok').className).toMatch(/success/);
  });
});
