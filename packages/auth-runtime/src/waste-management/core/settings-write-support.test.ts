import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExternalInterfaceRecord, WasteManagementSettingsRecord } from '@sva/core';

import type { AuthenticatedRequestContext } from '../../middleware.js';

const loadConfiguredWasteSettingsMock = vi.hoisted(() => vi.fn());
const updateWasteVisibleStatusMock = vi.hoisted(() => vi.fn(async () => undefined));
const emitWasteAuditEventMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('./settings-shared.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./settings-shared.js')>();
  return {
    ...actual,
    loadConfiguredWasteSettings: loadConfiguredWasteSettingsMock,
    updateWasteVisibleStatus: updateWasteVisibleStatusMock,
  };
});

vi.mock('./auth.js', () => ({
  emitWasteAuditEvent: emitWasteAuditEventMock,
}));

import {
  hasManagedWasteSettingsConflict,
  loadWasteSettingsWriteContext,
  runWasteManagementHolidaySyncAfterValidation,
  syncWasteHolidayState,
  updateWasteManagementSettingsAfterValidation,
} from './settings-write-support.js';

const actor: AuthenticatedRequestContext = {
  sessionId: 'session-1',
  user: {
    id: 'user-1',
    instanceId: 'tenant-a',
    roles: ['system_admin'],
  },
};

const createInterfaceRecord = (overrides: Partial<ExternalInterfaceRecord> = {}): ExternalInterfaceRecord => ({
  id: 'supabase-1',
  instanceId: 'tenant-a',
  typeKey: 'supabase',
  ownerKind: 'host',
  ownerId: 'host',
  displayName: 'Supabase',
  alias: 'default',
  enabled: true,
  isDefault: true,
  category: 'database',
  statusCheckKind: 'supabase',
  visibleStatus: 'ok',
  publicConfig: {
    projectUrl: 'https://tenant.example',
    schemaName: 'wm',
    calendarWebUrl: 'https://calendar.example',
    pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
    pdfContactBlock: 'Abfallberatung',
    holidayStateCode: 'BY',
    lastHolidaySyncStatus: 'partial_success',
    lastSuccessfulHolidaySyncAt: '2026-05-09T09:00:00.000Z',
  },
  secretConfigCiphertext: 'cipher-secret',
  ...overrides,
});

const createSettings = (
  overrides: Partial<WasteManagementSettingsRecord> = {}
): WasteManagementSettingsRecord => ({
  instanceId: 'tenant-a',
  provider: 'supabase',
  projectUrl: 'https://tenant.example',
  schemaName: 'wm',
  enabled: true,
  selectedInterfaceId: 'supabase-1',
  selectedInterfaceName: 'Supabase',
  selectedInterfaceTypeKey: 'supabase',
  availableInterfaces: [
    {
      id: 'supabase-1',
      name: 'Supabase',
      typeKey: 'supabase',
      enabled: true,
      visibleStatus: 'ok',
      isSelected: true,
    },
  ],
  calendarWebUrl: 'https://calendar.example',
  pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
  pdfContactBlock: 'Abfallberatung',
  databaseUrlConfigured: true,
  serviceRoleKeyConfigured: true,
  visibleStatus: 'ok',
  holidayStateCode: 'BY',
  lastHolidaySyncStatus: 'partial_success',
  lastSuccessfulHolidaySyncAt: '2026-05-09T09:00:00.000Z',
  customRecurrencePresets: [],
  ...overrides,
});

