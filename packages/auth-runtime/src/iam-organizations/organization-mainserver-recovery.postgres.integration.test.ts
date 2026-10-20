import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMainserverCredentialFingerprint } from '../mainserver-credential-readiness.js';
import { revealField } from '../iam-account-management/encryption.js';

const mocks = vi.hoisted(() => ({ db: vi.fn(), identity: vi.fn(), attributes: vi.fn() }));
vi.mock('../iam-account-management/shared-runtime.js', () => ({
  withInstanceScopedDb: mocks.db,
  resolveIdentityProviderForInstance: mocks.identity,
}));
import { restoreOrganizationMainserverCredentials } from './organization-mainserver-recovery.js';

const databaseUrl = process.env.IAM_CREDENTIAL_RECOVERY_TEST_DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl, max: 4 }) : null;
const schema = `credential_recovery_${randomUUID().replaceAll('-', '')}`;
const actorId = randomUUID();
const orgId = randomUUID();
const technicalId = randomUUID();
const input = {
  instanceId: 'tenant',
  organizationId: orgId,
  actorAccountId: actorId,
  actorSubject: 'actor-subject',
  requestId: 'request',
  reauthorize: vi.fn(
    async (): Promise<{ instanceRevision: number; userRevision: number } | null> => ({
      instanceRevision: 1,
      userRevision: 1,
    })
  ),
};
const credentials = { apiKey: 'application', apiSecret: 'fixture-only-secret' };
const fingerprint = createMainserverCredentialFingerprint({
  instanceId: 'tenant',
  source: 'organization',
  principalId: orgId,
  credentials,
});
const db = () => {
  if (!pool) throw new Error('local test database missing');
  return pool;
};
const execute = (sql: string, params: readonly unknown[] = []) =>
  db().query(sql.replaceAll('iam.', `${schema}.`), [...params]);
const readCredentials = async () =>
  (await execute('SELECT * FROM iam.organization_mainserver_credentials')).rows[0];
const attributes = () => ({
  instanceId: ['tenant'],
  organizationId: [orgId],
  accountPurpose: ['organization_mainserver'],
  mainserverUserApplicationId: [credentials.apiKey],
  mainserverUserApplicationSecret: [credentials.apiSecret],
});

