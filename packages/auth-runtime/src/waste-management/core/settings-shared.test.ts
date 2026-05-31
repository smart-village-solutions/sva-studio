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
            holidayStateCode: 'NW',
            lastHolidaySyncStatus: 'success',
          },
          secretConfigCiphertext: 'cipher-secret',
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
