import { clearWorkspaceCoverageOutputs } from './validate-downloaded-coverage.ts';
import {
  buildAppCoverageCommand,
  buildCoveragePartitionCommand,
  buildCoverageProjectCommand,
  buildEarlyCoverageGateCommand,
  excludeCoverageExemptProjects,
} from './coverage-plan.ts';
import { validateCoverageTestResults } from './validate-downloaded-coverage.ts';
import { writeCoverageShardEvidence } from './coverage-shard-evidence.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  coveragePartitions,
  prioritizeChangedCoverageProjects,
  selectCoveragePartition,
  resolveCoveragePlan,
} from './coverage-plan.ts';
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

  it('excludes policy-exempt projects before coverage planning', () => {
    expect(
      excludeCoverageExemptProjects(
        ['tooling-testing', 'plugin-news', 'public-waste-calendar-web'],
        ['tooling-testing', 'public-waste-calendar-web']
      )
    ).toEqual(['plugin-news']);
  });

  it('fails closed when mandatory project reports are missing', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'required-coverage-'));
    temporaryDirectories.push(directory);
    expect(() =>
      writeCoverageShardEvidence({
        rootDir: directory,
        project: 'example',
        phase: 'direct',
        headSha: 'head',
        projectRoots: [{ name: 'example', root: 'packages/example' }],
      })
    ).toThrow(/fehlt/);
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

describe('distributed coverage plan', () => {
  const plan = {
    changedFiles: ['packages/core/src/index.ts', 'nx.json'],
    affectedProjects: ['core', 'data', 'plugin-waste-management', 'sva-studio-react'],
    changedProjectPlan: {
      mode: 'full-fallback' as const,
      reason: 'unmapped',
      directProjects: [],
      remainingProjects: ['core', 'data', 'plugin-waste-management', 'sva-studio-react'],
      unmappedFiles: ['nx.json'],
    },
    projectRoots: [{ name: 'core', root: 'packages/core' }],
  };
  it('prioritizes mapped changes without reducing a full fallback', () => {
    const next = prioritizeChangedCoverageProjects(plan);
    expect(next.changedProjectPlan.directProjects).toEqual(['core']);
    expect(
      [
        ...next.changedProjectPlan.directProjects,
        ...next.changedProjectPlan.remainingProjects,
      ].sort()
    ).toEqual([...plan.affectedProjects].sort());
  });
  it('preserves the complete fallback when Nx reports only a subset', () => {
    const next = prioritizeChangedCoverageProjects({ ...plan, affectedProjects: ['core'] });
    expect(next.affectedProjects).toEqual([...plan.changedProjectPlan.remainingProjects].sort());
    expect(
      [
        ...next.changedProjectPlan.directProjects,
        ...next.changedProjectPlan.remainingProjects,
      ].sort()
    ).toEqual([...plan.changedProjectPlan.remainingProjects].sort());
    const empty = prioritizeChangedCoverageProjects({ ...plan, affectedProjects: [] });
    expect(empty.affectedProjects).toEqual(next.affectedProjects);
  });
  it('assigns regular projects once and heavy projects their exact file shard count', () => {
    const projects = coveragePartitions.flatMap((partition) =>
      selectCoveragePartition(prioritizeChangedCoverageProjects(plan), partition)
    );
    expect(projects.filter((project) => project === 'core')).toHaveLength(1);
    expect(projects.filter((project) => project === 'data')).toHaveLength(1);
    expect(projects.filter((project) => project === 'sva-studio-react')).toHaveLength(4);
    expect(projects.filter((project) => project === 'plugin-waste-management')).toHaveLength(2);
    expect(() => selectCoveragePartition(plan, 'app-5')).toThrow(/Ungültige/);
  });
});

describe('coverage execution contract', () => {
  it('keeps reports separate and instruments the heavy shard', () => {
    expect(buildCoveragePartitionCommand('sva-studio-react', 'app-2')).toContain('--shard=2/4');
    expect(buildCoveragePartitionCommand('plugin-waste-management', 'waste-1')).toContain(
      '--shard=1/2'
    );
    expect(buildCoveragePartitionCommand('core', 'direct-1')).not.toContain('--shard=');
  });
  it('requires a successful, exact, disjoint test file union', () => {
    const result = {
      success: true,
      numFailedTests: 0,
      numFailedTestSuites: 0,
      testResults: [{ name: '/repo/a.test.ts', assertionResults: [] }],
    };
    expect(() => validateCoverageTestResults([result], ['a.test.ts'], '/repo')).not.toThrow();
    expect(() => validateCoverageTestResults([result, result], ['a.test.ts'], '/repo')).toThrow(
      /Doppelte/
    );
    expect(() =>
      validateCoverageTestResults([result], ['a.test.ts', 'b.test.ts'], '/repo')
    ).toThrow(/unvollständig/);
    expect(() =>
      validateCoverageTestResults([{ ...result, success: false }], ['a.test.ts'], '/repo')
    ).toThrow(/fehlgeschlagen/);
  });
});