describe.skipIf(!databaseUrl)('organization recovery against PostgreSQL', () => {
  beforeAll(async () => {
    vi.stubEnv('IAM_PII_ACTIVE_KEY_ID', 'fixture-key');
    vi.stubEnv(
      'IAM_PII_KEYRING_JSON',
      JSON.stringify({ 'fixture-key': Buffer.alloc(32, 7).toString('base64') })
    );
    await db().query(`CREATE SCHEMA ${schema}`);
    const snapshot = readFileSync(
      new URL('../../../../docs/development/studio-db-schema-final.sql', import.meta.url),
      'utf8'
    );
    for (const table of [
      'accounts',
      'organizations',
      'account_organizations',
      'organization_mainserver_credentials',
      'mainserver_data_provider_bindings',
      'activity_logs',
      'permission_cache_instance_revisions',
      'permission_cache_user_revisions',
    ]) {
      const beginning = snapshot.indexOf(`CREATE TABLE iam.${table} (`);
      if (beginning < 0) throw new Error(`schema snapshot missing ${table}`);
      await execute(snapshot.slice(beginning, snapshot.indexOf('\n);', beginning) + 3));
    }
    mocks.db.mockImplementation(async (_instance, work) => {
      const client = await db().connect();
      try {
        await client.query('BEGIN');
        const result = await work({
          query: (sql: string, params?: readonly unknown[]) =>
            client.query(sql.replaceAll('iam.', `${schema}.`), params ? [...params] : []),
        });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });
    mocks.identity.mockResolvedValue({ provider: { getUserAttributes: mocks.attributes } });
  });

  beforeEach(async () => {
    input.reauthorize.mockReset().mockResolvedValue({ instanceRevision: 1, userRevision: 1 });
    await db().query(
      `TRUNCATE ${schema}.accounts, ${schema}.organizations, ${schema}.account_organizations, ${schema}.organization_mainserver_credentials, ${schema}.mainserver_data_provider_bindings, ${schema}.activity_logs, ${schema}.permission_cache_instance_revisions, ${schema}.permission_cache_user_revisions`
    );
    await execute(
      "INSERT INTO iam.accounts (id, instance_id, keycloak_subject, status) VALUES ($1, 'tenant', 'actor-subject', 'active'), ($2, 'tenant', 'technical-subject', 'active')",
      [actorId, technicalId]
    );
    await execute(
      "INSERT INTO iam.organizations (id, instance_id, organization_key, display_name) VALUES ($1, 'tenant', 'organization', 'Fixture organization')",
      [orgId]
    );
    await execute(
      "INSERT INTO iam.account_organizations (account_id, organization_id, instance_id) VALUES ($1, $2, 'tenant')",
      [actorId, orgId]
    );
    await execute(
      "INSERT INTO iam.organization_mainserver_credentials (instance_id, organization_id, technical_account_id, provisioning_status, mainserver_application_id, last_verified_at) VALUES ('tenant', $1, $2, 'ready', 'application', '2026-10-19T12:00:00Z')",
      [orgId, technicalId]
    );
    await execute(
      "INSERT INTO iam.mainserver_data_provider_bindings (instance_id, principal_type, principal_id, credential_fingerprint, data_provider_id, status, evidence_kind) VALUES ('tenant', 'organization', $1, $2, 'provider', 'verified', 'identity_endpoint')",
      [orgId, fingerprint]
    );
    mocks.attributes.mockReset().mockImplementation(async () => attributes());
  });

  afterAll(async () => {
    if (pool) {
      await db().query(`DROP SCHEMA ${schema} CASCADE`);
      await db().end();
    }
    vi.unstubAllEnvs();
  });

  it('restores an encrypted pair atomically and preserves binding and actual verification time', async () => {
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('restored');
    const row = await readCredentials();
    expect(row.mainserver_application_secret_ciphertext).toMatch(/^enc:v1:/);
    expect(
      revealField(
        row.mainserver_application_secret_ciphertext,
        `iam.organization_mainserver_credentials.mainserver_application_secret:${orgId}`
      )
    ).toBe(credentials.apiSecret);
    expect(row.last_verified_at.toISOString()).toBe('2026-10-19T12:00:00.000Z');
    expect(
      (await execute('SELECT status FROM iam.mainserver_data_provider_bindings')).rows
    ).toEqual([{ status: 'verified' }]);
    expect((await execute('SELECT event_type, payload FROM iam.activity_logs')).rows).toEqual([
      {
        event_type: 'organization.mainserver_credentials_restored',
        payload: { operation: 'restore_known_organization_credentials', organization_id: orgId },
      },
    ]);
  });

  it.each([
    'not_provisioned',
    'account_ready',
    'provisioning',
    'verification_required',
    'failed',
    'reconciliation_required',
  ])('does not promote %s to ready', async (status) => {
    await execute('UPDATE iam.organization_mainserver_credentials SET provisioning_status = $1', [
      status,
    ]);
    expect(await restoreOrganizationMainserverCredentials(input)).toBe(
      'organization_state_not_recoverable'
    );
    expect((await readCredentials()).mainserver_application_secret_ciphertext).toBeNull();
    expect(mocks.attributes).not.toHaveBeenCalled();
  });

  it.each(['historical', 'revoked', 'pending', 'conflict'])(
    'does not reactivate %s bindings',
    async (status) => {
      await execute('UPDATE iam.mainserver_data_provider_bindings SET status = $1', [status]);
      expect(await restoreOrganizationMainserverCredentials(input)).toBe('binding_not_verified');
      expect((await readCredentials()).mainserver_application_secret_ciphertext).toBeNull();
    }
  );

  it('rejects a second verified credential version', async () => {
    await execute(
      "INSERT INTO iam.mainserver_data_provider_bindings (instance_id, principal_type, principal_id, credential_fingerprint, data_provider_id, status, evidence_kind) VALUES ('tenant', 'organization', $1, $2, 'provider', 'verified', 'identity_endpoint')",
      [orgId, 'a'.repeat(64)]
    );
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('binding_not_verified');
  });

  it('rejects a concurrent manual credential update after the candidate was read', async () => {
    mocks.attributes.mockImplementation(async () => {
      await execute(
        "UPDATE iam.organization_mainserver_credentials SET mainserver_application_id = 'new-application', provisioning_status = 'verification_required', updated_at = NOW()"
      );
      return attributes();
    });
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('concurrent_change');
    expect((await readCredentials()).mainserver_application_id).toBe('new-application');
  });

  it('allows just one of two concurrent processes to restore the lost version', async () => {
    let calls = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    mocks.attributes.mockImplementation(async () => {
      if (++calls === 2) release();
      await barrier;
      return attributes();
    });
    const result = await Promise.all([
      restoreOrganizationMainserverCredentials(input),
      restoreOrganizationMainserverCredentials(input),
    ]);
    expect(result.sort()).toEqual(['concurrent_change', 'restored']);
    expect(
      (await execute('SELECT count(*)::int AS count FROM iam.activity_logs')).rows[0].count
    ).toBe(1);
  });

  it('rolls back the credential write when the audit cannot be persisted', async () => {
    await db().query(
      `ALTER TABLE ${schema}.activity_logs ADD CONSTRAINT reject_test_audit CHECK (event_type <> 'organization.mainserver_credentials_restored')`
    );
    try {
      expect(await restoreOrganizationMainserverCredentials(input)).toBe('database_unavailable');
      expect((await readCredentials()).mainserver_application_secret_ciphertext).toBeNull();
    } finally {
      await db().query(`ALTER TABLE ${schema}.activity_logs DROP CONSTRAINT reject_test_audit`);
    }
  });

  it('rejects cross-tenant actors and missing membership without a Keycloak call', async () => {
    await execute("UPDATE iam.accounts SET instance_id = 'other' WHERE id = $1", [actorId]);
    expect(await restoreOrganizationMainserverCredentials(input)).toBe(
      'organization_state_not_recoverable'
    );
    expect(mocks.attributes).not.toHaveBeenCalled();
  });

  it('preserves complete credentials and refuses deleted technical accounts', async () => {
    await execute(
      "UPDATE iam.organization_mainserver_credentials SET mainserver_application_secret_ciphertext = 'existing-secret'"
    );
    expect(await restoreOrganizationMainserverCredentials(input)).toBe(
      'organization_state_not_recoverable'
    );
    await execute(
      'UPDATE iam.organization_mainserver_credentials SET mainserver_application_secret_ciphertext = NULL'
    );
    await execute("UPDATE iam.accounts SET deletion_lifecycle_state = 'deleted' WHERE id = $1", [
      technicalId,
    ]);
    expect(await restoreOrganizationMainserverCredentials(input)).toBe(
      'organization_state_not_recoverable'
    );
    expect(mocks.attributes).not.toHaveBeenCalled();
  });
  it('refuses an active provisioning lease and accepts an expired lease', async () => {
    await execute(
      "UPDATE iam.organization_mainserver_credentials SET lease_expires_at = NOW() + INTERVAL '1 minute'"
    );
    expect(await restoreOrganizationMainserverCredentials(input)).toBe(
      'organization_state_not_recoverable'
    );
    expect(mocks.attributes).not.toHaveBeenCalled();
    await execute(
      "UPDATE iam.organization_mainserver_credentials SET lease_expires_at = NOW() - INTERVAL '1 minute'"
    );
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('restored');
  });

  it('rechecks technical account deletion after the Keycloak read', async () => {
    mocks.attributes.mockImplementation(async () => {
      await execute("UPDATE iam.accounts SET deletion_lifecycle_state = 'deleted' WHERE id = $1", [
        technicalId,
      ]);
      return attributes();
    });
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('concurrent_change');
    expect((await readCredentials()).mainserver_application_secret_ciphertext).toBeNull();
  });

  it('rechecks removed membership before committing credentials', async () => {
    mocks.attributes.mockImplementation(async () => {
      await execute('DELETE FROM iam.account_organizations WHERE account_id = $1', [actorId]);
      return attributes();
    });
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('concurrent_change');
    expect((await readCredentials()).mainserver_application_secret_ciphertext).toBeNull();
  });
  it.each(['instance', 'user'])(
    'refuses a %s permission revision changed after fresh authorization',
    async (scope) => {
      input.reauthorize.mockImplementation(async () => {
        if (scope === 'instance')
          await execute(
            "INSERT INTO iam.permission_cache_instance_revisions(instance_id, revision) VALUES ('tenant', 2)"
          );
        else
          await execute(
            "INSERT INTO iam.permission_cache_user_revisions(instance_id, keycloak_subject, revision) VALUES ('tenant', 'actor-subject', 2)"
          );
        return { instanceRevision: 1, userRevision: 1 };
      });
      expect(await restoreOrganizationMainserverCredentials(input)).toBe('principal_not_allowed');
      expect((await readCredentials()).mainserver_application_secret_ciphertext).toBeNull();
      expect(
        (await execute('SELECT count(*)::int AS count FROM iam.activity_logs')).rows[0].count
      ).toBe(0);
    }
  );

  it('refuses lost session authorization after the candidate read without a partial write', async () => {
    input.reauthorize.mockResolvedValue(null);
    expect(await restoreOrganizationMainserverCredentials(input)).toBe('principal_not_allowed');
    expect((await readCredentials()).mainserver_application_secret_ciphertext).toBeNull();
  });
});
