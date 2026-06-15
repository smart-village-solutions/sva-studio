import { describe, expect, it } from 'vitest';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../index.js';
import { createWasteDataSourceRepository, wasteDataSourceStatements } from '../index.js';

const record = {
  instanceId: 'tenant-a',
  provider: 'supabase' as const,
  projectUrl: 'https://tenant-a.supabase.co',
  schemaName: 'public',
  enabled: true,
  databaseUrlConfigured: true,
  serviceRoleKeyConfigured: true,
  databaseUrlCiphertext: 'db-cipher',
  serviceRoleKeyCiphertext: 'service-cipher',
  visibleStatus: 'ok' as const,
  lastCheckedAt: '2026-05-09T09:00:00.000Z',
  lastCheckStatus: 'succeeded' as const,
  lastCheckErrorCode: undefined,
  lastCheckErrorMessage: undefined,
  updatedAt: '2026-05-09T09:00:00.000Z',
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

describe('waste data source repository (data package coverage)', () => {
  it('maps selected rows including secret-configured flags and returns null when missing', async () => {
    const { executor, statements } = createExecutor([
      {
        instance_id: record.instanceId,
        provider_key: record.provider,
        project_url: record.projectUrl,
        schema_name: record.schemaName,
        enabled: record.enabled,
        database_url_ciphertext: record.databaseUrlCiphertext,
        service_role_key_ciphertext: record.serviceRoleKeyCiphertext,
        visible_status: record.visibleStatus,
        last_checked_at: record.lastCheckedAt,
        last_check_status: record.lastCheckStatus,
        last_check_error_code: null,
        last_check_error_message: null,
        updated_at: record.updatedAt,
      },
    ]);

    await expect(createWasteDataSourceRepository(executor).getByInstanceId('tenant-a')).resolves.toEqual(record);
    expect(statements[0]?.values).toEqual(['tenant-a']);

    const empty = createExecutor();
    await expect(createWasteDataSourceRepository(empty.executor).getByInstanceId('tenant-a')).resolves.toBeNull();
  });

  it('builds upsert statements with nullable secret and check fields', async () => {
    const { executor, statements } = createExecutor();
    const input = {
      ...record,
      databaseUrlConfigured: false,
      serviceRoleKeyConfigured: false,
      databaseUrlCiphertext: undefined,
      serviceRoleKeyCiphertext: undefined,
      visibleStatus: 'not_configured' as const,
      lastCheckedAt: undefined,
      lastCheckStatus: undefined,
    };

    await createWasteDataSourceRepository(executor).upsert(input);

    expect(statements[0]?.text).toContain('ON CONFLICT (instance_id) DO UPDATE');
    expect(statements[0]?.values).toEqual([
      'tenant-a',
      'supabase',
      'https://tenant-a.supabase.co',
      'public',
      true,
      null,
      null,
      'not_configured',
      null,
      null,
      null,
      null,
    ]);
    expect(wasteDataSourceStatements.upsert(record).values[7]).toBe('ok');
  });

  it('updates only the visible connection-check state for operational probes', async () => {
    const { executor, statements } = createExecutor();
    const repository = createWasteDataSourceRepository(executor);

    await repository.updateConnectionCheck({
      instanceId: 'tenant-a',
      checkedAt: '2026-05-09T10:00:00.000Z',
      checkStatus: 'failed',
      visibleStatus: 'error',
      errorCode: 'connection_refused',
      errorMessage: 'Host unreachable',
    });

    expect(statements[0]?.text).toContain('UPDATE iam.instance_waste_data_sources');
    expect(statements[0]?.values).toEqual([
      'tenant-a',
      'error',
      '2026-05-09T10:00:00.000Z',
      'failed',
      'connection_refused',
      'Host unreachable',
    ]);
  });
});