describe('waste-management settings write support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T10:15:00.000Z'));
  });

  it('loads the write context from listInterfaceRecords when available', async () => {
    const current = createSettings();
    const interfaceRecord = createInterfaceRecord();
    loadConfiguredWasteSettingsMock.mockResolvedValue(current);

    const result = await loadWasteSettingsWriteContext(
      {
        listInterfaceRecords: vi.fn(async () => [interfaceRecord]),
      },
      'tenant-a',
      'req-1'
    );

    expect(result).toEqual({
      current,
      interfaceRecords: [interfaceRecord],
    });
  });

  it('falls back to the default interface loader and returns a 503 response when settings are unavailable', async () => {
    const interfaceRecord = createInterfaceRecord();
    loadConfiguredWasteSettingsMock
      .mockResolvedValueOnce(createSettings())
      .mockResolvedValueOnce(null);

    const resolved = await loadWasteSettingsWriteContext(
      {
        loadDefaultInterfaceRecord: vi.fn(async () => interfaceRecord),
      },
      'tenant-a',
      'req-1'
    );
    const missing = await loadWasteSettingsWriteContext({}, 'tenant-a', 'req-2');

    expect(resolved).toEqual({
      current: createSettings(),
      interfaceRecords: [interfaceRecord],
    });
    expect(missing).toBeInstanceOf(Response);
    await expect((missing as Response).json()).resolves.toMatchObject({
      error: expect.objectContaining({
        code: 'database_unavailable',
      }),
      requestId: 'req-2',
    });
  });

  it('detects managed supabase conflicts but ignores non-supabase interfaces', () => {
    expect(
      hasManagedWasteSettingsConflict(
        createInterfaceRecord({
          publicConfig: {
            projectUrl: 'https://tenant.example',
            schemaName: '   ',
          },
        }),
        {
          projectUrl: 'https://tenant.example',
          schemaName: 'public',
          enabled: true,
        }
      )
    ).toBe(false);

    expect(
      hasManagedWasteSettingsConflict(createInterfaceRecord(), {
        projectUrl: 'https://other.example',
        schemaName: 'wm',
        enabled: true,
      })
    ).toBe(true);

    expect(
      hasManagedWasteSettingsConflict(
        createInterfaceRecord({
          typeKey: 's3',
          category: 'object_storage',
          statusCheckKind: 's3',
          publicConfig: {},
        }),
        {
          projectUrl: 'https://other.example',
          schemaName: 'ignored',
          enabled: false,
        }
      )
    ).toBe(false);
  });

  it('returns holiday sync status only when a state is present and maps failures to failed', async () => {
    const syncWasteHolidayRules = vi
      .fn()
      .mockResolvedValueOnce('success')
      .mockRejectedValueOnce(new Error('boom'));

    await expect(syncWasteHolidayState({}, 'tenant-a')).resolves.toBeUndefined();
    await expect(syncWasteHolidayState({ syncWasteHolidayRules }, 'tenant-a', 'NW')).resolves.toBe('success');
    await expect(syncWasteHolidayState({ syncWasteHolidayRules }, 'tenant-a', 'NW')).resolves.toBe('failed');
  });

  it('rejects updates when no target interface can be resolved', async () => {
    loadConfiguredWasteSettingsMock.mockResolvedValue(
      createSettings({
        selectedInterfaceId: undefined,
        availableInterfaces: [],
      })
    );

    const response = await updateWasteManagementSettingsAfterValidation({
      deps: {
        listInterfaceRecords: vi.fn(async () => []),
      },
      ctx: actor,
      instanceId: 'tenant-a',
      requestId: 'req-1',
      input: {
        projectUrl: 'https://tenant.example',
        schemaName: 'wm',
        enabled: true,
        customRecurrencePresets: [],
        deletedPresetFallbacks: {},
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.objectContaining({
        code: 'invalid_request',
      }),
    });
    expect(emitWasteAuditEventMock).not.toHaveBeenCalled();
  });

  it('rejects updates that change interface-managed supabase fields', async () => {
    loadConfiguredWasteSettingsMock.mockResolvedValue(createSettings());
    const saveExternalInterfaceRecord = vi.fn(async () => undefined);

    const response = await updateWasteManagementSettingsAfterValidation({
      deps: {
        listInterfaceRecords: vi.fn(async () => [createInterfaceRecord()]),
        saveExternalInterfaceRecord,
      },
      ctx: actor,
      instanceId: 'tenant-a',
      requestId: 'req-1',
      input: {
        projectUrl: 'https://other.example',
        schemaName: 'wm',
        enabled: true,
        customRecurrencePresets: [],
        deletedPresetFallbacks: {},
      },
    });

    expect(response.status).toBe(409);
    expect(saveExternalInterfaceRecord).not.toHaveBeenCalled();
    expect(emitWasteAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'waste-management.settings.updated',
        result: 'failure',
        reasonCode: 'managed_via_interfaces',
      })
    );
  });

  it('persists the selected interface, syncs holidays, and revalidates after a successful update', async () => {
    const legacyRecord = createInterfaceRecord({
      id: 'legacy-1',
      typeKey: 's3',
      category: 'object_storage',
      statusCheckKind: 's3',
      displayName: 'Archiv',
      publicConfig: {
        wasteManagementSelected: true,
        calendarWebUrl: 'https://legacy.example',
        pdfContactBlock: 'Alt',
      },
    });
    const targetRecord = createInterfaceRecord({
      id: 'supabase-2',
      displayName: 'Supabase B',
      isDefault: false,
    });
    const current = createSettings({
      selectedInterfaceId: 'legacy-1',
      selectedInterfaceName: 'Archiv',
      selectedInterfaceTypeKey: 's3',
      availableInterfaces: [
        {
          id: 'legacy-1',
          name: 'Archiv',
          typeKey: 's3',
          enabled: true,
          visibleStatus: 'ok',
          isSelected: true,
        },
        {
          id: 'supabase-2',
          name: 'Supabase B',
          typeKey: 'supabase',
          enabled: true,
          visibleStatus: 'ok',
          isSelected: false,
        },
      ],
    });
    const saved = createSettings({
      selectedInterfaceId: 'supabase-2',
      selectedInterfaceName: 'Supabase B',
      selectedInterfaceTypeKey: 'supabase',
      holidayStateCode: 'NW',
      lastHolidaySyncStatus: 'success',
      lastSuccessfulHolidaySyncAt: '2026-06-07T10:15:00.000Z',
      calendarWebUrl: 'https://calendar.next',
      pdfBrandingAssetUrl: 'https://cdn.example/next.svg',
      pdfContactBlock: 'Kontakt neu',
    });
    const saveExternalInterfaceRecord = vi.fn(async () => undefined);
    const saveWasteCustomRecurrencePresets = vi.fn(async () => undefined);
    const syncWasteHolidayRules = vi.fn(async () => 'success' as const);

    loadConfiguredWasteSettingsMock.mockResolvedValueOnce(current).mockResolvedValueOnce(saved);

    const response = await updateWasteManagementSettingsAfterValidation({
      deps: {
        listInterfaceRecords: vi.fn(async () => [legacyRecord, targetRecord]),
        saveExternalInterfaceRecord,
        saveWasteCustomRecurrencePresets,
        syncWasteHolidayRules,
      },
      ctx: actor,
      instanceId: 'tenant-a',
      requestId: 'req-1',
      input: {
        projectUrl: 'https://tenant.example',
        schemaName: 'wm',
        enabled: true,
        selectedInterfaceId: 'supabase-2',
        calendarWebUrl: ' https://calendar.next ',
        pdfBrandingAssetUrl: ' https://cdn.example/next.svg ',
        pdfContactBlock: ' Kontakt neu ',
        holidayStateCode: 'NW',
        customRecurrencePresets: [{ id: 'preset-1', name: '10 Tage', intervalDays: 10 }],
        deletedPresetFallbacks: { 'preset-legacy': { kind: 'default', value: 'none' } },
      },
    });

    expect(syncWasteHolidayRules).toHaveBeenCalledWith('tenant-a', 'NW');
    expect(saveWasteCustomRecurrencePresets).toHaveBeenCalledWith('tenant-a', {
      nextItems: [{ id: 'preset-1', name: '10 Tage', intervalDays: 10 }],
      deletedPresetFallbacks: { 'preset-legacy': { kind: 'default', value: 'none' } },
    });
    expect(saveExternalInterfaceRecord).toHaveBeenCalledTimes(2);

    const persistedRecords = saveExternalInterfaceRecord.mock.calls.map(([record]) => record as ExternalInterfaceRecord);
    const persistedLegacy = persistedRecords.find((record) => record.id === 'legacy-1');
    const persistedTarget = persistedRecords.find((record) => record.id === 'supabase-2');

    expect(persistedLegacy?.publicConfig).toEqual({
      calendarWebUrl: 'https://legacy.example',
      pdfContactBlock: 'Alt',
    });
    expect(persistedTarget?.publicConfig).toEqual(
      expect.objectContaining({
        wasteManagementSelected: true,
        calendarWebUrl: 'https://calendar.next',
        pdfBrandingAssetUrl: 'https://cdn.example/next.svg',
        pdfContactBlock: 'Kontakt neu',
        holidayStateCode: 'NW',
        lastHolidaySyncStatus: 'success',
        lastSuccessfulHolidaySyncAt: '2026-06-07T10:15:00.000Z',
      })
    );

    expect(updateWasteVisibleStatusMock).toHaveBeenCalledWith(
      expect.objectContaining({
        saveExternalInterfaceRecord,
      }),
      'tenant-a',
      'success'
    );
    expect(emitWasteAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'waste-management.settings.updated',
        result: 'success',
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: expect.objectContaining({
        selectedInterfaceId: 'supabase-2',
        holidayStateCode: 'NW',
        lastHolidaySyncStatus: 'success',
      }),
      requestId: 'req-1',
    });
  });

  it('returns a verification error when saved settings cannot be reloaded', async () => {
    const current = createSettings();
    const saveExternalInterfaceRecord = vi.fn(async () => undefined);
    const saveWasteCustomRecurrencePresets = vi.fn(async () => undefined);

    loadConfiguredWasteSettingsMock.mockResolvedValueOnce(current).mockResolvedValueOnce(null);

    const response = await updateWasteManagementSettingsAfterValidation({
      deps: {
        listInterfaceRecords: vi.fn(async () => [createInterfaceRecord()]),
        saveExternalInterfaceRecord,
        saveWasteCustomRecurrencePresets,
      },
      ctx: actor,
      instanceId: 'tenant-a',
      requestId: 'req-1',
      input: {
        projectUrl: 'https://tenant.example',
        schemaName: 'wm',
        enabled: true,
        holidayStateCode: 'BY',
        customRecurrencePresets: [],
        deletedPresetFallbacks: {},
      },
    });

    expect(response.status).toBe(503);
    expect(updateWasteVisibleStatusMock).not.toHaveBeenCalled();
    expect(emitWasteAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'waste-management.settings.updated',
        result: 'failure',
        reasonCode: 'verification_failed',
      })
    );
  });

  it('guards the manual holiday sync against missing interface selection or holiday state', async () => {
    loadConfiguredWasteSettingsMock
      .mockResolvedValueOnce(createSettings({ selectedInterfaceId: undefined, availableInterfaces: [] }))
      .mockResolvedValueOnce(createSettings({ holidayStateCode: undefined }));

    const missingInterface = await runWasteManagementHolidaySyncAfterValidation({
      deps: {
        listInterfaceRecords: vi.fn(async () => []),
      },
      ctx: actor,
      instanceId: 'tenant-a',
      requestId: 'req-1',
    });
    const missingState = await runWasteManagementHolidaySyncAfterValidation({
      deps: {
        listInterfaceRecords: vi.fn(async () => [createInterfaceRecord()]),
      },
      ctx: actor,
      instanceId: 'tenant-a',
      requestId: 'req-2',
    });

    expect(missingInterface.status).toBe(400);
    expect(missingState.status).toBe(400);
    expect(emitWasteAuditEventMock).not.toHaveBeenCalled();
  });

  it('persists a manual holiday sync result on the selected interface', async () => {
    const current = createSettings({
      holidayStateCode: 'NW',
      lastSuccessfulHolidaySyncAt: '2026-05-01T00:00:00.000Z',
    });
    const saved = createSettings({
      holidayStateCode: 'NW',
      lastHolidaySyncStatus: 'partial_success',
      lastSuccessfulHolidaySyncAt: '2026-06-07T10:15:00.000Z',
    });
    const targetRecord = createInterfaceRecord({
      publicConfig: {
        projectUrl: 'https://tenant.example',
        schemaName: 'wm',
        wasteManagementSelected: true,
        calendarWebUrl: 'https://calendar.example',
        pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
        pdfContactBlock: 'Abfallberatung',
        holidayStateCode: 'NW',
      },
    });
    const saveExternalInterfaceRecord = vi.fn(async () => undefined);
    const syncWasteHolidayRules = vi.fn(async () => 'partial_success' as const);

    loadConfiguredWasteSettingsMock.mockResolvedValueOnce(current).mockResolvedValueOnce(saved);

    const response = await runWasteManagementHolidaySyncAfterValidation({
      deps: {
        listInterfaceRecords: vi.fn(async () => [targetRecord]),
        saveExternalInterfaceRecord,
        syncWasteHolidayRules,
      },
      ctx: actor,
      instanceId: 'tenant-a',
      requestId: 'req-1',
    });

    expect(syncWasteHolidayRules).toHaveBeenCalledWith('tenant-a', 'NW');
    expect(saveExternalInterfaceRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'supabase-1',
        publicConfig: expect.objectContaining({
          wasteManagementSelected: true,
          holidayStateCode: 'NW',
          lastHolidaySyncStatus: 'partial_success',
          lastSuccessfulHolidaySyncAt: '2026-06-07T10:15:00.000Z',
        }),
      })
    );
    expect(emitWasteAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionId: 'waste-management.settings.holiday-sync.triggered',
        result: 'success',
      })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: expect.objectContaining({
        holidayStateCode: 'NW',
        lastHolidaySyncStatus: 'partial_success',
      }),
    });
  });
});
