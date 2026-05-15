import { describe, expect, it } from 'vitest';

import { buildExternalInterfaceSecretConfigAad } from '../external-interfaces.server.js';
import { WasteRuntimeError, resolveWasteDataSource, runWasteConnectionCheck } from './data-source.server.js';

describe('waste data source runtime', () => {
  it('resolves enabled waste data sources and reveals protected secrets with stable AADs', async () => {
    const revealCalls: Array<{ ciphertext: string | null | undefined; aad: string }> = [];

    await expect(
      resolveWasteDataSource({
        instanceId: 'tenant-a',
        loadDefaultInterface: async () => ({
          id: 'iface-1',
          instanceId: 'tenant-a',
          typeKey: 'supabase',
          ownerKind: 'host',
          ownerId: 'host',
          displayName: 'Waste Supabase',
          alias: 'default',
          enabled: true,
          isDefault: true,
          category: 'database',
          statusCheckKind: 'supabase',
          visibleStatus: 'unknown',
          publicConfig: {
            projectUrl: 'https://tenant-a.supabase.co',
            schemaName: 'public',
          },
          secretConfigCiphertext: 'db-cipher',
        }),
        revealSecret: (ciphertext, aad) => {
          revealCalls.push({ ciphertext, aad });
          return JSON.stringify({
            databaseUrl: 'postgres://db.example/waste',
            serviceRoleKey: 'service-role-key',
          });
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
      { ciphertext: 'db-cipher', aad: buildExternalInterfaceSecretConfigAad('iface-1') },
    ]);
  });

  it('fails closed when the datasource is missing, disabled, or unreadable', async () => {
    await expect(
      resolveWasteDataSource({
        instanceId: 'tenant-a',
        loadDefaultInterface: async () => null,
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
        loadDefaultInterface: async () => ({
          id: 'iface-1',
          instanceId: 'tenant-a',
          typeKey: 'supabase',
          ownerKind: 'host',
          ownerId: 'host',
          displayName: 'Waste Supabase',
          alias: 'default',
          enabled: false,
          isDefault: true,
          category: 'database',
          statusCheckKind: 'supabase',
          visibleStatus: 'unknown',
          publicConfig: {
            projectUrl: 'https://tenant-a.supabase.co',
            schemaName: 'public',
          },
          secretConfigCiphertext: 'db-cipher',
        }),
        revealSecret: () => 'revealed',
      })
    ).rejects.toMatchObject({
      code: 'disabled',
    });

    await expect(
      resolveWasteDataSource({
        instanceId: 'tenant-a',
        loadDefaultInterface: async () => ({
          id: 'iface-1',
          instanceId: 'tenant-a',
          typeKey: 'supabase',
          ownerKind: 'host',
          ownerId: 'host',
          displayName: 'Waste Supabase',
          alias: 'default',
          enabled: true,
          isDefault: true,
          category: 'database',
          statusCheckKind: 'supabase',
          visibleStatus: 'unknown',
          publicConfig: {
            projectUrl: 'https://tenant-a.supabase.co',
            schemaName: 'public',
          },
          secretConfigCiphertext: 'db-cipher',
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

  it('resolves the supabase interface registry as the only waste datasource source', async () => {
    const revealCalls: Array<{ ciphertext: string | null | undefined; aad: string }> = [];

    await expect(
      resolveWasteDataSource({
        instanceId: 'tenant-a',
        loadDefaultInterface: async () => ({
          id: 'iface-1',
          instanceId: 'tenant-a',
          typeKey: 'supabase',
          ownerKind: 'host',
          ownerId: 'host',
          displayName: 'Waste Supabase',
          alias: 'default',
          enabled: true,
          isDefault: true,
          category: 'database',
          baseUrl: 'https://tenant-a.supabase.co',
          authMode: 'service_role',
          statusCheckKind: 'supabase',
          visibleStatus: 'unknown',
          publicConfig: {
            projectUrl: 'https://tenant-a.supabase.co',
            schemaName: 'wm',
          },
          secretConfigCiphertext: 'interface-secret-cipher',
        }),
        revealSecret: (ciphertext, aad) => {
          revealCalls.push({ ciphertext, aad });
          if (ciphertext === 'interface-secret-cipher') {
            return JSON.stringify({
              databaseUrl: 'postgres://db.example/interface',
              serviceRoleKey: 'interface-service-role',
            });
          }
          return undefined;
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        projectUrl: 'https://tenant-a.supabase.co',
        schemaName: 'wm',
        databaseUrl: 'postgres://db.example/interface',
        serviceRoleKey: 'interface-service-role',
      })
    );

    expect(revealCalls).toEqual([
      {
        ciphertext: 'interface-secret-cipher',
        aad: buildExternalInterfaceSecretConfigAad('iface-1'),
      },
    ]);

    await expect(
      resolveWasteDataSource({
        instanceId: 'tenant-a',
        loadDefaultInterface: async () => null,
        revealSecret: () => undefined,
      })
    ).rejects.toMatchObject({
      code: 'not_configured',
      message: 'Für diese Instanz ist keine Waste-Supabase-Schnittstelle konfiguriert.',
    });
  });
});
