import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  createStudioJob: vi.fn(),
  markStudioJobEnqueueFailed: vi.fn(),
  queueStudioJob: vi.fn(),
  createStoragePort: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
  service: {
    claimContentSaveOperationRecovery: vi.fn(),
    finalizeContentSaveOperationCleanup: vi.fn(),
    listAssetsByOperation: vi.fn(),
    listVariantsByAssetId: vi.fn(),
  },
}));

vi.mock('../plugin-operations/core.shared.js', () => ({
  createStudioJob: state.createStudioJob,
  markStudioJobEnqueueFailed: state.markStudioJobEnqueueFailed,
}));

vi.mock('../plugin-operations/runner.js', () => ({
  queueStudioJob: state.queueStudioJob,
}));

vi.mock('./repository.js', () => ({
  withMediaService: async (_instanceId: string, work: (service: unknown) => unknown) =>
    work(state.service),
}));

vi.mock('./storage-s3.js', () => ({
  createConfiguredMediaStoragePortForInstance: state.createStoragePort,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

import {
  cleanupMediaContentSaveOperation,
  mediaContentSaveRecoveryStudioJobRegistration,
  scheduleMediaContentSaveRecovery,
} from './content-save-recovery.js';

describe('media content save recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.createStudioJob.mockResolvedValue({
      id: 'job-1',
      queueName: 'media-content-save-recovery',
      maxAttempts: 5,
    });
    state.queueStudioJob.mockResolvedValue(undefined);
    state.markStudioJobEnqueueFailed.mockResolvedValue(undefined);
    state.service.claimContentSaveOperationRecovery.mockResolvedValue(null);
    state.service.listAssetsByOperation.mockResolvedValue([]);
    state.service.listVariantsByAssetId.mockResolvedValue([]);
    state.service.finalizeContentSaveOperationCleanup.mockResolvedValue(true);
  });

  it('persists and queues recovery for the operation expiry', async () => {
    await scheduleMediaContentSaveRecovery({
      instanceId: 'tenant-a',
      operationId: 'operation-1',
      actorSubject: 'actor-1',
      expiresAt: '2026-08-18T10:00:00.000Z',
      requestId: 'request-1',
    });

    expect(state.createStudioJob).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        create: expect.objectContaining({
          idempotencyKey: 'media-content-save-recovery:operation-1',
          scheduledAt: '2026-08-18T10:00:00.000Z',
        }),
      })
    );
    expect(state.queueStudioJob).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'tenant-a',
        jobId: 'job-1',
        runAt: new Date('2026-08-18T10:00:00.000Z'),
      })
    );
  });

  it('deletes operation-owned storage before atomically finalizing database cleanup', async () => {
    const storagePort = { deleteObject: vi.fn(async () => undefined) };
    state.service.listAssetsByOperation.mockResolvedValue([
      { id: 'asset-1', storageKey: 'tenant-a/originals/asset-1.jpg' },
    ]);
    state.service.listVariantsByAssetId.mockResolvedValue([
      { storageKey: 'tenant-a/variants/asset-1/thumbnail.webp' },
    ]);

    await cleanupMediaContentSaveOperation({
      instanceId: 'tenant-a',
      operationId: 'operation-1',
      actorSubject: 'actor-1',
      storagePort: storagePort as never,
    });

    expect(storagePort.deleteObject).toHaveBeenNthCalledWith(1, {
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/originals/asset-1.jpg',
    });
    expect(storagePort.deleteObject).toHaveBeenNthCalledWith(2, {
      instanceId: 'tenant-a',
      storageKey: 'tenant-a/variants/asset-1/thumbnail.webp',
    });
    expect(state.service.finalizeContentSaveOperationCleanup).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      operationId: 'operation-1',
      actorSubject: 'actor-1',
    });
  });

  it('does not clean operations that the safe recovery lease excludes', async () => {
    const progressReporter = { reportProgress: vi.fn() };
    const result = await mediaContentSaveRecoveryStudioJobRegistration.handler({
      job: {
        id: 'job-1',
        instanceId: 'tenant-a',
        inputPayload: { operationId: 'operation-1', actorSubject: 'actor-1' },
      },
      progressReporter,
    } as never);

    expect(result).toEqual({
      resultPayload: { plugin: { operationId: 'operation-1', status: 'not_cleanup_eligible' } },
    });
    expect(state.service.listAssetsByOperation).not.toHaveBeenCalled();
    expect(progressReporter.reportProgress).not.toHaveBeenCalled();
  });
});
