import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { rootRoute } from '../../../app/router';
import { renderWithProviders } from '../../../shared/test/render';
import { createAdminRoutes } from '../routes';

const LINK = 'https://atria.casa.test/convite/abc123';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

function stub(invite_status = 201) {
  const fetcher = vi.fn((input: string) => {
    const url = new URL(input, 'http://x');
    if (url.pathname === '/api/v1/me') {
      return Promise.resolve(json({ id: 'e1', email: 'e@casa.test', role: 'elevated' }));
    }
    if (url.pathname === '/api/v1/admin/invites') {
      return Promise.resolve(
        invite_status === 201
          ? json({ id: 'i1', link: LINK, expires_at: '2026-11-07T15:00:00Z' }, 201)
          : json({ code: 'boom', title: 'x' }, invite_status),
      );
    }
    return Promise.resolve(json({}));
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

function renderNew() {
  return renderWithProviders(null, {
    route: '/admin/invites/new',
    routes: createAdminRoutes(rootRoute),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NewInviteScreen', () => {
  it('generates and copies an invite link', async () => {
    stub();
    const user = userEvent.setup();
    renderNew();
    const field = await screen.findByLabelText('Link do convite');
    expect(field).toHaveAttribute('readonly');
    expect(field).toHaveValue('');
    await user.click(screen.getByRole('button', { name: 'Gerar' }));
    await waitFor(() => {
      expect(field).toHaveValue(LINK);
    });
    await user.click(screen.getByRole('button', { name: 'Copiar link' }));
    expect(await navigator.clipboard.readText()).toBe(LINK);
    const notice = await screen.findByText('Link copiado.');
    expect(notice).toHaveAttribute('aria-live', 'polite');
  });

  it('renders the header and the form in the centered form column', async () => {
    stub();
    renderNew();
    const heading = await screen.findByRole('heading', { level: 1, name: 'Gerar convite' });
    const form = screen.getByRole('form', { name: 'Gerar convite' });
    const column = form.parentElement as HTMLElement;
    expect(column).toContainElement(heading);
    const cancel = within(form).getByRole('button', { name: 'Cancelar' });
    const submit = within(form).getByRole('button', { name: 'Gerar' });
    expect(cancel.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('cancels back to the invites screen', async () => {
    stub();
    const { router } = renderNew();
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/invites');
    });
  });

  it('shows the error when the invite cannot be generated', async () => {
    stub(500);
    renderNew();
    await userEvent.click(await screen.findByRole('button', { name: 'Gerar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível gerar o convite');
  });

  it('moves through the form with the keyboard and has no axe violations', async () => {
    stub();
    const { container } = renderNew();
    const submit = await screen.findByRole('button', { name: 'Gerar' });
    for (let step = 0; step < 40 && document.activeElement !== submit; step += 1) {
      await userEvent.tab();
    }
    expect(submit).toHaveFocus();
    expect(await axe(container)).toHaveNoViolations();
  });
});
