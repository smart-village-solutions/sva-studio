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
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
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

vi.mock('@sva/server-runtime', () => ({
  buildExternalInterfaceSecretConfigAad: (interfaceId: string) =>
    `iam.instance_external_interfaces.secret_config:${interfaceId}`,
  createSdkLogger: () => state.logger,
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
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
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

  it('persists mail transport passwords in encrypted interface secrets and preserves them on blank updates', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue(null);
    let savedRecord: Record<string, unknown> | null = null;
    state.saveExternalInterfaceRecord.mockImplementation(async (record: Record<string, unknown>) => {
      savedRecord = record;
    });
    state.loadExternalInterfaceRecordById.mockImplementation(async (_instanceId: string, interfaceId: string) => {
      if (interfaceId === 'existing-mail-id') {
        return {
          id: 'existing-mail-id',
          instanceId: 'de-test',
          typeKey: 'mail_transport',
          ownerKind: 'host',
          ownerId: 'host',
          displayName: 'Bestehender Mail-Transport',
          alias: 'mail-1',
          enabled: true,
          isDefault: true,
          category: 'api',
          baseUrl: 'smtp.example.org',
          authMode: 'basic',
          publicConfig: {
            transportId: 'mail-1',
            transportType: 'smtp',
            securityMode: 'starttls',
            authMode: 'basic',
            host: 'smtp.example.org',
            port: 587,
            username: 'mailer',
          },
          secretConfigCiphertext:
            'iam.instance_external_interfaces.secret_config:existing-mail-id:{"password":"secret-old"}',
          statusCheckKind: 'mail_transport',
          visibleStatus: 'unknown',
          createdAt: '2026-05-12T08:00:00.000Z',
          updatedAt: '2026-05-12T08:00:00.000Z',
        };
      }
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

    await upsertStoredInterface('de-test', {
      type: 'mailTransport',
      name: 'Mail-Transport',
      enabled: true,
      config: {
        transportId: 'mail-1',
        host: 'smtp.example.org',
        port: '587',
        securityMode: 'starttls',
        authMode: 'basic',
        username: 'mailer',
        password: 'secret-new',
        defaultFromEmail: 'noreply@example.org',
        defaultFromName: 'Abfallservice',
        defaultReplyToEmail: 'service@example.org',
        maxBatchSize: '25',
        rateLimitPerMinute: '60',
      },
    });

    expect(state.saveExternalInterfaceRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        typeKey: 'mail_transport',
        publicConfig: expect.not.objectContaining({
          password: expect.anything(),
        }),
        secretConfigCiphertext: expect.any(String),
      })
    );
    const createdPersisted = state.saveExternalInterfaceRecord.mock.calls[0]?.[0];
    expect(createdPersisted?.secretConfigCiphertext).toBe(
      `iam.instance_external_interfaces.secret_config:${createdPersisted?.id}:{"password":"secret-new"}`
    );

    state.saveExternalInterfaceRecord.mockClear();
    await upsertStoredInterface(
      'de-test',
      {
        type: 'mailTransport',
        name: 'Mail-Transport',
        enabled: true,
        config: {
          transportId: 'mail-1',
          host: 'smtp.example.org',
          port: '587',
          securityMode: 'starttls',
          authMode: 'basic',
          username: 'mailer',
          password: '',
          defaultFromEmail: 'noreply@example.org',
          defaultFromName: 'Abfallservice',
          defaultReplyToEmail: 'service@example.org',
          maxBatchSize: '25',
          rateLimitPerMinute: '60',
        },
      },
      'existing-mail-id'
    );

    const updatedPersisted = state.saveExternalInterfaceRecord.mock.calls[0]?.[0];
    expect(updatedPersisted?.secretConfigCiphertext).toBe(
      'iam.instance_external_interfaces.secret_config:existing-mail-id:{"password":"secret-old"}'
    );
  });

  it('persists map geocoding interfaces with public runtime config and encrypted api keys', async () => {
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
        type: 'mapGeocoding',
        name: 'POI-Karte',
        enabled: true,
        config: {
          provider: 'geoapify',
          styleUrl: 'https://tiles.example/styles/poi',
          autocompleteEnabled: true,
          geocodeEnabled: true,
          reverseGeocodeEnabled: true,
          suggestEndpoint: 'https://host.example/suggest',
          geocodeEndpoint: 'https://host.example/geocode',
          reverseGeocodeEndpoint: 'https://host.example/reverse',
          requestTimeoutMs: '2500',
          rateLimitPerMinute: '90',
          killSwitchEnabled: false,
          apiKey: 'geoapify-key',
        },
      })
    ).resolves.toEqual(
      expect.objectContaining({
        type: 'mapGeocoding',
      })
    );

    expect(state.saveExternalInterfaceRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        typeKey: 'map_geocoding',
        category: 'api',
        authMode: 'api_key',
        statusCheckKind: 'map_geocoding',
        publicConfig: expect.objectContaining({
          provider: 'geoapify',
          styleUrl: 'https://tiles.example/styles/poi',
          suggestEndpoint: 'https://host.example/suggest',
          geocodeEndpoint: 'https://host.example/geocode',
          reverseGeocodeEndpoint: 'https://host.example/reverse',
          requestTimeoutMs: 2500,
          rateLimitPerMinute: 90,
          killSwitchEnabled: false,
        }),
        secretConfigCiphertext: expect.any(String),
      })
    );

    const persisted = state.saveExternalInterfaceRecord.mock.calls[0]?.[0];
    expect(persisted?.secretConfigCiphertext).toBe(
      `iam.instance_external_interfaces.secret_config:${persisted?.id}:{"apiKey":"geoapify-key"}`
    );
  });

  it('rejects incomplete runtime-usable map geocoding drafts before persistence', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue(null);

    const { upsertStoredInterface } = await import('./instance-interfaces-server');

    await expect(
      upsertStoredInterface('de-test', {
        type: 'mapGeocoding',
        name: 'Custom-Geocoding',
        enabled: true,
        config: {
          provider: 'custom',
          styleUrl: 'https://tiles.example/styles/poi',
          autocompleteEnabled: true,
          geocodeEnabled: false,
          reverseGeocodeEnabled: false,
          suggestEndpoint: '',
          geocodeEndpoint: '',
          reverseGeocodeEndpoint: '',
          requestTimeoutMs: '',
          rateLimitPerMinute: '',
          killSwitchEnabled: false,
          apiKey: '',
        },
      })
    ).rejects.toThrow('invalid_config');

    await expect(
      upsertStoredInterface('de-test', {
        type: 'mapGeocoding',
        name: 'Ungueltige Style-URL',
        enabled: true,
        config: {
          provider: 'geoapify',
          styleUrl: 'not-a-url',
          autocompleteEnabled: true,
          geocodeEnabled: true,
          reverseGeocodeEnabled: true,
          suggestEndpoint: '',
          geocodeEndpoint: '',
          reverseGeocodeEndpoint: '',
          requestTimeoutMs: '',
          rateLimitPerMinute: '',
          killSwitchEnabled: false,
          apiKey: 'geoapify-key',
        },
      })
    ).rejects.toThrow('invalid_config');

    await expect(
      upsertStoredInterface('de-test', {
        type: 'mapGeocoding',
        name: 'Geoapify-Geocoding',
        enabled: true,
        config: {
          provider: 'geoapify',
          styleUrl: 'https://tiles.example/styles/poi',
          autocompleteEnabled: true,
          geocodeEnabled: true,
          reverseGeocodeEnabled: true,
          suggestEndpoint: '',
          geocodeEndpoint: '',
          reverseGeocodeEndpoint: '',
          requestTimeoutMs: '',
          rateLimitPerMinute: '',
          killSwitchEnabled: false,
          apiKey: '',
        },
      })
    ).rejects.toThrow('invalid_config');

    expect(state.saveExternalInterfaceRecord).not.toHaveBeenCalled();
  });

  it('clears stale optional map geocoding fields when they are removed during updates', async () => {
    let savedRecord: Record<string, unknown> | null = null;
    state.saveExternalInterfaceRecord.mockImplementation(async (record: Record<string, unknown>) => {
      savedRecord = record;
    });
    state.loadExternalInterfaceRecordById.mockImplementation(async () => {
      if (savedRecord) {
        return {
          ...savedRecord,
          createdAt: '2026-05-12T08:00:00.000Z',
          updatedAt: '2026-05-12T08:00:00.000Z',
        };
      }

      return {
        id: 'existing-map-id',
        instanceId: 'de-test',
        typeKey: 'map_geocoding',
        ownerKind: 'host',
        ownerId: 'host',
        displayName: 'Bestehendes Karten-Geocoding',
        alias: 'existing-map-id',
        enabled: true,
        isDefault: true,
        category: 'api',
        baseUrl: 'https://host.example/suggest',
        authMode: 'api_key',
        publicConfig: {
          provider: 'custom',
          styleUrl: 'https://tiles.example/styles/poi',
          autocompleteEnabled: true,
          geocodeEnabled: true,
          reverseGeocodeEnabled: false,
          suggestEndpoint: 'https://host.example/suggest',
          geocodeEndpoint: 'https://host.example/geocode',
          reverseGeocodeEndpoint: 'https://host.example/reverse',
          requestTimeoutMs: 2500,
          rateLimitPerMinute: 90,
          killSwitchEnabled: false,
        },
        secretConfigCiphertext: 'iam.instance_external_interfaces.secret_config:existing-map-id:{\"apiKey\":\"geoapify-key\"}',
        statusCheckKind: 'map_geocoding',
        visibleStatus: 'ok',
        createdAt: '2026-05-12T08:00:00.000Z',
        updatedAt: '2026-05-12T08:00:00.000Z',
      };
    });

    const { upsertStoredInterface } = await import('./instance-interfaces-server');

    await upsertStoredInterface(
      'de-test',
      {
        type: 'mapGeocoding',
        name: 'Geoapify-Karte',
        enabled: true,
        config: {
          provider: 'geoapify',
          styleUrl: 'https://tiles.example/styles/poi',
          autocompleteEnabled: true,
          geocodeEnabled: true,
          reverseGeocodeEnabled: true,
          suggestEndpoint: '',
          geocodeEndpoint: '',
          reverseGeocodeEndpoint: '',
          requestTimeoutMs: '',
          rateLimitPerMinute: '',
          killSwitchEnabled: false,
          apiKey: '',
        },
      },
      'existing-map-id'
    );

    const persisted = state.saveExternalInterfaceRecord.mock.calls[0]?.[0] as { publicConfig: Record<string, unknown> } | undefined;
    expect(persisted?.publicConfig).toMatchObject({
      provider: 'geoapify',
      styleUrl: 'https://tiles.example/styles/poi',
      autocompleteEnabled: true,
      geocodeEnabled: true,
      reverseGeocodeEnabled: true,
      killSwitchEnabled: false,
    });
    expect(persisted?.publicConfig.suggestEndpoint).toBe('');
    expect(persisted?.publicConfig.geocodeEndpoint).toBe('');
    expect(persisted?.publicConfig.reverseGeocodeEndpoint).toBe('');
    expect(persisted?.publicConfig.requestTimeoutMs).toBeUndefined();
    expect(persisted?.publicConfig.rateLimitPerMinute).toBeUndefined();
  });

  it('rejects creating a second map geocoding interface while no default selector exists', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue({
      id: 'existing-map-id',
      instanceId: 'de-test',
      typeKey: 'map_geocoding',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Bestehende Karte',
      alias: 'existing-map-id',
      enabled: true,
      isDefault: true,
      category: 'api',
      baseUrl: 'https://tiles.example/styles/poi',
      authMode: 'api_key',
      publicConfig: {
        provider: 'geoapify',
        styleUrl: 'https://tiles.example/styles/poi',
        autocompleteEnabled: true,
        geocodeEnabled: true,
        reverseGeocodeEnabled: true,
        suggestEndpoint: '',
        geocodeEndpoint: '',
        reverseGeocodeEndpoint: '',
        killSwitchEnabled: false,
      },
      secretConfigCiphertext: 'iam.instance_external_interfaces.secret_config:existing-map-id:{\"apiKey\":\"geoapify-key\"}',
      statusCheckKind: 'map_geocoding',
      createdAt: '2026-05-12T08:00:00.000Z',
      updatedAt: '2026-05-12T08:00:00.000Z',
    });

    const { upsertStoredInterface } = await import('./instance-interfaces-server');

    await expect(
      upsertStoredInterface('de-test', {
        type: 'mapGeocoding',
        name: 'Neue Karte',
        enabled: true,
        config: {
          provider: 'geoapify',
          styleUrl: 'https://tiles.example/styles/poi-2',
          autocompleteEnabled: true,
          geocodeEnabled: true,
          reverseGeocodeEnabled: true,
          suggestEndpoint: '',
          geocodeEndpoint: '',
          reverseGeocodeEndpoint: '',
          requestTimeoutMs: '',
          rateLimitPerMinute: '',
          killSwitchEnabled: false,
          apiKey: 'geoapify-key',
        },
      })
    ).rejects.toThrow('invalid_config');

    expect(state.saveExternalInterfaceRecord).not.toHaveBeenCalled();
  });

  it('preserves waste-specific supabase public config fields on interface updates', async () => {
    state.loadExternalInterfaceRecordById.mockResolvedValue({
      id: 'existing-supabase-id',
      instanceId: 'de-test',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Existing Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      baseUrl: 'https://tenant.supabase.co',
      authMode: 'service_role',
      publicConfig: {
        projectUrl: 'https://tenant.supabase.co',
        schemaName: 'wm',
        holidayStateCode: 'NW',
        lastHolidaySyncStatus: 'success',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:existing-supabase-id:{"databaseUrl":"postgres://db","serviceRoleKey":"service-key"}',
      statusCheckKind: 'supabase',
      visibleStatus: 'ok',
      createdAt: '2026-05-12T08:00:00.000Z',
      updatedAt: '2026-05-12T08:00:00.000Z',
    });

    const { upsertStoredInterface } = await import('./instance-interfaces-server');

    await expect(
      upsertStoredInterface(
        'de-test',
        {
          type: 'supabase',
          name: 'Updated Supabase',
          enabled: true,
          config: {
            projectUrl: 'https://tenant.supabase.co',
            schemaName: 'wm',
            databaseUrl: '',
            serviceRoleKey: '',
          },
        },
        'existing-supabase-id'
      )
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'existing-supabase-id',
        type: 'supabase',
      })
    );

    expect(state.saveExternalInterfaceRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'existing-supabase-id',
        publicConfig: expect.objectContaining({
          projectUrl: 'https://tenant.supabase.co',
          schemaName: 'wm',
          holidayStateCode: 'NW',
          lastHolidaySyncStatus: 'success',
        }),
      })
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
    expect(state.logger.error).toHaveBeenCalledWith(
      'Failed to read stored external interface secrets',
      expect.objectContaining({
        operation: 'build_interface_record',
        workspace_id: 'de-test',
        interface_type: 's3',
        existing_interface_id: 'existing-interface-id',
        error_message: 'secret_unreadable',
      })
    );
  });

  it('rejects non-object decrypted secret payloads during updates', async () => {
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
    state.revealField.mockReturnValue('["secret-old"]');

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

  it('rejects deleting dedicated mainserver-backed records through the generic delete path', async () => {
    const { deleteStoredInterface } = await import('./instance-interfaces-server');

    await expect(deleteStoredInterface('de-test', 'sva-mainserver:de-test')).rejects.toThrow(
      'mainserver_interfaces_use_dedicated_endpoint'
    );

    expect(state.deleteExternalInterfaceRecord).not.toHaveBeenCalled();
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
    const missingSupabaseSecrets = {
      id: 'supabase-2',
      instanceId: 'de-test',
      type: 'supabase',
      name: 'Supabase Incomplete',
      enabled: true,
      config: {
        projectUrl: 'https://project.supabase.co',
        schemaName: 'public',
        databaseUrl: '',
        serviceRoleKey: '',
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
    expect(checkStoredInterfaceHealth(missingSupabaseSecrets)).toEqual(
      expect.objectContaining({
        status: 'error',
        statusMessage: expect.stringContaining('Direkte DB-URL erforderlich'),
      })
    );
    expect(checkStoredInterfaceHealth(validS3)).toEqual(
      expect.objectContaining({
        status: 'unknown',
        statusMessage: 'S3-Verbindungsprüfung ausstehend.',
      })
    );

    expect(
      checkStoredInterfaceHealth({
        id: 'map-1',
        instanceId: 'de-test',
        type: 'mapGeocoding',
        name: 'POI-Karte',
        enabled: true,
        config: {
          provider: 'geoapify',
          styleUrl: '',
          autocompleteEnabled: true,
          geocodeEnabled: true,
          reverseGeocodeEnabled: true,
          suggestEndpoint: '',
          geocodeEndpoint: '',
          reverseGeocodeEndpoint: '',
          requestTimeoutMs: '2500',
          rateLimitPerMinute: '90',
          killSwitchEnabled: false,
        },
        createdAt: '2026-05-12T08:00:00.000Z',
        updatedAt: '2026-05-12T08:00:00.000Z',
      })
    ).toEqual(
      expect.objectContaining({
        status: 'error',
        statusMessage: expect.stringContaining('Style-URL erforderlich'),
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

  it('rejects invalid mail transport drafts before persistence', async () => {
    state.loadDefaultExternalInterfaceRecord.mockResolvedValue(null);

    const { upsertStoredInterface } = await import('./instance-interfaces-server');

    await expect(
      upsertStoredInterface('de-test', {
        type: 'mailTransport',
        name: 'Mail-Transport',
        enabled: true,
        config: {
          transportId: 'mail-1',
          host: '',
          port: '587',
          securityMode: 'starttls',
          authMode: 'basic',
          username: 'mailer',
          password: 'secret',
          defaultFromEmail: '',
          defaultFromName: '',
          defaultReplyToEmail: '',
          maxBatchSize: '',
          rateLimitPerMinute: '',
        },
      })
    ).rejects.toThrow('invalid_config');

    await expect(
      upsertStoredInterface('de-test', {
        type: 'mailTransport',
        name: 'Mail-Transport',
        enabled: true,
        config: {
          transportId: 'mail-1',
          host: 'https://api.mail.example',
          port: '587',
          securityMode: 'starttls',
          authMode: 'basic',
          username: 'mailer',
          password: 'secret',
          defaultFromEmail: '',
          defaultFromName: '',
          defaultReplyToEmail: '',
          maxBatchSize: '',
          rateLimitPerMinute: '',
        },
      })
    ).rejects.toThrow('invalid_config');

    await expect(
      upsertStoredInterface('de-test', {
        type: 'mailTransport',
        name: 'Mail-Transport',
        enabled: true,
        config: {
          transportId: 'mail-1',
          host: '',
          port: '587',
          securityMode: 'starttls',
          authMode: 'basic',
          username: 'mailer',
          password: 'secret',
          defaultFromEmail: '',
          defaultFromName: '',
          defaultReplyToEmail: '',
          maxBatchSize: '',
          rateLimitPerMinute: '',
        },
      })
    ).rejects.toThrow('invalid_config');

    await expect(
      upsertStoredInterface('de-test', {
        type: 'mailTransport',
        name: 'Mail-Transport',
        enabled: true,
        config: {
          transportId: 'mail-1',
          host: 'smtp.example.org',
          port: '0',
          securityMode: 'starttls',
          authMode: 'basic',
          username: 'mailer',
          password: 'secret',
          defaultFromEmail: '',
          defaultFromName: '',
          defaultReplyToEmail: '',
          maxBatchSize: '',
          rateLimitPerMinute: '',
        },
      })
    ).rejects.toThrow('invalid_config');

    expect(state.saveExternalInterfaceRecord).not.toHaveBeenCalled();
  });

  it('maps stored mail transport rows and derives health for SMTP and legacy provider transports', async () => {
    state.listExternalInterfaceRecords.mockResolvedValue([
      {
        id: 'mail-provider-1',
        instanceId: 'de-test',
        typeKey: 'mail_transport',
        ownerKind: 'host',
        ownerId: 'host',
        displayName: 'Provider Mail',
        alias: 'provider-mail',
        enabled: true,
        isDefault: true,
        category: 'api',
        baseUrl: 'https://api.mail.example',
        authMode: 'oauth2',
        publicConfig: {
          transportId: 'provider-mail',
          transportType: 'provider_api',
          securityMode: 'invalid',
          authMode: 'invalid',
          endpoint: 'https://api.mail.example',
          mode: 'transactional',
          maxBatchSize: 50,
          rateLimitPerMinute: 120,
        },
        secretConfigCiphertext: 'cipher',
        statusCheckKind: 'mail_transport',
        createdAt: '2026-05-12T08:00:00.000Z',
        updatedAt: '2026-05-12T08:00:00.000Z',
      },
    ]);

    const { checkStoredInterfaceHealth, listStoredInterfaces } = await import('./instance-interfaces-server');

    await expect(listStoredInterfaces('de-test')).resolves.toEqual([
      expect.objectContaining({
        type: 'mailTransport',
        config: expect.objectContaining({
          host: 'https://api.mail.example',
          securityMode: 'starttls',
          authMode: 'basic',
          maxBatchSize: '50',
          rateLimitPerMinute: '120',
        }),
      }),
    ]);

    expect(
      checkStoredInterfaceHealth({
        id: 'mail-smtp-1',
        instanceId: 'de-test',
        type: 'mailTransport',
        name: 'SMTP',
        enabled: true,
        config: {
          transportId: '',
          host: '',
          port: '',
          securityMode: 'starttls',
          authMode: 'basic',
          username: 'mailer',
          defaultFromEmail: '',
          defaultFromName: '',
          defaultReplyToEmail: '',
          maxBatchSize: '',
          rateLimitPerMinute: '',
        },
        createdAt: '2026-05-12T08:00:00.000Z',
        updatedAt: '2026-05-12T08:00:00.000Z',
      })
    ).toEqual(
      expect.objectContaining({
        status: 'error',
        statusMessage: 'Mail-Transport unvollständig (Transport-ID erforderlich).',
      })
    );

    expect(
      checkStoredInterfaceHealth({
        id: 'mail-provider-2',
        instanceId: 'de-test',
        type: 'mailTransport',
        name: 'Legacy',
        enabled: true,
        config: {
          transportId: 'provider-mail',
          host: '',
          port: '',
          securityMode: 'starttls',
          authMode: 'basic',
          username: 'mailer',
          defaultFromEmail: '',
          defaultFromName: '',
          defaultReplyToEmail: '',
          maxBatchSize: '',
          rateLimitPerMinute: '',
        },
        createdAt: '2026-05-12T08:00:00.000Z',
        updatedAt: '2026-05-12T08:00:00.000Z',
      })
    ).toEqual(
      expect.objectContaining({
        status: 'error',
        statusMessage: 'Mail-Transport unvollständig (SMTP-Host und Port erforderlich).',
      })
    );

    expect(
      checkStoredInterfaceHealth({
        id: 'mail-provider-3',
        instanceId: 'de-test',
        type: 'mailTransport',
        name: 'Legacy',
        enabled: true,
        config: {
          transportId: 'provider-mail',
          host: 'https://api.mail.example',
          port: '443',
          securityMode: 'starttls',
          authMode: 'basic',
          username: '',
          defaultFromEmail: '',
          defaultFromName: '',
          defaultReplyToEmail: '',
          maxBatchSize: '',
          rateLimitPerMinute: '',
        },
        createdAt: '2026-05-12T08:00:00.000Z',
        updatedAt: '2026-05-12T08:00:00.000Z',
      })
    ).toEqual(
      expect.objectContaining({
        status: 'unknown',
        statusMessage: 'Statusprüfung für Mail-Transporte ist noch nicht verfügbar.',
      })
    );
  });

  it('clears stale optional mail transport fields and incompatible transport-specific fields on update', async () => {
    let savedRecord: Record<string, unknown> | null = null;
    state.saveExternalInterfaceRecord.mockImplementation(async (record: Record<string, unknown>) => {
      savedRecord = record;
    });
    state.loadExternalInterfaceRecordById.mockImplementation(async () => {
      if (savedRecord) {
        return {
          ...savedRecord,
          createdAt: '2026-05-12T08:00:00.000Z',
          updatedAt: '2026-05-12T08:00:00.000Z',
        };
      }

      return {
      id: 'existing-mail-id',
      instanceId: 'de-test',
      typeKey: 'mail_transport',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Bestehender Mail-Transport',
      alias: 'mail-1',
      enabled: true,
      isDefault: true,
      category: 'api',
      baseUrl: 'https://api.mail.example',
      authMode: 'basic',
      publicConfig: {
        transportId: 'mail-1',
        transportType: 'provider_api',
        securityMode: 'starttls',
        authMode: 'basic',
        endpoint: 'https://api.mail.example',
        mode: 'transactional',
        username: 'mailer',
        defaultFromEmail: 'noreply@example.org',
        defaultFromName: 'Abfallservice',
        defaultReplyToEmail: 'service@example.org',
        maxBatchSize: 25,
        rateLimitPerMinute: 60,
      },
      secretConfigCiphertext: undefined,
      statusCheckKind: 'mail_transport',
      visibleStatus: 'ok',
      createdAt: '2026-05-12T08:00:00.000Z',
      updatedAt: '2026-05-12T08:00:00.000Z',
    };
    });

    const { upsertStoredInterface } = await import('./instance-interfaces-server');

    await upsertStoredInterface(
      'de-test',
      {
        type: 'mailTransport',
        name: 'Mail-Transport',
        enabled: true,
        config: {
          transportId: 'mail-1',
          host: 'smtp.example.org',
          port: '587',
          securityMode: 'starttls',
          authMode: 'basic',
          username: 'mailer',
          password: 'secret-new',
          defaultFromEmail: '',
          defaultFromName: '',
          defaultReplyToEmail: '',
          maxBatchSize: '',
          rateLimitPerMinute: '',
        },
      },
      'existing-mail-id'
    );

    const persisted = state.saveExternalInterfaceRecord.mock.calls[0]?.[0] as { publicConfig: Record<string, unknown> } | undefined;
    expect(persisted?.publicConfig).toMatchObject({
      transportType: 'smtp',
      host: 'smtp.example.org',
      port: 587,
    });
    expect(persisted?.publicConfig.defaultFromEmail).toBeUndefined();
    expect(persisted?.publicConfig.defaultFromName).toBeUndefined();
    expect(persisted?.publicConfig.defaultReplyToEmail).toBeUndefined();
    expect(persisted?.publicConfig.maxBatchSize).toBeUndefined();
    expect(persisted?.publicConfig.rateLimitPerMinute).toBeUndefined();
    expect(persisted?.publicConfig.endpoint).toBeUndefined();
    expect(persisted?.publicConfig.mode).toBeUndefined();
  });
});
