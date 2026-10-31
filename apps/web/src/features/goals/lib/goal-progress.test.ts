import { describe, expect, it } from 'vitest';
import { goalProgress } from './goal-progress';

const open = { completed: false };
const done = { completed: true };

describe('goalProgress', () => {
  it('returns 25 with one of four milestones done', () => {
    expect(goalProgress({ status: 'in_progress' }, [done, open, open, open])).toBe(25);
  });

  it('returns 100 with all milestones done', () => {
    expect(goalProgress({ status: 'in_progress' }, [done, done, done])).toBe(100);
  });

  it('rounds down to a whole number', () => {
    expect(goalProgress({ status: 'in_progress' }, [done, open, open])).toBe(33);
  });

  it('uses the status when there are no milestones', () => {
    expect(goalProgress({ status: 'completed' }, [])).toBe(100);
    expect(goalProgress({ status: 'planned' }, [])).toBe(0);
    expect(goalProgress({ status: 'in_progress' }, [])).toBe(0);
    expect(goalProgress({ status: 'abandoned' }, [])).toBe(0);
  });

  it('ignores removed milestones', () => {
    const before = [done, open, open, open];
    expect(goalProgress({ status: 'in_progress' }, before)).toBe(25);
    expect(goalProgress({ status: 'in_progress' }, before.slice(0, 2))).toBe(50);
    expect(goalProgress({ status: 'in_progress' }, [done])).toBe(100);
  });
});
