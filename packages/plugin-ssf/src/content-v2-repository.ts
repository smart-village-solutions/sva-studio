import { createHash } from 'node:crypto';
import { canonicalize } from 'json-canonicalize';
import type { Pool, PoolClient } from 'pg';
import { ZodError } from 'zod';

import {
  ssfInstallationContentV2FieldsSchema,
  ssfRuntimeContentV2FieldsSchema,
  type SsfInstallationContentV2Fields,
  type SsfRuntimeContentV2Fields,
} from './content-v2-contracts.js';
import { resolveSsfRuntimeContentV2, sanitizeSsfContentV2Fields } from './content-v2.js';
import { withTenantTransaction } from './repository.transaction.js';

type SystemRow = {
  installation_content_v2: unknown;
  runtime_content_v2: unknown;
};
type TenantRow = { runtime_content_v2: unknown };

export type SsfSystemContentV2 = Readonly<{
  installation: SsfInstallationContentV2Fields | null;
  runtimeTemplate: SsfRuntimeContentV2Fields | null;
}>;
export type SsfTenantContentV2 = Readonly<{
  runtimeTemplate: SsfRuntimeContentV2Fields | null;
  overrides: Record<string, unknown> | null;
}>;

export const readSsfSystemContentV2 = async (pool: Pool): Promise<SsfSystemContentV2> => {
  const result = await pool.query<SystemRow>(
    'SELECT installation_content_v2, runtime_content_v2 FROM ssf.server_settings WHERE singleton = true'
  );
  const row = result.rows[0];
  return {
    installation:
      row?.installation_content_v2 == null
        ? null
        : ssfInstallationContentV2FieldsSchema.parse(row.installation_content_v2),
    runtimeTemplate:
      row?.runtime_content_v2 == null
        ? null
        : ssfRuntimeContentV2FieldsSchema.parse(row.runtime_content_v2),
  };
};

export const readSsfInstallationContentV2 = async (
  pool: Pool
): Promise<SsfInstallationContentV2Fields | null> => {
  const result = await pool.query<Pick<SystemRow, 'installation_content_v2'>>(
    'SELECT installation_content_v2 FROM ssf.server_settings WHERE singleton = true'
  );
  const stored = result.rows[0]?.installation_content_v2;
  return stored == null ? null : ssfInstallationContentV2FieldsSchema.parse(stored);
};

export const readSsfTenantContentV2 = async (
  pool: Pool,
  instanceId: string
): Promise<SsfTenantContentV2> =>
  withTenantTransaction(pool, instanceId, true, async (client) => {
    // One SQL snapshot: a template and its overrides cannot come from different commits.
    const result = await client.query<{ template: unknown; overrides: unknown }>(
      `SELECT (SELECT runtime_content_v2 FROM ssf.server_settings WHERE singleton = true) AS template,
              (SELECT runtime_content_v2 FROM ssf.tenant_settings WHERE instance_id = $1) AS overrides`,
      [instanceId]
    );
    const template = result.rows[0]?.template;
    const overrides = result.rows[0]?.overrides;
    return {
      runtimeTemplate: template == null ? null : ssfRuntimeContentV2FieldsSchema.parse(template),
      overrides: overrides == null ? null : (overrides as Record<string, unknown>),
    };
  });

const assertExistingTenantContent = async (
  client: PoolClient,
  runtimeTemplate: SsfRuntimeContentV2Fields | null
): Promise<void> => {
  if (runtimeTemplate === null) return;
  const tenants = await client.query<{ instance_id: string; runtime_content_v2: unknown }>(
    'SELECT instance_id, runtime_content_v2 FROM ssf.tenant_settings WHERE runtime_content_v2 IS NOT NULL'
  );
  const affectedTenants: string[] = [];
  for (const tenant of tenants.rows) {
    try {
      resolveSsfRuntimeContentV2({
        tenant: {
          id: tenant.instance_id,
          displayName: tenant.instance_id,
          timeZone: 'Europe/Berlin',
        },
        template: runtimeTemplate,
        overrides: tenant.runtime_content_v2,
      });
    } catch (error) {
      if (!(error instanceof ZodError)) throw error;
      affectedTenants.push(tenant.instance_id);
    }
  }
  if (affectedTenants.length) throw new SsfContentV2TenantConflict(affectedTenants);
};

