import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  loadExternalInterfaceRecordById: vi.fn(),
  saveExternalInterfaceConnectionCheck: vi.fn(),
  revealField: vi.fn((value: string | null | undefined, aad: string) =>
    value && value.startsWith(`${aad}:`) ? value.slice(aad.length + 1) : undefined
  ),
  poolQuery: vi.fn(),
  poolEnd: vi.fn(async () => undefined),
  fetch: vi.fn(),
  s3Send: vi.fn(),
}));

vi.mock('@sva/data-repositories/server', () => ({
  loadExternalInterfaceRecordById: state.loadExternalInterfaceRecordById,
  saveExternalInterfaceConnectionCheck: state.saveExternalInterfaceConnectionCheck,
}));

vi.mock('@sva/auth-runtime/server', () => ({
  revealField: state.revealField,
}));

vi.mock('pg', () => ({
  Pool: vi.fn(function MockPool() {
    return {
      query: state.poolQuery,
      end: state.poolEnd,
    };
  }),
}));

vi.mock('@aws-sdk/client-s3', () => ({
  HeadBucketCommand: class HeadBucketCommand {
    readonly input: unknown;

    constructor(input: unknown) {
      this.input = input;
    }
  },
  S3Client: class S3Client {
    async send(command: unknown) {
      return state.s3Send(command);
    }
  },
}));

