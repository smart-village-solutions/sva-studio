import { describe, expect, it } from 'vitest';

import {
  ExternalInterfaceRuntimeError,
  buildExternalInterfaceSecretConfigAad,
  resolveExternalInterface,
  runExternalInterfaceConnectionCheck,
  sanitizeExternalInterfaceRecord,
} from './external-interfaces.server.js';

describe('external interfaces runtime', () => {
  const baseRecord = {
    id: 'interface-1',
    instanceId: 'tenant-a',
    typeKey: 'supabase',
    ownerKind: 'host' as const,
    ownerId: 'host',
    displayName: 'Supabase',
    alias: 'default',
    enabled: true,
    isDefault: true,
    category: 'database' as const,
    statusCheckKind: 'supabase' as const,
    visibleStatus: 'unknown' as const,
    publicConfig: {
      projectUrl: 'https://tenant-a.supabase.co',
      schemaName: 'public',
    },
    secretConfigCiphertext: 'cipher-secret',
  };

  it('sanitizes persisted records without leaking ciphertexts', () => {
    expect(sanitizeExternalInterfaceRecord(baseRecord)).toEqual(
      expect.objectContaining({
        id: 'interface-1',
        typeKey: 'supabase',
        publicConfig: {
          projectUrl: 'https://tenant-a.supabase.co',
          schemaName: 'public',
        },
        secretConfigConfigured: {
          databaseUrl: true,
          serviceRoleKey: true,
        },
      })
    );
  });

  it('resolves interfaces by id, alias and default with stable secret AADs', async () => {
    const revealCalls: Array<{ ciphertext: string | null | undefined; aad: string }> = [];

    await expect(
      resolveExternalInterface({
        instanceId: 'tenant-a',
        typeKey: 'supabase',
        interfaceId: 'interface-1',
        loadById: async () => baseRecord,
        loadByAlias: async () => null,
        loadDefault: async () => null,
        revealSecret: (ciphertext, aad) => {
          revealCalls.push({ ciphertext, aad });
          return JSON.stringify({
            databaseUrl: 'postgres://db.example/supabase',
            serviceRoleKey: 'service-role-key',
          });
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'interface-1',
        typeKey: 'supabase',
        secretConfig: {
          databaseUrl: 'postgres://db.example/supabase',
          serviceRoleKey: 'service-role-key',
        },
      })
    );

    expect(revealCalls).toEqual([
      {
        ciphertext: 'cipher-secret',
        aad: buildExternalInterfaceSecretConfigAad('interface-1'),
      },
    ]);
  });

  it('fails closed when an interface is missing, disabled or unreadable', async () => {
    await expect(
      resolveExternalInterface({
        instanceId: 'tenant-a',
        typeKey: 's3',
        loadById: async () => null,
        loadByAlias: async () => null,
        loadDefault: async () => null,
        revealSecret: () => undefined,
      })
    ).rejects.toMatchObject({
      name: 'ExternalInterfaceRuntimeError',
      code: 'default_missing',
    });

    await expect(
      resolveExternalInterface({
        instanceId: 'tenant-a',
        typeKey: 's3',
        interfaceId: 'interface-1',
        loadById: async () => ({
          ...baseRecord,
          typeKey: 's3',
          category: 'object_storage',
          statusCheckKind: 's3',
          enabled: false,
        }),
        loadByAlias: async () => null,
        loadDefault: async () => null,
        revealSecret: () => undefined,
      })
    ).rejects.toMatchObject({
      code: 'disabled',
    });

    await expect(
      resolveExternalInterface({
        instanceId: 'tenant-a',
        typeKey: 's3',
        interfaceId: 'interface-1',
        loadById: async () => ({
          ...baseRecord,
          typeKey: 's3',
          category: 'object_storage',
          statusCheckKind: 's3',
        }),
        loadByAlias: async () => null,
        loadDefault: async () => null,
        revealSecret: () => undefined,
      })
    ).rejects.toMatchObject({
      code: 'secret_unreadable',
      retryable: true,
    });
  });

  it('maps successful and failed connection checks into central technical status records', async () => {
    const resolved = {
      ...baseRecord,
      secretConfig: {
        databaseUrl: 'postgres://db.example/supabase',
        serviceRoleKey: 'service-role-key',
      },
    };

    await expect(
      runExternalInterfaceConnectionCheck({
        resolvedInterface: resolved,
        now: () => '2026-05-12T12:00:00.000Z',
        probe: async () => undefined,
      })
    ).resolves.toEqual({
      instanceId: 'tenant-a',
      interfaceId: 'interface-1',
      checkedAt: '2026-05-12T12:00:00.000Z',
      checkStatus: 'succeeded',
      visibleStatus: 'ok',
    });

    await expect(
      runExternalInterfaceConnectionCheck({
        resolvedInterface: resolved,
        now: () => '2026-05-12T12:05:00.000Z',
        probe: async () => {
          throw new ExternalInterfaceRuntimeError({
            code: 'connection_failed',
            instanceId: 'tenant-a',
            typeKey: 'supabase',
            message: 'DB handshake failed',
            retryable: true,
          });
        },
      })
    ).resolves.toEqual({
      instanceId: 'tenant-a',
      interfaceId: 'interface-1',
      checkedAt: '2026-05-12T12:05:00.000Z',
      checkStatus: 'failed',
      visibleStatus: 'error',
      errorCode: 'connection_failed',
      errorMessage: 'DB handshake failed',
    });
  });
});
