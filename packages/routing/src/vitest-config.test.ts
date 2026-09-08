import { describe, expect, it } from 'vitest';

import vitestConfig from '../vitest.config';

describe('routing vitest config', () => {
  it('resolves the DSR persistence subpath from source without a prebuilt workspace package', () => {
    expect(vitestConfig.resolve?.alias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          find: /^@sva\/iam-governance\/dsr-persistence$/,
          replacement: expect.stringContaining('/packages/iam-governance/src/dsr-persistence.ts'),
        }),
      ]),
    );
  });

  it('resolves the plugin SDK documentation subpath from source', () => {
    expect(vitestConfig.resolve?.alias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          find: /^@sva\/plugin-sdk\/route-documentation$/,
          replacement: expect.stringContaining('/packages/plugin-sdk/src/route-documentation.ts'),
        }),
      ])
    );
  });

  it('resolves SSF provisioning from source for auth-runtime coverage', () => {
    expect(vitestConfig.resolve?.alias).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          find: /^@sva\/plugin-ssf\/provisioning$/,
          replacement: expect.stringContaining('/packages/plugin-ssf/src/provisioning.ts'),
        }),
      ])
    );
  });
});
