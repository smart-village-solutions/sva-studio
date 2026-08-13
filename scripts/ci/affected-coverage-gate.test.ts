import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildAppCoverageCommand,
  buildCoverageProjectsCommand,
  buildEarlyCoverageGateCommand,
  clearWorkspaceCoverageOutputs,
} from './affected-coverage-gate.ts';

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

  it('builds the Nx coverage command for the app', () => {
    expect(buildAppCoverageCommand()).toBe('pnpm nx run sva-studio-react:test:coverage');
  });

  it('builds fail-fast changed-first coverage commands', () => {
    expect(buildCoverageProjectsCommand(['plugin-news', 'routing'])).toBe(
      'env -u NO_COLOR pnpm nx run-many --target=test:coverage --projects=plugin-news,routing --parallel=1 --nxBail --output-style=stream'
    );
    expect(buildEarlyCoverageGateCommand(['plugin-news', 'routing'])).toBe(
      'COVERAGE_GATE_EVALUATE_REGRESSIONS=1 COVERAGE_GATE_PROJECT_FILTER=plugin-news,routing pnpm coverage-gate'
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
    const buildOutputCoverageDirectory = path.join(
      rootDirectory,
      'apps/example-app/.output/server/coverage'
    );
    const generatedCoverageDirectory = path.join(
      rootDirectory,
      'apps/example-app/.generated/coverage'
    );
    const nestedSourceCoverageDirectory = path.join(rootDirectory, 'apps/example-app/src/coverage');
    const unrelatedDirectory = path.join(rootDirectory, 'apps/example-app/src');

    fs.mkdirSync(appCoverageDirectory, { recursive: true });
    fs.mkdirSync(packageCoverageDirectory, { recursive: true });
    fs.mkdirSync(nodeModulesCoverageDirectory, { recursive: true });
    fs.mkdirSync(buildOutputCoverageDirectory, { recursive: true });
    fs.mkdirSync(generatedCoverageDirectory, { recursive: true });
    fs.mkdirSync(nestedSourceCoverageDirectory, { recursive: true });
    fs.mkdirSync(unrelatedDirectory, { recursive: true });

    clearWorkspaceCoverageOutputs(rootDirectory);

    expect(fs.existsSync(appCoverageDirectory)).toBe(false);
    expect(fs.existsSync(packageCoverageDirectory)).toBe(false);
    expect(fs.existsSync(nodeModulesCoverageDirectory)).toBe(true);
    expect(fs.existsSync(buildOutputCoverageDirectory)).toBe(true);
    expect(fs.existsSync(generatedCoverageDirectory)).toBe(true);
    expect(fs.existsSync(nestedSourceCoverageDirectory)).toBe(true);
    expect(fs.existsSync(unrelatedDirectory)).toBe(true);
  });
});
