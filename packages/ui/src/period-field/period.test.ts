import { resolvePeriod } from './period';

const today = '2026-10-30';

describe('resolvePeriod', () => {
  it('resolves this month as the default', () => {
    expect(resolvePeriod({ preset: 'this_month' }, today)).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('resolves last month, next 30 days, last 30 days and this year from today', () => {
    expect(resolvePeriod({ preset: 'last_month' }, today)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(resolvePeriod({ preset: 'next_30_days' }, today)).toEqual({
      from: '2026-10-30',
      to: '2026-11-29',
    });
    expect(resolvePeriod({ preset: 'last_30_days' }, today)).toEqual({
      from: '2026-09-30',
      to: '2026-10-30',
    });
    expect(resolvePeriod({ preset: 'this_year' }, today)).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    });
  });

  it('returns no dates for all', () => {
    expect(resolvePeriod({ preset: 'all' }, today)).toBeNull();
  });

  it('keeps from and to for custom', () => {
    expect(
      resolvePeriod({ preset: 'custom', from: '2026-10-05', to: '2026-10-20' }, today),
    ).toEqual({ from: '2026-10-05', to: '2026-10-20' });
  });
});
