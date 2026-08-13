import { describe, expect, it } from 'vitest';

import { resolvePlaywrightMaxFailures } from './playwright-ci-policy';

describe('playwright-ci-policy', () => {
  it('uses one confirmed failure as the PR fail-fast limit when configured', () => {
    expect(resolvePlaywrightMaxFailures({ CI: 'true', PLAYWRIGHT_MAX_FAILURES: '1' })).toBe(1);
  });

  it('keeps exhaustive CI runs unlimited by default', () => {
    expect(resolvePlaywrightMaxFailures({ CI: 'true' })).toBe(0);
  });

  it('does not apply a CI failure limit locally', () => {
    expect(resolvePlaywrightMaxFailures({ CI: 'false', PLAYWRIGHT_MAX_FAILURES: '1' })).toBe(0);
  });

  it.each(['-1', '1.5', 'invalid'])('rejects invalid CI failure limit %s', (value) => {
    expect(() =>
      resolvePlaywrightMaxFailures({ CI: 'true', PLAYWRIGHT_MAX_FAILURES: value })
    ).toThrow('PLAYWRIGHT_MAX_FAILURES');
  });
});
