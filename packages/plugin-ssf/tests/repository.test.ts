import type { Pool, PoolClient, QueryResult } from 'pg';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  provisionSsfTenant,
  readSsfConfigurationOverrides,
  readSsfTenant,
  upsertSsfTenantLocale,
} from '../src/runtime.js';
import {
  readSsfInstallationContentV2,
  readSsfSystemContentV2,
  readSsfTenantContentV2,
  replaceSsfSystemContentV2,
  writeSsfTenantContentV2,
} from '../src/content-v2-repository.js';

const result = <T extends Record<string, unknown>>(rows: T[]): QueryResult<T> =>
  ({ rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] }) as QueryResult<T>;

const runtimeTemplateV2 = (): NonNullable<
  Parameters<typeof replaceSsfSystemContentV2>[1]['runtimeTemplate']
> => {
  const example = JSON.parse(
    readFileSync(
      new URL('../../../docs/api/ssf-runtime-configuration-v2.example.json', import.meta.url),
      'utf8'
    )
  ) as Record<string, unknown>;
  delete example['contractVersion'];
  delete example['configurationRevision'];
  delete example['tenant'];
  return example as NonNullable<Parameters<typeof replaceSsfSystemContentV2>[1]['runtimeTemplate']>;
};

const installationContentV2 = (): NonNullable<
  Parameters<typeof replaceSsfSystemContentV2>[1]['installation']
> => {
  const example = JSON.parse(
    readFileSync(
      new URL('../../../docs/api/ssf-installation-content-v2.example.json', import.meta.url),
      'utf8'
    )
  ) as Record<string, unknown>;
  delete example['contractVersion'];
  delete example['configurationRevision'];
  return example as NonNullable<Parameters<typeof replaceSsfSystemContentV2>[1]['installation']>;
};

