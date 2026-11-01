import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/render';
import {
  forgetListLocations,
  rememberListLocation,
  useBackTarget,
  type BackTargetOptions,
} from './back-target';

function Probe(options: BackTargetOptions) {
  return <output aria-label="target">{useBackTarget(options)}</output>;
}

async function targetAt(current: string, options: BackTargetOptions) {
  renderWithProviders(<Probe {...options} />, { route: current });
  const output = await screen.findByRole('status', { name: 'target' });
  return output.textContent;
}

beforeEach(() => {
  forgetListLocations();
  sessionStorage.clear();
});

describe('useBackTarget', () => {
  it('returns to the last list with its tab and filters', async () => {
    rememberListLocation('finance', '/finance?tab=accounts&filter=x');
    expect(
      await targetAt('/finance/accounts/1', {
        module: 'finance',
        fallback_to: '/finance/accounts',
      }),
    ).toBe('/finance?tab=accounts&filter=x');
  });

  it('returns to the dashboard when the item was opened there', async () => {
    rememberListLocation('finance', '/finance?tab=accounts');
    rememberListLocation('finance', '/finance/dashboard?period=year');
    expect(
      await targetAt('/finance/accounts/1', {
        module: 'finance',
        fallback_to: '/finance/accounts',
      }),
    ).toBe('/finance/dashboard?period=year');
  });

  it('falls back to the list of the type without history', async () => {
    expect(
      await targetAt('/finance/accounts/1', {
        module: 'finance',
        fallback_to: '/finance/accounts',
      }),
    ).toBe('/finance/accounts');
  });

  it('uses the explicit target on the edit screen', async () => {
    rememberListLocation('finance', '/finance?tab=accounts');
    expect(
      await targetAt('/finance/accounts/1/edit', {
        module: 'finance',
        fallback_to: '/finance/accounts',
        to: '/finance/accounts/1',
      }),
    ).toBe('/finance/accounts/1');
  });

  it('recovers the origin from the session after a reload', async () => {
    rememberListLocation('library', '/library?tab=books');
    forgetListLocations({ keep_session: true });
    expect(await targetAt('/library/books/1', { module: 'library', fallback_to: '/library' })).toBe(
      '/library?tab=books',
    );
  });

  it('ignores the page being opened, saved by the list while the route changes', async () => {
    rememberListLocation('notes', '/notes?q=a');
    rememberListLocation('notes', '/notes/1');
    expect(await targetAt('/notes/1', { module: 'notes', fallback_to: '/notes' })).toBe(
      '/notes?q=a',
    );
  });

  it('drops that stale entry so the next detail still returns to the list', async () => {
    rememberListLocation('notes', '/notes?q=a');
    rememberListLocation('notes', '/notes/1');
    await targetAt('/notes/1', { module: 'notes', fallback_to: '/notes' });
    expect(await targetAt('/notes/2', { module: 'notes', fallback_to: '/notes' })).toBe(
      '/notes?q=a',
    );
  });

  it('falls back to the module list when the first page is a detail', async () => {
    expect(await targetAt('/notes/1', { module: 'notes', fallback_to: '/notes' })).toBe('/notes');
  });

  it('reads an origin saved as plain text by the previous version', async () => {
    sessionStorage.setItem('atria_back:goals', '/goals?view=grid');
    forgetListLocations({ keep_session: true });
    expect(await targetAt('/goals/1', { module: 'goals', fallback_to: '/goals' })).toBe(
      '/goals?view=grid',
    );
  });
});
