import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('has no axe violations', async () => {
    const { container } = render(
      <PageHeader eyebrow="Finanças" title="Contas" subtitle="Tudo em um lugar" />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('renders eyebrow, heading and subtitle', () => {
    render(<PageHeader eyebrow="Finanças" title="Contas" subtitle="Tudo em um lugar" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Contas' })).toBeInTheDocument();
    expect(screen.getByText('Finanças')).toBeInTheDocument();
    expect(screen.getByText('Tudo em um lugar')).toBeInTheDocument();
  });

  it('renders the back link above the title', () => {
    render(<PageHeader title="Contas" back={<a href="/x">Voltar</a>} />);
    const back = screen.getByRole('link', { name: 'Voltar' });
    const heading = screen.getByRole('heading', { name: 'Contas' });
    expect(back.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('exposes the heading as focusable without a tab stop', () => {
    render(<PageHeader title="Contas" />);
    const heading = screen.getByRole('heading', { name: 'Contas' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(heading).toHaveAttribute('data-page-heading');
  });

  it('applies the stuck and compact states', () => {
    const { container } = render(<PageHeader title="Contas" subtitle="Tudo" stuck compact />);
    const root = container.querySelector('header');
    expect(root?.className).toMatch(/stuck/);
    expect(root?.className).toMatch(/compact/);
    expect(screen.queryByText('Tudo')).not.toBeInTheDocument();
  });

  it('marks the compact state with data-compact', () => {
    const { container, rerender } = render(<PageHeader title="Contas" compact />);
    expect(container.querySelector('header')).toHaveAttribute('data-compact');
    rerender(<PageHeader title="Contas" />);
    expect(container.querySelector('header')).not.toHaveAttribute('data-compact');
  });
});
