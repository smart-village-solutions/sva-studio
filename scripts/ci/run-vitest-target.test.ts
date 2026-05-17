import { describe, expect, it } from 'vitest';

import { normalizeVitestRunArgs } from './run-vitest-target.ts';

describe('run-vitest-target', () => {
  it('rewrites --testFiles flags into positional vitest file filters', () => {
    expect(
      normalizeVitestRunArgs([
        '--reporter=verbose',
        '--config',
        'vitest.config.ts',
        '--passWithNoTests',
        '--testFiles=src/runtime-health.test.ts',
      ])
    ).toEqual([
      '--reporter=verbose',
      '--config',
      'vitest.config.ts',
      '--passWithNoTests',
      'src/runtime-health.test.ts',
    ]);
  });

  it('supports repeated --testFiles flags', () => {
    expect(
      normalizeVitestRunArgs([
        '--config',
        'vitest.config.ts',
        '--testFiles=src/runtime-health.test.ts',
        '--testFiles',
        'src/runtime-auth.test.ts',
      ])
    ).toEqual([
      '--config',
      'vitest.config.ts',
      'src/runtime-health.test.ts',
      'src/runtime-auth.test.ts',
    ]);
  });

  it('keeps existing positional filters before appended test files', () => {
    expect(
      normalizeVitestRunArgs([
        'tests',
        '--coverage',
        '--reporter=verbose',
        '--config',
        'vitest.config.ts',
        '--testFiles=tests/foo.test.ts',
      ])
    ).toEqual([
      'tests',
      '--coverage',
      '--reporter=verbose',
      '--config',
      'vitest.config.ts',
      'tests/foo.test.ts',
    ]);
  });
});
