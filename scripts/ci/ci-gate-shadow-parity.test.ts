import { describe, expect, it } from 'vitest';

import { evaluateCiGateMainShadowParity, mainGateMappings } from './ci-gate-main-shadow-parity.ts';
import {
  createScopeFailureEvidence,
  evaluateCiGateShadowParity,
  gateMappings,
  type GitHubCheckRun,
} from './ci-gate-shadow-parity.ts';
import { createPrScopeEvidence } from './pr-scope.cli.ts';
import { classifyPrScope } from './pr-scope.ts';

const headSha = 'head-sha';
const scope = createPrScopeEvidence(
  classifyPrScope(['packages/core/src/index.ts']),
  'base',
  headSha
);

const check = (
  name: string,
  conclusion: string | null = 'success',
  overrides: Partial<GitHubCheckRun> = {}
): GitHubCheckRun => ({
  name,
  head_sha: headSha,
  status: conclusion === null ? 'in_progress' : 'completed',
  conclusion,
  started_at: '2026-08-28T10:00:00.000Z',
  completed_at: conclusion === null ? null : '2026-08-28T10:01:00.000Z',
  ...overrides,
});

const allChecks = (): GitHubCheckRun[] =>
  gateMappings.flatMap((mapping) => [
    ...mapping.legacyChecks.map((name) => check(name)),
    ...mapping.shadowChecks.map((name) => check(name)),
  ]);

describe('ci-gate-shadow-parity', () => {
  it('accepts terminal equivalent legacy and shadow results', () => {
    const result = evaluateCiGateShadowParity(
      allChecks(),
      scope,
      scope,
      new Date('2026-08-28T11:00:00.000Z')
    );

    expect(result.mismatches).toEqual([]);
    expect(result.gates).toHaveLength(12);
    expect(result.gates.every((gate) => gate.matches)).toBe(true);
  });

  it('measures both PR sides from the same workflow start', () => {
    const checks = allChecks().map((entry) =>
      entry.name === 'Unit'
        ? {
            ...entry,
            started_at: '2026-08-28T10:00:50.000Z',
            completed_at: '2026-08-28T10:01:00.000Z',
          }
        : entry
    );
    const result = evaluateCiGateShadowParity(
      checks,
      scope,
      scope,
      new Date('2026-08-28T11:00:00.000Z'),
      new Date('2026-08-28T10:00:00.000Z')
    );
    const unit = result.gates.find((gate) => gate.gate === 'Unit');

    expect(unit?.legacy.durationMs).toBe(60_000);
    expect(unit?.shadow.durationMs).toBe(60_000);
  });

  it('collects exact-head main parity evidence with a common start', () => {
    const checks = mainGateMappings.flatMap((mapping) => [
      ...mapping.legacyChecks.map((name) => check(name)),
      ...mapping.shadowChecks.map((name) => check(name)),
    ]);
    const result = evaluateCiGateMainShadowParity(
      checks,
      headSha,
      'push',
      new Date('2026-08-28T11:00:00.000Z'),
      new Date('2026-08-28T10:00:00.000Z')
    );

    expect(result.eventName).toBe('push');
    expect(result.gates).toHaveLength(12);
    expect(result.nonComparableGates).toEqual([]);
    expect(result.gates.every((gate) => gate.legacy.durationMs === 60_000)).toBe(true);
    expect(result.mismatches).toEqual([]);
  });

  it('marks gates without a scheduled legacy run as non-comparable', () => {
    const scheduledMappings = mainGateMappings.filter((mapping) =>
      ['Coverage', 'Complexity', 'Integration'].includes(mapping.gate)
    );
    const checks = scheduledMappings.flatMap((mapping) => [
      ...mapping.legacyChecks.map((name) => check(name)),
      ...mapping.shadowChecks.map((name) => check(name)),
    ]);
    const result = evaluateCiGateMainShadowParity(
      checks,
      headSha,
      'schedule',
      new Date('2026-08-28T11:00:00.000Z'),
      new Date('2026-08-28T10:00:00.000Z')
    );

    expect(result.gates.map((gate) => gate.gate)).toEqual([
      'Coverage',
      'Complexity',
      'Integration',
    ]);
    expect(result.nonComparableGates).toHaveLength(9);
    expect(result.mismatches).toEqual([]);
  });

  it('accepts equivalent terminal failures', () => {
    const checks = allChecks().map((entry) =>
      entry.name === 'Types' || entry.name === 'CI Shadow / Types'
        ? { ...entry, conclusion: 'failure' }
        : entry
    );

    const result = evaluateCiGateShadowParity(checks, scope, scope);

    expect(result.mismatches).toEqual([]);
    expect(result.gates.find((gate) => gate.gate === 'Types')).toMatchObject({
      matches: true,
      legacy: { state: 'failed' },
      shadow: { state: 'failed' },
    });
  });

  it.each([
    ['missing', (checks: GitHubCheckRun[]) => checks.filter((entry) => entry.name !== 'Lint')],
    ['duplicate', (checks: GitHubCheckRun[]) => [...checks, check('Lint')]],
    [
      'foreign head',
      (checks: GitHubCheckRun[]) =>
        checks.map((entry) =>
          entry.name === 'CI Shadow / Lint' ? { ...entry, head_sha: 'other-head' } : entry
        ),
    ],
    [
      'pending',
      (checks: GitHubCheckRun[]) =>
        checks.map((entry) =>
          entry.name === 'CI Shadow / Lint' ? check(entry.name, null) : entry
        ),
    ],
  ])('fails closed for %s check evidence', (_name, mutate) => {
    expect(
      evaluateCiGateShadowParity(mutate(allChecks()), scope, scope).mismatches.length
    ).toBeGreaterThan(0);
  });

  it('reports a terminal result mismatch', () => {
    const checks = allChecks().map((entry) =>
      entry.name === 'CI Shadow / Coverage Complete' ? { ...entry, conclusion: 'failure' } : entry
    );

    expect(evaluateCiGateShadowParity(checks, scope, scope).mismatches).toContain(
      'Coverage: Bestand=passed, Shadow=failed'
    );
  });

  it('fails closed when the centralized and legacy scope plans differ', () => {
    const legacyScope = createPrScopeEvidence(classifyPrScope(['README.md']), 'base', headSha);

    const result = evaluateCiGateShadowParity(allChecks(), scope, legacyScope);

    expect(result.scopeMatches).toBe(false);
    expect(result.hardMismatchCount).toBe(1);
    expect(result.mismatches).toContain(
      'PR-Scope: zentraler Shadow-Plan weicht vom Legacy-HEAD-Plan ab'
    );
  });

  it('records missing scope evidence as a hard mismatch', () => {
    const result = createScopeFailureEvidence(
      'base',
      headSha,
      'Scope-Job endete mit failure',
      new Date('2026-08-28T11:00:00.000Z')
    );

    expect(result).toMatchObject({
      scopeMatches: false,
      gates: [],
      awaitingChecks: false,
      hardMismatchCount: 1,
    });
    expect(result.mismatches[0]).toContain('Scope-Job endete mit failure');
  });
});
