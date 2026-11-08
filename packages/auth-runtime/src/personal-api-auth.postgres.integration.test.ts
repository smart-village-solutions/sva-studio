import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryClient } from './db.js';

const mocks = vi.hoisted(() => ({ db: vi.fn(), jwks: vi.fn(), control: vi.fn() }));
vi.mock('./db.js', async (original) => ({
  ...(await original<typeof import('./db.js')>()),
  withResolvedInstanceDb: mocks.db,
}));
vi.mock('./redis-session.js', () => ({ getSessionControlState: mocks.control }));
vi.mock('./config-request.js', () => ({
  resolvePersonalApiAuthBinding: async () => ({
    issuer: 'https://synthetic.invalid/realm',
    audience: 'studio',
    scope: { kind: 'instance', instanceId: 'synthetic-tenant' },
  }),
}));
vi.mock('./middleware-hosts.js', () => ({
  resolveSessionUser: async (_r: Request, user: unknown) => user,
}));
vi.mock('./service-token.js', () => ({
  getRemoteServiceJwks: mocks.jwks,
  isServiceIdentityProviderUnavailable: () => false,
}));

import { authenticatePersonalApiRequest } from './personal-api-auth.js';
import { loadPermissionsWithClient, loadTenantPermissionProjectionSubjectsWithClient } from './iam-authorization/permission-store.queries.js';
import { enrichSessionUserWithEffectiveRoles } from './effective-session-roles.js';

const url = process.env.IAM_OWASP_TEST_DATABASE_URL;
const pool = url ? new Pool({ connectionString: url, max: 3 }) : null;
const schema = `owasp_auth_${randomUUID().replaceAll('-', '')}`;
const accountId = randomUUID();
const roleId = randomUUID();
const groupId = randomUUID();
const permissionId = randomUUID();
const organizationId = randomUUID();
const subject = 'synthetic-subject';
const tenant = 'synthetic-tenant';
const execute = async (sql: string, values: readonly unknown[] = []) => {
  if (!pool) throw new Error('isolated test database required');
  return pool.query(sql.replaceAll('iam.', `${schema}.`), [...values]);
};
const client: QueryClient = {
  async query<TRow>(sql: string, values?: readonly unknown[]) {
    const result = await execute(sql, values);
    return { rows: result.rows as TRow[], rowCount: result.rowCount ?? 0 };
  },
};

