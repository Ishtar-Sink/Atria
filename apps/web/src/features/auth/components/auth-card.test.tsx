import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { axe } from 'vitest-axe';
import { AppProviders } from '../../../app/providers';
import { AuthCard } from './auth-card';

function renderCard() {
  return render(
    <AppProviders>
      <AuthCard heading="Entrar" subtitle="Use o e-mail da sua conta.">
        <form aria-label="Entrar">
          <input aria-label="E-mail" />
        </form>
      </AuthCard>
    </AppProviders>,
  );
}

describe('AuthCard', () => {
  it('renders the heading, the subtitle and the form inside the card', () => {
    renderCard();
    const card = document.querySelector<HTMLElement>('[data-auth-card]');
    expect(card).not.toBeNull();
    const scope = within(card as HTMLElement);
    expect(scope.getByRole('heading', { level: 1, name: 'Entrar' })).toHaveAttribute(
      'data-page-heading',
    );
    expect(scope.getByText('Use o e-mail da sua conta.')).toBeInTheDocument();
    expect(scope.getByRole('form', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('marks the card with data-auth-card for the screens to find', () => {
    renderCard();
    expect(document.querySelectorAll('[data-auth-card]')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 }).closest('[data-auth-card]')).not.toBeNull();
  });

  it('has no axe violations', async () => {
    const { container } = renderCard();
    expect(await axe(container)).toHaveNoViolations();
  });
});
