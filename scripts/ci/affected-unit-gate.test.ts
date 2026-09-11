import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildUnitProjectCommand,
  hasPlannedUnitProjects,
  resolveAppUnitExecutionPlan,
  runAffectedUnitGate,
  runAffectedUnitGateCli,
} from './affected-unit-gate.ts';
import { buildAppUnitCommand, planAppUnitExecution } from './affected-unit-plan.ts';
import { runCiCommand } from './ci-command-runner.ts';
import { writeCiFeedbackEvidence } from './ci-feedback-evidence.ts';
import { loadNxProjectRoots } from './nx-project-graph.ts';
import { resolveChangedFiles } from './pr-scope.ts';
import { parseUnitShard, selectRemainingUnitProjects } from './unit-shards.ts';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
vi.mock('./ci-command-runner.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ci-command-runner.ts')>()),
  runCiCommand: vi.fn(),
}));
vi.mock('./ci-feedback-evidence.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ci-feedback-evidence.ts')>()),
  writeCiFeedbackEvidence: vi.fn(),
}));
vi.mock('./nx-project-graph.ts', () => ({ loadNxProjectRoots: vi.fn() }));
vi.mock('./pr-scope.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./pr-scope.ts')>()),
  resolveChangedFiles: vi.fn(),
}));

describe('affected-unit-gate', () => {
  it('skips app slicing when the app is not affected', () => {
    expect(planAppUnitExecution(['packages/core/src/index.ts'], ['core'])).toEqual({
      mode: 'skip',
      reason: 'app-not-affected',
      slices: [],
    });
  });

  it('uses slices for app-only ui and hook changes', () => {
    expect(
      planAppUnitExecution(
        [
          'apps/sva-studio-react/src/components/Header.tsx',
          'apps/sva-studio-react/src/hooks/useTheme.ts',
        ],
        ['sva-studio-react']
      )
    ).toEqual({
      mode: 'slices',
      reason: 'app-only-sliceable-change',
      slices: ['hooks', 'ui'],
    });
  });

  it('routes non-server app lib changes to the hooks-lib slice', () => {
    expect(
      planAppUnitExecution(['apps/sva-studio-react/src/lib/theme.ts'], ['sva-studio-react'])
    ).toEqual({
      mode: 'slices',
      reason: 'app-only-sliceable-change',
      slices: ['hooks'],
    });
  });

  it('uses the aggregate app target for app config changes', () => {
    expect(
      planAppUnitExecution(['apps/sva-studio-react/vitest.config.ts'], ['sva-studio-react'])
    ).toEqual({
      mode: 'aggregate',
      reason: 'aggregate-app-file',
      slices: [],
    });
  });

  it('uses the aggregate app target for mixed workspace changes', () => {
    expect(
      planAppUnitExecution(
        ['apps/sva-studio-react/src/routes/-index.tsx', 'packages/routing/src/index.ts'],
        ['routing', 'sva-studio-react']
      )
    ).toEqual({
      mode: 'aggregate',
      reason: 'mixed-workspace-change',
      slices: [],
    });
  });

  it('skips the app run for infra-only non-app changes even when nx marks the app affected', () => {
    expect(
      planAppUnitExecution(
        ['.github/workflows/build.yml', 'compose.yaml', 'scripts/ci/monitoring-stack-ci.sh'],
        ['tooling-testing', 'sva-studio-react']
      )
    ).toEqual({
      mode: 'skip',
      reason: 'non-app-infra-change',
      slices: [],
    });
  });

  it('does not skip app tests when app and infra files change together', () => {
    expect(
      planAppUnitExecution(
        ['apps/sva-studio-react/src/routes/settings.tsx', '.github/workflows/build.yml'],
        ['tooling-testing', 'sva-studio-react']
      )
    ).toEqual({
      mode: 'slices',
      reason: 'app-only-sliceable-change',
      slices: ['routes'],
    });
  });

  it.each([
    'package.json',
    'pnpm-lock.yaml',
    'tsconfig.base.json',
    'tooling/testing/vitest.config.ts',
  ])(
    'uses the aggregate app target for dependency-relevant root or tooling change %s',
    (filePath) => {
      expect(planAppUnitExecution([filePath], ['tooling-testing', 'sva-studio-react'])).toEqual({
        mode: 'aggregate',
        reason: 'mixed-workspace-change',
        slices: [],
      });
    }
  );

  it('uses the aggregate app target when a file cannot be mapped to a safe slice', () => {
    expect(
      planAppUnitExecution(['apps/sva-studio-react/src/main.tsx'], ['sva-studio-react'])
    ).toEqual({
      mode: 'aggregate',
      reason: 'aggregate-app-file',
      slices: [],
    });
  });

  it('maps server-side app test files to the server slice', () => {
    expect(
      planAppUnitExecution(
        ['apps/sva-studio-react/src/lib/instance-interfaces-server.test.ts'],
        ['sva-studio-react']
      )
    ).toEqual({
      mode: 'slices',
      reason: 'app-only-sliceable-change',
      slices: ['server'],
    });
  });

  it('builds Nx commands for aggregate and sliced app runs', () => {
    expect(buildAppUnitCommand()).toBe('pnpm nx run sva-studio-react:test:unit');
    expect(buildAppUnitCommand('routes')).toBe('pnpm nx run sva-studio-react:test:unit:routes');
  });

  it('builds target-exact fail-fast commands so retries preserve completed targets', () => {
    expect(buildUnitProjectCommand('plugin-news')).toBe(
      'env -u NO_COLOR pnpm nx run plugin-news:test:unit --nxBail --output-style=stream'
    );
  });

  it('runs the complete app unit target when the project graph fallback is active', () => {
    expect(
      resolveAppUnitExecutionPlan(
        ['apps/sva-studio-react/src/routes/settings.tsx'],
        ['sva-studio-react'],
        {
          mode: 'full-fallback',
          reason: 'nx-project-graph-unavailable',
          directProjects: [],
          remainingProjects: ['sva-studio-react'],
          unmappedFiles: ['apps/sva-studio-react/src/routes/settings.tsx'],
        }
      )
    ).toEqual({
      mode: 'aggregate',
      reason: 'nx-project-graph-unavailable',
      slices: [],
    });
  });

  it('does not skip a full fallback when Nx reports no affected projects', () => {
    expect(
      hasPlannedUnitProjects({
        mode: 'full-fallback',
        reason: 'unmapped-files',
        directProjects: [],
        remainingProjects: ['plugin-news', 'sva-studio-react'],
        unmappedFiles: ['.github/dependabot.yml'],
      })
    ).toBe(true);
  });
});

