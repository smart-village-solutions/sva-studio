import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

  it('replaces the default tests directory with explicit test file filters', () => {
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
      '--coverage',
      '--reporter=verbose',
      '--config',
      'vitest.config.ts',
      'tests/foo.test.ts',
    ]);
  });

  it('keeps the complete tests directory when no explicit files are requested', () => {
    expect(normalizeVitestRunArgs(['tests', '--coverage', '--config', 'vitest.config.ts'])).toEqual(
      ['tests', '--coverage', '--config', 'vitest.config.ts']
    );
  });

  it('does not remove a flag value named tests', () => {
    expect(normalizeVitestRunArgs(['--root', 'tests', '--testFiles=unit/foo.test.ts'])).toEqual([
      '--root',
      'tests',
      'unit/foo.test.ts',
    ]);
  });

  it('rejects combining test file filters with options that accept optional values', () => {
    expect(() =>
      normalizeVitestRunArgs(['--changed', '--testFiles=src/runtime-health.test.ts'])
    ).toThrow('--changed kann nicht mit --testFiles kombiniert werden.');
  });

  it('keeps plain positional filters ahead of explicit test file filters', () => {
    expect(
      normalizeVitestRunArgs([
        'src/server',
        '--config',
        'vitest.config.ts',
        '--testFiles=src/runtime-health.test.ts',
      ])
    ).toEqual(['src/server', '--config', 'vitest.config.ts', 'src/runtime-health.test.ts']);
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
    expect(
      isRunVitestTargetEntrypoint('file:///workspace/scripts/ci/run-vitest-target.ts', undefined)
    ).toBe(false);
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

it('records the complete discovery inventory and actual selected shard cases', () => {
  const root = fs.mkdtempSync(path.join(process.cwd(), '.nx', 'unit-manifest-contract-'));
  try {
    for (const name of ['one', 'two'])
      fs.writeFileSync(
        path.join(root, `${name}.test.ts`),
        `import {it,expect} from 'vitest'; it('${name}',()=>expect(1).toBe(1));`
      );
    fs.writeFileSync(
      path.join(root, 'vitest.config.ts'),
      `export default {test:{include:['*.test.ts'],maxWorkers:1}};`
    );
    const manifest = path.join(root, 'manifest.json');
    const wrapper = fileURLToPath(new URL('./run-vitest-target.ts', import.meta.url));
    execFileSync('pnpm', ['exec', 'tsx', wrapper, '--config', 'vitest.config.ts', '--shard=1/2'], {
      cwd: root,
      stdio: 'pipe',
      env: { ...process.env, CI_APP_UNIT_ROOT: root, CI_APP_UNIT_MANIFEST: manifest },
    });
    const value = JSON.parse(fs.readFileSync(manifest, 'utf8'));
    expect(value.expectedFiles).toEqual(['one.test.ts', 'two.test.ts']);
    expect(value.files).toHaveLength(1);
    expect(value.tests).toEqual([
      { file: value.files[0], name: path.basename(value.files[0], '.test.ts'), status: 'passed' },
    ]);
    expect(fs.existsSync(`${manifest}.results.json`)).toBe(false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 30000);
