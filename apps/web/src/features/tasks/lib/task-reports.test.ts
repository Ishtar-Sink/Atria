import { describe, expect, it } from 'vitest';
import { TASKS_REPORTS, tasksReportHref } from './task-reports';

describe('task reports', () => {
  it('builds the module report path', () => {
    expect(TASKS_REPORTS.map((report) => report.id)).toEqual(['tasks-done']);
    expect(tasksReportHref('tasks-done')).toBe('/reports/tasks-done?from_module=tasks');
  });
});
