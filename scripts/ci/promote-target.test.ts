import { describe, expect, it } from 'vitest';

import { publicBaseUrlForEnvironment, stackNameForEnvironment } from './promote-target.ts';

describe('stackNameForEnvironment', () => {
  it.each([
    ['dev', 'studio-dev'],
    ['staging', 'studio-staging'],
    ['prod', 'studio'],
  ] as const)('maps %s to the verified live stack %s', (environment, expected) => {
    expect(stackNameForEnvironment(environment)).toBe(expected);
  });

  it.each([
    ['dev', 'https://studio-dev.smart-village.app'],
    ['staging', 'https://studio-staging.smart-village.app'],
    ['prod', 'https://studio.smart-village.app'],
  ] as const)('maps %s to the verified public base URL %s', (environment, expected) => {
    expect(publicBaseUrlForEnvironment(environment)).toBe(expected);
  });
});
