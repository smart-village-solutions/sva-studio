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

import * as operationsSupport from './operations-support.js';
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
  getSessionById: vi.fn(async () => ({
    activeOrganizationId: 'org-1',
  })),
  emitAuditEvent: vi.fn(async () => undefined),
  resolveActorInfo: vi.fn(async () => ({
    actor: {
      instanceId: 'tenant-a',
      actorAccountId: 'account-1',
      requestId: 'req-test',
      traceId: 'trace-test',
    },
  })),
  loadDefaultInterfaceRecord: vi.fn(async () => ({
    id: 'supabase-1',
    instanceId: 'tenant-a',
    typeKey: 'supabase',
    ownerKind: 'host' as const,
    ownerId: 'host',
    displayName: 'Supabase',
    alias: 'default',
    enabled: true,
    isDefault: true,
    category: 'database' as const,
    statusCheckKind: 'supabase' as const,
    visibleStatus: 'ok' as const,
    publicConfig: {
      projectUrl: 'https://tenant.example',
      schemaName: 'wm',
    },
    secretConfigCiphertext: 'cipher-secret',
  })),
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

const createToolRequest = (url: string, body: Record<string, unknown>, headers?: Record<string, string>) =>
  new Request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'idem-1',
      Origin: 'https://studio.test',
      'X-Requested-With': 'XMLHttpRequest',
      ...headers,
    },
    body: JSON.stringify(body),
  });

const actorWithoutInstance: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: '',
    roles: ['system_admin'],
  },
};

