import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';
import type { WasteManagementHandlerDeps } from './types.js';

const emitWasteAuditEventMock = vi.hoisted(() => vi.fn(async () => undefined));
const updateWasteVisibleStatusMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('./auth.js', () => ({
  authorizeWasteManagementAction: vi.fn(async () => null),
  emitWasteAuditEvent: emitWasteAuditEventMock,
}));

vi.mock('./settings-shared.js', () => ({
  updateWasteVisibleStatus: updateWasteVisibleStatusMock,
}));

import { runWasteCreateMutation, runWasteUpdateMutation } from './mutation-helpers.js';

describe('waste-management mutation helpers', () => {
  const ctx: AuthenticatedRequestContext = {
    sessionId: 'session-1',
    user: {
      id: 'user-1',
      instanceId: 'tenant-a',
      roles: ['system_admin'],
    },
  };

  const deps: WasteManagementHandlerDeps = {};

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a created item and emits success audit metadata', async () => {
    const save = vi.fn(async () => undefined);
    const loadSaved = vi.fn(async () => ({ id: 'fraction-1', name: 'Restmuell' }));

    const response = await runWasteCreateMutation({
      deps,
      ctx,
      instanceId: 'tenant-a',
      requestId: 'req-test',
      resourceId: 'fraction-1',
      audit: {
        actionId: 'waste-management.fraction.created',
        resourceType: 'waste_fraction',
      },
      messages: {
        verificationFailed: 'Die Waste-Fraktion konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Fraktion konnte nicht gespeichert werden.',
      },
      save,
      loadSaved,
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      data: { id: 'fraction-1', name: 'Restmuell' },
      requestId: 'req-test',
    });
    expect(save).toHaveBeenCalledOnce();
    expect(loadSaved).toHaveBeenCalledOnce();
    expect(emitWasteAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'waste-management.fraction.created',
        result: 'success',
        resourceType: 'waste_fraction',
        resourceId: 'fraction-1',
      })
    );
    expect(updateWasteVisibleStatusMock).toHaveBeenCalledWith(deps, 'tenant-a', 'success');
  });

  it('returns a verification error when a freshly saved item cannot be reloaded', async () => {
    const response = await runWasteCreateMutation({
      deps,
      ctx,
      instanceId: 'tenant-a',
      requestId: 'req-test',
      resourceId: 'fraction-1',
      audit: {
        actionId: 'waste-management.fraction.created',
        resourceType: 'waste_fraction',
      },
      messages: {
        verificationFailed: 'Die Waste-Fraktion konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Fraktion konnte nicht gespeichert werden.',
      },
      save: vi.fn(async () => undefined),
      loadSaved: vi.fn(async () => null),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message: 'Die Waste-Fraktion konnte nicht verifiziert werden.',
      },
      requestId: 'req-test',
    });
    expect(emitWasteAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'waste-management.fraction.created',
        result: 'failure',
        reasonCode: 'verification_failed',
        resourceType: 'waste_fraction',
        resourceId: 'fraction-1',
      })
    );
    expect(updateWasteVisibleStatusMock).not.toHaveBeenCalled();
  });

  it('returns a not-found error before updating a missing item', async () => {
    const save = vi.fn(async () => undefined);

    const response = await runWasteUpdateMutation({
      deps,
      ctx,
      instanceId: 'tenant-a',
      requestId: 'req-test',
      resourceId: 'fraction-1',
      audit: {
        actionId: 'waste-management.fraction.updated',
        resourceType: 'waste_fraction',
      },
      messages: {
        notFound: 'Die Waste-Fraktion wurde nicht gefunden.',
        verificationFailed: 'Die Waste-Fraktion konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Fraktion konnte nicht gespeichert werden.',
      },
      loadExisting: vi.fn(async () => null),
      save,
      loadSaved: vi.fn(async () => ({ id: 'fraction-1', name: 'Restmuell' })),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'not_found',
        message: 'Die Waste-Fraktion wurde nicht gefunden.',
      },
      requestId: 'req-test',
    });
    expect(save).not.toHaveBeenCalled();
    expect(emitWasteAuditEventMock).not.toHaveBeenCalled();
    expect(updateWasteVisibleStatusMock).not.toHaveBeenCalled();
  });

  it('returns a persistence error and marks visible status for revalidation on update failures', async () => {
    const response = await runWasteUpdateMutation({
      deps,
      ctx,
      instanceId: 'tenant-a',
      requestId: 'req-test',
      resourceId: 'fraction-1',
      audit: {
        actionId: 'waste-management.fraction.updated',
        resourceType: 'waste_fraction',
      },
      messages: {
        notFound: 'Die Waste-Fraktion wurde nicht gefunden.',
        verificationFailed: 'Die Waste-Fraktion konnte nicht verifiziert werden.',
        persistenceFailed: 'Die Waste-Fraktion konnte nicht gespeichert werden.',
      },
      loadExisting: vi.fn(async () => ({ id: 'fraction-1' })),
      save: vi.fn(async () => {
        throw new Error('db down');
      }),
      loadSaved: vi.fn(async () => ({ id: 'fraction-1', name: 'Restmuell' })),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message: 'Die Waste-Fraktion konnte nicht gespeichert werden.',
      },
      requestId: 'req-test',
    });
    expect(emitWasteAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'waste-management.fraction.updated',
        result: 'failure',
        reasonCode: 'database_unavailable',
        resourceType: 'waste_fraction',
        resourceId: 'fraction-1',
      })
    );
    expect(updateWasteVisibleStatusMock).toHaveBeenCalledWith(deps, 'tenant-a', 'revalidate');
  });
});
