import { describe, expect, it } from 'vitest';

import { createInstanceRegistryRepository } from './index.js';
import { createQueuedExecutor } from './test-support.js';

const provisioningRow = {
  instance_id: 'tenant-a',
  status: 'provisioning',
  desired_generation: 2,
  completed_generation: 1,
  database_name: 'sva_waste_tenant_a_deadbeef',
  interface_id: 'interface-1',
  active_job_id: null,
  error_code: null,
  error_message: null,
  requested_at: '2026-08-02T08:00:00.000Z',
  started_at: null,
  completed_at: null,
  updated_at: '2026-08-02T08:00:01.000Z',
};

describe('instance registry waste provisioning repository', () => {
  it('requests an idempotent desired state and maps its tenant binding', async () => {
    const { executor, statements } = createQueuedExecutor([[provisioningRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.requestWasteProvisioning('tenant-a')).resolves.toEqual({
      instanceId: 'tenant-a',
      status: 'provisioning',
      desiredGeneration: 2,
      completedGeneration: 1,
      databaseName: 'sva_waste_tenant_a_deadbeef',
      interfaceId: 'interface-1',
      requestedAt: '2026-08-02T08:00:00.000Z',
      updatedAt: '2026-08-02T08:00:01.000Z',
    });
    expect(statements[0]?.values).toEqual(['tenant-a']);
    expect(statements[0]?.text).toContain("status IN ('failed', 'disabled')");
  });

  it('reads and disables only the scoped tenant state without deleting data', async () => {
    const disabledRow = {
      ...provisioningRow,
      status: 'disabled',
      completed_at: '2026-08-02T09:00:00.000Z',
      updated_at: '2026-08-02T09:00:00.000Z',
    };
    const { executor, statements } = createQueuedExecutor([[provisioningRow], [disabledRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.getWasteProvisioning('tenant-a')).resolves.toMatchObject({
      instanceId: 'tenant-a',
      status: 'provisioning',
    });
    await expect(repository.disableWasteProvisioning('tenant-a')).resolves.toMatchObject({
      instanceId: 'tenant-a',
      status: 'disabled',
    });
    expect(statements[1]?.text).toContain("SET status = 'disabled'");
    expect(statements[1]?.text).not.toContain('DELETE');
  });

  it('correlates claim, completion and failure with job and desired generation', async () => {
    const jobId = '00000000-0000-4000-8000-000000000001';
    const claimedRow = { ...provisioningRow, active_job_id: jobId };
    const completedRow = {
      ...claimedRow,
      status: 'ready',
      active_job_id: null,
      completed_generation: 2,
      completed_at: '2026-08-02T09:00:00.000Z',
    };
    const failedRow = {
      ...claimedRow,
      status: 'failed',
      active_job_id: null,
      error_code: 'migration_failed',
      error_message: 'redacted',
    };
    const { executor, statements } = createQueuedExecutor([
      [claimedRow],
      [completedRow],
      [failedRow],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.claimWasteProvisioning({ instanceId: 'tenant-a', jobId, desiredGeneration: 2 })
    ).resolves.toMatchObject({ status: 'provisioning', activeJobId: jobId });
    await expect(
      repository.completeWasteProvisioning({
        instanceId: 'tenant-a',
        jobId,
        desiredGeneration: 2,
        databaseName: 'tenant-db',
        interfaceId: 'interface-1',
      })
    ).resolves.toMatchObject({ status: 'ready', completedGeneration: 2 });
    await expect(
      repository.failWasteProvisioning({
        instanceId: 'tenant-a',
        jobId,
        desiredGeneration: 2,
        errorCode: 'migration_failed',
        errorMessage: 'redacted',
      })
    ).resolves.toMatchObject({ status: 'failed', errorCode: 'migration_failed' });

    expect(statements[0]?.text).toContain('active_job_id = $2::uuid');
    expect(statements[1]?.text).toContain("status = 'ready'");
    expect(statements[2]?.text).toContain("status = 'failed'");
    expect(statements.map(({ values }) => values?.slice(0, 3))).toEqual([
      ['tenant-a', jobId, 2],
      ['tenant-a', jobId, 2],
      ['tenant-a', jobId, 2],
    ]);
  });
});
