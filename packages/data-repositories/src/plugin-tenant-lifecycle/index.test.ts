import { describe, expect, it } from 'vitest';

import type { SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import { createPluginTenantLifecycleRepository } from './index.js';

const row = {
  instance_id: 'tenant-a',
  plugin_id: 'speech',
  access_state: 'active' as const,
  readiness_status: 'pending' as const,
  desired_operation: 'provision' as const,
  desired_generation: '2',
  completed_generation: '1',
  claimed_generation: null,
  active_job_id: null,
  readiness_revision: null,
  readiness_checks: [],
  error_code: null,
  retry_kind: null,
  retry_after: null,
  next_recheck_at: '2026-08-30T12:02:00.000Z',
  contract_revision: 'policy:contract',
  recovery_error_code: null,
  requested_at: '2026-08-30T12:00:00.000Z',
  started_at: null,
  completed_at: null,
  updated_at: '2026-08-30T12:00:00.000Z',
};

const createExecutor = (rows: readonly (typeof row)[] = [row]) => {
  const statements: SqlStatement[] = [];
  const executor: SqlExecutor = {
    async execute<TRow>(statement) {
      statements.push(statement);
      return { rowCount: rows.length, rows: rows as readonly TRow[] };
    },
  };
  return { executor, statements };
};

const createQueuedExecutor = (queuedRows: readonly (readonly (typeof row)[])[]) => {
  const statements: SqlStatement[] = [];
  const queue = [...queuedRows];
  const executor: SqlExecutor = {
    async execute<TRow>(statement) {
      statements.push(statement);
      const rows = queue.shift() ?? [];
      return { rowCount: rows.length, rows: rows as readonly TRow[] };
    },
  };
  return { executor, statements };
};

describe('plugin tenant lifecycle repository', () => {
  it('increments the desired generation only when no lifecycle job is in flight', async () => {
    const { executor, statements } = createExecutor();
    const repository = createPluginTenantLifecycleRepository(executor);

    const result = await repository.requestLifecycle({
      instanceId: 'tenant-a',
      pluginId: 'speech',
      operation: 'reconcile',
    });

    expect(result.desiredGeneration).toBe(2);
    expect(statements[0]?.values).toEqual(['tenant-a', 'speech', 'reconcile']);
    expect(statements[0]?.text).toContain(
      'desired_generation = iam.instance_plugin_lifecycle.desired_generation + 1'
    );
    expect(statements[0]?.text).toContain('claimed_generation = NULL');
    expect(statements[0]?.text).toContain('active_job_id = NULL');
    expect(statements[0]?.text).toContain(
      'WHERE iam.instance_plugin_lifecycle.active_job_id IS NULL'
    );
    expect(statements[0]?.text).toContain(
      'AND iam.instance_plugin_lifecycle.claimed_generation IS NULL'
    );
  });

  it('rejects a concurrent request while a lifecycle job is in flight', async () => {
    const { executor } = createExecutor([]);
    const repository = createPluginTenantLifecycleRepository(executor);

    await expect(
      repository.requestLifecycle({
        instanceId: 'tenant-a',
        pluginId: 'speech',
        operation: 'reconcile',
      })
    ).rejects.toThrow('plugin_tenant_lifecycle_request_conflict');
  });

  it('claims only the exact desired operation and generation', async () => {
    const { executor, statements } = createExecutor([]);
    const repository = createPluginTenantLifecycleRepository(executor);

    await expect(
      repository.claimLifecycle({
        instanceId: 'tenant-a',
        pluginId: 'speech',
        jobId: '7dbe0bb5-4689-46b0-b21f-0d9ea3cd9489',
        generation: 4,
        operation: 'provision',
      })
    ).resolves.toBeNull();

    expect(statements[0]?.text).toContain('AND desired_generation = $4');
    expect(statements[0]?.text).toContain('AND desired_operation = $5');
    expect(statements[0]?.values).toEqual([
      'tenant-a',
      'speech',
      '7dbe0bb5-4689-46b0-b21f-0d9ea3cd9489',
      4,
      'provision',
    ]);
  });

  it('marks only the exact unclaimed generation retryable after job creation fails', async () => {
    const { executor, statements } = createExecutor();
    const repository = createPluginTenantLifecycleRepository(executor);

    await repository.failUnclaimedLifecycle({
      instanceId: 'tenant-a',
      pluginId: 'speech',
      generation: 2,
      readinessStatus: 'blocked',
      errorCode: 'plugin_tenant_lifecycle_job_creation_failed',
      retryKind: 'retryable',
    });

    expect(statements[0]?.text).toContain('AND desired_generation = $3');
    expect(statements[0]?.text).toContain('AND claimed_generation IS NULL');
    expect(statements[0]?.text).toContain('AND active_job_id IS NULL');
    expect(statements[0]?.values).toEqual([
      'tenant-a',
      'speech',
      2,
      'blocked',
      'plugin_tenant_lifecycle_job_creation_failed',
      'retryable',
      null,
    ]);
  });

  it('fences completion by active job, claimed generation and current desired generation', async () => {
    const { executor, statements } = createExecutor([row]);
    const repository = createPluginTenantLifecycleRepository(executor);

    await expect(
      repository.completeLifecycle({
        instanceId: 'tenant-a',
        pluginId: 'speech',
        jobId: '7dbe0bb5-4689-46b0-b21f-0d9ea3cd9489',
        generation: 3,
        operation: 'readiness',
        readinessStatus: 'ready',
        readinessRevision: 'schema:3',
        readinessChecks: [{ checkId: 'speech.databaseSchema', status: 'ready' }],
        contractRevision: 'speech-1:1',
      })
    ).resolves.toMatchObject({ outcome: 'applied' });

    expect(statements[0]?.text).toContain('AND active_job_id = $3::uuid');
    expect(statements[0]?.text).toContain('AND claimed_generation = $4');
    expect(statements[0]?.text).toContain('AND desired_generation = $4');
    expect(statements[0]?.text).toContain(
      "WHEN $6 = 'pending' THEN NOW() + INTERVAL '120 seconds'"
    );
    expect(statements[0]?.text).toContain('contract_revision = $9');
    expect(statements[0]?.values[7]).toBe('[{"checkId":"speech.databaseSchema","status":"ready"}]');
    expect(statements[0]?.values[8]).toBe('speech-1:1');
  });

  it('distinguishes already applied and conflicting lifecycle transitions', async () => {
    const alreadyAppliedRow = {
      ...row,
      completed_generation: '3',
      active_job_id: null,
      claimed_generation: null,
    };
    const already = createQueuedExecutor([[], [alreadyAppliedRow]]);
    await expect(
      createPluginTenantLifecycleRepository(already.executor).completeLifecycle({
        instanceId: 'tenant-a',
        pluginId: 'speech',
        jobId: '7dbe0bb5-4689-46b0-b21f-0d9ea3cd9489',
        generation: 3,
        operation: 'readiness',
        readinessStatus: 'ready',
        readinessRevision: 'schema:3',
        readinessChecks: [],
      })
    ).resolves.toMatchObject({ outcome: 'alreadyApplied' });

    const conflict = createQueuedExecutor([
      [],
      [{ ...alreadyAppliedRow, completed_generation: '2' }],
    ]);
    await expect(
      createPluginTenantLifecycleRepository(conflict.executor).failLifecycle({
        instanceId: 'tenant-a',
        pluginId: 'speech',
        jobId: '7dbe0bb5-4689-46b0-b21f-0d9ea3cd9489',
        generation: 3,
        readinessStatus: 'blocked',
        errorCode: 'stale',
        retryKind: 'terminal',
      })
    ).resolves.toMatchObject({ outcome: 'conflict' });
  });

  it('keeps suspend and reactivate reversible without deleting lifecycle identity', async () => {
    const { executor, statements } = createExecutor();
    const repository = createPluginTenantLifecycleRepository(executor);

    await repository.requestLifecycle({
      instanceId: 'tenant-a',
      pluginId: 'speech',
      operation: 'suspend',
    });
    await repository.completeLifecycle({
      instanceId: 'tenant-a',
      pluginId: 'speech',
      jobId: '7dbe0bb5-4689-46b0-b21f-0d9ea3cd9489',
      generation: 2,
      operation: 'reactivate',
      readinessStatus: 'ready',
      readinessRevision: 'schema:3',
      readinessChecks: [],
    });

    expect(statements[0]?.text).toContain("WHEN EXCLUDED.desired_operation = 'suspend'");
    expect(statements[1]?.text).toContain("WHEN $5 = 'reactivate' THEN 'active'");
    expect(statements.every(({ text }) => !text.includes('DELETE FROM'))).toBe(true);
  });
});