describe.skipIf(!url)('personal tokens against committed PostgreSQL account state', () => {
  let signed: string;
  beforeAll(async () => {
    if (!pool) throw new Error('isolated test database required');
    await pool.query(`CREATE SCHEMA ${schema}`);
    const snapshot = readFileSync(
      new URL('../../../docs/development/studio-db-schema-final.sql', import.meta.url),
      'utf8'
    );
    for (const table of [
      'accounts',
      'instance_memberships',
      'account_roles',
      'roles',
      'permissions',
      'role_permissions',
      'organizations',
      'account_groups',
      'groups',
      'group_roles',
      'delegations',
      'account_organizations',
      'instance_modules',
    ]) {
      const start = snapshot.indexOf(`CREATE TABLE iam.${table} (`);
      if (start < 0) throw new Error(`snapshot table missing: ${table}`);
      await execute(snapshot.slice(start, snapshot.indexOf('\n);', start) + 3));
    }
    await execute(
      "INSERT INTO iam.organizations(id,instance_id,organization_key,display_name) VALUES($1,$2,'test','Test')",
      [organizationId, tenant]
    );
    const keys = await generateKeyPair('RS256');
    mocks.jwks.mockReturnValue(createLocalJWKSet({ keys: [await exportJWK(keys.publicKey)] }));
    signed = await new SignJWT({ azp: 'sva-studio-mcp-personal' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://synthetic.invalid/realm')
      .setAudience('studio')
      .setSubject(subject)
      .setExpirationTime('10m')
      .sign(keys.privateKey);
    mocks.db.mockImplementation(
      async (_resolve, _instance, work: (db: QueryClient) => Promise<unknown>) => work(client)
    );
    await execute(
      "INSERT INTO iam.instance_modules(instance_id,module_id,effective_active) VALUES($1,'iam',true)",
      [tenant]
    );
    await execute(
      "INSERT INTO iam.roles(id,instance_id,role_name,role_key,display_name,external_role_name) VALUES($1,$2,'admin','system_admin','Synthetic admin','system_admin')",
      [roleId, tenant]
    );
    await execute(
      "INSERT INTO iam.permissions(id,instance_id,permission_key,action,resource_type) VALUES($1,$2,$3,$3,'iam')",
      [permissionId, tenant, 'iam.user.read']
    );
    await execute(
      "INSERT INTO iam.groups(id,instance_id,group_key,display_name,group_type) VALUES($1,$2,'test','Test','role_bundle')",
      [groupId, tenant]
    );
    await execute('INSERT INTO iam.group_roles(instance_id,group_id,role_id) VALUES($1,$2,$3)', [tenant, groupId, roleId]);
    await execute(
      'INSERT INTO iam.role_permissions(instance_id,role_id,permission_id) VALUES($1,$2,$3)',
      [tenant, roleId, permissionId]
    );
  });
  beforeEach(async () => {
    mocks.control.mockResolvedValue(undefined);
    await execute('DELETE FROM iam.account_groups');
    await execute('DELETE FROM iam.account_roles');
    await execute('DELETE FROM iam.instance_memberships');
    await execute('DELETE FROM iam.accounts');
    await execute(
      "INSERT INTO iam.accounts(id,instance_id,keycloak_subject,status) VALUES($1,$2,$3,'active')",
      [accountId, tenant, subject]
    );
    await execute('INSERT INTO iam.instance_memberships(instance_id,account_id) VALUES($1,$2)', [
      tenant,
      accountId,
    ]);
    await execute(
      'INSERT INTO iam.account_roles(instance_id,account_id,role_id) VALUES($1,$2,$3)',
      [tenant, accountId, roleId]
    );
  });
  afterAll(async () => {
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await pool.end();
    }
  });
  const request = () =>
    new Request('https://synthetic.invalid/api/v1/iam/users', {
      headers: { authorization: `Bearer ${signed}` },
    });

  it.each([
    "status = 'inactive'",
    'is_blocked = true',
    'soft_deleted_at = NOW()',
    'permanently_deleted_at = NOW()',
    "deletion_lifecycle_state = 'deactivated'",
    'deactivated_at = NOW()',
  ])(
    'blocks the same signed token after committing %s while preserving grants',
    async (assignment) => {
      const projectionInput = { instanceId: tenant, permissionIds: ['iam.user.read'] };
      expect(await loadTenantPermissionProjectionSubjectsWithClient(client, projectionInput)).not.toEqual([]);
      expect(await authenticatePersonalApiRequest(request())).toMatchObject({
        user: { roles: ['system_admin'] },
      });
      expect(
        await loadPermissionsWithClient(client, { instanceId: tenant, keycloakSubject: subject })
      ).not.toEqual([]);
      expect(
        await loadPermissionsWithClient(client, {
          instanceId: tenant,
          keycloakSubject: subject,
          organizationId,
        })
      ).not.toEqual([]);
      await execute(`UPDATE iam.accounts SET ${assignment} WHERE id = $1`, [accountId]);
      expect(await loadTenantPermissionProjectionSubjectsWithClient(client, projectionInput)).toEqual([]);
      const rejected = await authenticatePersonalApiRequest(request());
      expect(rejected).toBeInstanceOf(Response);
      expect((rejected as Response).status).toBe(403);
      expect(
        (await execute('SELECT count(*)::int AS count FROM iam.account_roles')).rows[0].count
      ).toBe(1);
      expect(
        await loadPermissionsWithClient(client, { instanceId: tenant, keycloakSubject: subject })
      ).toEqual([]);
      expect(
        await loadPermissionsWithClient(client, {
          instanceId: tenant,
          keycloakSubject: subject,
          organizationId,
        })
      ).toEqual([]);
      const user = await enrichSessionUserWithEffectiveRoles({
        id: subject,
        instanceId: tenant,
        roles: ['system_admin'],
      });
      expect(user.roles).toEqual([]);
    }
  );

  it('preserves browser roles and permissions under a processing restriction while denying personal tokens', async () => {
    await execute('UPDATE iam.accounts SET processing_restricted_at = NOW() WHERE id = $1', [accountId]);
    for (const source of ['direct', 'group']) {
      if (source === 'group') {
        await execute('DELETE FROM iam.account_roles');
        await execute('INSERT INTO iam.account_groups(instance_id,account_id,group_id) VALUES($1,$2,$3)', [tenant, accountId, groupId]);
      }
      expect(((await authenticatePersonalApiRequest(request())) as Response).status).toBe(403);
      const browserUser = await enrichSessionUserWithEffectiveRoles({ id: subject, instanceId: tenant, roles: [] });
      expect(browserUser.roles).toEqual(['system_admin']);
      for (const scope of [
        { instanceId: tenant, keycloakSubject: subject },
        { instanceId: tenant, keycloakSubject: subject, organizationId },
      ]) {
        expect(await loadPermissionsWithClient(client, scope)).not.toEqual([]);
      }
      expect(await loadTenantPermissionProjectionSubjectsWithClient(client, {
        instanceId: tenant, permissionIds: ['iam.user.read'],
      })).toEqual([]);
    }
  });

  it('allows an explicitly reactivated account with its retained role', async () => {
    await execute("UPDATE iam.accounts SET status = 'inactive'");
    expect(((await authenticatePersonalApiRequest(request())) as Response).status).toBe(403);
    await execute("UPDATE iam.accounts SET status = 'active'");
    expect(await authenticatePersonalApiRequest(request())).toMatchObject({
      user: { roles: ['system_admin'] },
    });
  });
  it('rejects a missing or foreign tenant membership without provisioning one', async () => {
    await execute("UPDATE iam.instance_memberships SET instance_id = 'foreign-tenant'");
    expect(((await authenticatePersonalApiRequest(request())) as Response).status).toBe(403);
    await execute('DELETE FROM iam.accounts');
    expect(((await authenticatePersonalApiRequest(request())) as Response).status).toBe(403);
    expect((await execute('SELECT count(*)::int AS count FROM iam.accounts')).rows[0].count).toBe(
      0
    );
  });
});
