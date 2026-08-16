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
});
