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
  buildSettingsRecord,
  defaultRunConnectionProbe,
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
        updatedAt: '2026-05-09T10:00:00.000Z',
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
      updatedAt: '2026-05-09T10:00:00.000Z',
    });
  });

  it('builds settings records with trimmed values, defaults and protected secrets', async () => {
    const protectSecret = vi.fn((value: string, aad: string) => `protected:${aad}:${value}`);

    const record = await buildSettingsRecord(
      {
        protectSecret,
        loadWasteDataSourceRecord: vi.fn(async () => ({
          instanceId: 'tenant-a',
          provider: 'supabase',
          projectUrl: 'https://old.example',
          schemaName: 'old',
          enabled: false,
          databaseUrlConfigured: true,
          serviceRoleKeyConfigured: true,
          databaseUrlCiphertext: 'existing-db',
          serviceRoleKeyCiphertext: 'existing-key',
          visibleStatus: 'ok',
          lastCheckedAt: '2026-05-01T10:00:00.000Z',
          lastCheckStatus: 'succeeded',
          lastCheckErrorCode: null,
          lastCheckErrorMessage: null,
          updatedAt: '2026-05-01T10:00:00.000Z',
        })),
      },
      'tenant-a',
      {
        provider: 'supabase',
        projectUrl: ' https://tenant.example ',
        schemaName: ' ',
        enabled: true,
        databaseUrl: ' postgres://db ',
        serviceRoleKey: ' service-key ',
      }
    );

    expect(record).toMatchObject({
      instanceId: 'tenant-a',
      provider: 'supabase',
      projectUrl: 'https://tenant.example',
      schemaName: 'public',
      enabled: true,
      databaseUrlConfigured: true,
      serviceRoleKeyConfigured: true,
      visibleStatus: 'unknown',
      lastCheckedAt: '2026-05-01T10:00:00.000Z',
      lastCheckStatus: 'succeeded',
    });
    expect(record.databaseUrlCiphertext).toContain('postgres://db');
    expect(record.serviceRoleKeyCiphertext).toContain('service-key');
    expect(protectSecret).toHaveBeenCalledTimes(2);
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
    const saveWasteConnectionCheck = vi.fn(async () => undefined);
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

    await updateWasteVisibleStatus({ saveWasteConnectionCheck }, 'tenant-a', 'success');
    await updateWasteVisibleStatus(
      {
        saveWasteConnectionCheck,
        loadWasteDataSourceRecord: vi.fn(async () => ({
          instanceId: 'tenant-a',
          provider: 'supabase',
          projectUrl: 'https://tenant.example',
          schemaName: 'wm',
          enabled: true,
          databaseUrlConfigured: true,
          serviceRoleKeyConfigured: true,
          databaseUrlCiphertext: 'cipher-db',
          serviceRoleKeyCiphertext: 'cipher-key',
          visibleStatus: 'unknown',
        })),
        revealSecret: vi.fn((ciphertext: string | null | undefined) => ciphertext?.replace('cipher-', 'revealed-')),
        runConnectionProbe: vi.fn(async () => undefined),
      },
      'tenant-a',
      'revalidate'
    );

    expect(saveWasteConnectionCheck).toHaveBeenNthCalledWith(1, {
      instanceId: 'tenant-a',
      checkedAt: '2026-05-10T12:00:00.000Z',
      checkStatus: 'succeeded',
      visibleStatus: 'ok',
    });
    expect(resolveWasteDataSourceMock).toHaveBeenCalledTimes(1);
    expect(runWasteConnectionCheckMock).toHaveBeenCalledTimes(1);
  });

  it('persists failed connection checks when revalidation throws and skips incomplete dependency sets', async () => {
    const saveWasteConnectionCheck = vi.fn(async () => undefined);
    resolveWasteDataSourceMock.mockRejectedValue(Object.assign(new Error('Probe fehlgeschlagen.'), { code: 'probe_failed' }));

    await updateWasteVisibleStatus({ saveWasteConnectionCheck }, 'tenant-a', 'revalidate');
    await updateWasteVisibleStatus(
      {
        saveWasteConnectionCheck,
        loadWasteDataSourceRecord: vi.fn(async () => null),
        revealSecret: vi.fn(),
      },
      'tenant-a',
      'revalidate'
    );
    await updateWasteVisibleStatus(
      {
        saveWasteConnectionCheck,
        loadWasteDataSourceRecord: vi.fn(async () => null),
      },
      'tenant-a',
      'revalidate'
    );

    expect(saveWasteConnectionCheck).toHaveBeenCalledTimes(1);
    expect(saveWasteConnectionCheck).toHaveBeenCalledWith({
      instanceId: 'tenant-a',
      checkedAt: '2026-05-10T12:00:00.000Z',
      checkStatus: 'failed',
      visibleStatus: 'error',
      errorCode: 'probe_failed',
      errorMessage: 'Probe fehlgeschlagen.',
    });
  });
});
