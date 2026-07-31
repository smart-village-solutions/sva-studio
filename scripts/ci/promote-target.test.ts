import { describe, expect, it } from 'vitest';

import { stackNameForEnvironment } from './promote-target.ts';

describe('stackNameForEnvironment', () => {
  it.each([
    ['dev', 'studio-dev'],
    ['staging', 'studio-staging'],
    ['prod', 'studio'],
  ] as const)('maps %s to the verified live stack %s', (environment, expected) => {
    expect(stackNameForEnvironment(environment)).toBe(expected);
  });
});
