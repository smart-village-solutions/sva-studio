import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WasteAnnualTourTransferError,
  type WasteAnnualTourTransferPreview,
  type WasteAnnualTourTransferResult,
} from '@sva/core';
import type { AuthenticatedRequestContext } from '../../middleware.js';

const idempotency = vi.hoisted(() => ({
  reserve: vi.fn(),
  renew: vi.fn(),
  complete: vi.fn(),
  release: vi.fn(),
  hasAudit: vi.fn(),
}));

vi.mock('../../iam-account-management/shared.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../iam-account-management/shared.js')>()),
  reserveIdempotency: idempotency.reserve,
  renewIdempotencyLease: idempotency.renew,
  completeIdempotency: idempotency.complete,
  releaseIdempotencyReservation: idempotency.release,
  hasIdempotentAuditEvent: idempotency.hasAudit,
}));

import { wasteManagementAnnualTourTransferHandlers } from './annual-tour-transfer.js';
import { startAnnualTourTransferLeaseHeartbeat } from './annual-tour-transfer-idempotency.js';

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: { id: 'user-1', instanceId: 'tenant-a', roles: ['system_admin'] },
};

const preview: WasteAnnualTourTransferPreview = {
  sourceYear: 2026,
  targetYear: 2027,
  previewFingerprint: `sha256:${'a'.repeat(64)}`,
  tours: [],
  summary: {
    transferable: 0,
    alreadyEffective: 0,
    blocked: 0,
    selected: 0,
    relationships: 0,
    excluded: 0,
  },
};

const result: WasteAnnualTourTransferResult = {
  sourceYear: 2026,
  targetYear: 2027,
  createdTourIds: ['target-1'],
  existingTourIds: [],
  createdCount: 1,
  existingCount: 0,
  classificationCounts: { transferable: 1, alreadyEffective: 0, blocked: 0 },
  listTarget: { tourValidityPeriod: 'next', status: 'inactive' },
};

const permissions = vi.fn(async () => ({
  ok: true as const,
  permissions: [
    { action: 'waste-management.tours.manage', resourceType: 'waste-management' },
    { action: 'waste-management.scheduling.manage', resourceType: 'waste-management' },
  ],
}));

const request = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://studio.test${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://studio.test',
      'X-Requested-With': 'XMLHttpRequest',
      ...headers,
    },
    body: JSON.stringify(body),
  });

