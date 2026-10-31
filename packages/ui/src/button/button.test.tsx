import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Button } from './button';

describe('Button', () => {
  it('has no axe violations', async () => {
    const { container } = render(<Button>Salvar</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders the variant class', () => {
    render(<Button variant="primary">Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' }).className).toMatch(/primary/);
  });

  it('is disabled with aria-disabled when loading', () => {
    render(<Button loading>Salvar</Button>);
    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('applies the muted variant', () => {
    render(<Button variant="muted">Ver</Button>);
    expect(screen.getByRole('button', { name: 'Ver' }).className).toMatch(/muted/);
  });

  it('uses the tint color in the muted variant', () => {
    render(
      <Button variant="muted" tint="#ff8800">
        Raia
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Raia' });
    expect(button.style.getPropertyValue('--button-tint')).toBe('#ff8800');
    expect(button.className).toMatch(/tinted/);
  });

  it('applies the success variant and the pressed state', () => {
    render(
      <Button variant="success" aria-pressed="true">
        Concluir
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Concluir' });
    expect(button.className).toMatch(/success/);
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Button success hover (DEC-013)', () => {
  const css = readFileSync(join(__dirname, 'button.module.css'), 'utf8');

  it('mixes success 22% with success-soft on hover, as in the prototype', () => {
    expect(css).toMatch(
      /\.success:hover:not\(:disabled\) \{\s*background: color-mix\(in srgb, var\(--success\) 22%, var\(--success-soft\)\);/,
    );
  });

  it('mixes success 85% with text when pressed and hovered, as in the prototype', () => {
    expect(css).toMatch(
      /\.success\[aria-pressed='true'\]:hover:not\(:disabled\) \{\s*background: color-mix\(in srgb, var\(--success\) 85%, var\(--text\)\);/,
    );
  });
});
