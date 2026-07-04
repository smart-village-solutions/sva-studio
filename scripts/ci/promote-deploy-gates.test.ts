import { describe, expect, it } from 'vitest';

import {
  evaluateDeployGate,
  evaluatePromoteDeployGates,
  formatRiskSummary,
  type DeployGateMode,
} from './promote-deploy-gates.ts';

describe('promote-deploy-gates', () => {
  it('treats docs-only changes as safe for assert-none', () => {
    const result = evaluatePromoteDeployGates({
      bootstrapMode: 'assert-none',
      changedFiles: ['docs/guides/swarm-deployment-runbook.md'],
      migrationMode: 'assert-none',
    });

    expect(result.migration.riskDetected).toBe(false);
    expect(result.migration.ok).toBe(true);
    expect(result.bootstrap.riskDetected).toBe(false);
    expect(result.bootstrap.ok).toBe(true);
  });

  it('fails migration assert-none when migration-risk files changed', () => {
    const result = evaluatePromoteDeployGates({
      bootstrapMode: 'assert-none',
      changedFiles: ['packages/data/migrations/0010_add_role.sql'],
      migrationMode: 'assert-none',
    });

    expect(result.migration).toMatchObject({
      mode: 'assert-none',
      ok: false,
      result: 'blocked-risk',
      riskDetected: true,
    });
    expect(result.migration.riskFiles).toEqual(['packages/data/migrations/0010_add_role.sql']);
  });

  it('fails bootstrap assert-none when provisioning-risk files changed', () => {
    const result = evaluatePromoteDeployGates({
      bootstrapMode: 'assert-none',
      changedFiles: ['packages/auth-runtime/src/bootstrap/reconcile.ts'],
      migrationMode: 'assert-none',
    });

    expect(result.bootstrap).toMatchObject({
      mode: 'assert-none',
      ok: false,
      result: 'blocked-risk',
      riskDetected: true,
    });
    expect(result.bootstrap.riskFiles).toEqual(['packages/auth-runtime/src/bootstrap/reconcile.ts']);
  });

  it('treats compose contract changes as migration and bootstrap risk', () => {
    const result = evaluatePromoteDeployGates({
      bootstrapMode: 'assert-none',
      changedFiles: ['compose.yaml', 'deploy/compose.prod.yaml'],
      migrationMode: 'assert-none',
    });

    expect(result.migration.riskFiles).toEqual(['compose.yaml', 'deploy/compose.prod.yaml']);
    expect(result.bootstrap.riskFiles).toEqual(['compose.yaml', 'deploy/compose.prod.yaml']);
    expect(result.migration.ok).toBe(false);
    expect(result.bootstrap.ok).toBe(false);
  });

  it('refuses run mode when no safe executor is configured', () => {
    const result = evaluateDeployGate({
      changedFiles: [],
      executorConfigured: false,
      kind: 'migration',
      mode: 'run',
    });

    expect(result).toMatchObject({
      mode: 'run',
      ok: false,
      result: 'blocked-missing-executor',
      riskDetected: false,
    });
    expect(result.message).toContain('Kein sicherer One-shot-Executor');
  });

  it('still blocks run mode when a configured executor is not wired as a hardened promote step', () => {
    const result = evaluateDeployGate({
      changedFiles: ['migrate-entrypoint.sh'],
      executorConfigured: true,
      kind: 'migration',
      mode: 'run',
    });

    expect(result).toMatchObject({
      mode: 'run',
      ok: false,
      result: 'blocked-safe-run-required',
      riskDetected: true,
    });
    expect(result.message).toContain('gehaerteter Exit-Code-/Log-Evidenz');
  });

  it('formats risk summaries deterministically', () => {
    expect(formatRiskSummary([])).toBe('none');
    expect(formatRiskSummary(['packages/data/migrations/0010_add_role.sql', 'migrate-entrypoint.sh'])).toBe(
      'migrate-entrypoint.sh, packages/data/migrations/0010_add_role.sql'
    );
  });

  it.each<{
    kind: 'bootstrap' | 'migration';
    mode: DeployGateMode;
  }>([
    { kind: 'migration', mode: 'assert-none' },
    { kind: 'migration', mode: 'run' },
    { kind: 'bootstrap', mode: 'assert-none' },
    { kind: 'bootstrap', mode: 'run' },
  ])('keeps mode and kind stable for %s/%s', ({ kind, mode }) => {
    const result = evaluateDeployGate({
      changedFiles: [],
      executorConfigured: true,
      kind,
      mode,
    });

    expect(result.kind).toBe(kind);
    expect(result.mode).toBe(mode);
  });
});
