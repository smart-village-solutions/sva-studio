import type { Pool, PoolClient, QueryResult } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { readSsfConfigurationOverrides, upsertSsfTenantLocale } from '../src/runtime.js';

const result = <T extends Record<string, unknown>>(rows: T[]): QueryResult<T> =>
  ({ rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] }) as QueryResult<T>;

describe('SSF PostgreSQL repository', () => {
  it('sets transaction-local tenant context and retains explicit tenant predicates', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM ssf.server_settings')) return result([]);
      if (sql.includes('FROM ssf.server_locales')) return result([]);
      if (sql.includes('FROM ssf.tenant_settings')) {
        return result([
          {
            default_locale: 'de-DE',
            custom_branding_allowed: false,
            conversation_content_storage_allowed: false,
            conversation_content_storage_mode: 'disabled',
            logo_media_reference: null,
            icon_media_reference: null,
          },
        ]);
      }
      if (sql.includes('FROM ssf.tenant_locales')) return result([]);
      return result([]);
    });
    const release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;

    const overrides = await readSsfConfigurationOverrides(pool, 'tenant-a');

    expect(query).toHaveBeenNthCalledWith(1, 'BEGIN READ ONLY');
    expect(query).toHaveBeenNthCalledWith(2, 'SELECT set_config($1, $2, true);', [
      'app.instance_id',
      'tenant-a',
    ]);
    expect(
      query.mock.calls.some(
        ([sql, values]) =>
          typeof sql === 'string' &&
          sql.includes('FROM ssf.tenant_settings') &&
          sql.includes('WHERE instance_id = $1') &&
          Array.isArray(values) &&
          values[0] === 'tenant-a'
      )
    ).toBe(true);
    expect(query).toHaveBeenLastCalledWith('COMMIT');
    expect(release).toHaveBeenCalledOnce();
    expect(overrides.tenantSettings?.defaultLocale).toBe('de-DE');
  });

  it('rolls back tenant writes when the database rejects them', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('INSERT INTO')) throw new Error('constraint violation');
      return result([]);
    });
    const release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;

    await expect(
      upsertSsfTenantLocale(pool, {
        instanceId: 'tenant-b',
        locale: 'de-DE',
        enabled: true,
      })
    ).rejects.toThrow('constraint violation');

    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(query).not.toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });

  it('preserves the operation error when rollback also fails', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith('INSERT INTO')) throw new Error('constraint violation');
      if (sql === 'ROLLBACK') throw new Error('connection lost');
      return result([]);
    });
    const release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;

    await expect(
      upsertSsfTenantLocale(pool, {
        instanceId: 'tenant-b',
        locale: 'de-DE',
        enabled: true,
      })
    ).rejects.toThrow('constraint violation');

    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });
});
