import { describe, expect, it } from 'vitest';

import { buildAppCoverageCommand } from './affected-coverage-gate.ts';

describe('affected-coverage-gate', () => {
  it('builds the direct vitest coverage command for the app', () => {
    expect(buildAppCoverageCommand()).toBe(
      'pnpm exec vitest run --config apps/sva-studio-react/vitest.config.ts --coverage --reporter=verbose'
    );
  });
});
