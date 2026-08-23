import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WasteAnnualTourTransferPreview, WasteAnnualTourTransferResult } from '@sva/core';
import type { AuthenticatedRequestContext } from '../../middleware.js';

const idempotency = vi.hoisted(() => ({
  reserve: vi.fn(),
  complete: vi.fn(),
}));

vi.mock('../../iam-account-management/shared.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../iam-account-management/shared.js')>()),
  reserveIdempotency: idempotency.reserve,
  completeIdempotency: idempotency.complete,
}));

import { wasteManagementAnnualTourTransferHandlers } from './annual-tour-transfer.js';

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
    idempotency.reserve.mockResolvedValue({ status: 'reserved' });
    idempotency.complete.mockResolvedValue(undefined);
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
    expect(idempotency.complete).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'COMPLETED', responseStatus: 201 })
    );
    expect(emitAuditEvent).toHaveBeenCalledTimes(1);
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

  it('returns the updated preview without writing when the confirmed fingerprint is stale', async () => {
    const create = vi.fn(async () => {
      throw new Error(`preview_stale:${JSON.stringify(preview)}`);
    });
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
          emitAuditEvent: vi.fn(async () => undefined),
        }
      );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'preview_stale', details: { updatedPreview: preview } },
    });
  });
});
