import { describe, expect, it } from 'vitest';

import {
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
      new Date('2026-08-28T11:00:00.000Z')
    );

    expect(result.mismatches).toEqual([]);
    expect(result.gates).toHaveLength(12);
    expect(result.gates.every((gate) => gate.matches)).toBe(true);
  });

  it('accepts equivalent terminal failures', () => {
    const checks = allChecks().map((entry) =>
      entry.name === 'Types' || entry.name === 'CI Shadow / Types'
        ? { ...entry, conclusion: 'failure' }
        : entry
    );

    const result = evaluateCiGateShadowParity(checks, scope);

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
      evaluateCiGateShadowParity(mutate(allChecks()), scope).mismatches.length
    ).toBeGreaterThan(0);
  });

  it('reports a terminal result mismatch', () => {
    const checks = allChecks().map((entry) =>
      entry.name === 'CI Shadow / Coverage Complete' ? { ...entry, conclusion: 'failure' } : entry
    );

    expect(evaluateCiGateShadowParity(checks, scope).mismatches).toContain(
      'Coverage: Bestand=passed, Shadow=failed'
    );
  });
});
