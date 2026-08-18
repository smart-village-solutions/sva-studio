import { describe, expect, it, vi } from 'vitest';

import {
  buildSuccessfulOneShotResult,
  classifyOneShotDiagnostic,
  createOneShotJobError,
  withOneShotCleanupFailure,
} from './one-shot-job-lifecycle.ts';

describe('one-shot job lifecycle', () => {
  it.each([
    [
      '{"code":"PROMOTE_PREFLIGHT_TENANT_SCOPE_MISMATCH"}',
      'candidate',
      'CANDIDATE_TENANT_SCOPE_MISMATCH',
    ],
    ['[migrate-entrypoint] Wende Migrationen an', 'migrate', 'MIGRATION_GOOSE_FAILED'],
    [
      '[migrate-entrypoint] Wende Graphile-Worker-Migrationen mit dem privilegierten Migrationsbenutzer an',
      'migrate',
      'MIGRATION_GRAPHILE_WORKER_FAILED',
    ],
    [
      '[bootstrap-entrypoint] running bootstrap SQL against database',
      'bootstrap',
      'BOOTSTRAP_SQL_FAILED',
    ],
    ['psql: error: connection refused', 'bootstrap', 'ONESHOT_DATABASE_CONNECTION_FAILED'],
    [
      'ERROR: relation graphile_worker.jobs does not exist',
      'bootstrap',
      'ONESHOT_DATABASE_SCHEMA_MISSING',
    ],
  ] as const)('maps a remote diagnostic to a stable code', (diagnostic, service, expected) => {
    expect(classifyOneShotDiagnostic(diagnostic, service)).toBe(expected);
  });

  it('builds the shared successful migration and bootstrap result contract', () => {
    const cleanup = vi.fn(async () => undefined);
    const result = buildSuccessfulOneShotResult({
      cleanup,
      durationMs: 42,
      jobServiceName: 'bootstrap',
      jobStackName: 'studio-staging-bootstrap-1',
      logTail: 'restricted diagnostic',
      startedAt: '2026-08-18T00:00:00.000Z',
      task: { exitCode: 0, state: 'complete', taskId: 'task-1' },
    });

    expect(result).toMatchObject({
      durationMs: 42,
      exitCode: 0,
      jobServiceName: 'bootstrap',
      state: 'complete',
      taskId: 'task-1',
    });
    expect(result.cleanup).toBe(cleanup);
  });

  it('preserves allowlisted task evidence when cleanup also fails', () => {
    const taskFailure = createOneShotJobError({
      diagnostic: 'person@example.test https://internal.example.test',
      failureKind: 'task-failed',
      jobServiceName: 'migrate',
      jobStackName: 'studio-prod-migrate-1',
      task: { exitCode: 1, state: 'failed', taskId: 'task-2' },
    });
    const cleanupFailure = withOneShotCleanupFailure(taskFailure);

    expect(cleanupFailure.evidence).toEqual({
      cleanupFailed: true,
      diagnosticCode: 'ONESHOT_UNKNOWN_TASK_FAILURE',
      exitCode: 1,
      failureKind: 'task-failed',
      jobServiceName: 'migrate',
      jobStackName: 'studio-prod-migrate-1',
      state: 'failed',
      taskId: 'task-2',
    });
    expect(JSON.stringify(cleanupFailure.evidence)).not.toMatch(/person@|https:/u);
  });
});
