import { describe, expect, it } from 'vitest';
import {
  apiParams,
  fromPeriodValue,
  parseReportSearch,
  toPeriodValue,
  todayInTimeZone,
} from './use-report-search';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const CATEGORY = '22222222-2222-4222-8222-222222222222';
const BOOK = '33333333-3333-4333-8333-333333333333';
const EMOTION = '44444444-4444-4444-8444-444444444444';
const GOAL = '55555555-5555-4555-8555-555555555555';
const PROJECT = '66666666-6666-4666-8666-666666666666';
const TODAY = '2026-10-30';

describe('parseReportSearch', () => {
  it('reads every filter from the url', () => {
    expect(
      parseReportSearch('fin-cat', { account_id: ACCOUNT, category_id: CATEGORY }).filters,
    ).toEqual({
      account_id: ACCOUNT,
      category_id: CATEGORY,
    });
    expect(parseReportSearch('read-pages', { book_id: BOOK }).filters).toEqual({ book_id: BOOK });
    expect(parseReportSearch('lib-status', { type: 'video' }).filters).toEqual({ type: 'video' });
    expect(parseReportSearch('journal-emo', { emotion: EMOTION }).filters).toEqual({
      emotion: EMOTION,
    });
    expect(
      parseReportSearch('goals-progress', { goal_id: GOAL, goal_status: 'completed' }).filters,
    ).toEqual({ goal_id: GOAL, goal_status: 'completed' });
    expect(parseReportSearch('proj-cards', { project_id: PROJECT }).filters).toEqual({
      project_id: PROJECT,
    });
    expect(parseReportSearch('fin-flow', { run: 1 }).run).toBe(true);
    expect(parseReportSearch('fin-flow', { run: '1' }).run).toBe(true);
    expect(parseReportSearch('fin-flow', {}).run).toBe(false);
  });

  it('keeps only the filters accepted by the report', () => {
    const search = parseReportSearch('fin-flow', {
      account_id: ACCOUNT,
      category_id: CATEGORY,
      book_id: BOOK,
      type: 'book',
    });
    expect(search.filters).toEqual({ account_id: ACCOUNT });
    expect(parseReportSearch('tasks-done', { account_id: ACCOUNT, period: 'all' }).filters).toEqual(
      {},
    );
  });

  it('drops invalid values without failing', () => {
    const search = parseReportSearch('fin-flow', {
      account_id: 'nao-e-uuid',
      period: 'ontem',
      from_module: 'nada',
    });
    expect(search.filters).toEqual({});
    expect(search.period).toBe('this_month');
    expect(search.from_module).toBeUndefined();
  });

  it('defaults to this month in the user timezone', () => {
    const search = parseReportSearch('fin-flow', {});
    expect(search.period).toBe('this_month');
    // 01/11 02:00 em UTC ainda é 31/10 em São Paulo.
    const today = todayInTimeZone(new Date('2026-11-01T02:00:00Z'), 'America/Sao_Paulo');
    expect(today).toBe('2026-10-31');
    expect(apiParams('fin-flow', search, today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('opens with any period when it comes from an entity', () => {
    expect(parseReportSearch('fin-cat', { category_id: CATEGORY, run: 1 }).period).toBe('all');
    expect(parseReportSearch('read-pages', { book_id: BOOK, run: 1 }).period).toBe('all');
    expect(parseReportSearch('goals-progress', { goal_id: GOAL, run: 1 }).period).toBe(
      'this_month',
    );
    // sem run, nem filtro de entidade nem outro caso abrem em "Qualquer período"
    expect(parseReportSearch('fin-cat', { category_id: CATEGORY }).period).toBe('this_month');
    expect(parseReportSearch('journal-emo', { emotion: EMOTION, run: 1 }).period).toBe(
      'this_month',
    );
    // o período da URL vale sobre o padrão
    expect(
      parseReportSearch('fin-cat', { category_id: CATEGORY, run: 1, period: 'last_month' }).period,
    ).toBe('last_month');
  });

  it('sends no from and to for any period', () => {
    const search = parseReportSearch('fin-flow', { period: 'all', account_id: ACCOUNT });
    expect(apiParams('fin-flow', search, TODAY)).toEqual({ account_id: ACCOUNT });
    expect(toPeriodValue(search)).toEqual({ preset: 'all' });
  });

  it('sends from and to of the preset in the user timezone', () => {
    const last = parseReportSearch('fin-flow', { period: 'last_month' });
    expect(apiParams('fin-flow', last, TODAY)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    const year = parseReportSearch('journal-emo', { period: 'this_year' });
    expect(apiParams('journal-emo', year, TODAY)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    const custom = parseReportSearch('fin-flow', {
      period: 'custom',
      from: '2026-10-10',
      to: '2026-10-14',
    });
    expect(apiParams('fin-flow', custom, TODAY)).toEqual({ from: '2026-10-10', to: '2026-10-14' });
    expect(toPeriodValue(custom)).toEqual({
      preset: 'custom',
      from: '2026-10-10',
      to: '2026-10-14',
    });
  });

  it('falls back to the default period for an incomplete or inverted custom range', () => {
    expect(parseReportSearch('fin-flow', { period: 'custom', from: '2026-10-10' }).period).toBe(
      'this_month',
    );
    expect(
      parseReportSearch('fin-flow', { period: 'custom', from: '2026-10-14', to: '2026-10-10' })
        .period,
    ).toBe('this_month');
  });

  it('sends no period to the reports without one', () => {
    const search = parseReportSearch('goals-progress', { period: 'last_month', goal_id: GOAL });
    expect(apiParams('goals-progress', search, TODAY)).toEqual({ goal_id: GOAL });
  });

  it('maps the emotion filter to emotion_id', () => {
    const search = parseReportSearch('journal-emo', { emotion: EMOTION, period: 'all' });
    expect(apiParams('journal-emo', search, TODAY)).toEqual({ emotion_id: EMOTION });
  });

  it('accepts only the goal statuses of the contract', () => {
    for (const status of ['planned', 'in_progress', 'completed', 'abandoned']) {
      expect(parseReportSearch('goals-progress', { goal_status: status }).filters.goal_status).toBe(
        status,
      );
    }
    for (const status of ['active', 'paused', 'done']) {
      expect(
        parseReportSearch('goals-progress', { goal_status: status }).filters.goal_status,
      ).toBeUndefined();
    }
  });

  it('drops from_module and run from the api params', () => {
    const search = parseReportSearch('fin-flow', {
      period: 'all',
      account_id: ACCOUNT,
      from_module: 'finance',
      run: 1,
    });
    expect(search.from_module).toBe('finance');
    expect(apiParams('fin-flow', search, TODAY)).toEqual({ account_id: ACCOUNT });
  });
});

describe('fromPeriodValue', () => {
  it('keeps from and to only for a custom range', () => {
    expect(fromPeriodValue({ preset: 'all' })).toEqual({
      period: 'all',
      from: undefined,
      to: undefined,
    });
    expect(fromPeriodValue({ preset: 'custom', from: '2026-10-01', to: '2026-10-05' })).toEqual({
      period: 'custom',
      from: '2026-10-01',
      to: '2026-10-05',
    });
  });
});
