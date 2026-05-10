import { describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';

vi.mock('@sva/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/core')>();
  return {
    ...actual,
    getWasteManagementImportCatalogEntry: vi.fn(actual.getWasteManagementImportCatalogEntry),
  };
});

import { getWasteManagementImportCatalogEntry } from '@sva/core';

import { wasteManagementOperationHandlers } from './operations.js';

const mockedGetWasteManagementImportCatalogEntry = vi.mocked(getWasteManagementImportCatalogEntry);

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
  },
};

const createDeps = () => ({
  getRequestId: () => 'req-test',
  emitAuditEvent: vi.fn(async () => undefined),
  resolvePermissions: vi.fn(async () => ({
    ok: true as const,
    permissions: [
      {
        action: 'waste-management.import.execute',
        resourceType: 'waste-management',
        effect: 'allow' as const,
      },
      {
        action: 'waste-management.seed.execute',
        resourceType: 'waste-management',
        effect: 'allow' as const,
      },
    ],
  })),
});

const createImportRequest = (body: Record<string, unknown>) =>
  new Request('https://studio.test/api/v1/waste-management/tools/imports', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'idem-1',
      Origin: 'https://studio.test',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(body),
  });

describe('waste-management operation handlers', () => {
  it('rejects unknown import profile ids before a job is started', async () => {
    const startPluginOperationJob = vi.fn();

    const response = await wasteManagementOperationHandlers.startWasteManagementImportInternal(
      createImportRequest({
        importProfileId: 'waste-management.unknown-profile',
        sourceFormat: 'text/csv',
        blobRef: 'blob:import',
      }),
      actor,
      {
        ...createDeps(),
        startPluginOperationJob,
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: expect.stringContaining('Unbekanntes Waste-Importprofil'),
      },
      requestId: 'req-test',
    });
    expect(startPluginOperationJob).not.toHaveBeenCalled();
  });

  it('rejects valid profiles when the import catalog entry is missing', async () => {
    mockedGetWasteManagementImportCatalogEntry.mockReturnValueOnce(null);

    const response = await wasteManagementOperationHandlers.startWasteManagementImportInternal(
      createImportRequest({
        importProfileId: 'waste-management.geografie-abholorte',
        sourceFormat: 'text/csv',
        blobRef: 'blob:import',
      }),
      actor,
      {
        ...createDeps(),
        startPluginOperationJob: vi.fn(),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: expect.stringContaining('fachlicher Katalogeintrag'),
      },
    });
  });

  it('rejects unsupported source formats for an otherwise valid import profile', async () => {
    mockedGetWasteManagementImportCatalogEntry.mockReturnValue({
      id: 'waste-management.geografie-abholorte',
      title: 'Abholorte',
      description: 'Test',
      sourceFormats: ['text/csv'],
    } as never);

    const response = await wasteManagementOperationHandlers.startWasteManagementImportInternal(
      createImportRequest({
        importProfileId: 'waste-management.geografie-abholorte',
        sourceFormat: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        blobRef: 'blob:import',
      }),
      actor,
      {
        ...createDeps(),
        startPluginOperationJob: vi.fn(),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: expect.stringContaining('unterstützt dieses Quellformat nicht'),
      },
    });
    mockedGetWasteManagementImportCatalogEntry.mockReset();
  });

  it('keeps successful non-json operation responses and still emits audit metadata', async () => {
    const emitAuditEvent = vi.fn(async () => undefined);

    const response = await wasteManagementOperationHandlers.startWasteManagementSeedInternal(
      new Request('https://studio.test/api/v1/waste-management/tools/seed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idem-2',
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({ seedKey: 'baseline' }),
      }),
      actor,
      {
        ...createDeps(),
        emitAuditEvent,
        startPluginOperationJob: vi.fn(async () => new Response('accepted', { status: 202 })),
      }
    );

    expect(response.status).toBe(202);
    expect(await response.text()).toBe('accepted');
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_authorized',
        pluginAction: expect.objectContaining({
          actionId: 'waste-management.seed.started',
          result: 'success',
        }),
      })
    );
  });
});
