import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { Toast, ToastRegion } from './toast';

const css = readFileSync(join(import.meta.dirname, 'toast.module.css'), 'utf8');

describe('Toast', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <ToastRegion>
        <Toast tone="success">Salvo</Toast>
      </ToastRegion>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('announces with aria-live polite', () => {
    const { container } = render(
      <ToastRegion>
        <Toast>Salvo</Toast>
      </ToastRegion>,
    );
    expect(container.querySelector('[aria-live="polite"]')).toContainElement(
      screen.getByText('Salvo'),
    );
  });

  it('uses the soft background of the tone', () => {
    for (const tone of ['success', 'warning', 'danger', 'info']) {
      expect(css).toMatch(
        new RegExp(`\\.${tone}\\s*\\{[^}]*background:\\s*var\\(--${tone}-soft\\)`),
      );
    }
    render(<Toast tone="danger">Falhou</Toast>);
    expect(screen.getByText('Falhou').closest('div')?.className).toMatch(/danger/);
  });
});
