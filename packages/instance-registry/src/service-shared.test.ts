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
      protectSecret: vi.fn((value: string | undefined, aad: string) =>
        value ? `protected:${aad}:${value}` : null
      ),
      loadWasteDataSourceRecord: vi.fn(async () => null),
    };

    await expect(
      buildWasteManagementSettingsRecord(deps as never, 'demo', {
        provider: 'postgresql',
        schemaName: ' custom ',
        enabled: true,
        databaseUrl: ' postgres://waste.example/db ',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        instanceId: 'demo',
        provider: 'postgresql',
        schemaName: 'custom',
        enabled: true,
        databaseUrlConfigured: true,
        visibleStatus: 'unknown',
        databaseUrlCiphertext:
          'protected:iam.instance_waste_data_sources.database_url:demo:postgres://waste.example/db',
      })
    );
  });

  it('preserves stored secrets and check metadata when an update omits secret fields', async () => {
    const deps = {
      protectSecret: vi.fn((value: string | undefined, aad: string) =>
        value ? `protected:${aad}:${value}` : null
      ),
      loadWasteDataSourceRecord: vi.fn(async () => ({
        instanceId: 'demo',
        provider: 'postgresql',
        schemaName: 'public',
        enabled: true,
        databaseUrlConfigured: true,
        databaseUrlCiphertext: 'existing-db-cipher',
        visibleStatus: 'error',
        lastCheckedAt: '2026-05-09T10:00:00.000Z',
        lastCheckStatus: 'failed',
        lastCheckErrorCode: 'connection_refused',
        lastCheckErrorMessage: 'Host unreachable',
      })),
    };

    await expect(
      buildWasteManagementSettingsRecord(deps as never, 'demo', {
        provider: 'postgresql',
        enabled: true,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        schemaName: 'public',
        databaseUrlCiphertext: 'existing-db-cipher',
        visibleStatus: 'unknown',
        lastCheckedAt: '2026-05-09T10:00:00.000Z',
        lastCheckStatus: 'failed',
        lastCheckErrorCode: 'connection_refused',
        lastCheckErrorMessage: 'Host unreachable',
      })
    );
  });
});
