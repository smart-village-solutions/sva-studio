import { describe, expect, it } from 'vitest';

import { aggregateAuditStatus } from './model.ts';

describe('aggregateAuditStatus', () => {
  it('returns fail when at least one check failed', () => {
    expect(aggregateAuditStatus(['pass', 'warn', 'fail'])).toBe('fail');
  });

  it('returns warn when no check failed but one warned', () => {
    expect(aggregateAuditStatus(['pass', 'skip', 'warn'])).toBe('warn');
  });

  it('returns pass when all non-skipped checks passed', () => {
    expect(aggregateAuditStatus(['pass', 'skip'])).toBe('pass');
  });
});
