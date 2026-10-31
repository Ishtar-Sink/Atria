import { describe, expect, it } from 'vitest';
import { GOALS_REPORTS, goalReportHref, goalsReportHref } from './goal-reports';

describe('goal reports', () => {
  it('builds the module and the goal report paths', () => {
    expect(GOALS_REPORTS.map((report) => report.id)).toEqual(['goals-progress']);
    expect(goalsReportHref('goals-progress')).toBe('/reports/goals-progress?from_module=goals');
    expect(goalReportHref('g-1')).toBe(
      '/reports/goals-progress?goal_id=g-1&run=1&from_module=goals',
    );
  });
});