export const replaceSsfSystemContentV2 = async (
  pool: Pool,
  input: SsfSystemContentV2,
  options: SsfContentWriteOptions<SsfSystemContentV2>
): Promise<SsfSystemContentV2> => {
  const installation =
    input.installation === null
      ? null
      : ssfInstallationContentV2FieldsSchema.parse(sanitizeSsfContentV2Fields(input.installation));
  const runtimeTemplate =
    input.runtimeTemplate === null
      ? null
      : ssfRuntimeContentV2FieldsSchema.parse(sanitizeSsfContentV2Fields(input.runtimeTemplate));
  if (runtimeTemplate !== null) {
    // Control characters use the largest JSON escape for each allowed tenant-profile character.
    resolveSsfRuntimeContentV2({
      tenant: {
        id: '\u0000'.repeat(128),
        displayName: '\u0000'.repeat(200),
        timeZone: '\u0000'.repeat(100),
      },
      template: runtimeTemplate,
      overrides: null,
    });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('ssf.content.v2', 0))");
    const stored = await client.query<SystemRow>(
      'SELECT installation_content_v2, runtime_content_v2 FROM ssf.server_settings WHERE singleton = true'
    );
    const previous: SsfSystemContentV2 = {
      installation: (stored.rows[0]?.installation_content_v2 ??
        null) as SsfSystemContentV2['installation'],
      runtimeTemplate: (stored.rows[0]?.runtime_content_v2 ??
        null) as SsfSystemContentV2['runtimeTemplate'],
    };
    assertSsfAdminContentRevision('platform', previous, options.expectedRevision);
    options.validate?.(previous);
    await assertExistingTenantContent(client, runtimeTemplate);
    if (installation !== null) {
      await client.query(
        `INSERT INTO ssf.server_settings (singleton, installation_content_v2)
         VALUES (true, $1::jsonb)
         ON CONFLICT (singleton) DO UPDATE SET
           installation_content_v2 = EXCLUDED.installation_content_v2,
           updated_at = now()`,
        [JSON.stringify(installation)]
      );
    }
    if (runtimeTemplate !== null) {
      await client.query(
        `INSERT INTO ssf.server_settings (singleton, runtime_content_v2)
         VALUES (true, $1::jsonb)
         ON CONFLICT (singleton) DO UPDATE SET
           runtime_content_v2 = EXCLUDED.runtime_content_v2,
           updated_at = now()`,
        [JSON.stringify(runtimeTemplate)]
      );
    }
    const next = {
      installation: installation ?? previous.installation,
      runtimeTemplate: runtimeTemplate ?? previous.runtimeTemplate,
    };
    await client.query('COMMIT');
    return next;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

export const writeSsfTenantContentV2 = async (
  pool: Pool,
  instanceId: string,
  input: unknown,
  options: SsfContentWriteOptions<SsfTenantContentV2>
): Promise<SsfTenantContentV2> =>
  withTenantTransaction(pool, instanceId, false, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('ssf.content.v2', 0))");
    const system = await client.query<Pick<SystemRow, 'runtime_content_v2'>>(
      'SELECT runtime_content_v2 FROM ssf.server_settings WHERE singleton = true'
    );
    const template = system.rows[0]?.runtime_content_v2;
    const tenant = await client.query<TenantRow>(
      'SELECT runtime_content_v2 FROM ssf.tenant_settings WHERE instance_id = $1',
      [instanceId]
    );
    const previous: SsfTenantContentV2 = {
      runtimeTemplate: (template ?? null) as SsfTenantContentV2['runtimeTemplate'],
      overrides: (tenant.rows[0]?.runtime_content_v2 ?? null) as SsfTenantContentV2['overrides'],
    };
    assertSsfAdminContentRevision(instanceId, previous, options.expectedRevision);
    options.validate?.(previous);
    if (template == null || typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new Error('ssf_v2_tenant_content_invalid');
    }
    const sanitized = sanitizeSsfContentV2Fields(input) as Record<string, unknown>;
    resolveSsfRuntimeContentV2({
      tenant: { id: instanceId, displayName: 'Validation', timeZone: 'Europe/Berlin' },
      template,
      overrides: sanitized,
    });
    await client.query(
      `INSERT INTO ssf.tenant_settings (instance_id, runtime_content_v2)
       VALUES ($1, $2::jsonb)
       ON CONFLICT (instance_id) DO UPDATE SET
         runtime_content_v2 = EXCLUDED.runtime_content_v2,
         updated_at = now()`,
      [instanceId, JSON.stringify(sanitized)]
    );
    return { runtimeTemplate: previous.runtimeTemplate, overrides: sanitized };
  });

export class SsfContentV2TenantConflict extends Error {
  constructor(readonly affectedTenants: readonly string[]) {
    super('ssf_v2_affected_tenant_policy_invalid');
  }
}

/** Hash raw administrative state, including explicit overrides and the bound scope. */
export const createSsfAdminContentRevision = (
  scope: string,
  value: SsfSystemContentV2 | SsfTenantContentV2
): string =>
  `sha256:${createHash('sha256').update(canonicalize({ scope, value }), 'utf8').digest('hex')}`;

export type SsfContentWriteOptions<T> = Readonly<{
  expectedRevision: string;
  validate?: (previous: T) => void;
}>;

export class SsfContentRevisionConflict extends Error {
  constructor() {
    super('ssf_content_revision_conflict');
  }
}
const assertSsfAdminContentRevision = (
  scope: string,
  value: SsfSystemContentV2 | SsfTenantContentV2,
  expected: string
) => {
  if (createSsfAdminContentRevision(scope, value) !== expected)
    throw new SsfContentRevisionConflict();
};
