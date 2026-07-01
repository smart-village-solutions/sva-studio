import { beforeEach, describe, expect, it, vi } from 'vitest';

const resolveWasteDataSourceMock = vi.hoisted(() => vi.fn());
const runWasteConnectionCheckMock = vi.hoisted(() => vi.fn());
const poolConnectMock = vi.hoisted(() => vi.fn());
const poolEndMock = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock('@sva/server-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sva/server-runtime')>();
  return {
    ...actual,
    resolveWasteDataSource: resolveWasteDataSourceMock,
    runWasteConnectionCheck: runWasteConnectionCheckMock,
  };
});

vi.mock('pg', () => ({
  Pool: vi.fn(function MockPool() {
    return {
      connect: poolConnectMock,
      end: poolEndMock,
    };
  }),
}));

import {
  defaultRunConnectionProbe,
  loadConfiguredWasteSettings,
  sanitizeWasteSettings,
  updateWasteVisibleStatus,
} from './settings-shared.js';

const createEmailReminderConfig = () => ({
  enabled: true,
  publicSignupEnabled: true,
  transportId: 'mail-transport-1',
  publicBaseUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
  doiConfirmPath: '/email-reminders/confirm',
  unsubscribePath: '/email-reminders/unsubscribe',
  signupSuccessPath: '/email-reminders/pending',
  activationSuccessPath: '/email-reminders/active',
  unsubscribeSuccessPath: '/email-reminders/unsubscribed',
  invalidTokenPath: '/email-reminders/invalid-token',
  fromName: 'Landkreis Prignitz',
  fromEmail: 'abfall@example.org',
  replyToEmail: 'reply@example.org',
  serviceLabel: 'Mülli',
  privacyPolicyUrl: 'https://example.org/privacy',
  imprintUrl: 'https://example.org/imprint',
  consentLabel: 'Ich stimme zu.',
  consentVersion: '2026-06-14',
  dataControllerLabel: 'Landkreis Prignitz',
  dataProtectionContactEmail: 'datenschutz@example.org',
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
});

