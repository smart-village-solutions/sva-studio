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
  getSessionById: vi.fn(async () => ({
    activeOrganizationId: 'org-1',
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

  it('saves custom recurrence presets when the interface-managed fields stay unchanged', async () => {
    const deps = createDeps();
    const loadDefaultInterfaceRecord = vi.fn(async () => ({
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
        calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
        holidayStateCode: 'BY',
      },
      secretConfigCiphertext: 'cipher-secret',
    }));
    const saveExternalInterfaceRecord = vi.fn(async () => undefined);
    const saveWasteCustomRecurrencePresets = vi.fn(async () => undefined);
    const syncWasteHolidayRules = vi.fn(async () => 'success' as const);
    const loadWasteCustomRecurrencePresets = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'preset-10',
          name: '10 Tage',
          description: 'Ferien',
          intervalDays: 10,
          createdAt: '2026-05-10T10:00:00.000Z',
          updatedAt: '2026-05-10T10:00:00.000Z',
        },
      ]);

    const response = await wasteManagementSettingsHandlers.updateWasteManagementSettingsInternal(
      createRequest({
        provider: 'supabase',
        projectUrl: 'https://tenant.example',
        schemaName: 'wm',
        enabled: true,
        calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
        holidayStateCode: 'NW',
        customRecurrencePresets: [
          { id: 'preset-10', name: '10 Tage', description: 'Ferien', intervalDays: 10 },
        ],
        deletedPresetFallbacks: {},
      }),
      actor,
      {
        ...deps,
        loadDefaultInterfaceRecord,
        saveExternalInterfaceRecord,
        loadWasteCustomRecurrencePresets,
        saveWasteCustomRecurrencePresets,
        syncWasteHolidayRules,
      }
    );

    expect(response.status).toBe(200);
    expect(saveExternalInterfaceRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'supabase-1',
        publicConfig: expect.objectContaining({
          projectUrl: 'https://tenant.example',
          schemaName: 'wm',
          calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
          holidayStateCode: 'NW',
          lastHolidaySyncStatus: 'success',
          wasteManagementSelected: true,
        }),
      })
    );
    expect(saveWasteCustomRecurrencePresets).toHaveBeenCalledWith('tenant-a', {
      nextItems: [{ id: 'preset-10', name: '10 Tage', description: 'Ferien', intervalDays: 10 }],
      deletedPresetFallbacks: {},
    });
    expect(syncWasteHolidayRules).toHaveBeenCalledWith('tenant-a', 'NW');
    expect(
      deps.emitAuditEvent.mock.calls.some(
        ([event]) =>
          event.pluginAction.actionId === 'waste-management.settings.updated' &&
          event.pluginAction.result === 'success'
      )
    ).toBe(true);
    await expect(response.json()).resolves.toEqual({
      data: {
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
        calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
        databaseUrlConfigured: true,
        serviceRoleKeyConfigured: true,
        visibleStatus: 'ok',
        holidayStateCode: 'NW',
        lastHolidaySyncStatus: 'success',
        customRecurrencePresets: [
          {
            id: 'preset-10',
            name: '10 Tage',
            description: 'Ferien',
            intervalDays: 10,
            createdAt: '2026-05-10T10:00:00.000Z',
            updatedAt: '2026-05-10T10:00:00.000Z',
          },
        ],
      },
      requestId: 'req-test',
    });
  });

  it('rejects writes when interface-managed fields differ from the persisted interface config', async () => {
    const deps = createDeps();

    const response = await wasteManagementSettingsHandlers.updateWasteManagementSettingsInternal(
      createRequest({
        provider: 'supabase',
        projectUrl: '',
        schemaName: 'wm',
        enabled: true,
      }),
      actor,
      {
        ...deps,
        loadDefaultInterfaceRecord: vi.fn(async () => ({
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
          },
          secretConfigCiphertext: 'cipher-secret',
        })),
        loadWasteCustomRecurrencePresets: vi.fn(async () => []),
        saveWasteCustomRecurrencePresets: vi.fn(async () => undefined),
      }
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

  it('preserves the stored email reminder config when the holiday sync writes status metadata', async () => {
    const deps = createDeps();
    const saveExternalInterfaceRecord = vi.fn(async () => undefined);

    const response = await wasteManagementSettingsHandlers.runWasteManagementHolidaySyncInternal(
      new Request('https://studio.test/api/v1/waste-management/settings/holiday-sync', {
        method: 'POST',
        headers: {
          Origin: 'https://studio.test',
          'X-Requested-With': 'XMLHttpRequest',
        },
      }),
      actor,
      {
        ...deps,
        loadDefaultInterfaceRecord: vi.fn(async () => ({
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
            calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
            holidayStateCode: 'NW',
            emailReminderConfig: {
              enabled: true,
              publicSignupEnabled: true,
              transportId: 'mail-transport-1',
              publicBaseUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
              doiConfirmPath: '/email-reminders/confirm',
              unsubscribePath: '/email-reminders/unsubscribe',
              fromName: 'Landkreis Prignitz',
              fromEmail: 'abfall@example.org',
              privacyPolicyUrl: 'https://example.org/privacy',
              imprintUrl: 'https://example.org/imprint',
              consentLabel: 'Ich stimme zu.',
              consentVersion: '2026-06-14',
              doiSubjectTemplate: 'Bitte bestätigen',
              doiIntroText: 'Bitte bestätigen Sie die Einrichtung.',
              doiButtonLabel: 'Jetzt aktivieren',
              reminderSubjectTemplate: 'Nicht vergessen',
              reminderIntroTemplate: 'Morgen wird geleert.',
              unsubscribeLinkLabel: 'Abmelden',
              unsubscribeSuccessHeadline: 'Abgemeldet',
              unsubscribeSuccessBody: 'Sie wurden abgemeldet.',
              maxSubscriptionsPerEmailAndLocation: 5,
              signupRateLimitPerIpPerHour: 20,
              signupRateLimitPerEmailPerHour: 10,
              doiTokenTtlHours: 48,
              pendingSubscriptionTtlHours: 72,
              materializationLookaheadDays: 7,
            },
          },
          secretConfigCiphertext: 'cipher-secret',
        })),
        saveExternalInterfaceRecord,
        loadWasteCustomRecurrencePresets: vi.fn(async () => []),
        syncWasteHolidayRules: vi.fn(async () => 'success' as const),
      }
    );

    expect(response.status).toBe(200);
    expect(saveExternalInterfaceRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        publicConfig: expect.objectContaining({
          emailReminderConfig: expect.objectContaining({
            transportId: 'mail-transport-1',
            publicSignupEnabled: true,
          }),
          lastHolidaySyncStatus: 'success',
        }),
      })
    );
  });
});