describe('waste-management operation handlers', () => {
  it.each([
    {
      label: 'initialize returns forbidden when the dedicated permission is missing',
      handler: wasteManagementOperationHandlers.startWasteManagementInitializeInternal,
      request: () =>
        createToolRequest('https://studio.test/api/v1/waste-management/tools/initialize', {
          targetSchema: 'wm',
        }),
      deps: () => ({
        ...createDeps(),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [],
        })),
      }),
      actor,
      expectedStatus: 403,
      expectedCode: 'forbidden',
    },
    {
      label: 'migrations returns forbidden when the dedicated permission is missing',
      handler: wasteManagementOperationHandlers.startWasteManagementMigrationsInternal,
      request: () =>
        createToolRequest('https://studio.test/api/v1/waste-management/tools/migrations', {
          targetSchema: 'waste',
        }),
      deps: () => ({
        ...createDeps(),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [],
        })),
      }),
      actor,
      expectedStatus: 403,
      expectedCode: 'forbidden',
    },
    {
      label: 'reset rejects a missing actor instance id',
      handler: wasteManagementOperationHandlers.startWasteManagementResetInternal,
      request: () =>
        createToolRequest('https://studio.test/api/v1/waste-management/tools/reset', {
          confirmationToken: 'RESET',
        }),
      deps: () => ({
        ...createDeps(),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [
            {
              action: 'waste-management.reset.execute',
              resourceType: 'waste-management',
              effect: 'allow' as const,
            },
          ],
        })),
      }),
      actor: actorWithoutInstance,
      expectedStatus: 400,
      expectedCode: 'invalid_instance_id',
    },
    {
      label: 'seed rejects csrf violations before a job is started',
      handler: wasteManagementOperationHandlers.startWasteManagementSeedInternal,
      request: () =>
        createToolRequest(
          'https://studio.test/api/v1/waste-management/tools/seed',
          {
            seedKey: 'baseline',
          },
          {
            Origin: 'https://evil.test',
          }
        ),
      deps: () => ({
        ...createDeps(),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [
            {
              action: 'waste-management.seed.execute',
              resourceType: 'waste-management',
              effect: 'allow' as const,
            },
          ],
        })),
        startPluginOperationJob: vi.fn(),
      }),
      actor,
      expectedStatus: 403,
      expectedCode: 'csrf_validation_failed',
      expectedJobCalls: 0,
    },
    {
      label: 'import rejects missing idempotency keys before a job is started',
      handler: wasteManagementOperationHandlers.startWasteManagementImportInternal,
      request: () =>
        createToolRequest(
          'https://studio.test/api/v1/waste-management/tools/imports',
          {
            importProfileId: 'waste-management.geografie-abholorte',
            sourceFormat: 'text/csv',
            blobRef: 'blob:import',
          },
          {
            'Idempotency-Key': '',
          }
        ),
      deps: () => ({
        ...createDeps(),
        startPluginOperationJob: vi.fn(),
      }),
      actor,
      expectedStatus: 400,
      expectedCode: 'idempotency_key_required',
      expectedJobCalls: 0,
    },
  ])('$label', async ({ handler, request, deps, actor: scopedActor, expectedStatus, expectedCode, expectedJobCalls }) => {
    const scopedDeps = deps();
    const response = await handler(request(), scopedActor, scopedDeps);

    expect(response.status).toBe(expectedStatus);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: expectedCode,
      },
      requestId: 'req-test',
    });
    if ('startPluginOperationJob' in scopedDeps) {
      expect(scopedDeps.startPluginOperationJob).toHaveBeenCalledTimes(expectedJobCalls ?? 0);
    }
  });

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

  it('resolves the IAM actor account id before starting a migrations job', async () => {
    const startPluginOperationJob = vi.fn(async () => new Response(JSON.stringify({ data: { id: 'job-1' } }), { status: 202 }));

    const response = await wasteManagementOperationHandlers.startWasteManagementMigrationsInternal(
      createToolRequest('https://studio.test/api/v1/waste-management/tools/migrations', {
        targetSchema: 'wm',
      }),
      actor,
      {
        ...createDeps(),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [
            {
              action: 'waste-management.settings.manage',
              resourceType: 'waste-management',
              effect: 'allow' as const,
            },
          ],
        })),
        startPluginOperationJob,
      }
    );

    expect(startPluginOperationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        actorAccountId: 'account-1',
        instanceId: 'tenant-a',
      })
    );
    expect(response.status).toBe(202);
  });

  it('creates a dedicated waste-type sync job payload', async () => {
    const startPluginOperationJob = vi.fn(async () => new Response(JSON.stringify({ data: { id: 'job-2' } }), { status: 202 }));

    const response = await wasteManagementOperationHandlers.startWasteManagementSyncWasteTypesInternal(
      createToolRequest('https://studio.test/api/v1/waste-management/tools/sync-waste-types', {}),
      actor,
      {
        ...createDeps(),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [
            {
              action: 'waste-management.settings.manage',
              resourceType: 'waste-management',
              effect: 'allow' as const,
            },
          ],
        })),
        startPluginOperationJob,
      }
    );

    expect(startPluginOperationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'POST:/api/v1/waste-management/tools/sync-waste-types',
        data: expect.objectContaining({
          jobTypeId: 'waste-management.sync-waste-types',
          input: {
            operation: 'sync-waste-types',
          },
        }),
      })
    );
    expect(response.status).toBe(202);
  });

  it('rejects tool starts when the actor membership cannot be resolved to an IAM account', async () => {
    const startPluginOperationJob = vi.fn();

    const response = await wasteManagementOperationHandlers.startWasteManagementMigrationsInternal(
      createToolRequest('https://studio.test/api/v1/waste-management/tools/migrations', {
        targetSchema: 'wm',
      }),
      actor,
      {
        ...createDeps(),
        resolveActorInfo: vi.fn(async () => ({
          actor: {
            instanceId: 'tenant-a',
            requestId: 'req-test',
          },
        })),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [
            {
              action: 'waste-management.settings.manage',
              resourceType: 'waste-management',
              effect: 'allow' as const,
            },
          ],
        })),
        startPluginOperationJob,
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'forbidden',
        message: 'Akteur-Account nicht gefunden.',
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

  it('rejects unknown source format ids before a job is started', async () => {
    const startPluginOperationJob = vi.fn();

    const response = await wasteManagementOperationHandlers.startWasteManagementImportInternal(
      createImportRequest({
        importProfileId: 'waste-management.geografie-abholorte',
        sourceFormat: 'application/unknown',
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
        message: expect.stringContaining('Unbekanntes Waste-Importformat'),
      },
      requestId: 'req-test',
    });
    expect(startPluginOperationJob).not.toHaveBeenCalled();
  });

  it('emits audit metadata for failed json operation responses', async () => {
    const emitAuditEvent = vi.fn(async () => undefined);

    const response = await wasteManagementOperationHandlers.startWasteManagementResetInternal(
      createToolRequest('https://studio.test/api/v1/waste-management/tools/reset', {
        confirmationToken: 'RESET',
      }),
      actor,
      {
        ...createDeps(),
        emitAuditEvent,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [
            {
              action: 'waste-management.reset.execute',
              resourceType: 'waste-management',
              effect: 'allow' as const,
            },
          ],
        })),
        startPluginOperationJob: vi.fn(
          async () =>
            new Response(JSON.stringify({ error: 'conflict', data: { id: 'job-7' } }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            })
        ),
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: 'conflict',
      data: { id: 'job-7' },
    });
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_failed',
        pluginAction: expect.objectContaining({
          actionId: 'waste-management.reset.started',
          result: 'failure',
          reasonCode: 'conflict',
          resourceId: 'job-7',
        }),
      })
    );
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

  it('uses the facade fallback for migrations, preserves optional payload fields as undefined, and falls back to job_start_failed', async () => {
    const emitAuditEvent = vi.fn(async () => undefined);
    const facadeSpy = vi
      .spyOn(operationsSupport, 'startPluginOperationJobFromFacade')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 42 } }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const response = await wasteManagementOperationHandlers.startWasteManagementMigrationsInternal(
      createToolRequest('https://studio.test/api/v1/waste-management/tools/migrations', {}),
      actor,
      {
        ...createDeps(),
        emitAuditEvent,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [
            {
              action: 'waste-management.settings.manage',
              resourceType: 'waste-management',
              effect: 'allow' as const,
            },
          ],
        })),
      }
    );

    expect(response.status).toBe(500);
    expect(facadeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'POST:/api/v1/waste-management/tools/migrations',
        data: expect.objectContaining({
          jobTypeId: 'waste-management.apply-migrations',
          input: {
            operation: 'apply-migrations',
            targetSchema: undefined,
            requestedByVersion: undefined,
          },
        }),
      })
    );
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_failed',
        pluginAction: expect.objectContaining({
          actionId: 'waste-management.migrations.started',
          result: 'failure',
          reasonCode: 'job_start_failed',
          resourceId: undefined,
        }),
      })
    );
  });

  it('starts the initialize job through the generic plugin operations pipeline', async () => {
    const emitAuditEvent = vi.fn(async () => undefined);
    const startPluginOperationJob = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { id: 'job-init-1' } }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    const response = await wasteManagementOperationHandlers.startWasteManagementInitializeInternal(
      createToolRequest('https://studio.test/api/v1/waste-management/tools/initialize', {
        targetSchema: 'wm',
      }),
      actor,
      {
        ...createDeps(),
        emitAuditEvent,
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [
            {
              action: 'waste-management.settings.manage',
              resourceType: 'waste-management',
              effect: 'allow' as const,
            },
          ],
        })),
        startPluginOperationJob,
      }
    );

    expect(response.status).toBe(202);
    expect(startPluginOperationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'POST:/api/v1/waste-management/tools/initialize',
        data: expect.objectContaining({
          jobTypeId: 'waste-management.initialize-data-source',
          input: {
            operation: 'initialize-data-source',
            targetSchema: 'wm',
          },
        }),
      })
    );
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_authorized',
        pluginAction: expect.objectContaining({
          actionId: 'waste-management.initialize.started',
          result: 'success',
          resourceId: 'job-init-1',
        }),
      })
    );
  });

  it('rejects tool starts that target a schema outside the configured waste schema', async () => {
    const startPluginOperationJob = vi.fn();

    const response = await wasteManagementOperationHandlers.startWasteManagementMigrationsInternal(
      createToolRequest('https://studio.test/api/v1/waste-management/tools/migrations', {
        targetSchema: 'foreign_schema',
      }),
      actor,
      {
        ...createDeps(),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [
            {
              action: 'waste-management.settings.manage',
              resourceType: 'waste-management',
              effect: 'allow' as const,
            },
          ],
        })),
        startPluginOperationJob,
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: expect.stringContaining('konfigurierte Schema'),
      },
    });
    expect(startPluginOperationJob).not.toHaveBeenCalled();
  });

  it('binds migrations to the configured supabase interface schema when no legacy waste datasource exists', async () => {
    const startPluginOperationJob = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { id: 'job-migration-1' } }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    const response = await wasteManagementOperationHandlers.startWasteManagementMigrationsInternal(
      createToolRequest('https://studio.test/api/v1/waste-management/tools/migrations', {
        targetSchema: 'wm',
      }),
      actor,
      {
        ...createDeps(),
        resolvePermissions: vi.fn(async () => ({
          ok: true as const,
          permissions: [
            {
              action: 'waste-management.settings.manage',
              resourceType: 'waste-management',
              effect: 'allow' as const,
            },
          ],
        })),
        startPluginOperationJob,
      }
    );

    expect(response.status).toBe(202);
    expect(startPluginOperationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          input: expect.objectContaining({
            targetSchema: 'wm',
          }),
        }),
      })
    );
  });

  it('creates import previews and returns the preview payload as an api item', async () => {
    const previewWasteLocationTourPickupDateImport = vi.fn(async () => ({
      detectedDelimiter: ';',
      delimiter: ';',
      validRowCount: 4,
      invalidRowCount: 1,
      newTours: ['Tour Nord'],
      summary: {
        locations: { created: 2, existing: 1 },
        assignments: { created: 3, existing: 0 },
      },
      errors: [],
    }));

    const response = await wasteManagementOperationHandlers.previewWasteManagementLocationTourPickupDateImportInternal(
      createToolRequest('https://studio.test/api/v1/waste-management/tools/imports/preview', {
        importProfileId: 'waste-management.ortsbezogene-tourtermine',
        sourceFormat: 'text/csv',
        blobRef: 'data:text/csv;base64,ZmFrZQ==',
        delimiterOverride: ';',
      }),
      actor,
      {
        ...createDeps(),
        previewWasteLocationTourPickupDateImport,
      }
    );

    expect(previewWasteLocationTourPickupDateImport).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      sourceFormat: 'text/csv',
      blobRef: 'data:text/csv;base64,ZmFrZQ==',
      delimiterOverride: ';',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: expect.objectContaining({
        validRowCount: 4,
        invalidRowCount: 1,
      }),
      requestId: 'req-test',
    });
  });

  it('returns 503 for missing preview dependencies and unexpected preview backend failures', async () => {
    const missingDependencyResponse =
      await wasteManagementOperationHandlers.previewWasteManagementLocationTourPickupDateImportInternal(
        createToolRequest('https://studio.test/api/v1/waste-management/tools/imports/preview', {
          importProfileId: 'waste-management.ortsbezogene-tourtermine',
          sourceFormat: 'text/csv',
          blobRef: 'data:text/csv;base64,ZmFrZQ==',
        }),
        actor,
        createDeps()
      );

    expect(missingDependencyResponse.status).toBe(503);
    await expect(missingDependencyResponse.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message: 'Die Importvorschau konnte nicht erstellt werden.',
      },
    });

    const throwingResponse =
      await wasteManagementOperationHandlers.previewWasteManagementLocationTourPickupDateImportInternal(
        createToolRequest('https://studio.test/api/v1/waste-management/tools/imports/preview', {
          importProfileId: 'waste-management.ortsbezogene-tourtermine',
          sourceFormat: 'text/csv',
          blobRef: 'data:text/csv;base64,ZmFrZQ==',
        }),
        actor,
        {
          ...createDeps(),
          previewWasteLocationTourPickupDateImport: vi.fn(async () => {
            throw new Error('preview kaputt');
          }),
        }
      );

    expect(throwingResponse.status).toBe(503);
    await expect(throwingResponse.json()).resolves.toMatchObject({
      error: {
        code: 'database_unavailable',
        message: 'Die Importvorschau konnte nicht erstellt werden.',
      },
    });
  });
});