describe('SSF PostgreSQL repository', () => {
  it('reads stored V2 system and tenant content within the verified tenant scope', async () => {
    const installation = installationContentV2();
    const template = runtimeTemplateV2();
    const overrides = { staff: { dashboard: { headline: 'Tenant A' } } };
    const query = vi.fn(async (sql: string) =>
      sql.includes('SELECT installation_content_v2, runtime_content_v2')
        ? result([{ installation_content_v2: installation, runtime_content_v2: template }])
        : sql.includes('SELECT installation_content_v2 FROM')
          ? result([{ installation_content_v2: installation }])
          : result([])
    );
    const clientQuery = vi.fn(async (sql: string) =>
      sql.includes('FROM ssf.server_settings')
        ? result([{ runtime_content_v2: template }])
        : sql.includes('FROM ssf.tenant_settings')
          ? result([{ runtime_content_v2: overrides }])
          : result([])
    );
    const release = vi.fn();
    const pool = {
      query,
      connect: vi.fn(async () => ({ query: clientQuery, release }) as unknown as PoolClient),
    } as unknown as Pool;

    await expect(readSsfSystemContentV2(pool)).resolves.toEqual({
      installation,
      runtimeTemplate: template,
    });
    await expect(readSsfInstallationContentV2(pool)).resolves.toEqual(installation);
    await expect(readSsfTenantContentV2(pool, 'tenant-a')).resolves.toEqual({
      runtimeTemplate: template,
      overrides,
    });
    expect(clientQuery).toHaveBeenCalledWith('SELECT set_config($1, $2, true);', [
      'app.instance_id',
      'tenant-a',
    ]);
    expect(clientQuery).toHaveBeenCalledWith(
      'SELECT runtime_content_v2 FROM ssf.tenant_settings WHERE instance_id = $1',
      ['tenant-a']
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it('validates existing tenant overrides before committing both V2 system documents', async () => {
    const template = runtimeTemplateV2();
    const installation = installationContentV2();
    const query = vi.fn(async (sql: string, _values?: unknown[]) => {
      void _values;
      return sql.includes('SELECT instance_id, runtime_content_v2')
        ? result([
            {
              instance_id: 'tenant-a',
              runtime_content_v2: { staff: { dashboard: { headline: 'Tenant A' } } },
            },
          ])
        : result([]);
    });
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query, release }) as unknown as PoolClient),
    } as unknown as Pool;

    await replaceSsfSystemContentV2(pool, { installation, runtimeTemplate: template });

    const installationWrite = query.mock.calls.find(([sql]) =>
      sql.includes('installation_content_v2 = EXCLUDED.installation_content_v2')
    );
    const runtimeWrite = query.mock.calls.find(([sql]) =>
      sql.includes('runtime_content_v2 = EXCLUDED.runtime_content_v2')
    );
    expect(JSON.parse(String(installationWrite?.[1]?.[0]))).toMatchObject({ legal: installation.legal });
    expect(JSON.parse(String(runtimeWrite?.[1]?.[0]))).toMatchObject({
      staff: { dashboard: { headline: template.staff.dashboard.headline } },
    });
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(query).not.toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });

  it('rolls back a V2 system change that invalidates a stored tenant override', async () => {
    const query = vi.fn(async (sql: string) =>
      sql.includes('SELECT instance_id, runtime_content_v2')
        ? result([
            {
              instance_id: 'tenant-a',
              runtime_content_v2: {
                staff: { feedback: { questions: [{ id: 'unknown', question: 'Invalid' }] } },
              },
            },
          ])
        : result([])
    );
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query, release }) as unknown as PoolClient),
    } as unknown as Pool;

    await expect(
      replaceSsfSystemContentV2(pool, {
        installation: null,
        runtimeTemplate: runtimeTemplateV2(),
      })
    ).rejects.toThrow('ssf_v2_override_identity_unknown');

    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(query).not.toHaveBeenCalledWith('COMMIT');
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO ssf.server_settings'))).toBe(
      false
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it('writes V2 tenant overrides only after a scoped transaction and template validation', async () => {
    const template = runtimeTemplateV2();
    const query = vi.fn(async (sql: string) =>
      sql.includes('SELECT runtime_content_v2 FROM ssf.server_settings')
        ? result([{ runtime_content_v2: template }])
        : result([])
    );
    const release = vi.fn();
    const pool = {
      connect: vi.fn(async () => ({ query, release }) as unknown as PoolClient),
    } as unknown as Pool;
    const overrides = { staff: { dashboard: { headline: 'Tenant A' } } };

    await expect(writeSsfTenantContentV2(pool, 'tenant-a', overrides)).resolves.toEqual(overrides);

    expect(query).toHaveBeenCalledWith('SELECT set_config($1, $2, true);', [
      'app.instance_id',
      'tenant-a',
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ssf.tenant_settings'), [
      'tenant-a',
      JSON.stringify(overrides),
    ]);
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalledOnce();
  });
  it('provisions one tenant record idempotently and verifies it in the same transaction', async () => {
    const tenantRow = {
      instance_id: 'tenant-a',
      status: 'prepared' as const,
      revision: '1',
      created_at: new Date('2026-09-07T12:00:00.000Z'),
      updated_at: new Date('2026-09-07T12:00:00.000Z'),
    };
    const query = vi.fn(async (sql: string) =>
      sql.includes('SELECT instance_id, status, revision') ? result([tenantRow]) : result([])
    );
    const release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;

    const first = await provisionSsfTenant(pool, 'tenant-a');
    const second = await provisionSsfTenant(pool, 'tenant-a');

    expect(first).toEqual({
      instanceId: 'tenant-a',
      status: 'prepared',
      revision: 1,
      createdAt: tenantRow.created_at,
      updatedAt: tenantRow.updated_at,
    });
    expect(second).toEqual(first);
    expect(
      query.mock.calls.filter(([sql]) =>
        typeof sql === 'string' && sql.includes('ON CONFLICT (instance_id) DO NOTHING')
      )
    ).toHaveLength(2);
    expect(query.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('UPDATE'))).toBe(false);
    expect(query).toHaveBeenCalledWith('SELECT set_config($1, $2, true);', [
      'app.instance_id',
      'tenant-a',
    ]);
  });

  it('reads only the explicitly bound tenant and rejects invalid identifiers before connecting', async () => {
    const query = vi.fn(async (sql: string) =>
      sql.includes('SELECT instance_id, status, revision')
        ? result([{
            instance_id: 'tenant-b',
            status: 'prepared' as const,
            revision: 1,
            created_at: new Date('2026-09-07T12:00:00.000Z'),
            updated_at: new Date('2026-09-07T12:00:00.000Z'),
          }])
        : result([])
    );
    const client = { query, release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn(async () => client) } as unknown as Pool;

    await expect(readSsfTenant(pool, 'tenant-b')).resolves.toEqual(
      expect.objectContaining({ instanceId: 'tenant-b', status: 'prepared', revision: 1 })
    );
    expect(query).toHaveBeenNthCalledWith(1, 'BEGIN READ ONLY');
    expect(query).toHaveBeenNthCalledWith(2, 'SELECT set_config($1, $2, true);', [
      'app.instance_id',
      'tenant-b',
    ]);
    expect(
      query.mock.calls.some(
        ([sql, values]) =>
          typeof sql === 'string' &&
          sql.includes('FROM ssf.tenants') &&
          sql.includes('WHERE instance_id = $1') &&
          Array.isArray(values) &&
          values[0] === 'tenant-b'
      )
    ).toBe(true);

    const connectionsBeforeInvalidInput = vi.mocked(pool.connect).mock.calls.length;
    await expect(readSsfTenant(pool, ' '.repeat(3))).rejects.toThrow(
      'ssf_tenant_instance_id_invalid'
    );
    await expect(readSsfTenant(pool, ' tenant-b ')).rejects.toThrow(
      'ssf_tenant_instance_id_invalid'
    );
    await expect(readSsfTenant(pool, 'Tenant-B')).rejects.toThrow(
      'ssf_tenant_instance_id_invalid'
    );
    await expect(readSsfTenant(pool, 'xn--tenant-b')).rejects.toThrow(
      'ssf_tenant_instance_id_invalid'
    );
    expect(vi.mocked(pool.connect)).toHaveBeenCalledTimes(connectionsBeforeInvalidInput);
  });

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
