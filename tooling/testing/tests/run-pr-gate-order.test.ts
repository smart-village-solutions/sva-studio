import { afterEach, describe, expect, it, vi } from 'vitest';

describe('run-pr-gate order', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('runs coverage and complexity gates before quality gates for full PR scopes', async () => {
    const commands: string[] = [];

    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.doMock('node:child_process', () => ({
      execSync: vi.fn((command: string) => {
        commands.push(command);
        return Buffer.from('');
      }),
    }));
    vi.doMock('../../../scripts/ci/pr-scope.ts', () => ({
      resolveChangedFiles: vi.fn(() => ['pnpm-lock.yaml']),
      classifyPrScope: vi.fn(() => ({
        codeRelevant: true,
        qualityGateMode: 'full',
        coverageMode: 'full',
        integrationMode: 'skip',
        appBuildMode: 'skip',
        e2eMode: 'skip',
      })),
    }));
    vi.doMock('../../../scripts/ci/affected-unit-gate.ts', () => ({
      runAffectedUnitGate: vi.fn(() => []),
    }));
    vi.doMock('../../../scripts/ci/run-integration-gate.ts', () => ({
      runIntegrationGate: vi.fn(),
    }));

    // eslint-disable-next-line @nx/enforce-module-boundaries
    const { runPrGate } = await import('../../../scripts/ci/run-pr-gate.ts');

    expect(runPrGate([])).toBe(0);
    expect(commands).toEqual([
      'pnpm check:file-placement',
      'pnpm check:toolchain-consistency',
      'pnpm clean:generated-source-artifacts',
      'pnpm check:plugin-ui-boundary',
      'pnpm check:plugin-architecture-boundary',
      'pnpm test:coverage',
      'pnpm patch-coverage-gate --base=origin/main',
      'pnpm sonar-new-code-gate --base=origin/main',
      'env COVERAGE_GATE_REQUIRE_SUMMARIES=0 pnpm coverage-gate',
      'pnpm complexity-gate',
      'pnpm test:eslint',
      'pnpm test:unit',
      'pnpm test:types',
      'pnpm test:ops:critical',
    ]);
  });
});
