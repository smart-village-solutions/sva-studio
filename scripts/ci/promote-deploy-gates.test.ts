import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateDeployGate,
  evaluatePromoteDeployGates,
  executePromoteDeployGates,
  formatRiskSummary,
  isTraefikOnlyComposeDiff,
  type DeployGateMode,
} from './promote-deploy-gates.ts';

const temporaryDirectories: string[] = [];

afterEach(() => {
  delete process.env.GITHUB_OUTPUT;
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

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
    expect(result.bootstrap.riskFiles).toEqual([
      'packages/auth-runtime/src/bootstrap/reconcile.ts',
    ]);
  });

  it('treats the deployed Portainer bootstrap entrypoint as bootstrap risk', () => {
    const result = evaluatePromoteDeployGates({
      bootstrapMode: 'assert-none',
      changedFiles: ['deploy/portainer/bootstrap-entrypoint.sh'],
      migrationMode: 'assert-none',
    });

    expect(result.bootstrap.riskFiles).toEqual(['deploy/portainer/bootstrap-entrypoint.sh']);
    expect(result.bootstrap.ok).toBe(false);
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

  it('allows Traefik-only compose label changes without suppressing other compose risks', () => {
    const result = evaluatePromoteDeployGates({
      bootstrapMode: 'assert-none',
      changedFiles: ['deploy/compose.dev.yaml'],
      migrationMode: 'assert-none',
      safeComposeFiles: ['deploy/compose.dev.yaml'],
    });

    expect(result.migration.ok).toBe(true);
    expect(result.bootstrap.ok).toBe(true);
  });

  it('recognizes only label-list changes as Traefik-only compose diffs', () => {
    expect(isTraefikOnlyComposeDiff("-        - 'traefik.http.routers.app.tls=true'\n+        - 'traefik.http.routers.app.tls.certresolver=default'\n")).toBe(true);
    expect(isTraefikOnlyComposeDiff('+  postgres:\n+    image: postgres:16-alpine\n')).toBe(false);
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
    expect(result.message).toContain('gehärteter Exit-Code-/Log-Evidenz');
  });

  it('formats risk summaries deterministically', () => {
    expect(formatRiskSummary([])).toBe('none');
    expect(
      formatRiskSummary(['packages/data/migrations/0010_add_role.sql', 'migrate-entrypoint.sh'])
    ).toBe('migrate-entrypoint.sh, packages/data/migrations/0010_add_role.sql');
  });

  it('writes gate messages as plain GitHub output values', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'promote-gates-'));
    temporaryDirectories.push(directory);
    const outputPath = path.join(directory, 'github-output.txt');
    process.env.GITHUB_OUTPUT = outputPath;

    const result = await executePromoteDeployGates([
      '--migration-mode',
      'assert-none',
      '--bootstrap-mode',
      'assert-none',
      '--changed-files',
      'docs/readme.md',
    ]);

    expect(result.exitCode).toBe(0);
    const output = readFileSync(outputPath, 'utf8');
    expect(output).toMatch(/^migration_gate_message=[^"].+$/mu);
    expect(output).toMatch(/^bootstrap_gate_message=[^"].+$/mu);
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
