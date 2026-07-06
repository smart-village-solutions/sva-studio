import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildAppCoverageCommand, clearWorkspaceCoverageOutputs } from './affected-coverage-gate.ts';

const temporaryDirectories: string[] = [];

describe('affected-coverage-gate', () => {
  afterEach(() => {
    while (temporaryDirectories.length > 0) {
      const directoryPath = temporaryDirectories.pop();
      if (directoryPath) {
        fs.rmSync(directoryPath, { recursive: true, force: true });
      }
    }
  });

  it('builds the direct vitest coverage command for the app', () => {
    expect(buildAppCoverageCommand()).toBe(
      'pnpm exec vitest run --config apps/sva-studio-react/vitest.config.ts --coverage --reporter=verbose'
    );
  });

  it('clears stale workspace coverage outputs before affected runs', () => {
    const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'affected-coverage-gate-'));
    temporaryDirectories.push(rootDirectory);

    const appCoverageDirectory = path.join(rootDirectory, 'apps/example-app/coverage');
    const packageCoverageDirectory = path.join(rootDirectory, 'packages/example-package/coverage');
    const nodeModulesCoverageDirectory = path.join(
      rootDirectory,
      'packages/example-package/node_modules/ignored-dependency/coverage'
    );
    const unrelatedDirectory = path.join(rootDirectory, 'apps/example-app/src');

    fs.mkdirSync(appCoverageDirectory, { recursive: true });
    fs.mkdirSync(packageCoverageDirectory, { recursive: true });
    fs.mkdirSync(nodeModulesCoverageDirectory, { recursive: true });
    fs.mkdirSync(unrelatedDirectory, { recursive: true });

    clearWorkspaceCoverageOutputs(rootDirectory);

    expect(fs.existsSync(appCoverageDirectory)).toBe(false);
    expect(fs.existsSync(packageCoverageDirectory)).toBe(false);
    expect(fs.existsSync(nodeModulesCoverageDirectory)).toBe(true);
    expect(fs.existsSync(unrelatedDirectory)).toBe(true);
  });
});
