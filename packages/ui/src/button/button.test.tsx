import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('shows a visible spinner while loading', () => {
    const { rerender } = render(<Button loading>Salvar</Button>);
    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    const spinner = button.querySelector('[data-button-spinner]');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
    rerender(<Button>Salvar</Button>);
    const idle = screen.getByRole('button', { name: 'Salvar' });
    expect(idle).not.toHaveAttribute('aria-busy');
    expect(idle.querySelector('[data-button-spinner]')).toBeNull();
  });

  it('ignores clicks while loading', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Salvar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Salvar' });
    await user.click(button);
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('keeps the accessible name while loading', () => {
    render(<Button loading>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('keeps the primary color while loading', () => {
    const css = readFileSync(join(__dirname, 'button.module.css'), 'utf8');
    const busy = /\.primary\[aria-busy='true'\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(busy).toContain('background: var(--primary)');
    const spinner = /\.spinner\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(spinner).toContain('var(--motion-slow)');
  });
});
