import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  listExternalInterfaceRecords: vi.fn(),
  loadExternalInterfaceRecordById: vi.fn(),
  loadDefaultExternalInterfaceRecord: vi.fn(),
  saveExternalInterfaceRecord: vi.fn(),
  deleteExternalInterfaceRecord: vi.fn(),
  protectField: vi.fn((value: string | undefined, aad: string) => (value ? `${aad}:${value}` : null)),
  revealField: vi.fn((value: string | null | undefined, aad: string) =>
    value && value.startsWith(`${aad}:`) ? value.slice(aad.length + 1) : undefined
  ),
}));

vi.mock('@sva/data-repositories/server', () => ({
  listExternalInterfaceRecords: state.listExternalInterfaceRecords,
  loadExternalInterfaceRecordById: state.loadExternalInterfaceRecordById,
  loadDefaultExternalInterfaceRecord: state.loadDefaultExternalInterfaceRecord,
  saveExternalInterfaceRecord: state.saveExternalInterfaceRecord,
  deleteExternalInterfaceRecord: state.deleteExternalInterfaceRecord,
}));

vi.mock('@sva/auth-runtime/server', () => ({
  protectField: state.protectField,
  revealField: state.revealField,
}));

describe('instance-interfaces-server', () => {
  beforeEach(() => {
    vi.resetModules();
    state.listExternalInterfaceRecords.mockReset();
    state.loadExternalInterfaceRecordById.mockReset();
    state.loadDefaultExternalInterfaceRecord.mockReset();
    state.saveExternalInterfaceRecord.mockReset();
    state.deleteExternalInterfaceRecord.mockReset();
    state.protectField.mockClear();
    state.revealField.mockClear();
  });

  it('reports custom interface storage as available and projects persisted registry rows', async () => {
    state.listExternalInterfaceRecords.mockResolvedValue([
      {
        id: 's3-1',
        instanceId: 'de-test',
        typeKey: 's3',
        ownerKind: 'host',
        ownerId: 'host',
        displayName: 'Uploads',
        alias: 'default',
        enabled: true,
        isDefault: true,
        category: 'object_storage',
        baseUrl: 'https://s3.example',
        authMode: 'access_key',
        publicConfig: {
          endpoint: 'https://s3.example',
          region: 'eu-central-1',
          bucket: 'uploads',
          accessKeyId: 'key-1',
          forcePathStyle: false,
        },
        secretConfigCiphertext: 'cipher',
        statusCheckKind: 's3',
        visibleStatus: 'ok',
        lastCheckedAt: '2026-05-12T08:00:00.000Z',
        createdAt: '2026-05-12T08:00:00.000Z',
        updatedAt: '2026-05-12T08:00:00.000Z',
      },
    ]);
    state.loadExternalInterfaceRecordById.mockResolvedValue(null);
    state.deleteExternalInterfaceRecord.mockResolvedValue(false);

    const {
      checkStoredInterfaceHealth,
      deleteStoredInterface,
      getStoredInterface,
      isCustomInterfaceStorageAvailable,
      listStoredInterfaces,
    } = await import('./instance-interfaces-server');

    expect(isCustomInterfaceStorageAvailable()).toBe(true);
    await expect(listStoredInterfaces('de-test')).resolves.toEqual([
      expect.objectContaining({
        id: 's3-1',
        type: 's3',
        name: 'Uploads',
        config: expect.objectContaining({
          endpoint: 'https://s3.example',
          bucket: 'uploads',
          accessKeyId: 'key-1',
        }),
      }),
    ]);
    await expect(getStoredInterface('de-test', 'missing')).resolves.toBeNull();
    await expect(deleteStoredInterface('de-test', 'missing')).resolves.toBe(false);

    const [entry] = await listStoredInterfaces('de-test');
    expect(checkStoredInterfaceHealth(entry!)).toEqual(
      expect.objectContaining({
        status: 'connected',
        checkedAt: '2026-05-12T08:00:00.000Z',
      })
    );
  });

  it('persists new s3 interfaces through the registry and encrypts secret JSON with stable AAD', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue(null);
    let savedRecord: Record<string, unknown> | null = null;
    state.saveExternalInterfaceRecord.mockImplementation(async (record: Record<string, unknown>) => {
      savedRecord = record;
    });
    state.loadExternalInterfaceRecordById.mockImplementation(async () => {
      if (!savedRecord) {
        return null;
      }

      return {
        ...savedRecord,
        createdAt: '2026-05-12T08:00:00.000Z',
        updatedAt: '2026-05-12T08:00:00.000Z',
      };
    });

    const { upsertStoredInterface } = await import('./instance-interfaces-server');

    await expect(
      upsertStoredInterface('de-test', {
        type: 's3',
        name: 'S3 Uploads',
        enabled: true,
        config: {
          endpoint: 'https://s3.example',
          region: 'eu-central-1',
          bucket: 'uploads',
          accessKeyId: 'key-1',
          secretAccessKey: 'secret-1',
          forcePathStyle: true,
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        type: 's3',
      })
    );

    const persisted = state.saveExternalInterfaceRecord.mock.calls[0]?.[0];
    expect(state.saveExternalInterfaceRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        typeKey: 's3',
        isDefault: true,
        publicConfig: expect.objectContaining({
          endpoint: 'https://s3.example',
          bucket: 'uploads',
        }),
        secretConfigCiphertext: expect.any(String),
      })
    );
    expect(persisted?.secretConfigCiphertext).toBe(
      `iam.instance_external_interfaces.secret_config:${persisted?.id}:{"secretAccessKey":"secret-1"}`
    );
    expect(persisted?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it('reuses persisted interface ids instead of generating a new uuid on updates', async () => {
    state.loadExternalInterfaceRecordById.mockResolvedValue({
      id: 'existing-interface-id',
      instanceId: 'de-test',
      typeKey: 's3',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Existing S3',
      alias: 'existing-s3',
      enabled: true,
      isDefault: true,
      category: 'object_storage',
      baseUrl: 'https://s3.example',
      authMode: 'access_key',
      publicConfig: {
        endpoint: 'https://s3.example',
        region: 'eu-central-1',
        bucket: 'uploads',
        accessKeyId: 'key-1',
        forcePathStyle: false,
      },
      secretConfigCiphertext: 'iam.instance_external_interfaces.secret_config:existing-interface-id:{"secretAccessKey":"secret-old"}',
      statusCheckKind: 's3',
      createdAt: '2026-05-12T08:00:00.000Z',
      updatedAt: '2026-05-12T08:00:00.000Z',
    });

    const { upsertStoredInterface } = await import('./instance-interfaces-server');

    await expect(
      upsertStoredInterface(
        'de-test',
        {
          type: 's3',
          name: 'Updated S3',
          enabled: true,
          config: {
            endpoint: 'https://s3.example',
            region: 'eu-central-1',
            bucket: 'uploads',
            accessKeyId: 'key-1',
            secretAccessKey: '',
            forcePathStyle: false,
          },
        },
        'existing-interface-id'
      )
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'existing-interface-id',
        type: 's3',
      })
    );

    const persisted = state.saveExternalInterfaceRecord.mock.calls[0]?.[0];
    expect(persisted?.id).toBe('existing-interface-id');
    expect(persisted?.secretConfigCiphertext).toBe(
      'iam.instance_external_interfaces.secret_config:existing-interface-id:{"secretAccessKey":"secret-old"}'
    );
  });

  it('fails closed when existing secrets can no longer be decrypted during updates', async () => {
    state.loadExternalInterfaceRecordById.mockResolvedValue({
      id: 'existing-interface-id',
      instanceId: 'de-test',
      typeKey: 's3',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Existing S3',
      alias: 'existing-s3',
      enabled: true,
      isDefault: true,
      category: 'object_storage',
      baseUrl: 'https://s3.example',
      authMode: 'access_key',
      publicConfig: {
        endpoint: 'https://s3.example',
        region: 'eu-central-1',
        bucket: 'uploads',
        accessKeyId: 'key-1',
        forcePathStyle: false,
      },
      secretConfigCiphertext: 'corrupted-ciphertext',
      statusCheckKind: 's3',
      createdAt: '2026-05-12T08:00:00.000Z',
      updatedAt: '2026-05-12T08:00:00.000Z',
    });
    state.revealField.mockReturnValue(undefined);

    const { upsertStoredInterface } = await import('./instance-interfaces-server');

    await expect(
      upsertStoredInterface(
        'de-test',
        {
          type: 's3',
          name: 'Updated S3',
          enabled: true,
          config: {
            endpoint: 'https://s3.example',
            region: 'eu-central-1',
            bucket: 'uploads',
            accessKeyId: 'key-1',
            secretAccessKey: '',
            forcePathStyle: false,
          },
        },
        'existing-interface-id'
      )
    ).rejects.toThrow('secret_unreadable');

    expect(state.saveExternalInterfaceRecord).not.toHaveBeenCalled();
  });

  it('rejects updates when the requested existing interface id no longer exists', async () => {
    state.loadExternalInterfaceRecordById.mockResolvedValue(null);
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue(null);

    const { upsertStoredInterface } = await import('./instance-interfaces-server');

    await expect(
      upsertStoredInterface(
        'de-test',
        {
          type: 's3',
          name: 'Updated S3',
          enabled: true,
          config: {
            endpoint: 'https://s3.example',
            region: 'eu-central-1',
            bucket: 'uploads',
            accessKeyId: 'key-1',
            secretAccessKey: 'secret-1',
            forcePathStyle: false,
          },
        },
        'missing-interface-id'
      )
    ).rejects.toThrow('interface_not_found');

    expect(state.saveExternalInterfaceRecord).not.toHaveBeenCalled();
  });

  it('rejects dedicated mainserver writes and missing records after persistence reload', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue(null);
    state.saveExternalInterfaceRecord.mockResolvedValue(undefined);
    state.loadExternalInterfaceRecordById.mockResolvedValue(null);

    const { upsertStoredInterface } = await import('./instance-interfaces-server');

    await expect(
      upsertStoredInterface('de-test', {
        type: 'mainserver',
        name: 'Mainserver',
        enabled: true,
        config: {
          graphqlBaseUrl: 'https://mainserver.example/graphql',
          oauthTokenUrl: 'https://mainserver.example/oauth/token',
        },
      })
    ).rejects.toThrow('mainserver_interfaces_use_dedicated_endpoint');

    await expect(
      upsertStoredInterface('de-test', {
        type: 's3',
        name: 'S3 Uploads',
        enabled: true,
        config: {
          endpoint: 'https://s3.example',
          region: 'eu-central-1',
          bucket: 'uploads',
          accessKeyId: 'key-1',
          secretAccessKey: 'secret-1',
          forcePathStyle: false,
        },
      })
    ).rejects.toThrow('interface_not_found');
  });

  it('derives deterministic health results for disabled, incomplete and unchecked entries', async () => {
    const { checkStoredInterfaceHealth } = await import('./instance-interfaces-server');

    const disabled = {
      id: 's3-1',
      instanceId: 'de-test',
      type: 's3',
      name: 'S3 Disabled',
      enabled: false,
      config: {
        endpoint: '',
        region: 'eu-central-1',
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
        forcePathStyle: false,
      },
      createdAt: '2026-05-12T08:00:00.000Z',
      updatedAt: '2026-05-12T08:00:00.000Z',
    } as const;
    const brokenSupabase = {
      id: 'supabase-1',
      instanceId: 'de-test',
      type: 'supabase',
      name: 'Supabase Broken',
      enabled: true,
      config: {
        projectUrl: '',
        schemaName: 'public',
        databaseUrl: '',
        serviceRoleKey: 'secret',
      },
      createdAt: '2026-05-12T08:00:00.000Z',
      updatedAt: '2026-05-12T08:00:00.000Z',
    } as const;
    const validS3 = {
      id: 's3-2',
      instanceId: 'de-test',
      type: 's3',
      name: 'S3 Ready',
      enabled: true,
      config: {
        endpoint: 'https://s3.example',
        region: 'eu-central-1',
        bucket: 'uploads',
        accessKeyId: 'key-1',
        forcePathStyle: false,
      },
      createdAt: '2026-05-12T08:00:00.000Z',
      updatedAt: '2026-05-12T08:00:00.000Z',
    } as const;

    expect(checkStoredInterfaceHealth(disabled).status).toBe('disabled');
    expect(checkStoredInterfaceHealth(brokenSupabase)).toEqual(
      expect.objectContaining({
        status: 'error',
        statusMessage: expect.stringContaining('Project URL erforderlich'),
      })
    );
    expect(checkStoredInterfaceHealth(validS3)).toEqual(
      expect.objectContaining({
        status: 'unknown',
        statusMessage: expect.stringContaining('noch nicht verfügbar'),
      })
    );
  });

  it('preserves persisted health metadata for disabled and visible-status-backed entries', async () => {
    const { checkStoredInterfaceHealth } = await import('./instance-interfaces-server');

    const disabledWithMetadata = {
      id: 's3-1',
      instanceId: 'de-test',
      type: 's3',
      name: 'S3 Disabled',
      enabled: false,
      config: {
        endpoint: 'https://s3.example',
        region: 'eu-central-1',
        bucket: 'uploads',
        accessKeyId: 'key-1',
        secretAccessKey: '',
        forcePathStyle: false,
      },
      visibleStatus: 'disabled',
      lastCheckedAt: '2026-05-12T08:00:00.000Z',
      lastCheckErrorCode: 'disabled_by_admin',
      lastCheckErrorMessage: 'Administrative Sperre',
      createdAt: '2026-05-12T08:00:00.000Z',
      updatedAt: '2026-05-12T08:00:00.000Z',
    } as const;
    const visibleStatusError = {
      id: 'supabase-1',
      instanceId: 'de-test',
      type: 'supabase',
      name: 'Supabase Broken',
      enabled: true,
      config: {
        projectUrl: 'https://project.supabase.co',
        schemaName: 'public',
        databaseUrl: '',
        serviceRoleKey: '',
      },
      visibleStatus: 'not_configured',
      lastCheckedAt: '2026-05-12T08:05:00.000Z',
      lastCheckErrorCode: 'not_configured',
      lastCheckErrorMessage: 'Secret fehlt',
      createdAt: '2026-05-12T08:05:00.000Z',
      updatedAt: '2026-05-12T08:05:00.000Z',
    } as const;

    expect(checkStoredInterfaceHealth(disabledWithMetadata)).toEqual(
      expect.objectContaining({
        status: 'disabled',
        errorCode: 'disabled_by_admin',
        statusMessage: 'Administrative Sperre',
      })
    );
    expect(checkStoredInterfaceHealth(visibleStatusError)).toEqual(
      expect.objectContaining({
        status: 'error',
        errorCode: 'not_configured',
        statusMessage: 'Secret fehlt',
      })
    );
  });
});
