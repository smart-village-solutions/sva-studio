import { describe, expect, it } from 'vitest';

import { buildExternalInterfaceSecretConfigAad } from '../external-interfaces.server.js';
import {
  WasteRuntimeError,
  resolveWasteDataSource,
  runWasteConnectionCheck,
} from './data-source.server.js';

describe('waste data source runtime', () => {
  it('resolves enabled waste data sources and reveals protected secrets with stable AADs', async () => {
    const revealCalls: Array<{ ciphertext: string | null | undefined; aad: string }> = [];

    await expect(
      resolveWasteDataSource({
        instanceId: 'tenant-a',
        loadDefaultInterface: async () => ({
          id: 'iface-1',
          instanceId: 'tenant-a',
          typeKey: 'postgresql',
          ownerKind: 'host',
          ownerId: 'host',
          displayName: 'Waste PostgreSQL',
          alias: 'default',
          enabled: true,
          isDefault: true,
          category: 'database',
          statusCheckKind: 'postgresql',
          visibleStatus: 'unknown',
          publicConfig: {
            schemaName: 'public',
          },
          secretConfigCiphertext: 'db-cipher',
        }),
        revealSecret: (ciphertext, aad) => {
          revealCalls.push({ ciphertext, aad });
          return JSON.stringify({
            databaseUrl: 'postgres://db.example/waste',
          });
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        instanceId: 'tenant-a',
        provider: 'postgresql',
        databaseUrl: 'postgres://db.example/waste',
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
          typeKey: 'postgresql',
          ownerKind: 'host',
          ownerId: 'host',
          displayName: 'Waste PostgreSQL',
          alias: 'default',
          enabled: false,
          isDefault: true,
          category: 'database',
          statusCheckKind: 'postgresql',
          visibleStatus: 'unknown',
          publicConfig: {
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
          typeKey: 'postgresql',
          ownerKind: 'host',
          ownerId: 'host',
          displayName: 'Waste PostgreSQL',
          alias: 'default',
          enabled: true,
          isDefault: true,
          category: 'database',
          statusCheckKind: 'postgresql',
          visibleStatus: 'unknown',
          publicConfig: {
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

  it('keeps plugin-managed data sources closed until tenant provisioning is ready', async () => {
    const managedInterface = {
      id: 'waste-management:tenant-a',
      instanceId: 'tenant-a',
      typeKey: 'postgresql' as const,
      ownerKind: 'plugin' as const,
      ownerId: 'waste-management',
      displayName: 'Waste PostgreSQL',
      alias: 'waste-management',
      enabled: true,
      isDefault: true,
      category: 'database' as const,
      statusCheckKind: 'postgresql' as const,
      visibleStatus: 'ok' as const,
      publicConfig: { schemaName: 'public' },
      secretConfigCiphertext: 'db-cipher',
    };

    await expect(
      resolveWasteDataSource({
        instanceId: 'tenant-a',
        loadDefaultInterface: async () => managedInterface,
        loadProvisioning: async () => ({
          instanceId: 'tenant-a',
          status: 'failed',
          desiredGeneration: 1,
          completedGeneration: 0,
          requestedAt: '2026-08-02T08:00:00.000Z',
          updatedAt: '2026-08-02T08:05:00.000Z',
        }),
        revealSecret: () => JSON.stringify({ databaseUrl: 'postgres://db.example/waste' }),
      })
    ).rejects.toMatchObject({ code: 'provisioning_not_ready', retryable: true });

    await expect(
      resolveWasteDataSource({
        instanceId: 'tenant-a',
        loadDefaultInterface: async () => managedInterface,
        loadProvisioning: async () => ({
          instanceId: 'tenant-a',
          status: 'ready',
          desiredGeneration: 1,
          completedGeneration: 1,
          requestedAt: '2026-08-02T08:00:00.000Z',
          completedAt: '2026-08-02T08:05:00.000Z',
          updatedAt: '2026-08-02T08:05:00.000Z',
        }),
        revealSecret: () => JSON.stringify({ databaseUrl: 'postgres://db.example/waste' }),
      })
    ).resolves.toMatchObject({ databaseUrl: 'postgres://db.example/waste' });
  });

  it('maps successful and failed connection checks into central technical status records', async () => {
    const dataSource = {
      instanceId: 'tenant-a',
      provider: 'postgresql' as const,
      schemaName: 'public',
      enabled: true,
      databaseUrl: 'postgres://db.example/waste',
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

  it('uses the current time for waste connection checks when no clock is injected', async () => {
    const dataSource = {
      instanceId: 'tenant-a',
      provider: 'postgresql' as const,
      schemaName: 'public',
      enabled: true,
      databaseUrl: 'postgres://db.example/waste',
      visibleStatus: 'unknown' as const,
    };

    await expect(
      runWasteConnectionCheck({
        dataSource,
        probe: async () => undefined,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        instanceId: 'tenant-a',
        checkStatus: 'succeeded',
        visibleStatus: 'ok',
        checkedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      })
    );
  });

  it('resolves the PostgreSQL interface registry as the only waste datasource source', async () => {
    const revealCalls: Array<{ ciphertext: string | null | undefined; aad: string }> = [];

    await expect(
      resolveWasteDataSource({
        instanceId: 'tenant-a',
        loadDefaultInterface: async () => ({
          id: 'iface-1',
          instanceId: 'tenant-a',
          typeKey: 'postgresql',
          ownerKind: 'host',
          ownerId: 'host',
          displayName: 'Waste PostgreSQL',
          alias: 'default',
          enabled: true,
          isDefault: true,
          category: 'database',
          authMode: 'database_credentials',
          statusCheckKind: 'postgresql',
          visibleStatus: 'unknown',
          publicConfig: {
            schemaName: 'wm',
          },
          secretConfigCiphertext: 'interface-secret-cipher',
        }),
        revealSecret: (ciphertext, aad) => {
          revealCalls.push({ ciphertext, aad });
          if (ciphertext === 'interface-secret-cipher') {
            return JSON.stringify({
              databaseUrl: 'postgres://db.example/interface',
            });
          }
          return undefined;
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        provider: 'postgresql',
        schemaName: 'wm',
        databaseUrl: 'postgres://db.example/interface',
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
      message: 'Für diese Instanz ist keine Waste-PostgreSQL-Schnittstelle konfiguriert.',
    });
  });
});
