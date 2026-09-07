import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  claimSsfAuthorizationProjection,
  confirmSsfAuthorizationProjectionReadBack,
  createPostgresSsfAuthorizationProjectionStore,
  createSsfConfigurationRevision,
  createSsfAuthorizationRevision,
  markSsfAuthorizationSessionsRevoked,
  readSsfConfigurationOverrides,
  readReadySsfAuthorizationRevision,
  resolveSsfRuntimeConfiguration,
  stageSsfAuthorizationProjection,
  SSF_AUTHORIZATION_PROJECTION_VERSION,
  upsertSsfTenantLocale,
  upsertSsfTenantSettings,
} from '../src/runtime.js';

const rootDatabaseUrl = process.env['SSF_TEST_ROOT_DATABASE_URL'];
const tenantDatabaseUrl = process.env['SSF_TEST_TENANT_DATABASE_URL'];
const hasDatabase = Boolean(rootDatabaseUrl && tenantDatabaseUrl);

describe.skipIf(!hasDatabase)('SSF PostgreSQL tenant isolation', () => {
  const rootPool = new Pool({ connectionString: rootDatabaseUrl });
  const tenantPool = new Pool({ connectionString: tenantDatabaseUrl });

  beforeAll(async () => {
    await upsertSsfTenantSettings(rootPool, {
      instanceId: 'tenant-a',
      defaultLocale: 'de-DE',
      customBrandingAllowed: false,
      conversationContentStorageAllowed: false,
      conversationContentStorageMode: 'disabled',
      logoMediaReference: null,
      iconMediaReference: null,
    });
    await upsertSsfTenantSettings(rootPool, {
      instanceId: 'tenant-b',
      defaultLocale: 'en',
      customBrandingAllowed: true,
      conversationContentStorageAllowed: true,
      conversationContentStorageMode: 'ask',
      logoMediaReference: null,
      iconMediaReference: null,
    });
    await upsertSsfTenantLocale(rootPool, {
      instanceId: 'tenant-a',
      locale: 'de-DE',
      enabled: true,
    });
    await upsertSsfTenantLocale(rootPool, {
      instanceId: 'tenant-b',
      locale: 'en',
      enabled: true,
    });
  });

  afterAll(async () => {
    await Promise.all([rootPool.end(), tenantPool.end()]);
  });

  it('returns only rows from the transaction-local tenant', async () => {
    const tenantA = await readSsfConfigurationOverrides(tenantPool, 'tenant-a');
    const tenantB = await readSsfConfigurationOverrides(tenantPool, 'tenant-b');

    expect(tenantA.tenantSettings?.defaultLocale).toBe('de-DE');
    expect(tenantA.tenantLocales.map((entry) => entry.locale)).toEqual(['de-DE']);
    expect(tenantB.tenantSettings?.defaultLocale).toBe('en');
    expect(tenantB.tenantLocales.map((entry) => entry.locale)).toEqual(['en']);
  });

  it('enforces RLS even when a query omits the repository predicate', async () => {
    const client = await tenantPool.connect();
    try {
      await client.query('BEGIN READ ONLY');
      await client.query('SELECT set_config($1, $2, true);', ['app.instance_id', 'tenant-a']);
      const result = await client.query<{ instance_id: string }>(
        'SELECT instance_id FROM ssf.tenant_settings ORDER BY instance_id'
      );
      expect(result.rows).toEqual([{ instance_id: 'tenant-a' }]);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('rejects a cross-tenant write and invalid oversized HTML', async () => {
    const tenantClient = await tenantPool.connect();
    try {
      await tenantClient.query('BEGIN');
      await tenantClient.query('SELECT set_config($1, $2, true);', ['app.instance_id', 'tenant-a']);
      await expect(
        tenantClient.query(
          `INSERT INTO ssf.tenant_locales (instance_id, locale, enabled)
           VALUES ('tenant-b', 'de-DE', true)`
        )
      ).rejects.toMatchObject({ code: '42501' });
      await tenantClient.query('ROLLBACK');
    } finally {
      tenantClient.release();
    }

    await expect(
      rootPool.query(
        `INSERT INTO ssf.server_locales (locale, authenticated_home_explanation_html)
         VALUES ($1, $2)`,
        ['fr', '💬'.repeat(16_385)]
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('makes a committed write visible with a new effective revision on the next read', async () => {
    const mediaResolver = {
      resolve: async () => {
        throw new Error('No media reference expected.');
      },
    };
    const beforeOverrides = await readSsfConfigurationOverrides(tenantPool, 'tenant-a');
    const before = await resolveSsfRuntimeConfiguration({
      tenant: {
        id: 'tenant-a',
        displayName: 'Tenant A',
        timeZone: 'Europe/Berlin',
      },
      ...beforeOverrides,
      mediaResolver,
    });

    await upsertSsfTenantLocale(tenantPool, {
      instanceId: 'tenant-a',
      locale: 'de-DE',
      enabled: true,
      authenticatedHomeExplanationHtml: '<p>Unmittelbar geändert</p>',
    });

    const afterOverrides = await readSsfConfigurationOverrides(tenantPool, 'tenant-a');
    const after = await resolveSsfRuntimeConfiguration({
      tenant: {
        id: 'tenant-a',
        displayName: 'Tenant A',
        timeZone: 'Europe/Berlin',
      },
      ...afterOverrides,
      mediaResolver,
    });

    expect(after.localization.locales[0]?.authenticatedHomeExplanationHtml).toBe(
      '<p>Unmittelbar geändert</p>'
    );
    expect(createSsfConfigurationRevision(after)).not.toBe(createSsfConfigurationRevision(before));
  });

  it('publishes an authorization revision only after read-back and session revocation', async () => {
    const desired = {
      contractVersion: SSF_AUTHORIZATION_PROJECTION_VERSION,
      instanceId: 'tenant-a',
      subjects: [
        {
          subject: 'user-a',
          roles: ['user' as const],
          permissions: ['ssf.configuration.tenant.read' as const],
        },
      ],
    };
    const state = await stageSsfAuthorizationProjection(rootPool, desired);
    const revision = createSsfAuthorizationRevision(desired);

    await expect(readReadySsfAuthorizationRevision(tenantPool, 'tenant-a')).resolves.toBeNull();
    expect(
      await claimSsfAuthorizationProjection(rootPool, {
        instanceId: 'tenant-a',
        generation: state.generation,
        desiredRevision: revision,
      })
    ).toBe(true);
    expect(
      await confirmSsfAuthorizationProjectionReadBack(rootPool, {
        desired,
        readBack: desired,
        generation: state.generation,
      })
    ).toBe(true);
    await expect(readReadySsfAuthorizationRevision(tenantPool, 'tenant-a')).resolves.toBeNull();
    expect(
      await markSsfAuthorizationSessionsRevoked(rootPool, {
        instanceId: 'tenant-a',
        generation: state.generation,
        authorizationRevision: revision,
      })
    ).toBe(true);
    await expect(readReadySsfAuthorizationRevision(tenantPool, 'tenant-a')).resolves.toBe(revision);
    await expect(readReadySsfAuthorizationRevision(tenantPool, 'tenant-b')).resolves.toBeNull();

    const desiredSubject = desired.subjects[0];
    if (!desiredSubject) throw new Error('projection fixture requires a subject');
    await stageSsfAuthorizationProjection(rootPool, {
      ...desired,
      subjects: [{ ...desiredSubject, permissions: [] }],
    });
    await expect(readReadySsfAuthorizationRevision(tenantPool, 'tenant-a')).resolves.toBeNull();
  });

  it('serializes projection work per tenant while allowing another tenant to proceed', async () => {
    const store = createPostgresSsfAuthorizationProjectionStore(rootPool);
    let releaseTenantA: (() => void) | undefined;
    const tenantAGate = new Promise<void>((resolve) => {
      releaseTenantA = resolve;
    });
    let tenantAEntered = false;
    let secondTenantAEntered = false;
    let tenantBEntered = false;

    const firstTenantA = store.withTenantLock('tenant-a', async () => {
      tenantAEntered = true;
      await tenantAGate;
    });
    while (!tenantAEntered) await new Promise((resolve) => setTimeout(resolve, 5));

    const secondTenantA = store.withTenantLock('tenant-a', async () => {
      secondTenantAEntered = true;
    });
    const tenantB = store.withTenantLock('tenant-b', async () => {
      tenantBEntered = true;
    });
    await tenantB;
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(tenantBEntered).toBe(true);
    expect(secondTenantAEntered).toBe(false);

    releaseTenantA?.();
    await Promise.all([firstTenantA, secondTenantA]);
    expect(secondTenantAEntered).toBe(true);
  });
});
