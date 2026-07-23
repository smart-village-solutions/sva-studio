import { describe, expect, it } from 'vitest';

import { parseArgs } from './promote-one-shot-job.ts';

describe('promote one-shot job', () => {
  it('accepts production one-shot jobs', () => {
    expect(parseArgs(['--kind', 'migration', '--environment', 'prod'])).toEqual({
      environment: 'prod',
      kind: 'migration',
    });
  });
});
