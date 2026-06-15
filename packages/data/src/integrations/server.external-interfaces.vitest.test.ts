import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const writeDatabaseUrl = 'postgres://db.example/sva-write';

describe('data server re-export external interfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.IAM_DATABASE_URL;
  });

  it('persists and reads interface records inside the IAM transaction boundary', async () => {
    const { listExternalInterfaceRecords, saveExternalInterfaceRecord } = await import('../server.js');

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

  it('covers configuration, lookup, delete and failure branches through the public server entrypoint', async () => {
    const {
      deleteExternalInterfaceRecord,
      listExternalInterfaceTypeDefinitions,
      loadDefaultExternalInterfaceRecord,
      loadExternalInterfaceRecordByAlias,
      saveExternalInterfaceConnectionCheck,
      saveExternalInterfaceRecord,
      saveExternalInterfaceTypeDefinition,
    } = await import('../server.js');

    await expect(
      loadExternalInterfaceRecordByAlias('tenant-a', 's3', 'media', {
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

    mocks.poolFactory.mockReturnValueOnce({
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

    const release = vi.fn();
    const queries: string[] = [];
    mocks.poolFactory.mockReturnValue({
      connect: vi.fn(async () => ({
        query: vi.fn(async (text: string) => {
          queries.push(text);

          if (text.includes('INSERT INTO iam.instance_external_interfaces')) {
            throw new Error('write failed');
          }

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
          getDatabaseUrl: () => writeDatabaseUrl,
        }
      )
    ).rejects.toThrow('write failed');
    expect(queries).toContain('ROLLBACK');

    await expect(
      listExternalInterfaceTypeDefinitions({
        getDatabaseUrl: () => writeDatabaseUrl,
      })
    ).resolves.toEqual([
      expect.objectContaining({
        typeKey: 's3',
        statusCheckKind: 's3',
      }),
    ]);

    await expect(
      loadExternalInterfaceRecordByAlias('tenant-a', 's3', 'media', {
        getDatabaseUrl: () => writeDatabaseUrl,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'interface-1',
        alias: 'media',
      })
    );

    await expect(
      loadDefaultExternalInterfaceRecord('tenant-a', 'supabase', {
        getDatabaseUrl: () => writeDatabaseUrl,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'interface-2',
        isDefault: true,
      })
    );

    await expect(
      deleteExternalInterfaceRecord('tenant-a', 'interface-1', {
        getDatabaseUrl: () => writeDatabaseUrl,
      })
    ).resolves.toBe(true);

    await expect(
      saveExternalInterfaceTypeDefinition(
        {
          typeKey: 'supabase',
          ownerKind: 'host',
          ownerId: 'host',
          displayName: 'Supabase',
          category: 'database',
          publicSchema: { projectUrl: true },
          secretSchema: { serviceRoleKey: true },
          statusCheckKind: 'supabase',
          enabled: true,
        },
        {
          getDatabaseUrl: () => writeDatabaseUrl,
        }
      )
    ).resolves.toBeUndefined();

    await expect(
      saveExternalInterfaceConnectionCheck(
        {
          instanceId: 'tenant-a',
          interfaceId: 'interface-1',
          checkedAt: '2026-05-12T11:00:00.000Z',
          checkStatus: 'succeeded',
          visibleStatus: 'ok',
        },
        {
          getDatabaseUrl: () => writeDatabaseUrl,
        }
      )
    ).resolves.toBeUndefined();

    expect(queries.some((text) => text.includes('FROM iam.external_interface_types'))).toBe(true);
    expect(queries.some((text) => text.includes('AND alias = $3'))).toBe(true);
    expect(queries.some((text) => text.includes('AND is_default = true'))).toBe(true);
    expect(queries.some((text) => text.includes('DELETE FROM iam.instance_external_interfaces'))).toBe(true);
    expect(queries.some((text) => text.includes('INSERT INTO iam.external_interface_types'))).toBe(true);
    expect(queries.some((text) => text.includes('UPDATE iam.instance_external_interfaces'))).toBe(true);
  });
});
