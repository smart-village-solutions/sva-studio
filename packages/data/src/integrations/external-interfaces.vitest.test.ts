import { describe, expect, it } from 'vitest';

import type {
  ExternalInterfaceConnectionCheckRecord,
  ExternalInterfaceRecord,
  ExternalInterfaceTypeDefinition,
} from '@sva/core';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../index.js';
import { createExternalInterfaceRepository, externalInterfaceStatements } from '../index.js';

const typeDefinition: ExternalInterfaceTypeDefinition = {
  typeKey: 's3',
  ownerKind: 'host',
  ownerId: 'host',
  displayName: 'S3',
  category: 'object_storage',
  publicSchema: { fields: ['endpoint', 'bucket'] },
  secretSchema: { fields: ['secretAccessKey'] },
  statusCheckKind: 's3',
  enabled: true,
};

const record: ExternalInterfaceRecord = {
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
  statusCheckKind: 's3',
  visibleStatus: 'unknown',
  publicConfig: {
    endpoint: 'https://s3.example',
    region: 'eu-central-1',
    bucket: 'media',
    accessKeyId: 'key-1',
    forcePathStyle: true,
  },
  secretConfigCiphertext: 'cipher-1',
  lastCheckedAt: '2026-05-12T10:00:00.000Z',
  lastCheckStatus: 'succeeded',
  updatedAt: '2026-05-12T10:00:00.000Z',
};

const connectionCheck: ExternalInterfaceConnectionCheckRecord = {
  instanceId: 'tenant-a',
  interfaceId: 'interface-1',
  checkedAt: '2026-05-12T11:00:00.000Z',
  checkStatus: 'failed',
  visibleStatus: 'error',
  errorCode: 'connection_failed',
  errorMessage: 'Host unreachable',
};

const createExecutor = (rows: readonly Record<string, unknown>[] = []) => {
  const statements: SqlStatement[] = [];
  const executor: SqlExecutor = {
    async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
      statements.push(statement);
      return {
        rowCount: rows.length,
        rows: rows as readonly TRow[],
      };
    },
  };

  return { executor, statements };
};