describe('remaining Unit shards', () => {
  const projects = [
    'sva-studio-react',
    'core',
    'data',
    'plugin-news',
    'routing',
    'tooling-testing',
  ];
  const options = { base: 'base', head: 'head' };
  beforeEach(() => {
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify(projects));
    vi.mocked(resolveChangedFiles).mockReturnValue(['packages/core/src/index.ts']);
    vi.mocked(loadNxProjectRoots).mockReturnValue(
      projects.map((name) => ({ name, root: `packages/${name}` }))
    );
    vi.mocked(runCiCommand).mockReturnValue({ durationMs: 1, retryCount: 0, attempts: [] });
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
  });

  it.each(['', '0/4', '5/4', '1/0', '1.5/4', '-1/4', '1/4extra', '1/9007199254740992'])(
    'rejects invalid shard %j',
    (value) => expect(() => parseUnitShard(value)).toThrow(/Unit-Shard/u)
  );

  it.each([[], ['core'], projects, [...projects, 'core']])(
    'partitions every project exactly once independently of input ordering: %j',
    (...input) => {
      const selected = [1, 2, 3, 4].map((index) =>
        selectRemainingUnitProjects(input, { index, count: 4 })
      );
      expect(selected.flat().sort()).toEqual([...new Set(input)].sort());
      expect(selected).toEqual(
        [1, 2, 3, 4].map((index) =>
          selectRemainingUnitProjects([...input].reverse(), { index, count: 4 })
        )
      );
      expect(selected[0]).toEqual(input.includes('sva-studio-react') ? ['sva-studio-react'] : []);
    }
  );

  it('supports a single shard with the complete project set', () => {
    expect(selectRemainingUnitProjects(projects, { index: 1, count: 1 })).toEqual(
      [...projects].sort()
    );
  });

  it.each(['affected', 'unmapped', 'invalid-base', 'graph-failure'])(
    'executes the exact unsharded Nx command set for %s scope',
    (scope) => {
      if (scope === 'unmapped') vi.mocked(resolveChangedFiles).mockReturnValue(['unknown.ts']);
      if (scope === 'invalid-base')
        vi.mocked(resolveChangedFiles).mockImplementation(() => {
          throw new Error('base');
        });
      if (scope === 'graph-failure')
        vi.mocked(loadNxProjectRoots).mockImplementation(() => {
          throw new Error('graph');
        });
      runAffectedUnitGate(options);
      const original = vi
        .mocked(runCiCommand)
        .mock.calls.map(([command]) => command)
        .sort();
      vi.mocked(runCiCommand).mockClear();
      runAffectedUnitGate(options, undefined, undefined, 'direct');
      for (const index of [1, 2, 3, 4]) {
        runAffectedUnitGate(options, undefined, undefined, 'remaining', { index, count: 4 });
      }
      expect(
        vi
          .mocked(runCiCommand)
          .mock.calls.map(([command]) => command)
          .sort()
      ).toEqual(original);
    }
  );

  it('writes distinct evidence with the full scope plan for an empty shard', () => {
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify(['core']));
    expect(runAffectedUnitGateCli(['--phase', 'remaining', '--shard', '4/4'])).toBe(0);
    expect(runCiCommand).not.toHaveBeenCalled();
    expect(writeCiFeedbackEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        shardId: 'unit-remaining-4-of-4',
        status: 'skipped',
        plan: expect.objectContaining({ directProjects: ['core'], remainingProjects: [] }),
      })
    );
  });

  it('stops the shard at its first failure and writes failed evidence', () => {
    vi.mocked(runCiCommand).mockImplementation(() => {
      throw new Error('test failure');
    });
    expect(runAffectedUnitGateCli(['--phase', 'remaining', '--shard', '2/4'])).toBe(1);
    expect(runCiCommand).toHaveBeenCalledTimes(1);
    expect(writeCiFeedbackEvidence).toHaveBeenCalledWith(
      expect.objectContaining({
        shardId: 'unit-remaining-2-of-4',
        status: 'failed',
      })
    );
  });

  it.each(['all', 'direct'])('rejects sharding the %s phase before running commands', (phase) => {
    expect(() => runAffectedUnitGateCli(['--phase', phase, '--shard', '1/4'])).toThrow(
      /remaining/u
    );
    expect(runCiCommand).not.toHaveBeenCalled();
  });
});