describe('instance-interface-healthcheck.server', () => {
  beforeEach(() => {
    vi.resetModules();
    state.loadExternalInterfaceRecordById.mockReset();
    state.saveExternalInterfaceConnectionCheck.mockReset();
    state.revealField.mockClear();
    state.poolQuery.mockReset();
    state.poolEnd.mockClear();
    state.fetch.mockReset();
    state.s3Send.mockReset();
    vi.stubGlobal('fetch', state.fetch);
  });

  it('persists a failed connection check when the database rejects credentials', async () => {
    state.loadExternalInterfaceRecordById.mockResolvedValue({
      id: 'supabase-1',
      instanceId: 'de-test',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Waste Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      baseUrl: 'https://tenant.supabase.co',
      authMode: 'service_role',
      statusCheckKind: 'supabase',
      visibleStatus: 'unknown',
      publicConfig: {
        projectUrl: 'https://tenant.supabase.co',
        schemaName: 'wm',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:supabase-1:{"databaseUrl":"postgres://db.example/wm","serviceRoleKey":"service-role-key"}',
    });
    state.poolQuery.mockRejectedValue(Object.assign(new Error('password authentication failed'), { code: '28P01' }));

    const { runStoredInterfaceHealthcheck } = await import('./instance-interface-healthcheck.server.js');

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'supabase-1',
        now: () => '2026-05-13T10:00:00.000Z',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        visibleStatus: 'error',
        errorCode: 'database_auth_failed',
      })
    );

    expect(state.saveExternalInterfaceConnectionCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceId: 'de-test',
        interfaceId: 'supabase-1',
        checkStatus: 'failed',
        visibleStatus: 'error',
        errorCode: 'database_auth_failed',
      })
    );
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it('uses the provided Date timestamp when the local healthcheck wrapper catches an error', async () => {
    state.loadExternalInterfaceRecordById.mockResolvedValue({
      id: 'supabase-1',
      instanceId: 'de-test',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Waste Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      baseUrl: 'https://tenant.supabase.co',
      authMode: 'service_role',
      statusCheckKind: 'supabase',
      visibleStatus: 'unknown',
      publicConfig: {
        projectUrl: 'https://tenant.supabase.co',
        schemaName: 'wm',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:supabase-1:{"databaseUrl":"postgres://db.example/wm","serviceRoleKey":"service-role-key"}',
    });
    state.revealField.mockImplementationOnce(() => {
      throw new Error('decrypt failed');
    });

    const { runStoredInterfaceHealthcheck } = await import('./instance-interface-healthcheck.server.js');

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'supabase-1',
        now: () => new Date('2026-05-13T10:00:00.000Z'),
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        checkedAt: '2026-05-13T10:00:00.000Z',
        errorCode: 'connection_failed',
      })
    );
  });

  it('persists a failed connection check when the configured schema is missing', async () => {
    state.loadExternalInterfaceRecordById.mockResolvedValue({
      id: 'supabase-1',
      instanceId: 'de-test',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Waste Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      baseUrl: 'https://tenant.supabase.co',
      authMode: 'service_role',
      statusCheckKind: 'supabase',
      visibleStatus: 'unknown',
      publicConfig: {
        projectUrl: 'https://tenant.supabase.co',
        schemaName: 'wm',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:supabase-1:{"databaseUrl":"postgres://db.example/wm","serviceRoleKey":"service-role-key"}',
    });
    state.poolQuery.mockResolvedValue({ rows: [{ schema_exists: false }] });

    const { runStoredInterfaceHealthcheck } = await import('./instance-interface-healthcheck.server.js');

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'supabase-1',
        now: () => '2026-05-13T10:00:00.000Z',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        visibleStatus: 'error',
        errorCode: 'schema_missing',
      })
    );

    expect(state.fetch).not.toHaveBeenCalled();
  });

  it('persists a failed connection check when the service role key is rejected by Supabase', async () => {
    state.loadExternalInterfaceRecordById.mockResolvedValue({
      id: 'supabase-1',
      instanceId: 'de-test',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Waste Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      baseUrl: 'https://tenant.supabase.co',
      authMode: 'service_role',
      statusCheckKind: 'supabase',
      visibleStatus: 'unknown',
      publicConfig: {
        projectUrl: 'https://tenant.supabase.co',
        schemaName: 'wm',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:supabase-1:{"databaseUrl":"postgres://db.example/wm","serviceRoleKey":"service-role-key"}',
    });
    state.poolQuery.mockResolvedValue({ rows: [{ schema_exists: true }] });
    state.fetch.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Invalid API key' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
    );

    const { runStoredInterfaceHealthcheck } = await import('./instance-interface-healthcheck.server.js');

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'supabase-1',
        now: () => '2026-05-13T10:00:00.000Z',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        visibleStatus: 'error',
        errorCode: 'service_role_key_invalid',
      })
    );
  });

  it('persists supabase validation failures for missing db urls, invalid project urls, api status errors, and unreachable hosts', async () => {
    const { runStoredInterfaceHealthcheck } = await import('./instance-interface-healthcheck.server.js');

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 'supabase-missing-db-url',
      instanceId: 'de-test',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Waste Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      baseUrl: 'https://tenant.supabase.co',
      authMode: 'service_role',
      statusCheckKind: 'supabase',
      visibleStatus: 'unknown',
      publicConfig: {
        projectUrl: 'https://tenant.supabase.co',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:supabase-missing-db-url:{"serviceRoleKey":"service-role-key"}',
    });

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'supabase-missing-db-url',
        now: () => new Date('2026-05-13T10:00:00.000Z'),
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        errorCode: 'database_url_missing',
      })
    );

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 'supabase-invalid-project-url',
      instanceId: 'de-test',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Waste Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      baseUrl: 'https://tenant.supabase.co',
      authMode: 'service_role',
      statusCheckKind: 'supabase',
      visibleStatus: 'unknown',
      publicConfig: {
        projectUrl: 'http://tenant.example.invalid',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:supabase-invalid-project-url:{"databaseUrl":"postgres://db.example/wm","serviceRoleKey":"service-role-key"}',
    });
    state.poolQuery.mockResolvedValueOnce({ rows: [{ schema_exists: true }] });

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'supabase-invalid-project-url',
        now: () => '2026-05-13T10:00:00.000Z',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        errorCode: 'project_url_invalid',
      })
    );

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 'supabase-api-500',
      instanceId: 'de-test',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Waste Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      baseUrl: 'https://tenant.supabase.co',
      authMode: 'service_role',
      statusCheckKind: 'supabase',
      visibleStatus: 'unknown',
      publicConfig: {
        projectUrl: 'https://tenant.supabase.co',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:supabase-api-500:{"databaseUrl":"postgres://db.example/wm","serviceRoleKey":"service-role-key"}',
    });
    state.poolQuery.mockResolvedValueOnce({ rows: [{ schema_exists: true }] });
    state.fetch.mockResolvedValueOnce(new Response('boom', { status: 500 }));

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'supabase-api-500',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        errorCode: 'connection_failed',
      })
    );

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 'supabase-host-down',
      instanceId: 'de-test',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Waste Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      baseUrl: 'https://tenant.supabase.co',
      authMode: 'service_role',
      statusCheckKind: 'supabase',
      visibleStatus: 'unknown',
      publicConfig: {
        projectUrl: 'https://tenant.supabase.co',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:supabase-host-down:{"databaseUrl":"postgres://db.example/wm","serviceRoleKey":"service-role-key"}',
    });
    state.poolQuery.mockRejectedValueOnce(Object.assign(new Error('connect timed out'), { code: 'ETIMEDOUT' }));

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'supabase-host-down',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        errorCode: 'database_host_unreachable',
      })
    );

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 'supabase-empty-project-url',
      instanceId: 'de-test',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Waste Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      baseUrl: 'https://tenant.supabase.co',
      authMode: 'service_role',
      statusCheckKind: 'supabase',
      visibleStatus: 'unknown',
      publicConfig: {
        projectUrl: '',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:supabase-empty-project-url:{"databaseUrl":"postgres://db.example/wm","serviceRoleKey":"service-role-key"}',
    });
    state.poolQuery.mockResolvedValueOnce({ rows: [{ schema_exists: true }] });

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'supabase-empty-project-url',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        errorCode: 'project_url_invalid',
      })
    );

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 'supabase-generic-db-error',
      instanceId: 'de-test',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Waste Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      baseUrl: 'https://tenant.supabase.co',
      authMode: 'service_role',
      statusCheckKind: 'supabase',
      visibleStatus: 'unknown',
      publicConfig: {
        projectUrl: 'https://tenant.supabase.co',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:supabase-generic-db-error:{"databaseUrl":"postgres://db.example/wm","serviceRoleKey":"service-role-key"}',
    });
    state.poolQuery.mockRejectedValueOnce(new Error('generic database probe failure'));

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'supabase-generic-db-error',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        errorCode: 'connection_failed',
      })
    );
  });

  it('persists a successful connection check for an s3 interface', async () => {
    state.loadExternalInterfaceRecordById.mockResolvedValue({
      id: 's3-1',
      instanceId: 'de-test',
      typeKey: 's3',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Media S3',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'object_storage',
      baseUrl: 'https://s3.example',
      authMode: 'access_key',
      statusCheckKind: 's3',
      visibleStatus: 'unknown',
      publicConfig: {
        endpoint: 'https://s3.example',
        region: 'eu-central-1',
        bucket: 'media',
        accessKeyId: 'key-1',
        forcePathStyle: true,
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:s3-1:{"secretAccessKey":"secret-1"}',
    });
    state.s3Send.mockResolvedValue({});

    const { runStoredInterfaceHealthcheck } = await import('./instance-interface-healthcheck.server.js');

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 's3-1',
        now: () => '2026-05-13T10:00:00.000Z',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'succeeded',
        visibleStatus: 'ok',
      })
    );
  });

  it('persists a failed connection check when an s3 bucket is missing', async () => {
    state.loadExternalInterfaceRecordById.mockResolvedValue({
      id: 's3-1',
      instanceId: 'de-test',
      typeKey: 's3',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Media S3',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'object_storage',
      baseUrl: 'https://s3.example',
      authMode: 'access_key',
      statusCheckKind: 's3',
      visibleStatus: 'unknown',
      publicConfig: {
        endpoint: 'https://s3.example',
        region: 'eu-central-1',
        bucket: 'missing-bucket',
        accessKeyId: 'key-1',
        forcePathStyle: true,
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:s3-1:{"secretAccessKey":"secret-1"}',
    });
    state.s3Send.mockRejectedValue(Object.assign(new Error('NotFound'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } }));

    const { runStoredInterfaceHealthcheck } = await import('./instance-interface-healthcheck.server.js');

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 's3-1',
        now: () => '2026-05-13T10:00:00.000Z',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        visibleStatus: 'error',
        errorCode: 'bucket_missing',
      })
    );
  });

  it('persists a failed connection check when s3 credentials are rejected', async () => {
    state.loadExternalInterfaceRecordById.mockResolvedValue({
      id: 's3-1',
      instanceId: 'de-test',
      typeKey: 's3',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Media S3',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'object_storage',
      baseUrl: 'https://s3.example',
      authMode: 'access_key',
      statusCheckKind: 's3',
      visibleStatus: 'unknown',
      publicConfig: {
        endpoint: 'https://s3.example',
        region: 'eu-central-1',
        bucket: 'media',
        accessKeyId: 'key-1',
        forcePathStyle: true,
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:s3-1:{"secretAccessKey":"secret-1"}',
    });
    state.s3Send.mockRejectedValue(
      Object.assign(new Error('SignatureDoesNotMatch'), { name: 'SignatureDoesNotMatch', $metadata: { httpStatusCode: 403 } })
    );

    const { runStoredInterfaceHealthcheck } = await import('./instance-interface-healthcheck.server.js');

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 's3-1',
        now: () => '2026-05-13T10:00:00.000Z',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        visibleStatus: 'error',
        errorCode: 's3_auth_failed',
      })
    );
  });

  it('returns null for missing or unsupported stored interfaces', async () => {
    state.loadExternalInterfaceRecordById.mockResolvedValueOnce(null);

    const { runStoredInterfaceHealthcheck } = await import('./instance-interface-healthcheck.server.js');

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'missing',
      })
    ).resolves.toBeNull();

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 'custom-1',
      instanceId: 'de-test',
      typeKey: 'custom',
    });

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'custom-1',
      })
    ).resolves.toBeNull();
  });

  it('persists a not-configured check when supabase secrets are missing and maps api transport failures', async () => {
    const { runStoredInterfaceHealthcheck } = await import('./instance-interface-healthcheck.server.js');

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 'supabase-missing-secret',
      instanceId: 'de-test',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Waste Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      baseUrl: 'https://tenant.supabase.co',
      authMode: 'service_role',
      statusCheckKind: 'supabase',
      visibleStatus: 'unknown',
      publicConfig: {
        projectUrl: 'https://tenant.supabase.co',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:supabase-missing-secret:{"databaseUrl":"postgres://db.example/wm"}',
    });

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'supabase-missing-secret',
        now: () => '2026-05-13T10:00:00.000Z',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        visibleStatus: 'error',
        errorCode: 'service_role_key_missing',
      })
    );

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 'supabase-api-down',
      instanceId: 'de-test',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Waste Supabase',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'database',
      baseUrl: 'https://tenant.supabase.co',
      authMode: 'service_role',
      statusCheckKind: 'supabase',
      visibleStatus: 'unknown',
      publicConfig: {
        projectUrl: 'https://tenant.supabase.co',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:supabase-api-down:{"databaseUrl":"postgres://db.example/wm","serviceRoleKey":"service-role-key"}',
    });
    state.poolQuery.mockResolvedValueOnce({ rows: [{ schema_exists: true }] });
    state.fetch.mockRejectedValueOnce(new Error('socket hang up'));

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 'supabase-api-down',
        now: () => '2026-05-13T10:00:00.000Z',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        visibleStatus: 'error',
        errorCode: 'rest_api_unreachable',
      })
    );
  });

  it('persists failed s3 checks for missing secrets and unreachable endpoints', async () => {
    const { runStoredInterfaceHealthcheck } = await import('./instance-interface-healthcheck.server.js');

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 's3-missing-secret',
      instanceId: 'de-test',
      typeKey: 's3',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Media S3',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'object_storage',
      baseUrl: 'https://s3.example',
      authMode: 'access_key',
      statusCheckKind: 's3',
      visibleStatus: 'unknown',
      publicConfig: {
        endpoint: 'https://s3.example',
        bucket: 'media',
        accessKeyId: 'key-1',
      },
      secretConfigCiphertext: 'iam.instance_external_interfaces.secret_config:s3-missing-secret:{}',
    });

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 's3-missing-secret',
        now: () => '2026-05-13T10:00:00.000Z',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        visibleStatus: 'error',
        errorCode: 'secret_missing',
      })
    );

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 's3-unreachable',
      instanceId: 'de-test',
      typeKey: 's3',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Media S3',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'object_storage',
      baseUrl: 'https://s3.example',
      authMode: 'access_key',
      statusCheckKind: 's3',
      visibleStatus: 'unknown',
      publicConfig: {
        endpoint: 'https://s3.example',
        bucket: 'media',
        accessKeyId: 'key-1',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:s3-unreachable:{"secretAccessKey":"secret-1"}',
    });
    state.s3Send.mockRejectedValueOnce(Object.assign(new Error('dns failed'), { code: 'ENOTFOUND' }));

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 's3-unreachable',
        now: () => '2026-05-13T10:00:00.000Z',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        visibleStatus: 'error',
        errorCode: 's3_endpoint_unreachable',
      })
    );
  });

  it('persists generic s3 validation failures for missing endpoint fields and unexpected transport errors', async () => {
    const { runStoredInterfaceHealthcheck } = await import('./instance-interface-healthcheck.server.js');

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 's3-missing-endpoint',
      instanceId: 'de-test',
      typeKey: 's3',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Media S3',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'object_storage',
      baseUrl: 'https://s3.example',
      authMode: 'access_key',
      statusCheckKind: 's3',
      visibleStatus: 'unknown',
      publicConfig: {
        endpoint: ' ',
        bucket: 'media',
        accessKeyId: 'key-1',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:s3-missing-endpoint:{"secretAccessKey":"secret-1"}',
    });

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 's3-missing-endpoint',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        errorCode: 'connection_failed',
      })
    );

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 's3-missing-access-key',
      instanceId: 'de-test',
      typeKey: 's3',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Media S3',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'object_storage',
      baseUrl: 'https://s3.example',
      authMode: 'access_key',
      statusCheckKind: 's3',
      visibleStatus: 'unknown',
      publicConfig: {
        endpoint: 'https://s3.example',
        bucket: 'media',
        accessKeyId: ' ',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:s3-missing-access-key:{"secretAccessKey":"secret-1"}',
    });

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 's3-missing-access-key',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        errorCode: 'connection_failed',
      })
    );

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 's3-missing-bucket',
      instanceId: 'de-test',
      typeKey: 's3',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Media S3',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'object_storage',
      baseUrl: 'https://s3.example',
      authMode: 'access_key',
      statusCheckKind: 's3',
      visibleStatus: 'unknown',
      publicConfig: {
        endpoint: 'https://s3.example',
        bucket: ' ',
        accessKeyId: 'key-1',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:s3-missing-bucket:{"secretAccessKey":"secret-1"}',
    });

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 's3-missing-bucket',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        errorCode: 'bucket_missing',
      })
    );

    state.loadExternalInterfaceRecordById.mockResolvedValueOnce({
      id: 's3-generic-failure',
      instanceId: 'de-test',
      typeKey: 's3',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Media S3',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'object_storage',
      baseUrl: 'https://s3.example',
      authMode: 'access_key',
      statusCheckKind: 's3',
      visibleStatus: 'unknown',
      publicConfig: {
        endpoint: 'https://s3.example',
        bucket: 'media',
        accessKeyId: 'key-1',
      },
      secretConfigCiphertext:
        'iam.instance_external_interfaces.secret_config:s3-generic-failure:{"secretAccessKey":"secret-1"}',
    });
    state.s3Send.mockRejectedValueOnce(new Error('unexpected s3 failure'));

    await expect(
      runStoredInterfaceHealthcheck({
        instanceId: 'de-test',
        interfaceId: 's3-generic-failure',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        checkStatus: 'failed',
        errorCode: 'connection_failed',
      })
    );
  });
});
