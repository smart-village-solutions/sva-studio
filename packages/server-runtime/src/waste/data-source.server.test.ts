import { describe, expect, it } from 'vitest';

import {
  WasteRuntimeError,
  buildWasteDatabaseUrlAad,
  buildWasteServiceRoleKeyAad,
  resolveWasteDataSource,
  runWasteConnectionCheck,
} from './data-source.server.js';

describe('waste data source runtime', () => {
  it('resolves enabled waste data sources and reveals protected secrets with stable AADs', async () => {
    const revealCalls: Array<{ ciphertext: string | null | undefined; aad: string }> = [];

    await expect(
      resolveWasteDataSource({
        instanceId: 'tenant-a',
        loadRecord: async () => ({
          instanceId: 'tenant-a',
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'public',
          enabled: true,
          databaseUrlConfigured: true,
          serviceRoleKeyConfigured: true,
          databaseUrlCiphertext: 'db-cipher',
          serviceRoleKeyCiphertext: 'service-cipher',
          visibleStatus: 'unknown',
        }),
        revealSecret: (ciphertext, aad) => {
          revealCalls.push({ ciphertext, aad });
          return ciphertext === 'db-cipher' ? 'postgres://db.example/waste' : 'service-role-key';
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        instanceId: 'tenant-a',
        provider: 'supabase',
        databaseUrl: 'postgres://db.example/waste',
        serviceRoleKey: 'service-role-key',
      })
    );

    expect(revealCalls).toEqual([
      { ciphertext: 'db-cipher', aad: buildWasteDatabaseUrlAad('tenant-a') },
      { ciphertext: 'service-cipher', aad: buildWasteServiceRoleKeyAad('tenant-a') },
    ]);
  });

  it('fails closed when the datasource is missing, disabled, or unreadable', async () => {
    await expect(
      resolveWasteDataSource({
        instanceId: 'tenant-a',
        loadRecord: async () => null,
        revealSecret: () => undefined,
      })
    ).rejects.toMatchObject({
      name: 'WasteRuntimeError',
      code: 'not_configured',
      instanceId: 'tenant-a',
    });

    await expect(
      resolveWasteDataSource({
        instanceId: 'tenant-a',
        loadRecord: async () => ({
          instanceId: 'tenant-a',
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'public',
          enabled: false,
          databaseUrlConfigured: true,
          serviceRoleKeyConfigured: true,
          databaseUrlCiphertext: 'db-cipher',
          serviceRoleKeyCiphertext: 'service-cipher',
          visibleStatus: 'unknown',
        }),
        revealSecret: () => 'revealed',
      })
    ).rejects.toMatchObject({
      code: 'disabled',
    });

    await expect(
      resolveWasteDataSource({
        instanceId: 'tenant-a',
        loadRecord: async () => ({
          instanceId: 'tenant-a',
          provider: 'supabase',
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'public',
          enabled: true,
          databaseUrlConfigured: true,
          serviceRoleKeyConfigured: true,
          databaseUrlCiphertext: 'db-cipher',
          serviceRoleKeyCiphertext: 'service-cipher',
          visibleStatus: 'unknown',
        }),
        revealSecret: () => undefined,
      })
    ).rejects.toMatchObject({
      code: 'database_url_unreadable',
      retryable: true,
    });
  });

  it('maps successful and failed connection checks into central technical status records', async () => {
    const dataSource = {
      instanceId: 'tenant-a',
      provider: 'supabase' as const,
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'public',
      enabled: true,
      databaseUrl: 'postgres://db.example/waste',
      serviceRoleKey: 'service-role-key',
      visibleStatus: 'unknown' as const,
    };

    await expect(
      runWasteConnectionCheck({
        dataSource,
        now: () => '2026-05-09T18:00:00.000Z',
        probe: async () => undefined,
      })
    ).resolves.toEqual({
      instanceId: 'tenant-a',
      checkedAt: '2026-05-09T18:00:00.000Z',
      checkStatus: 'succeeded',
      visibleStatus: 'ok',
    });

    await expect(
      runWasteConnectionCheck({
        dataSource,
        now: () => '2026-05-09T18:05:00.000Z',
        probe: async () => {
          throw new WasteRuntimeError({
            code: 'connection_failed',
            instanceId: 'tenant-a',
            message: 'DB handshake failed',
            retryable: true,
          });
        },
      })
    ).resolves.toEqual({
      instanceId: 'tenant-a',
      checkedAt: '2026-05-09T18:05:00.000Z',
      checkStatus: 'failed',
      visibleStatus: 'error',
      errorCode: 'connection_failed',
      errorMessage: 'DB handshake failed',
    });
  });
});
