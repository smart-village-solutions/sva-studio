import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const readWorkspaceFile = (path: string): string => readFileSync(resolve(rootDir, path), 'utf8');
const readRuntimeWorker = () => ({
  entry: readWorkspaceFile('packages/auth-runtime/src/plugin-operations/runner-worker.ts'),
  support: readWorkspaceFile(
    'packages/auth-runtime/src/plugin-operations/runner-worker-support.ts'
  ),
});

describe('Graphile worker migration contract', () => {
  it('runs Graphile migrations only from the privileged migration one-shot', () => {
    const migrator = readWorkspaceFile('deploy/portainer/migrate-graphile-worker.mjs');
    const migrationEntrypoint = readWorkspaceFile('deploy/portainer/migrate-entrypoint.sh');
    const runtimeWorker = readRuntimeWorker();

    expect(migrator).toContain('await runMigrations({ pgPool: pool })');
    expect(migrator).toContain(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA graphile_worker REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC'
    );
    expect(migrator).toContain('SECURITY DEFINER');
    expect(migrator).toContain('SET search_path = pg_catalog, graphile_worker');
    expect(migrator).toContain('graphile_worker.sva_enqueue_job');
    expect(migrator).toContain("c.relkind <> 'S'");
    expect(migrator).toContain("d.deptype IN ('a', 'i')");
    expect(migrationEntrypoint).toContain('node "${GRAPHILE_WORKER_MIGRATOR}"');
    expect(runtimeWorker.entry).toContain("from './runner-worker-support.js'");
    expect(runtimeWorker.support).toContain('graphileWorker.runTaskList(');
    expect(runtimeWorker.entry + runtimeWorker.support).not.toContain('runMigrations');
    expect(runtimeWorker.entry + runtimeWorker.support).not.toContain(
      'bootstrapStudioAppDbUserIfNeeded'
    );
  });

  it('binds enqueue to the tenant role boundary and processing to the worker pool', () => {
    const runtimeWorker = readRuntimeWorker();
    const queueWorker = readWorkspaceFile(
      'packages/auth-runtime/src/plugin-operations/runner-queue.ts'
    );

    expect(runtimeWorker.entry).toContain('createGraphileWorkerRunner(');
    expect(runtimeWorker.support).toContain('const pool = resolveStudioJobWorkerPool()');
    expect(queueWorker).toContain('withInstanceDb(input.instanceId');
    expect(queueWorker).not.toContain('resolveStudioJobWorkerPool');
    expect(queueWorker).toContain('graphile_worker.sva_enqueue_job');
    expect(queueWorker).not.toContain('graphile_worker.add_job');
  });
});
