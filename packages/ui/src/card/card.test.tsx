import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Card } from './card';

const css = readFileSync(join(import.meta.dirname, 'card.module.css'), 'utf8');

describe('Card', () => {
  it('has no axe violations', async () => {
    const { container } = render(<Card>Conteúdo</Card>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders children', () => {
    render(<Card>Conteúdo</Card>);
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  it('maps each tone to the soft background', () => {
    expect(css).toMatch(/\.root\s*\{[^}]*background:\s*var\(--elevation-1\)/);
    for (const tone of ['primary', 'accent', 'success', 'warning', 'danger', 'info']) {
      expect(css).toMatch(
        new RegExp(`\\.${tone}\\s*\\{[^}]*background:\\s*var\\(--${tone}-soft\\)`),
      );
    }
  });
});
