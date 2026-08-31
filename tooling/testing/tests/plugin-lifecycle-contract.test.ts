import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { classifyPrScope } from '../../../scripts/ci/pr-scope.js';

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

  it('cannot skip integration for lifecycle, repository, migration, queue, or harness changes', () => {
    for (const path of [
      'packages/auth-runtime/src/plugin-tenant-lifecycle/runtime.ts',
      'packages/auth-runtime/src/plugin-operations/runner-queue.ts',
      'packages/data-repositories/src/plugin-tenant-lifecycle/repository.ts',
      'packages/data/migrations/0090_iam_plugin_lifecycle_linearization.sql',
    ]) {
      expect(classifyPrScope([path]).integrationMode).toBe('affected');
    }
    expect(
      classifyPrScope(['scripts/ci/verify-plugin-lifecycle-database-contract.ts']).integrationMode
    ).toBe('full');
  });
});
