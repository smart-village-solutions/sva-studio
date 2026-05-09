import { describe, expect, it, vi } from 'vitest';

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { buildWasteManagementSettingsRecord } from './service-shared.js';

describe('service-shared waste-management helpers', () => {
  it('creates a normalized waste-management settings record with protected secrets', async () => {
    const deps = {
      protectSecret: vi.fn((value: string | undefined, aad: string) => (value ? `protected:${aad}:${value}` : null)),
      loadWasteDataSourceRecord: vi.fn(async () => null),
    };

    await expect(
      buildWasteManagementSettingsRecord(deps as never, 'demo', {
        provider: 'supabase',
        projectUrl: 'https://tenant-a.supabase.co',
        schemaName: ' custom ',
        enabled: true,
        databaseUrl: ' postgres://waste.example/db ',
        serviceRoleKey: ' service-role ',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        instanceId: 'demo',
        provider: 'supabase',
        projectUrl: 'https://tenant-a.supabase.co',
        schemaName: 'custom',
        enabled: true,
        databaseUrlConfigured: true,
        serviceRoleKeyConfigured: true,
        visibleStatus: 'unknown',
        databaseUrlCiphertext:
          'protected:iam.instance_waste_data_sources.database_url:demo:postgres://waste.example/db',
        serviceRoleKeyCiphertext:
          'protected:iam.instance_waste_data_sources.service_role_key:demo:service-role',
      })
    );
  });

  it('preserves stored secrets and check metadata when an update omits secret fields', async () => {
    const deps = {
      protectSecret: vi.fn((value: string | undefined, aad: string) => (value ? `protected:${aad}:${value}` : null)),
      loadWasteDataSourceRecord: vi.fn(async () => ({
        instanceId: 'demo',
        provider: 'supabase',
        projectUrl: 'https://tenant-a.supabase.co',
        schemaName: 'public',
        enabled: true,
        databaseUrlConfigured: true,
        serviceRoleKeyConfigured: true,
        databaseUrlCiphertext: 'existing-db-cipher',
        serviceRoleKeyCiphertext: 'existing-service-cipher',
        visibleStatus: 'error',
        lastCheckedAt: '2026-05-09T10:00:00.000Z',
        lastCheckStatus: 'failed',
        lastCheckErrorCode: 'connection_refused',
        lastCheckErrorMessage: 'Host unreachable',
      })),
    };

    await expect(
      buildWasteManagementSettingsRecord(deps as never, 'demo', {
        provider: 'supabase',
        projectUrl: 'https://tenant-b.supabase.co',
        enabled: true,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        projectUrl: 'https://tenant-b.supabase.co',
        schemaName: 'public',
        databaseUrlCiphertext: 'existing-db-cipher',
        serviceRoleKeyCiphertext: 'existing-service-cipher',
        visibleStatus: 'unknown',
        lastCheckedAt: '2026-05-09T10:00:00.000Z',
        lastCheckStatus: 'failed',
        lastCheckErrorCode: 'connection_refused',
        lastCheckErrorMessage: 'Host unreachable',
      })
    );
  });
});
