import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildAppCoverageCommand,
  buildCoverageProjectCommand,
  buildEarlyCoverageGateCommand,
  clearWorkspaceCoverageOutputs,
  writeCoverageShardShadowEvidence,
} from './affected-coverage-gate.ts';
import { resolveCoveragePlan } from './coverage-plan.ts';
import { loadWorkspaceProjectRoots } from './nx-project-graph.ts';

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
    expect(buildCoverageProjectCommand('plugin-news')).toBe(
      'env -u NO_COLOR pnpm nx run plugin-news:test:coverage --nxBail --output-style=stream'
    );
    expect(buildEarlyCoverageGateCommand(['plugin-news', 'routing'])).toBe(
      'COVERAGE_GATE_EVALUATE_REGRESSIONS=1 COVERAGE_GATE_PROJECT_FILTER=plugin-news,routing pnpm coverage-gate'
    );
  });

  it('keeps shard evidence write failures observational in the required coverage runner', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    expect(() =>
      writeCoverageShardShadowEvidence(
        {
          rootDir: '/workspace',
          project: 'plugin-news',
          phase: 'direct',
          headSha: 'head',
          projectRoots: [{ name: 'plugin-news', root: 'packages/plugin-news' }],
        },
        () => {
          throw new Error('missing shard report');
        }
      )
    ).not.toThrow();
    expect(warning).toHaveBeenCalledWith(
      'Coverage-Shard-Shadow-Evidenz konnte nicht geschrieben werden: missing shard report'
    );

    warning.mockRestore();
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

  it('uses manifest roots for the full fallback without retrying a failed Nx graph', () => {
    const loadNxProjectRoots = vi.fn(() => {
      throw new Error('malformed Nx graph');
    });
    const loadWorkspaceProjectRoots = vi.fn(() => [
      { name: 'plugin-news', root: 'packages/plugin-news' },
    ]);

    expect(
      resolveCoveragePlan({ base: 'base', head: 'head' }, false, ['plugin-news'], {
        resolveChangedFiles: () => ['packages/plugin-news/src/index.ts'],
        getCoverageProjects: () => ['plugin-news'],
        loadNxProjectRoots,
        loadWorkspaceProjectRoots,
      })
    ).toMatchObject({
      affectedProjects: ['plugin-news'],
      projectRoots: [{ name: 'plugin-news', root: 'packages/plugin-news' }],
      changedProjectPlan: {
        mode: 'full-fallback',
        reason: 'invalid-base-head-or-project-graph',
        directProjects: [],
        remainingProjects: ['plugin-news'],
      },
    });
    expect(loadNxProjectRoots).toHaveBeenCalledTimes(1);
    expect(loadWorkspaceProjectRoots).toHaveBeenCalledTimes(1);
  });

  it('loads fallback project roots from workspace manifests without the Nx graph', () => {
    const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-project-roots-'));
    temporaryDirectories.push(rootDirectory);
    const projectDirectory = path.join(rootDirectory, 'packages/example');
    fs.mkdirSync(projectDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(projectDirectory, 'project.json'),
      JSON.stringify({ name: 'example' })
    );

    expect(loadWorkspaceProjectRoots(rootDirectory)).toEqual([
      { name: 'example', root: 'packages/example' },
    ]);
  });
});
