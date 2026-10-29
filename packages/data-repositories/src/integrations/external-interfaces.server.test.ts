import type { ExternalInterfaceRecord } from '@sva/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  poolFactory: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => mocks.logger,
}));

vi.mock('pg', () => ({
  Pool: function MockPool(config: unknown) {
    return mocks.poolFactory(config);
  },
}));

describe('external interfaces server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('persists and reads interface records inside the IAM transaction boundary', async () => {
    const { listExternalInterfaceRecords, saveExternalInterfaceRecord } = await import('./external-interfaces.server.js');

    const queries: string[] = [];
    const release = vi.fn();
    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => ({
        query: vi.fn(async (text: string) => {
          queries.push(text);
          if (text.includes('SELECT') && text.includes('FROM iam.instance_external_interfaces')) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: 'interface-1',
                  instance_id: 'tenant-a',
                  type_key: 's3',
                  owner_kind: 'host',
                  owner_id: 'host',
                  display_name: 'Object Storage',
                  alias: 'media',
                  enabled: true,
                  is_default: true,
                  category: 'object_storage',
                  base_url: 'https://s3.example',
                  auth_mode: 'access_key',
                  public_config_json: { endpoint: 'https://s3.example' },
                  secret_config_ciphertext: 'cipher-1',
                  status_check_kind: 's3',
                  visible_status: 'unknown',
                  last_checked_at: null,
                  last_check_status: null,
                  last_check_error_code: null,
                  last_check_error_message: null,
                  created_at: '2026-05-12T09:00:00.000Z',
                  updated_at: '2026-05-12T10:00:00.000Z',
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        }),
        release,
      })),
    });

    await saveExternalInterfaceRecord(
      {
        id: 'interface-1',
        instanceId: 'tenant-a',
        typeKey: 's3',
        ownerKind: 'host',
        ownerId: 'host',
        displayName: 'Object Storage',
        alias: 'media',
        enabled: true,
        isDefault: true,
        category: 'object_storage',
        baseUrl: 'https://s3.example',
        authMode: 'access_key',
        publicConfig: { endpoint: 'https://s3.example' },
        secretConfigCiphertext: 'cipher-1',
        statusCheckKind: 's3',
        visibleStatus: 'unknown',
      },
      {
        getDatabaseUrl: () => 'postgres://db.example/sva',
      }
    );

    await expect(
      listExternalInterfaceRecords('tenant-a', {
        getDatabaseUrl: () => 'postgres://db.example/sva',
      })
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'interface-1',
        typeKey: 's3',
        alias: 'media',
      }),
    ]);

    expect(queries).toContain('BEGIN');
    expect(queries).toContain('COMMIT');
    expect(release).toHaveBeenCalledTimes(2);
  });

  it('fails fast when no IAM database url is configured', async () => {
    const { listExternalInterfaceRecords } = await import('./external-interfaces.server.js');

    await expect(
      listExternalInterfaceRecords('tenant-a', {
        getDatabaseUrl: () => undefined,
      })
    ).rejects.toThrow('IAM database not configured');

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'database_not_configured',
      expect.objectContaining({
        operation: 'external_interface_db_tx',
        instance_id: 'tenant-a',
      })
    );
  });

  it('rolls back and logs when the IAM transaction body fails', async () => {
    const { saveExternalInterfaceRecord } = await import('./external-interfaces.server.js');

    const release = vi.fn();
    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => ({
        query: vi.fn(async (text: string) => {
          if (text.includes('INSERT INTO iam.instance_external_interfaces')) {
            throw new Error('write failed');
          }
          return { rowCount: 0, rows: [] };
        }),
        release,
      })),
    });

    await expect(
      saveExternalInterfaceRecord(
        {
          id: 'interface-1',
          instanceId: 'tenant-a',
          typeKey: 's3',
          ownerKind: 'host',
          ownerId: 'host',
          displayName: 'Object Storage',
          alias: 'media',
          enabled: true,
          isDefault: true,
          category: 'object_storage',
          baseUrl: 'https://s3.example',
          authMode: 'access_key',
          publicConfig: { endpoint: 'https://s3.example' },
          secretConfigCiphertext: 'cipher-1',
          statusCheckKind: 's3',
          visibleStatus: 'unknown',
        },
        {
          getDatabaseUrl: () => 'postgres://db.example/sva',
        }
      )
    ).rejects.toThrow('write failed');

    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'external_interface_db_tx_rolled_back',
      expect.objectContaining({
        instance_id: 'tenant-a',
      })
    );
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'external_interface_db_tx_failed',
      expect.objectContaining({
        instance_id: 'tenant-a',
        error: 'write failed',
      })
    );
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('logs pool connection failures before rethrowing them', async () => {
    const { listExternalInterfaceTypeDefinitions } = await import('./external-interfaces.server.js');

    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => {
        throw new Error('connect failed');
      }),
    });

    await expect(
      listExternalInterfaceTypeDefinitions({
        getDatabaseUrl: () => 'postgres://db.example/sva',
      })
    ).rejects.toThrow('connect failed');

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'pool_connect_failed',
      expect.objectContaining({
        instance_id: 'default',
        error: 'connect failed',
      })
    );
  });

  it('uses the default IAM database url, reuses the pool, and covers the remaining wrapper operations', async () => {
    const {
      deleteExternalInterfaceRecord,
      listExternalInterfaceTypeDefinitions,
      loadDefaultExternalInterfaceRecord,
      loadExternalInterfaceRecordByAlias,
      saveExternalInterfaceConnectionCheck,
      saveExternalInterfaceTypeDefinition,
    } = await import('./external-interfaces.server.js');

    const previousUrl = process.env.IAM_DATABASE_URL;
    process.env.IAM_DATABASE_URL = 'postgres://db.example/sva';

    const release = vi.fn();
    const queries: string[] = [];
    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => ({
        query: vi.fn(async (text: string) => {
          queries.push(text);

          if (text.includes('FROM iam.external_interface_types')) {
            return {
              rowCount: 1,
              rows: [
                {
                  type_key: 's3',
                  owner_kind: 'host',
                  owner_id: 'host',
                  display_name: 'S3',
                  category: 'object_storage',
                  public_schema_json: { endpoint: true },
                  secret_schema_json: { secretAccessKey: true },
                  status_check_kind: 's3',
                  enabled: true,
                },
              ],
            };
          }

          if (text.includes('AND alias = $3')) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: 'interface-1',
                  instance_id: 'tenant-a',
                  type_key: 's3',
                  owner_kind: 'host',
                  owner_id: 'host',
                  display_name: 'Object Storage',
                  alias: 'media',
                  enabled: true,
                  is_default: false,
                  category: 'object_storage',
                  base_url: 'https://s3.example',
                  auth_mode: 'access_key',
                  public_config_json: { endpoint: 'https://s3.example' },
                  secret_config_ciphertext: 'cipher-1',
                  status_check_kind: 's3',
                  visible_status: 'unknown',
                  last_checked_at: null,
                  last_check_status: null,
                  last_check_error_code: null,
                  last_check_error_message: null,
                  created_at: null,
                  updated_at: null,
                },
              ],
            };
          }

          if (text.includes('AND is_default = true')) {
            return {
              rowCount: 1,
              rows: [
                {
                  id: 'interface-2',
                  instance_id: 'tenant-a',
                  type_key: 'supabase',
                  owner_kind: 'host',
                  owner_id: 'host',
                  display_name: 'Supabase',
                  alias: 'default',
                  enabled: true,
                  is_default: true,
                  category: 'database',
                  base_url: 'https://tenant-a.supabase.co',
                  auth_mode: 'service_role',
                  public_config_json: { projectUrl: 'https://tenant-a.supabase.co' },
                  secret_config_ciphertext: 'cipher-2',
                  status_check_kind: 'supabase',
                  visible_status: 'ok',
                  last_checked_at: '2026-05-12T10:00:00.000Z',
                  last_check_status: 'succeeded',
                  last_check_error_code: null,
                  last_check_error_message: null,
                  created_at: '2026-05-12T09:00:00.000Z',
                  updated_at: '2026-05-12T10:00:00.000Z',
                },
              ],
            };
          }

          if (text.includes('DELETE FROM iam.instance_external_interfaces')) {
            return { rowCount: 1, rows: [] };
          }

          return { rowCount: 0, rows: [] };
        }),
        release,
      })),
    });

    await expect(listExternalInterfaceTypeDefinitions()).resolves.toEqual([
      expect.objectContaining({
        typeKey: 's3',
        statusCheckKind: 's3',
      }),
    ]);

    await expect(loadExternalInterfaceRecordByAlias('tenant-a', 's3', 'media')).resolves.toEqual(
      expect.objectContaining({
        id: 'interface-1',
        alias: 'media',
      })
    );

    await expect(loadDefaultExternalInterfaceRecord('tenant-a', 'supabase')).resolves.toEqual(
      expect.objectContaining({
        id: 'interface-2',
        isDefault: true,
      })
    );

    await expect(deleteExternalInterfaceRecord('tenant-a', 'interface-1')).resolves.toBe(true);

    await expect(
      saveExternalInterfaceTypeDefinition({
        typeKey: 'supabase',
        ownerKind: 'host',
        ownerId: 'host',
        displayName: 'Supabase',
        category: 'database',
        publicSchema: { projectUrl: true },
        secretSchema: { serviceRoleKey: true },
        statusCheckKind: 'supabase',
        enabled: true,
      })
    ).resolves.toBeUndefined();

    await expect(
      saveExternalInterfaceConnectionCheck({
        instanceId: 'tenant-a',
        interfaceId: 'interface-1',
        checkedAt: '2026-05-12T11:00:00.000Z',
        checkStatus: 'succeeded',
        visibleStatus: 'ok',
      })
    ).resolves.toBeUndefined();

    expect(mocks.poolFactory).toHaveBeenCalledTimes(1);
    expect(queries.some((text) => text.includes('FROM iam.external_interface_types'))).toBe(true);
    expect(queries.some((text) => text.includes('AND alias = $3'))).toBe(true);
    expect(queries.some((text) => text.includes('AND is_default = true'))).toBe(true);
    expect(queries.some((text) => text.includes('DELETE FROM iam.instance_external_interfaces'))).toBe(true);
    expect(queries.some((text) => text.includes('INSERT INTO iam.external_interface_types'))).toBe(true);
    expect(queries.some((text) => text.includes('UPDATE iam.instance_external_interfaces'))).toBe(true);
    expect(release).toHaveBeenCalledTimes(6);

    process.env.IAM_DATABASE_URL = previousUrl;
  });
});

