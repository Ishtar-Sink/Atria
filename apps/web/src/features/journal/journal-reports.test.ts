import { describe, expect, it } from 'vitest';
import { JOURNAL_REPORTS, journalReportHref } from './journal-reports';

describe('journal reports', () => {
  it('builds the module report path', () => {
    expect(JOURNAL_REPORTS.map((report) => report.id)).toEqual(['journal-emo']);
    expect(journalReportHref('journal-emo')).toBe('/reports/journal-emo?from_module=journal');
  });
});