describe('external interface repository (data package coverage)', () => {
  it('maps interface type and instance rows', async () => {
    const { executor } = createExecutor([
      {
        type_key: 's3',
        owner_kind: 'host',
        owner_id: 'host',
        display_name: 'S3',
        category: 'object_storage',
        public_schema_json: { fields: ['endpoint', 'bucket'] },
        secret_schema_json: { fields: ['secretAccessKey'] },
        status_check_kind: 's3',
        enabled: true,
      },
    ]);

    await expect(createExternalInterfaceRepository(executor).listTypeDefinitions()).resolves.toEqual([typeDefinition]);

    const instance = createExecutor([
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
        public_config_json: record.publicConfig,
        secret_config_ciphertext: 'cipher-1',
        status_check_kind: 's3',
        visible_status: 'unknown',
        last_checked_at: '2026-05-12T10:00:00.000Z',
        last_check_status: 'succeeded',
        last_check_error_code: null,
        last_check_error_message: null,
        created_at: '2026-05-12T09:00:00.000Z',
        updated_at: '2026-05-12T10:00:00.000Z',
      },
    ]);

    await expect(createExternalInterfaceRepository(instance.executor).listByInstanceId('tenant-a')).resolves.toEqual([
      {
        ...record,
        lastCheckErrorCode: undefined,
        lastCheckErrorMessage: undefined,
        createdAt: '2026-05-12T09:00:00.000Z',
      },
    ]);
  });

  it('keeps plugin-defined status check kinds when mapping rows and building upserts', async () => {
    const pluginTypeDefinition: ExternalInterfaceTypeDefinition = {
      typeKey: 'news-rss',
      ownerKind: 'plugin',
      ownerId: 'news',
      displayName: 'RSS Feed',
      category: 'feed',
      publicSchema: { feedUrl: true },
      secretSchema: {},
      statusCheckKind: 'news.rss',
      enabled: true,
    };

    const pluginRecord: ExternalInterfaceRecord = {
      id: 'interface-rss',
      instanceId: 'tenant-a',
      typeKey: 'news-rss',
      ownerKind: 'plugin',
      ownerId: 'news',
      displayName: 'RSS Feed',
      alias: 'default',
      enabled: true,
      isDefault: true,
      category: 'feed',
      statusCheckKind: 'news.rss',
      visibleStatus: 'unknown',
      publicConfig: { feedUrl: 'https://example.com/feed.xml' },
    };

    const { executor } = createExecutor([
      {
        type_key: 'news-rss',
        owner_kind: 'plugin',
        owner_id: 'news',
        display_name: 'RSS Feed',
        category: 'feed',
        public_schema_json: { feedUrl: true },
        secret_schema_json: {},
        status_check_kind: 'news.rss',
        enabled: true,
      },
      {
        id: 'interface-rss',
        instance_id: 'tenant-a',
        type_key: 'news-rss',
        owner_kind: 'plugin',
        owner_id: 'news',
        display_name: 'RSS Feed',
        alias: 'default',
        enabled: true,
        is_default: true,
        category: 'feed',
        base_url: null,
        auth_mode: null,
        public_config_json: { feedUrl: 'https://example.com/feed.xml' },
        secret_config_ciphertext: null,
        status_check_kind: 'news.rss',
        visible_status: 'unknown',
        last_checked_at: null,
        last_check_status: null,
        last_check_error_code: null,
        last_check_error_message: null,
        created_at: null,
        updated_at: null,
      },
    ]);

    await expect(createExternalInterfaceRepository(executor).listTypeDefinitions()).resolves.toContainEqual(
      pluginTypeDefinition
    );
    await expect(createExternalInterfaceRepository(executor).listByInstanceId('tenant-a')).resolves.toContainEqual(
      expect.objectContaining(pluginRecord)
    );

    expect(externalInterfaceStatements.upsertType(pluginTypeDefinition).values).toContain('news.rss');
    expect(externalInterfaceStatements.upsert(pluginRecord).values).toContain('news.rss');
  });

  it('maps nullable interface row fields to undefined and covers CRUD statement variants', async () => {
    const nullableExecutor = createExecutor([
      {
        id: 'interface-2',
        instance_id: 'tenant-a',
        type_key: 'supabase',
        owner_kind: 'host',
        owner_id: 'host',
        display_name: 'Supabase',
        alias: 'default',
        enabled: false,
        is_default: false,
        category: 'database',
        base_url: null,
        auth_mode: null,
        public_config_json: { projectUrl: 'https://tenant-a.supabase.co' },
        secret_config_ciphertext: null,
        status_check_kind: 'supabase',
        visible_status: 'disabled',
        last_checked_at: null,
        last_check_status: null,
        last_check_error_code: null,
        last_check_error_message: null,
        created_at: null,
        updated_at: null,
      },
    ]);

    await expect(
      createExternalInterfaceRepository(nullableExecutor.executor).getById('tenant-a', 'interface-2')
    ).resolves.toEqual({
      id: 'interface-2',
      instanceId: 'tenant-a',
      typeKey: 'supabase',
      ownerKind: 'host',
      ownerId: 'host',
      displayName: 'Supabase',
      alias: 'default',
      enabled: false,
      isDefault: false,
      category: 'database',
      baseUrl: undefined,
      authMode: undefined,
      publicConfig: { projectUrl: 'https://tenant-a.supabase.co' },
      secretConfigCiphertext: undefined,
      statusCheckKind: 'supabase',
      visibleStatus: 'disabled',
      lastCheckedAt: undefined,
      lastCheckStatus: undefined,
      lastCheckErrorCode: undefined,
      lastCheckErrorMessage: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    });

    const emptyExecutor = createExecutor();
    const repository = createExternalInterfaceRepository(emptyExecutor.executor);
    await expect(repository.getByAlias('tenant-a', 's3', 'missing')).resolves.toBeNull();
    await expect(repository.getDefaultByTypeKey('tenant-a', 's3')).resolves.toBeNull();
    await expect(repository.deleteById('tenant-a', 'missing')).resolves.toBe(false);

    const writer = createExecutor();
    const writerRepository = createExternalInterfaceRepository(writer.executor);
    await writerRepository.upsertTypeDefinition(typeDefinition);
    await writerRepository.upsert(record);
    await writerRepository.updateConnectionCheck(connectionCheck);

    expect(writer.statements).toHaveLength(3);
    expect(writer.statements[0]?.text).toContain('INSERT INTO iam.external_interface_types');
    expect(writer.statements[1]?.text).toContain('INSERT INTO iam.instance_external_interfaces');
    expect(writer.statements[2]?.values).toEqual([
      'tenant-a',
      'interface-1',
      'error',
      '2026-05-12T11:00:00.000Z',
      'failed',
      'connection_failed',
      'Host unreachable',
    ]);
  });
});
