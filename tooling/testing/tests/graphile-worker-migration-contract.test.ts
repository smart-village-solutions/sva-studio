import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const readWorkspaceFile = (path: string): string => readFileSync(resolve(rootDir, path), 'utf8');

describe('Graphile worker migration contract', () => {
  it('runs Graphile migrations only from the privileged migration one-shot', () => {
    const migrator = readWorkspaceFile('deploy/portainer/migrate-graphile-worker.mjs');
    const migrationEntrypoint = readWorkspaceFile('deploy/portainer/migrate-entrypoint.sh');
    const runtimeWorker = readWorkspaceFile(
      'packages/auth-runtime/src/plugin-operations/runner-worker.ts'
    );

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
    expect(runtimeWorker).toContain('graphileWorker.runTaskList(');
    expect(runtimeWorker).not.toContain('runMigrations');
    expect(runtimeWorker).not.toContain('bootstrapStudioAppDbUserIfNeeded');
  });

  it('binds enqueue to the tenant role boundary and processing to the worker pool', () => {
    const runtimeWorker = readWorkspaceFile(
      'packages/auth-runtime/src/plugin-operations/runner-worker.ts'
    );
    const queueWorker = readWorkspaceFile(
      'packages/auth-runtime/src/plugin-operations/runner-queue.ts'
    );

    expect(runtimeWorker).toContain('const pool = resolveStudioJobWorkerPool()');
    expect(queueWorker).toContain('withInstanceDb(input.instanceId');
    expect(queueWorker).not.toContain('resolveStudioJobWorkerPool');
    expect(queueWorker).toContain('graphile_worker.sva_enqueue_job');
    expect(queueWorker).not.toContain('graphile_worker.add_job');
  });
});
