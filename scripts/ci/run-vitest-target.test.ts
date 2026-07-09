import { describe, expect, it } from 'vitest';

import { isRunVitestTargetEntrypoint, normalizeVitestRunArgs } from './run-vitest-target.ts';

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

  it('protects test file filters from options with optional values', () => {
    expect(normalizeVitestRunArgs(['--changed', '--testFiles=src/runtime-health.test.ts'])).toEqual([
      '--changed',
      'src/runtime-health.test.ts',
    ]);
  });

  it('keeps plain positional filters ahead of explicit test file filters', () => {
    expect(
      normalizeVitestRunArgs([
        'src/server',
        '--config',
        'vitest.config.ts',
        '--testFiles=src/runtime-health.test.ts',
      ])
    ).toEqual([
      'src/server',
      '--config',
      'vitest.config.ts',
      'src/runtime-health.test.ts',
    ]);
  });
});

describe('isRunVitestTargetEntrypoint', () => {
  it('matches the repo standard ESM main-module guard', () => {
    expect(
      isRunVitestTargetEntrypoint(
        'file:///workspace/scripts/ci/run-vitest-target.ts',
        '/workspace/scripts/ci/run-vitest-target.ts'
      )
    ).toBe(true);
  });

  it('returns false when there is no entrypoint path', () => {
    expect(isRunVitestTargetEntrypoint('file:///workspace/scripts/ci/run-vitest-target.ts', undefined)).toBe(false);
  });

  it('returns false for a different entrypoint file', () => {
    expect(
      isRunVitestTargetEntrypoint(
        'file:///workspace/scripts/ci/run-vitest-target.ts',
        '/workspace/scripts/ci/other-script.ts'
      )
    ).toBe(false);
  });
});
