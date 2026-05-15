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
  saveExternalInterfaceConnectionCheck: vi.fn(async () => undefined),
  emitAuditEvent: vi.fn(async () => undefined),
});

describe('waste-management settings handlers', () => {
  beforeEach(() => {
    resolveWasteDataSourceMock.mockClear();
    runWasteConnectionCheckMock.mockClear();
  });

  it('rejects legacy waste settings writes because the supabase is managed via interfaces', async () => {
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

    expect(response.status).toBe(409);
    expect(resolveWasteDataSourceMock).not.toHaveBeenCalled();
    expect(runWasteConnectionCheckMock).not.toHaveBeenCalled();
    expect(
      deps.emitAuditEvent.mock.calls.some(
        ([event]) =>
          event.pluginAction.actionId === 'waste-management.settings.updated' &&
          event.pluginAction.result === 'failure' &&
          event.pluginAction.reasonCode === 'managed_via_interfaces'
      )
    ).toBe(true);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'invalid_request',
        message: 'Die Waste-Supabase wird ausschließlich über /interfaces verwaltet.',
      },
      requestId: 'req-test',
    });
  });

  it('rejects writes before touching persistence even for malformed payloads', async () => {
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

    expect(response.status).toBe(409);
    expect(runWasteConnectionCheckMock).not.toHaveBeenCalled();
  });

  it('still returns guard errors before the managed-via-interfaces rejection', async () => {
    const response = await wasteManagementSettingsHandlers.updateWasteManagementSettingsInternal(
      new Request('https://studio.test/api/v1/waste-management/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://evil.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: JSON.stringify({}),
      }),
      actor,
      createDeps()
    );

    expect(response.status).toBe(403);
  });
});
