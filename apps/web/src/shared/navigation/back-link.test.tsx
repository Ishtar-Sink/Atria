import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/render';
import { BackLink } from './back-link';
import { forgetListLocations, rememberListLocation } from './back-target';

beforeEach(() => {
  forgetListLocations();
  sessionStorage.clear();
});

describe('BackLink', () => {
  it('links to the list of origin', async () => {
    rememberListLocation('notes', '/notes?q=a');
    const { router } = renderWithProviders(<BackLink module="notes" fallback_to="/notes" />, {
      route: '/notes/1',
    });
    const link = await screen.findByRole('link', { name: 'Voltar' });
    expect(link).toHaveAttribute('href', '/notes?q=a');
    await userEvent.click(link);
    expect(router.state.location.href).toBe('/notes?q=a');
  });

  it('never pushes the current page', async () => {
    rememberListLocation('notes', '/notes/1');
    const { router } = renderWithProviders(<BackLink module="notes" fallback_to="/notes" />, {
      route: '/notes/1',
    });
    const link = await screen.findByRole('link', { name: 'Voltar' });
    expect(link).toHaveAttribute('href', '/notes');
    await userEvent.click(link);
    expect(router.state.location.href).toBe('/notes');
  });
});
