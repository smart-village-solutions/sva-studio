import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateDeployGate,
  evaluatePromoteDeployGates,
  executePromoteDeployGates,
  formatRiskSummary,
  type DeployGateMode,
} from './promote-deploy-gates.ts';
import { isDevMcpOnlyComposeDiff, isTraefikOnlyComposeDiff } from './traefik-compose-diff.ts';

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

  it('recognizes only the fixed Dev MCP service-token configuration as safe', () => {
    expect(isDevMcpOnlyComposeDiff([
      '+    environment:',
      '+      SVA_STUDIO_MCP_ENABLED: "true"',
      '+      SVA_STUDIO_MCP_ISSUER: "https://keycloak.smart-village.app/realms/studio-dev"',
      '+      SVA_STUDIO_MCP_AUDIENCE: "sva-studio-mcp"',
      '+      SVA_STUDIO_MCP_CLIENT_ID: "sva-studio-mcp"',
    ].join('\n'))).toBe(true);
    expect(isDevMcpOnlyComposeDiff('+      SVA_STUDIO_MCP_ENABLED: "false"')).toBe(false);
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

  it('automatically runs only the required Dev one-shot job', () => {
    const migration = evaluateDeployGate({
      changedFiles: ['packages/data/migrations/0010_add_role.sql'],
      environment: 'dev',
      executorConfigured: true,
      kind: 'migration',
      mode: 'auto',
    });
    const bootstrap = evaluateDeployGate({
      changedFiles: ['docs/guides/swarm-deployment-runbook.md'],
      environment: 'dev',
      executorConfigured: true,
      kind: 'bootstrap',
      mode: 'auto',
    });

    expect(migration).toMatchObject({ ok: true, riskDetected: true, shouldRun: true });
    expect(bootstrap).toMatchObject({ ok: true, riskDetected: false, shouldRun: false });
  });

  it('keeps automatic mode restricted to Dev', () => {
    const result = evaluateDeployGate({
      changedFiles: ['packages/data/migrations/0010_add_role.sql'],
      environment: 'staging',
      executorConfigured: true,
      kind: 'migration',
      mode: 'auto',
    });

    expect(result).toMatchObject({ ok: false, result: 'blocked-safe-run-required', shouldRun: false });
  });

  it('rejects automatic mode outside Dev even when no job would be required', () => {
    const result = evaluateDeployGate({
      changedFiles: ['docs/guides/swarm-deployment-runbook.md'],
      environment: 'staging',
      executorConfigured: true,
      kind: 'migration',
      mode: 'auto',
    });

    expect(result).toMatchObject({ ok: false, result: 'blocked-safe-run-required', shouldRun: false });
  });

  it('authorizes bootstrap run mode when a hardened executor is wired by the workflow', () => {
    const result = evaluateDeployGate({
      changedFiles: ['bootstrap-entrypoint.sh'],
      environment: 'staging',
      executorConfigured: true,
      kind: 'bootstrap',
      mode: 'run',
    });

    expect(result).toMatchObject({
      mode: 'run',
      ok: true,
      result: 'asserted-clean',
      riskDetected: true,
    });
    expect(result.message).toContain('Exit-Code-Evidenz');
  });

  it.each(['migration', 'bootstrap'] as const)('keeps production %s run fail-closed', (kind) => {
    const result = evaluateDeployGate({
      changedFiles: [],
      environment: 'prod',
      executorConfigured: true,
      kind,
      mode: 'run',
    });

    expect(result).toMatchObject({ ok: false, result: 'blocked-safe-run-required' });
    expect(result.message).toContain('Production erlaubt One-shot-Jobs');
  });

  it('authorizes a wired staging migration executor', () => {
    expect(evaluateDeployGate({
      changedFiles: ['packages/data/migrations/0010_add_role.sql'],
      environment: 'staging',
      executorConfigured: true,
      kind: 'migration',
      mode: 'run',
    })).toMatchObject({ ok: true, result: 'asserted-clean' });
  });

  it('keeps run mode fail-closed when the environment is missing', () => {
    expect(evaluateDeployGate({
      changedFiles: [],
      executorConfigured: true,
      kind: 'migration',
      mode: 'run',
    })).toMatchObject({ ok: false, result: 'blocked-safe-run-required' });
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
    { kind: 'migration', mode: 'auto' },
    { kind: 'migration', mode: 'run' },
    { kind: 'bootstrap', mode: 'assert-none' },
    { kind: 'bootstrap', mode: 'auto' },
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
