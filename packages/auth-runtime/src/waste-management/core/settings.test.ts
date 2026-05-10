import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthenticatedRequestContext } from '../../middleware.js';

const resolveWasteDataSourceMock = vi.hoisted(() => vi.fn(async () => ({ databaseUrl: 'postgres://waste', schemaName: 'wm' })));
const runWasteConnectionCheckMock = vi.hoisted(() => vi.fn(async () => ({
  instanceId: 'tenant-a',
  checkedAt: '2026-05-10T10:00:00.000Z',
  checkStatus: 'failed',
  visibleStatus: 'error',
  errorCode: 'connection_failed',
  errorMessage: 'Probe failed',
})));

vi.mock('@sva/server-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/server-runtime')>();
  return {
    ...actual,
    resolveWasteDataSource: resolveWasteDataSourceMock,
    runWasteConnectionCheck: runWasteConnectionCheckMock,
  };
});

import { wasteManagementSettingsHandlers } from './settings.js';

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
  },
};

const createRequest = (body: Record<string, unknown>) =>
  new Request('https://studio.test/api/v1/waste-management/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://studio.test',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify(body),
  });

const createDeps = () => ({
  getRequestId: () => 'req-test',
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
  protectSecret: vi.fn((value: string) => `enc:${value}`),
  revealSecret: vi.fn(() => 'revealed'),
  saveWasteDataSourceRecord: vi.fn(async () => undefined),
  saveWasteConnectionCheck: vi.fn(async () => undefined),
  emitAuditEvent: vi.fn(async () => undefined),
});

describe('waste-management settings handlers', () => {
  beforeEach(() => {
    resolveWasteDataSourceMock.mockClear();
    runWasteConnectionCheckMock.mockClear();
  });

  it('persists settings and emits a failure-shaped connection-check audit when the probe reports failure', async () => {
    const deps = createDeps();

    const response = await wasteManagementSettingsHandlers.updateWasteManagementSettingsInternal(
      createRequest({
        provider: 'supabase',
        projectUrl: 'https://tenant.example',
        schemaName: 'wm',
        enabled: true,
        databaseUrl: 'postgres://waste',
        serviceRoleKey: 'service-key',
      }),
      actor,
      deps
    );

    expect(response.status).toBe(200);
    expect(resolveWasteDataSourceMock).toHaveBeenCalled();
    expect(runWasteConnectionCheckMock).toHaveBeenCalled();
    expect(deps.saveWasteConnectionCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        checkStatus: 'failed',
        visibleStatus: 'error',
        errorCode: 'connection_failed',
      })
    );
    expect(
      deps.emitAuditEvent.mock.calls.some(
        ([event]) =>
          event.pluginAction.actionId === 'waste-management.connection-check.failed' &&
          event.pluginAction.result === 'failure' &&
          event.pluginAction.reasonCode === 'connection_failed'
      )
    ).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        visibleStatus: 'error',
        lastCheckStatus: 'failed',
      },
      requestId: 'req-test',
    });
  });

  it('returns invalid_request for malformed payloads before touching persistence', async () => {
    const deps = createDeps();

    const response = await wasteManagementSettingsHandlers.updateWasteManagementSettingsInternal(
      createRequest({
        provider: 'supabase',
        projectUrl: '',
        schemaName: 'wm',
        enabled: true,
      }),
      actor,
      deps
    );

    expect(response.status).toBe(400);
    expect(deps.saveWasteDataSourceRecord).not.toHaveBeenCalled();
    expect(runWasteConnectionCheckMock).not.toHaveBeenCalled();
  });

  it('rethrows missing dependency failures from the secret resolver path', async () => {
    resolveWasteDataSourceMock.mockImplementationOnce(async (input: { revealSecret: (ciphertext: string, aad: string) => string | undefined }) => {
      input.revealSecret('cipher', 'aad');
      return { databaseUrl: 'postgres://waste', schemaName: 'wm' };
    });

    await expect(
      wasteManagementSettingsHandlers.updateWasteManagementSettingsInternal(
        createRequest({
          provider: 'supabase',
          projectUrl: 'https://tenant.example',
          schemaName: 'wm',
          enabled: true,
          databaseUrl: 'postgres://waste',
          serviceRoleKey: 'service-key',
        }),
        actor,
        {
          ...createDeps(),
          revealSecret: undefined,
        }
      )
    ).rejects.toThrow('missing_dependency:revealSecret');
  });

  it('returns database_unavailable and emits a failure audit when persistence fails', async () => {
    const deps = createDeps();
    deps.saveWasteDataSourceRecord.mockImplementationOnce(async () => {
      throw new Error('db down');
    });

    const response = await wasteManagementSettingsHandlers.updateWasteManagementSettingsInternal(
      createRequest({
        provider: 'supabase',
        projectUrl: 'https://tenant.example',
        schemaName: 'wm',
        enabled: true,
      }),
      actor,
      deps
    );

    expect(response.status).toBe(503);
    expect(
      deps.emitAuditEvent.mock.calls.some(
        ([event]) =>
          event.pluginAction.actionId === 'waste-management.settings.updated' &&
          event.pluginAction.result === 'failure' &&
          event.pluginAction.reasonCode === 'database_unavailable'
      )
    ).toBe(true);
  });
});
