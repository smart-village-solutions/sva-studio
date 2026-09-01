import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');

describe('plugin lifecycle database contract gate', () => {
  it('runs the real lifecycle harness from auth-runtime integration', () => {
    const project = JSON.parse(read('packages/auth-runtime/project.json')) as {
      targets: { 'test:integration': { options: { commands?: string[]; parallel?: boolean } } };
    };
    expect(project.targets['test:integration'].options.commands).toContain(
      'node --import tsx scripts/ci/verify-plugin-lifecycle-database-contract.ts'
    );
    expect(project.targets['test:integration'].options.parallel).toBe(false);
  });

  it('keeps every lifecycle invariant positive and negative in the real harness', () => {
    const harness = read('scripts/ci/verify-plugin-lifecycle-database-contract.ts');
    const workerFixture = read('tooling/testing/fixtures/plugin-lifecycle-worker-process.ts');
    for (const invariant of [
      'LC-01',
      'LC-02',
      'LC-03',
      'LC-04',
      'LC-05',
      'LC-06',
      'TOP-01',
      'ACT-01',
      'OBS-01',
    ]) {
      expect(harness).toContain(`${invariant}-positive`);
      expect(harness).toContain(`${invariant}-negative`);
    }
    expect(harness).toContain('postgres:16-alpine');
    expect(harness).toContain('runTaskList');
    expect(harness).toContain('plugin-lifecycle-worker-process.ts');
    expect(workerFixture).toContain('ensurePrivilegedStudioJobWorkerStarted');
    expect(harness).toContain('top01_persistent_job_key_after_crash');
    expect(harness).toContain('top01_original_scheduled_job_completed_after_restart');
    expect(harness).toContain('top01_clean_shutdown_not_restarted');
    expect(harness).not.toContain("sva_enqueue_job('studio_job_execute_privileged'");
    expect(harness).toContain('packages/data/scripts/run-migrations.sh');
    expect(harness).toContain('assertPersistedTerminalOutcome');
    expect(harness).toContain('final_attempt_retry_key_absent');
    expect(harness).toContain('act01_reconcile_key_rollback');
  });

  it('keeps the observability function aggregated and least-privileged', () => {
    const migration = read('packages/data/migrations/0091_iam_plugin_lifecycle_observability.sql');
    expect(migration).toContain('CREATE ROLE iam_observability');
    expect(migration).toContain("RAISE EXCEPTION 'iam_observability_role_already_exists'");
    expect(migration).not.toContain('ALTER ROLE iam_observability');
    expect(migration).toMatch(/NOLOGIN NOSUPERUSER[\s\S]*NOBYPASSRLS/);
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = pg_catalog, iam');
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION iam.plugin_tenant_lifecycle_observability_snapshot() FROM PUBLIC'
    );
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION iam.plugin_tenant_lifecycle_observability_snapshot() TO iam_app'
    );
    expect(migration).toMatch(
      /SELECT 'pending_recheck_due'::text,[\s\S]*readiness_status = 'pending'[\s\S]*active_job_id IS NULL[\s\S]*next_recheck_at <= statement_timestamp\(\)/
    );
    expect(migration).toContain('REVOKE CREATE ON SCHEMA iam FROM iam_observability');
    expect(migration).not.toMatch(/EXECUTE\s+format|EXECUTE\s+[^;]*\|\|/i);
  });

  it('reconciles legacy terminal event duplicates before enforcing uniqueness', () => {
    const migration = read('packages/data/migrations/0090_iam_plugin_lifecycle_linearization.sql');
    const cleanupPosition = migration.indexOf('WITH ranked_terminal_events AS');
    const indexPosition = migration.indexOf(
      'CREATE UNIQUE INDEX idx_studio_job_events_terminal_attempt'
    );

    expect(cleanupPosition).toBeGreaterThan(-1);
    expect(indexPosition).toBeGreaterThan(cleanupPosition);
    expect(migration).toContain('PARTITION BY job_id, attempts');
    expect(migration).toContain('ORDER BY created_at DESC, id DESC');
    expect(migration).toContain('ranked.terminal_event_rank > 1');
  });

  it('executes the direct login denial for the allowlisted enqueue function', () => {
    const graphileContract = read('scripts/ci/verify-graphile-worker-database-contract.ts');
    expect(graphileContract).toContain("psqlStatus(\n      'sva_app'");
    expect(graphileContract).toContain('graphile_worker.sva_enqueue_job');
    expect(graphileContract).toContain('graphile_contract_direct_login_enqueue_was_allowed');
  });

  it('owns and cleans only its unique disposable container', () => {
    const harness = read('scripts/ci/verify-plugin-lifecycle-database-contract.ts');
    expect(harness).toContain('sva-lifecycle-contract-${process.pid}-${randomUUID()');
    expect(harness).toContain("spawnSync('docker', ['rm', '--force', containerName]");
    expect(harness).not.toContain('docker compose down');
  });
});