describe('DeepL credential transaction guards', () => {
  const record: ExternalInterfaceRecord = {
    id: 'deepl-interface',
    instanceId: 'tenant-a',
    typeKey: 'deepl',
    ownerKind: 'host',
    ownerId: 'host',
    displayName: 'DeepL',
    alias: 'deepl',
    enabled: true,
    isDefault: true,
    category: 'api',
    baseUrl: 'https://api-free.deepl.com',
    authMode: 'api_key',
    publicConfig: { revision: '8', credentialRevision: '3' },
    secretConfigCiphertext: 'encrypted',
    statusCheckKind: 'deepl',
    visibleStatus: 'unknown',
  };
  const empty = { rows: [], rowCount: 0 };
  const activeModule = { rows: [{ module_id: 'app-translations' }], rowCount: 1 };
  const database = () => {
    const query = vi
      .fn<
        (
          text: string,
          values?: readonly unknown[]
        ) => Promise<{ rows: unknown[]; rowCount: number }>
      >()
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce(empty);
    const release = vi.fn();
    mocks.poolFactory.mockReturnValue({ connect: vi.fn(async () => ({ query, release })) });
    return { query, release };
  };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv('IAM_DATABASE_URL', 'postgres://db.example/deepl');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('rejects non-host or non-DeepL records without opening a connection', async () => {
    const { saveDeepLInterfaceRecord } = await import('./external-interfaces.server.js');
    await expect(saveDeepLInterfaceRecord({ ...record, typeKey: 's3' }, '7')).rejects.toThrow(
      'invalid_config'
    );
    await expect(saveDeepLInterfaceRecord({ ...record, ownerKind: 'plugin' }, '7')).rejects.toThrow(
      'invalid_config'
    );
    expect(mocks.poolFactory).not.toHaveBeenCalled();
  });

  it.each(['record', 'check'])(
    'rolls back %s writes while the module is unavailable',
    async (operation) => {
      const { query, release } = database();
      query.mockResolvedValueOnce(empty).mockResolvedValueOnce(empty);
      const { saveDeepLInterfaceRecord, saveDeepLInterfaceCheck } =
        await import('./external-interfaces.server.js');
      await expect(
        operation === 'record'
          ? saveDeepLInterfaceRecord(record, '7')
          : saveDeepLInterfaceCheck({
              instanceId: 'tenant-a',
              interfaceId: record.id,
              expectedRevision: '7',
              checkedAt: '2026-10-29T12:00:00Z',
            })
      ).rejects.toThrow('deepl_module_unavailable');
      expect(query.mock.calls).toEqual([
        ['BEGIN'],
        ['SELECT set_config($1, $2, true);', ['app.instance_id', 'tenant-a']],
        [expect.stringContaining('FOR SHARE OF m,l'), ['tenant-a']],
        ['ROLLBACK'],
      ]);
      expect(release).toHaveBeenCalledOnce();
    }
  );

  it('locks the saved configuration and rejects a stale credential revision without upsert', async () => {
    const { query, release } = database();
    query
      .mockResolvedValueOnce(activeModule)
      .mockResolvedValueOnce({ rows: [{ revision: '8' }], rowCount: 1 })
      .mockResolvedValueOnce(empty);
    const { saveDeepLInterfaceRecord } = await import('./external-interfaces.server.js');
    await expect(saveDeepLInterfaceRecord(record, '7')).rejects.toThrow('interface_conflict');
    expect(query.mock.calls[3]).toEqual([
      expect.stringContaining('FOR UPDATE'),
      ['tenant-a', record.id],
    ]);
    expect(query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
    expect(query).toHaveBeenCalledTimes(5);
    expect(release).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    'persists the exact configuration after a matching revision, initially absent=%s',
    async (initial) => {
      const { query, release } = database();
      query
        .mockResolvedValueOnce(activeModule)
        .mockResolvedValueOnce(initial ? empty : { rows: [{ revision: '7' }], rowCount: 1 })
        .mockResolvedValueOnce(empty)
        .mockResolvedValueOnce(empty);
      const { saveDeepLInterfaceRecord } = await import('./external-interfaces.server.js');
      await saveDeepLInterfaceRecord(record, initial ? '0' : '7');
      const write = query.mock.calls[4] ?? [];
      expect(write[0]).toContain('INSERT INTO iam.instance_external_interfaces');
      expect(write[1]).toEqual([
        'tenant-a',
        record.id,
        'deepl',
        'host',
        'host',
        'DeepL',
        'deepl',
        true,
        true,
        'api',
        record.baseUrl,
        'api_key',
        JSON.stringify(record.publicConfig),
        'encrypted',
        'deepl',
        'unknown',
        null,
        null,
        null,
        null,
      ]);
      expect(query.mock.calls.at(-1)).toEqual(['COMMIT']);
      expect(release).toHaveBeenCalledOnce();
    }
  );

  it.each([undefined, 'provider_unavailable'])(
    'accepts check results only for the exact enabled revision, error=%s',
    async (errorCode) => {
      const { query, release } = database();
      query
        .mockResolvedValueOnce(activeModule)
        .mockResolvedValueOnce({ rows: [{ id: record.id }], rowCount: 1 })
        .mockResolvedValueOnce(empty);
      const { saveDeepLInterfaceCheck } = await import('./external-interfaces.server.js');
      const languages = errorCode
        ? undefined
        : [{ code: 'EN', name: 'English', tagHandling: true }];
      await saveDeepLInterfaceCheck({
        instanceId: 'tenant-a',
        interfaceId: record.id,
        expectedRevision: '7',
        checkedAt: '2026-10-29T12:00:00Z',
        languages,
        errorCode,
      });
      const update = query.mock.calls[3] ?? [];
      expect(update[0]).toContain("AND enabled AND public_config_json->>'revision'=$3");
      expect(update[0]).toContain(
        "'verifiedCredentialRevision',public_config_json->>'credentialRevision'"
      );
      expect(update[1]).toEqual([
        'tenant-a',
        record.id,
        '7',
        '2026-10-29T12:00:00Z',
        languages ? JSON.stringify(languages) : null,
        errorCode ? 'error' : 'ok',
        errorCode ? 'failed' : 'succeeded',
        errorCode ?? null,
      ]);
      expect(query.mock.calls.at(-1)).toEqual(['COMMIT']);
      expect(release).toHaveBeenCalledOnce();
    }
  );

  it('discards a provider result when the interface changed while the call was in flight', async () => {
    const { query, release } = database();
    query
      .mockResolvedValueOnce(activeModule)
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce(empty);
    const { saveDeepLInterfaceCheck } = await import('./external-interfaces.server.js');
    await expect(
      saveDeepLInterfaceCheck({
        instanceId: 'tenant-a',
        interfaceId: record.id,
        expectedRevision: '7',
        checkedAt: '2026-10-29T12:00:00Z',
      })
    ).rejects.toThrow('interface_conflict');
    expect(((query.mock.calls[3] ?? [])[1] ?? []).slice(0, 3)).toEqual([
      'tenant-a',
      record.id,
      '7',
    ]);
    expect(query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
    expect(release).toHaveBeenCalledOnce();
  });
});