describe('annual tour transfer handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idempotency.reserve.mockResolvedValue({ status: 'reserved', leaseToken: 'lease-1' });
    idempotency.renew.mockResolvedValue(true);
    idempotency.complete.mockResolvedValue(true);
    idempotency.release.mockResolvedValue(true);
    idempotency.hasAudit.mockResolvedValue(false);
  });

  it('renews the fenced lease while a long-running transfer remains active', async () => {
    vi.useFakeTimers();
    try {
      const stop = startAnnualTourTransferLeaseHeartbeat({
        instanceId: 'tenant-a',
        actorAccountId: 'account-1',
        idempotencyKey: 'idem-1',
        leaseToken: 'lease-1',
      });

      await vi.advanceTimersByTimeAsync(60 * 1_000);
      expect(idempotency.renew).toHaveBeenCalledWith(
        expect.objectContaining({ leaseToken: 'lease-1' })
      );
      await expect(stop()).resolves.toBe(true);
      expect(idempotency.renew).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('builds a read-only preview after both permissions and CSRF were checked', async () => {
    const load = vi.fn(async () => preview);
    const emitAuditEvent = vi.fn(async () => undefined);
    const response =
      await wasteManagementAnnualTourTransferHandlers.previewWasteAnnualTourTransferInternal(
        request('/api/v1/waste-management/tours/annual-transfer/preview', { sourceYear: 2026 }),
        actor,
        {
          getRequestId: () => 'req-1',
          resolvePermissions: permissions,
          previewWasteAnnualTourTransfer: load,
          emitAuditEvent,
        }
      );
    expect(response.status).toBe(200);
    expect(load).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      sourceYear: 2026,
      selectedTourIds: undefined,
      replacementDates: undefined,
    });
    expect(emitAuditEvent).not.toHaveBeenCalled();
  });

  it('rejects a client supplied target year before loading any Waste data', async () => {
    const load = vi.fn(async () => preview);
    const response =
      await wasteManagementAnnualTourTransferHandlers.previewWasteAnnualTourTransferInternal(
        request('/api/v1/waste-management/tours/annual-transfer/preview', {
          sourceYear: 2026,
          targetYear: 2030,
        }),
        actor,
        { resolvePermissions: permissions, previewWasteAnnualTourTransfer: load }
      );
    expect(response.status).toBe(400);
    expect(load).not.toHaveBeenCalled();
  });

  it.each([
    {
      error: new WasteAnnualTourTransferError('invalid_source_year'),
      status: 400,
      code: 'invalid_source_year',
    },
    {
      error: new WasteAnnualTourTransferError('replacement_date_invalid'),
      status: 400,
      code: 'replacement_date_invalid',
    },
    {
      error: new WasteAnnualTourTransferError('batch_limit_exceeded'),
      status: 413,
      code: 'batch_limit_exceeded',
    },
    {
      error: new Error('unacknowledged_target_conflict'),
      status: 409,
      code: 'target_conflict_unacknowledged',
    },
    {
      error: new Error('invalid_transfer_selection'),
      status: 400,
      code: 'invalid_request',
    },
    {
      error: new Error(`target_identity_conflict:${JSON.stringify(preview)}`),
      status: 409,
      code: 'target_identity_conflict',
    },
    { error: new Error('preview_stale:not-json'), status: 409, code: 'preview_stale' },
    { error: 'database offline', status: 503, code: 'database_unavailable' },
  ])('maps preview failure $code to its stable API response', async ({ error, status, code }) => {
    const response =
      await wasteManagementAnnualTourTransferHandlers.previewWasteAnnualTourTransferInternal(
        request('/api/v1/waste-management/tours/annual-transfer/preview', { sourceYear: 2026 }),
        actor,
        {
          resolvePermissions: permissions,
          previewWasteAnnualTourTransfer: vi.fn(async () => {
            throw error;
          }),
        }
      );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toMatchObject({ error: { code } });
  });

  it('reports the resource-specific expected year for invalid replacements', async () => {
    const response =
      await wasteManagementAnnualTourTransferHandlers.previewWasteAnnualTourTransferInternal(
        request('/api/v1/waste-management/tours/annual-transfer/preview', { sourceYear: 2027 }),
        actor,
        {
          resolvePermissions: permissions,
          previewWasteAnnualTourTransfer: vi.fn(async () => {
            throw new WasteAnnualTourTransferError('replacement_date_invalid', {
              sourceResourceId: 'shift-leap-year:actual',
              expectedYear: 2029,
            });
          }),
        }
      );

    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'replacement_date_invalid',
        message: 'Das Ersatzdatum muss im Kalenderjahr 2029 liegen.',
      },
    });
  });

  it('creates once with central idempotency and one data-minimizing audit event', async () => {
    const create = vi.fn(async () => result);
    const emitAuditEvent = vi.fn(async () => undefined);
    const response =
      await wasteManagementAnnualTourTransferHandlers.createWasteAnnualTourTransferInternal(
        request(
          '/api/v1/waste-management/tours/annual-transfer',
          {
            sourceYear: 2026,
            selectedTourIds: ['source-1'],
            replacementDates: [],
            acknowledgedConflictTourIds: [],
            previewFingerprint: `sha256:${'a'.repeat(64)}`,
          },
          { 'Idempotency-Key': 'idem-1' }
        ),
        actor,
        {
          getRequestId: () => 'req-1',
          resolvePermissions: permissions,
          resolveActorInfo: vi.fn(async () => ({
            actor: { instanceId: 'tenant-a', actorAccountId: 'account-1' },
          })),
          createWasteAnnualTourTransfer: create,
          emitAuditEvent,
        }
      );
    expect(response.status).toBe(201);
    expect(idempotency.reserve).toHaveBeenCalledWith(
      expect.objectContaining({ inProgressLeaseMs: 5 * 60 * 1_000 })
    );
    expect(idempotency.hasAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAccountId: 'account-1',
        idempotencyKey: 'idem-1',
      })
    );
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'idem-1' })
    );
    expect(idempotency.complete).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'COMPLETED', responseStatus: 201 })
    );
    expect(emitAuditEvent).toHaveBeenCalledTimes(1);
    expect(emitAuditEvent.mock.invocationCallOrder[0]).toBeLessThan(
      idempotency.complete.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginAction: expect.objectContaining({
          batchSummary: {
            sourceYear: 2026,
            targetYear: 2027,
            transferableCount: 1,
            alreadyEffectiveCount: 0,
            blockedCount: 0,
            createdCount: 1,
            existingCount: 0,
            resourceIds: ['target-1'],
          },
        }),
      })
    );
  });

  it('does not emit the annual summary audit again after crash recovery', async () => {
    idempotency.hasAudit.mockResolvedValue(true);
    const emitAuditEvent = vi.fn(async () => undefined);
    const response =
      await wasteManagementAnnualTourTransferHandlers.createWasteAnnualTourTransferInternal(
        request(
          '/api/v1/waste-management/tours/annual-transfer',
          {
            sourceYear: 2026,
            selectedTourIds: ['source-1'],
            replacementDates: [],
            acknowledgedConflictTourIds: [],
            previewFingerprint: `sha256:${'a'.repeat(64)}`,
          },
          { 'Idempotency-Key': 'idem-recovered' }
        ),
        actor,
        {
          resolvePermissions: permissions,
          resolveActorInfo: vi.fn(async () => ({
            actor: { instanceId: 'tenant-a', actorAccountId: 'account-1' },
          })),
          createWasteAnnualTourTransfer: vi.fn(async () => result),
          emitAuditEvent,
        }
      );

    expect(response.status).toBe(201);
    expect(emitAuditEvent).not.toHaveBeenCalled();
    expect(idempotency.complete).toHaveBeenCalled();
  });

  it('releases the fenced reservation after a transient failure so the request can retry', async () => {
    const emitAuditEvent = vi.fn(async () => undefined);
    const response =
      await wasteManagementAnnualTourTransferHandlers.createWasteAnnualTourTransferInternal(
        request(
          '/api/v1/waste-management/tours/annual-transfer',
          {
            sourceYear: 2026,
            selectedTourIds: ['source-1'],
            replacementDates: [],
            acknowledgedConflictTourIds: [],
            previewFingerprint: `sha256:${'a'.repeat(64)}`,
          },
          { 'Idempotency-Key': 'idem-retry' }
        ),
        actor,
        {
          resolvePermissions: permissions,
          resolveActorInfo: vi.fn(async () => ({
            actor: { instanceId: 'tenant-a', actorAccountId: 'account-1' },
          })),
          createWasteAnnualTourTransfer: vi.fn(async () => {
            throw new Error('connection_lost_around_commit');
          }),
          emitAuditEvent,
        }
      );

    expect(response.status).toBe(503);
    expect(idempotency.release).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      actorAccountId: 'account-1',
      endpoint: 'POST:/api/v1/waste-management/tours/annual-transfer',
      idempotencyKey: 'idem-retry',
      leaseToken: 'lease-1',
    });
    expect(idempotency.complete).not.toHaveBeenCalled();
    expect(idempotency.hasAudit).not.toHaveBeenCalled();
    expect(emitAuditEvent).not.toHaveBeenCalled();
  });

  it('does not execute or audit while the same idempotency key is still in progress', async () => {
    idempotency.reserve.mockResolvedValue({
      status: 'conflict',
      reason: 'in_progress',
      message: 'Idempotenter Request wird bereits verarbeitet.',
    });
    const create = vi.fn(async () => result);
    const emitAuditEvent = vi.fn(async () => undefined);

    const response =
      await wasteManagementAnnualTourTransferHandlers.createWasteAnnualTourTransferInternal(
        request(
          '/api/v1/waste-management/tours/annual-transfer',
          {
            sourceYear: 2026,
            selectedTourIds: ['source-1'],
            replacementDates: [],
            acknowledgedConflictTourIds: [],
            previewFingerprint: `sha256:${'a'.repeat(64)}`,
          },
          { 'Idempotency-Key': 'idem-1' }
        ),
        actor,
        {
          resolvePermissions: permissions,
          resolveActorInfo: vi.fn(async () => ({
            actor: { instanceId: 'tenant-a', actorAccountId: 'account-1' },
          })),
          createWasteAnnualTourTransfer: create,
          emitAuditEvent,
        }
      );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'idempotency_in_progress' },
    });
    expect(create).not.toHaveBeenCalled();
    expect(idempotency.complete).not.toHaveBeenCalled();
    expect(emitAuditEvent).not.toHaveBeenCalled();
  });

  it('does not audit or complete after losing the fenced lease', async () => {
    idempotency.renew.mockResolvedValueOnce(false);
    const create = vi.fn(async () => result);
    const emitAuditEvent = vi.fn(async () => undefined);

    const response =
      await wasteManagementAnnualTourTransferHandlers.createWasteAnnualTourTransferInternal(
        request(
          '/api/v1/waste-management/tours/annual-transfer',
          {
            sourceYear: 2026,
            selectedTourIds: ['source-1'],
            replacementDates: [],
            acknowledgedConflictTourIds: [],
            previewFingerprint: `sha256:${'a'.repeat(64)}`,
          },
          { 'Idempotency-Key': 'idem-1' }
        ),
        actor,
        {
          resolvePermissions: permissions,
          resolveActorInfo: vi.fn(async () => ({
            actor: { instanceId: 'tenant-a', actorAccountId: 'account-1' },
          })),
          createWasteAnnualTourTransfer: create,
          emitAuditEvent,
        }
      );

    expect(response.status).toBe(409);
    expect(create).toHaveBeenCalledTimes(1);
    expect(emitAuditEvent).not.toHaveBeenCalled();
    expect(idempotency.complete).not.toHaveBeenCalled();
  });

  it('returns the updated preview without writing when the confirmed fingerprint is stale', async () => {
    const updatedPreview = {
      ...preview,
      summary: { ...preview.summary, transferable: 2, alreadyEffective: 1, blocked: 3 },
    };
    const create = vi.fn(async () => {
      throw new Error(`preview_stale:${JSON.stringify(updatedPreview)}`);
    });
    const emitAuditEvent = vi.fn(async () => undefined);
    const response =
      await wasteManagementAnnualTourTransferHandlers.createWasteAnnualTourTransferInternal(
        request(
          '/api/v1/waste-management/tours/annual-transfer',
          {
            sourceYear: 2026,
            selectedTourIds: ['source-1'],
            replacementDates: [],
            acknowledgedConflictTourIds: [],
            previewFingerprint: `sha256:${'b'.repeat(64)}`,
          },
          { 'Idempotency-Key': 'idem-1' }
        ),
        actor,
        {
          resolvePermissions: permissions,
          resolveActorInfo: vi.fn(async () => ({
            actor: { instanceId: 'tenant-a', actorAccountId: 'account-1' },
          })),
          createWasteAnnualTourTransfer: create,
          emitAuditEvent,
        }
      );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'preview_stale', details: { updatedPreview } },
    });
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginAction: expect.objectContaining({
          batchSummary: expect.objectContaining({
            transferableCount: 2,
            alreadyEffectiveCount: 1,
            blockedCount: 3,
          }),
        }),
      })
    );
  });
});
