import { execFileSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildUnitProjectCommand,
  coverageExecutesSameUnitCommand,
  hasPlannedUnitProjects,
  resolveAppUnitExecutionPlan,
  runAffectedUnitGate,
  runAffectedUnitGateCli,
  runResidualUnitGate,
} from './affected-unit-gate.ts';
import {
  appUnitJobs,
  buildAppUnitCommand,
  buildAppUnitJobCommand,
  isAppUnitJobSelected,
  planAppUnitExecution,
} from './affected-unit-plan.ts';
import { CiCommandExecutionError, runCiCommand } from './ci-command-runner.ts';
import { writeCiFeedbackEvidence } from './ci-feedback-evidence.ts';
import { loadResidualUnitProjects, loadNxProjectRoots } from './nx-project-graph.ts';
import { resolveChangedFiles } from './pr-scope.ts';
import { runAppUnitPartition, parseUnitShard, selectRemainingUnitProjects } from './unit-shards.ts';

vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
vi.mock('./ci-command-runner.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ci-command-runner.ts')>()),
  runCiCommand: vi.fn(),
}));
vi.mock('./ci-feedback-evidence.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ci-feedback-evidence.ts')>()),
  writeCiFeedbackEvidence: vi.fn(),
}));
vi.mock('./nx-project-graph.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./nx-project-graph.ts')>()),
  loadNxProjectRoots: vi.fn(),
  loadResidualUnitProjects: vi.fn(),
}));
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

describe('separate app runners', () => {
  it('partitions routes into four jobs without changing the other slice commands', () => {
    expect(appUnitJobs.filter((job) => job.startsWith('routes-'))).toHaveLength(4);
    expect(buildAppUnitJobCommand('routes-4')).toBe(
      'pnpm nx run sva-studio-react:test:unit:routes --skipNxCache --maxWorkers=1 --shard=4/4'
    );
    expect(buildAppUnitJobCommand('server')).toBe(
      'pnpm nx run sva-studio-react:test:unit:server --skipNxCache --maxWorkers=1'
    );
    expect(() => buildAppUnitJobCommand('routes-5')).toThrow(/Ungültiger/);
  });
  it('selects only the planned slices and expands aggregate plans completely', () => {
    const plan = { mode: 'slices' as const, reason: 'test', slices: ['routes' as const] };
    expect(appUnitJobs.filter((job) => isAppUnitJobSelected(plan, job))).toEqual([
      'routes-1',
      'routes-2',
      'routes-3',
      'routes-4',
    ]);
    expect(
      appUnitJobs.every((job) => isAppUnitJobSelected({ ...plan, mode: 'aggregate' }, job))
    ).toBe(true);
    expect(appUnitJobs.some((job) => isAppUnitJobSelected({ ...plan, mode: 'skip' }, job))).toBe(
      false
    );
  });
});

describe('Main coverage reuses only identical test commands', () => {
  const target = {
    executor: 'nx:run-commands',
    options: {
      cwd: 'packages/example',
      command: 'pnpm exec vitest run tests --config vitest.config.ts',
    },
  };
  it('accepts only the addition of instrumentation to the same command', () => {
    expect(
      coverageExecutesSameUnitCommand(target, {
        ...target,
        options: { ...target.options, command: target.options.command + ' --coverage' },
      })
    ).toBe(true);
  });
  it('keeps different configurations, working directories and test selections as residual tests', () => {
    for (const options of [
      { ...target.options, command: 'pnpm exec vitest run --coverage' },
      { ...target.options, cwd: 'other' },
      { ...target.options, command: target.options.command + ' --coverage.include=src/**' },
    ])
      expect(coverageExecutesSameUnitCommand(target, { ...target, options })).toBe(false);
    expect(coverageExecutesSameUnitCommand({ executor: 'nx:noop' }, target)).toBe(false);
  });
});

it('preserves failed App partition duration and retry evidence', () => {
  const failure = new CiCommandExecutionError('app command', 'deterministic', [
    { attempt: 1, durationMs: 12, classification: 'deterministic', signal: null },
  ]);
  vi.mocked(runCiCommand).mockImplementation(() => {
    throw failure;
  });
  const report = vi.fn();
  expect(() =>
    runAppUnitPartition({ mode: 'aggregate', reason: 'test', slices: [] }, 'routes-1', report)
  ).toThrow(failure);
  expect(report).toHaveBeenCalledWith({
    label: 'unit:app:routes-1',
    projects: ['sva-studio-react'],
    durationMs: 12,
    retryCount: 0,
  });
  vi.mocked(runCiCommand).mockReset();
});

describe('separate Main App residual selection', () => {
  afterEach(() => vi.unstubAllEnvs());
  it.each([undefined, '0', '1'])('preserves residual projects with separate App=%s', (separate) => {
    vi.mocked(runCiCommand).mockClear();
    vi.mocked(loadResidualUnitProjects).mockReturnValue(['sva-studio-react', 'unit-only']);
    vi.stubEnv('CI_UNIT_APP_SEPARATE', separate);
    runResidualUnitGate();
    expect(vi.mocked(runCiCommand).mock.calls.map(([command]) => command)).toEqual(
      (separate === '1' ? ['unit-only'] : ['sva-studio-react', 'unit-only']).map(
        buildUnitProjectCommand
      )
    );
  });
});