describe('waste-management settings shared helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00.000Z'));
  });

  it('sanitizes persisted settings records without leaking secret ciphertexts', () => {
    expect(sanitizeWasteSettings(null)).toBeNull();

    expect(
      sanitizeWasteSettings({
        instanceId: 'tenant-a',
        provider: 'supabase',
        projectUrl: 'https://tenant.example',
        schemaName: 'wm',
        enabled: true,
        calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
        pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
        pdfContactBlock: 'Abfallberatung 03395 / 1234',
        emailReminderConfig: createEmailReminderConfig(),
        databaseUrlConfigured: true,
        serviceRoleKeyConfigured: false,
        databaseUrlCiphertext: 'cipher-db',
        serviceRoleKeyCiphertext: 'cipher-key',
        visibleStatus: 'warning',
        lastCheckedAt: '2026-05-09T10:00:00.000Z',
        lastCheckStatus: 'failed',
        lastCheckErrorCode: 'connection_failed',
        lastCheckErrorMessage: 'boom',
        holidayStateCode: 'NW',
        lastHolidaySyncStatus: 'partial_success',
        updatedAt: '2026-05-09T10:00:00.000Z',
        customRecurrencePresets: [],
      })
    ).toEqual({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant.example',
      schemaName: 'wm',
      enabled: true,
      calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
      pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
      pdfContactBlock: 'Abfallberatung 03395 / 1234',
      emailReminderConfig: createEmailReminderConfig(),
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: false,
      visibleStatus: 'warning',
      lastCheckedAt: '2026-05-09T10:00:00.000Z',
      lastCheckStatus: 'failed',
      lastCheckErrorCode: 'connection_failed',
      lastCheckErrorMessage: 'boom',
      holidayStateCode: 'NW',
      lastHolidaySyncStatus: 'partial_success',
      updatedAt: '2026-05-09T10:00:00.000Z',
      customRecurrencePresets: [],
    });
  });

  it('prefers the configured supabase interface over the legacy waste datasource record', async () => {
    const settings = await loadConfiguredWasteSettings(
      {
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
          visibleStatus: 'error',
          lastCheckedAt: '2026-05-09T10:00:00.000Z',
          lastCheckStatus: 'failed',
          lastCheckErrorCode: 'database_auth_failed',
          lastCheckErrorMessage: 'DB auth failed',
          updatedAt: '2026-05-09T11:00:00.000Z',
          publicConfig: {
            projectUrl: 'https://tenant.example',
            schemaName: 'wm',
            calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
            pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
            pdfContactBlock: 'Abfallberatung 03395 / 1234',
            emailReminderConfig: createEmailReminderConfig(),
            holidayStateCode: 'NW',
            lastHolidaySyncStatus: 'success',
          },
          secretConfigCiphertext: 'cipher-secret',
        })),
        loadWastePdfStaticSettings: vi.fn(async () => ({
          pdfBrandingAssetUrl: 'https://cdn.example/logo-from-waste.svg',
          pdfContactBlock: 'Abfallberatung aus Waste-DB',
        })),
        loadWasteCustomRecurrencePresets: vi.fn(async () => [
          {
            id: 'preset-10',
            name: '10 Tage',
            intervalDays: 10,
            createdAt: '2026-05-09T09:00:00.000Z',
            updatedAt: '2026-05-09T09:30:00.000Z',
          },
        ]),
      },
      'tenant-a'
    );

    expect(settings).toEqual({
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
          visibleStatus: 'error',
          isSelected: true,
        },
      ],
      calendarWebUrl: 'https://bb-prignitz.abfallkalender.smart-village.app/',
      pdfBrandingAssetUrl: 'https://cdn.example/logo-from-waste.svg',
      pdfContactBlock: 'Abfallberatung aus Waste-DB',
      emailReminderConfig: createEmailReminderConfig(),
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'error',
      lastCheckedAt: '2026-05-09T10:00:00.000Z',
      lastCheckStatus: 'failed',
      lastCheckErrorCode: 'database_auth_failed',
      lastCheckErrorMessage: 'DB auth failed',
      holidayStateCode: 'NW',
      lastHolidaySyncStatus: 'success',
      updatedAt: '2026-05-09T11:00:00.000Z',
      customRecurrencePresets: [
        {
          id: 'preset-10',
          name: '10 Tage',
          intervalDays: 10,
          createdAt: '2026-05-09T09:00:00.000Z',
          updatedAt: '2026-05-09T09:30:00.000Z',
        },
      ],
    });
  });

  it('falls back to interface pdf settings when no waste pdf settings are stored yet', async () => {
    const settings = await loadConfiguredWasteSettings(
      {
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
            pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
            pdfContactBlock: 'Abfallberatung 03395 / 1234',
          },
          secretConfigCiphertext: 'cipher-secret',
        })),
        loadWastePdfStaticSettings: vi.fn(async () => null),
      },
      'tenant-a'
    );

    expect(settings).toMatchObject({
      pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
      pdfContactBlock: 'Abfallberatung 03395 / 1234',
    });
  });

  it('falls back to interface pdf settings when the waste settings row has no usable values', async () => {
    const settings = await loadConfiguredWasteSettings(
      {
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
            pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
            pdfContactBlock: 'Abfallberatung 03395 / 1234',
          },
          secretConfigCiphertext: 'cipher-secret',
        })),
        loadWastePdfStaticSettings: vi.fn(async () => ({
          pdfBrandingAssetUrl: undefined,
          pdfContactBlock: undefined,
        })),
      },
      'tenant-a'
    );

    expect(settings).toMatchObject({
      pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
      pdfContactBlock: 'Abfallberatung 03395 / 1234',
    });
  });

  it('falls back to legacy interface pdf settings when the waste_settings table is absent', async () => {
    const settings = await loadConfiguredWasteSettings(
      {
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
            pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
            pdfContactBlock: 'Abfallberatung 03395 / 1234',
          },
          secretConfigCiphertext: 'cipher-secret',
        })),
        loadWastePdfStaticSettings: vi.fn(async () => {
          const error = new Error('relation "waste_settings" does not exist');
          Object.assign(error, { code: '42P01' });
          throw error;
        }),
      },
      'tenant-a'
    );

    expect(settings).toMatchObject({
      pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
      pdfContactBlock: 'Abfallberatung 03395 / 1234',
    });
  });

  it('merges partial waste pdf settings rows with legacy interface values per field', async () => {
    const settings = await loadConfiguredWasteSettings(
      {
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
            pdfBrandingAssetUrl: 'https://cdn.example/logo.svg',
            pdfContactBlock: 'Abfallberatung 03395 / 1234',
          },
          secretConfigCiphertext: 'cipher-secret',
        })),
        loadWastePdfStaticSettings: vi.fn(async () => ({
          pdfBrandingAssetUrl: 'https://cdn.example/logo-from-waste.svg',
          pdfContactBlock: undefined,
        })),
      },
      'tenant-a'
    );

    expect(settings).toMatchObject({
      pdfBrandingAssetUrl: 'https://cdn.example/logo-from-waste.svg',
      pdfContactBlock: 'Abfallberatung 03395 / 1234',
    });
  });

  it('does not swallow non-missing-table waste settings errors that merely mention the table name', async () => {
    await expect(
      loadConfiguredWasteSettings(
        {
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
          loadWastePdfStaticSettings: vi.fn(async () => {
            const error = new Error('permission denied for table waste_settings');
            Object.assign(error, { code: '42501' });
            throw error;
          }),
        },
        'tenant-a'
      )
    ).rejects.toThrow('permission denied for table waste_settings');
  });

  it('skips waste pdf lookup while the waste datasource is not configured yet', async () => {
    const loadWastePdfStaticSettings = vi.fn(async () => ({
      pdfBrandingAssetUrl: 'https://cdn.example/logo-from-waste.svg',
      pdfContactBlock: 'Abfallberatung aus Waste-DB',
    }));

    const settings = await loadConfiguredWasteSettings(
      {
        listInterfaceRecords: vi.fn(async () => []),
        loadDefaultInterfaceRecord: vi.fn(async () => null),
        loadWastePdfStaticSettings,
      },
      'tenant-a'
    );

    expect(loadWastePdfStaticSettings).not.toHaveBeenCalled();
    expect(settings).toEqual({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: '',
      schemaName: 'public',
      enabled: false,
      availableInterfaces: [],
      databaseUrlConfigured: false,
      serviceRoleKeyConfigured: false,
      visibleStatus: 'not_configured',
      customRecurrencePresets: [],
    });
  });

  it('returns a not-configured settings shell when no interface can be resolved', async () => {
    const settings = await loadConfiguredWasteSettings(
      {
        listInterfaceRecords: vi.fn(async () => []),
        loadDefaultInterfaceRecord: vi.fn(async () => null),
      },
      'tenant-a'
    );

    expect(settings).toEqual({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: '',
      schemaName: 'public',
      enabled: false,
      availableInterfaces: [],
      databaseUrlConfigured: false,
      serviceRoleKeyConfigured: false,
      visibleStatus: 'not_configured',
      customRecurrencePresets: [],
    });
  });

  it('maps non-supabase interfaces into a not-configured waste settings shell while preserving interface options', async () => {
    const settings = await loadConfiguredWasteSettings(
      {
        listInterfaceRecords: vi.fn(async () => [
          {
            id: 's3-1',
            instanceId: 'tenant-a',
            typeKey: 's3',
            ownerKind: 'host',
            ownerId: 'host',
            displayName: 'S3',
            alias: 'default',
            enabled: true,
            isDefault: true,
            category: 'object_storage',
            statusCheckKind: 's3',
            visibleStatus: 'ok',
            publicConfig: {
              wasteManagementSelected: true,
              calendarWebUrl: 'https://ignored.example',
            },
          },
        ]),
        loadDefaultInterfaceRecord: vi.fn(async () => null),
      },
      'tenant-a'
    );

    expect(settings).toEqual({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: '',
      schemaName: 'public',
      enabled: false,
      availableInterfaces: [
        {
          id: 's3-1',
          name: 'S3',
          typeKey: 's3',
          enabled: true,
          visibleStatus: 'ok',
          isSelected: false,
        },
      ],
      databaseUrlConfigured: false,
      serviceRoleKeyConfigured: false,
      visibleStatus: 'not_configured',
      customRecurrencePresets: [],
    });
  });

  it('runs the default connection probe through a short-lived pg pool', async () => {
    const release = vi.fn();
    const query = vi.fn(async () => ({ rows: [{ '?column?': 1 }] }));
    poolConnectMock.mockResolvedValue({ query, release });

    await defaultRunConnectionProbe({
      instanceId: 'tenant-a',
      schemaName: 'wm',
      databaseUrl: 'postgres://db',
      projectUrl: 'https://tenant.example',
      serviceRoleKey: 'service-key',
      provider: 'supabase',
      enabled: true,
    });

    expect(poolConnectMock).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith('SELECT 1;');
    expect(release).toHaveBeenCalledTimes(1);
    expect(poolEndMock).toHaveBeenCalledTimes(1);
  });

  it('updates visible status optimistically on successful writes and revalidates persisted settings', async () => {
    const saveExternalInterfaceConnectionCheck = vi.fn(async () => undefined);
    resolveWasteDataSourceMock.mockResolvedValue({
      instanceId: 'tenant-a',
      schemaName: 'wm',
      databaseUrl: 'postgres://db',
      projectUrl: 'https://tenant.example',
      serviceRoleKey: 'service-key',
      provider: 'supabase',
      enabled: true,
    });
    runWasteConnectionCheckMock.mockResolvedValue({
      instanceId: 'tenant-a',
      checkedAt: '2026-05-10T12:00:00.000Z',
      checkStatus: 'succeeded',
      visibleStatus: 'ok',
    });

    await updateWasteVisibleStatus(
      {
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
          visibleStatus: 'unknown',
          publicConfig: {},
          secretConfigCiphertext: 'cipher-secret',
        })),
        saveExternalInterfaceConnectionCheck,
      },
      'tenant-a',
      'success'
    );
    await updateWasteVisibleStatus(
      {
        loadDefaultInterfaceRecord: vi.fn(async () => ({
          id: 'supabase-1',
          instanceId: 'tenant-a',
          typeKey: 'supabase',
          ownerKind: 'host',
          ownerId: 'host',
          displayName: 'Supabase',
          alias: 'default',
          enabled: true,
          visibleStatus: 'unknown',
          isDefault: true,
          category: 'database',
          statusCheckKind: 'supabase',
          publicConfig: {
            projectUrl: 'https://tenant.example',
            schemaName: 'wm',
          },
          secretConfigCiphertext: 'cipher-secret',
        })),
        saveExternalInterfaceConnectionCheck,
        revealSecret: vi.fn((ciphertext: string | null | undefined) => ciphertext?.replace('cipher-', 'revealed-')),
        runConnectionProbe: vi.fn(async () => undefined),
      },
      'tenant-a',
      'revalidate'
    );

    expect(saveExternalInterfaceConnectionCheck).toHaveBeenNthCalledWith(1, {
      instanceId: 'tenant-a',
      interfaceId: 'supabase-1',
      checkedAt: '2026-05-10T12:00:00.000Z',
      checkStatus: 'succeeded',
      visibleStatus: 'ok',
    });
    expect(resolveWasteDataSourceMock).toHaveBeenCalledTimes(1);
    expect(runWasteConnectionCheckMock).toHaveBeenCalledTimes(1);
  });

  it('persists failed connection checks when revalidation throws and skips incomplete dependency sets', async () => {
    const saveExternalInterfaceConnectionCheck = vi.fn(async () => undefined);
    resolveWasteDataSourceMock.mockRejectedValue(Object.assign(new Error('Probe fehlgeschlagen.'), { code: 'probe_failed' }));

    await updateWasteVisibleStatus(
      {
        loadDefaultInterfaceRecord: vi.fn(async () => null),
        saveExternalInterfaceConnectionCheck,
      },
      'tenant-a',
      'revalidate'
    );
    await updateWasteVisibleStatus(
      {
        loadDefaultInterfaceRecord: vi.fn(async () => null),
        saveExternalInterfaceConnectionCheck,
        revealSecret: vi.fn(),
      },
      'tenant-a',
      'revalidate'
    );
    await updateWasteVisibleStatus(
      {
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
          visibleStatus: 'unknown',
          publicConfig: {},
          secretConfigCiphertext: 'cipher-secret',
        })),
        saveExternalInterfaceConnectionCheck,
        revealSecret: vi.fn(),
      },
      'tenant-a',
      'revalidate'
    );

    expect(saveExternalInterfaceConnectionCheck).toHaveBeenCalledTimes(1);
    expect(saveExternalInterfaceConnectionCheck).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      interfaceId: 'supabase-1',
      checkedAt: '2026-05-10T12:00:00.000Z',
      checkStatus: 'failed',
      visibleStatus: 'error',
      errorCode: 'probe_failed',
      errorMessage: 'Probe fehlgeschlagen.',
    });
  });
});
