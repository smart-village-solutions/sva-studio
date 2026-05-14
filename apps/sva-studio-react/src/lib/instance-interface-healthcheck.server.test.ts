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
});
