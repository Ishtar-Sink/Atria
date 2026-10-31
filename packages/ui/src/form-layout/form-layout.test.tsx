import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { FormActions, FormGrid } from './form-layout';

describe('FormGrid', () => {
  it('spans full-width fields across both columns', () => {
    render(
      <FormGrid>
        <div data-span="full">Título</div>
        <div>Tipo</div>
      </FormGrid>,
    );
    expect(screen.getByText('Título')).toHaveAttribute('data-span', 'full');
    const css = readFileSync(`${process.cwd()}/src/form-layout/form-layout.module.css`, 'utf8');
    expect(css).toMatch(/\[data-span='full'\][^}]*grid-column:\s*1\s*\/\s*-1/);
    expect(css).toContain('calc(var(--space) * 220)');
    expect(css).toMatch(/max-width:\s*640px/);
  });
});

describe('FormActions', () => {
  it('renders Cancelar before Salvar at the end of the row', () => {
    render(<FormActions cancel_label="Cancelar" submit_label="Salvar" onCancel={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Cancelar', 'Salvar']);
    expect(buttons[0]?.className).toMatch(/muted/);
    expect(buttons[1]?.className).toMatch(/primary/);
    expect(buttons[1]).toHaveAttribute('type', 'submit');
  });
});
