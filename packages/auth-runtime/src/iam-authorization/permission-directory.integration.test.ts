import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { protectField } from '@sva/server-runtime';
import { readTenantPermissionDirectorySubjects } from './tenant-permission-projection.js';
import { resolvePool } from './shared-scope.js';
import { loadTenantPermissionProjectionSubjectsWithClient } from './permission-store.queries.js';

it.skipIf(!process.env.IAM_DIRECTORY_TEST_DATABASE_URL)(
  'resolves committed tenant grants, scopes, group validity and account lifecycle in PostgreSQL',
  async () => {
    const pool = new Pool({ connectionString: process.env.IAM_DIRECTORY_TEST_DATABASE_URL });
    const client = await pool.connect();
    await client.query('BEGIN');
    try {
      const tenantA = 'identity-directory-a';
      const tenantB = 'identity-directory-b';
      const ids = {
        reviewer: '10000000-0000-4000-8000-000000000001',
        other: '10000000-0000-4000-8000-000000000002',
        role: '10000000-0000-4000-8000-000000000003',
        permission: '10000000-0000-4000-8000-000000000004',
        group: '10000000-0000-4000-8000-000000000005',
      };
      for (const tenant of [tenantA, tenantB])
        await client.query(
          "INSERT INTO iam.instances(id,display_name,primary_hostname,auth_realm,auth_client_id,tenant_admin_client_id) VALUES($1,'Synthetic tenant',$1 || '.example.test',$1,'studio','synthetic-admin')",
          [tenant]
        );
      await client.query(
        "INSERT INTO iam.instance_modules(instance_id,module_id,effective_active) VALUES($1,'ssf',true)",
        [tenantA]
      );
      await client.query(
        "INSERT INTO iam.accounts(id,instance_id,keycloak_subject,status,competence_languages,display_name_ciphertext) VALUES($1,$2,'synthetic-reviewer','active',ARRAY['de','en-US'],$3),($4,$5,'synthetic-other','active','{}',NULL)",
        [
          ids.reviewer,
          tenantA,
          protectField('Synthetic Reviewer', 'iam.accounts.display_name:synthetic-reviewer'),
          ids.other,
          tenantB,
        ]
      );
      await client.query(
        'INSERT INTO iam.instance_memberships(instance_id,account_id) VALUES($1,$2),($3,$4)',
        [tenantA, ids.reviewer, tenantB, ids.other]
      );
      await client.query(
        "INSERT INTO iam.roles(id,instance_id,role_name,role_key,display_name,external_role_name) VALUES($1,$2,'reviewer','reviewer','Synthetic reviewer','reviewer')",
        [ids.role, tenantA]
      );
      await client.query(
        "INSERT INTO iam.permissions(id,instance_id,permission_key,action,resource_type) VALUES($1,$2,'ssf.recording.review','ssf.recording.review','ssf')",
        [ids.permission, tenantA]
      );
      await client.query(
        'INSERT INTO iam.role_permissions(instance_id,role_id,permission_id) VALUES($1,$2,$3)',
        [tenantA, ids.role, ids.permission]
      );
      await client.query(
        "INSERT INTO iam.groups(id,instance_id,group_key,display_name,group_type) VALUES($1,$2,'reviewers','Synthetic reviewers','role_bundle')",
        [ids.group, tenantA]
      );
      await client.query(
        'INSERT INTO iam.group_roles(instance_id,group_id,role_id) VALUES($1,$2,$3)',
        [tenantA, ids.group, ids.role]
      );
      await client.query(
        'INSERT INTO iam.account_groups(instance_id,group_id,account_id) VALUES($1,$2,$3)',
        [tenantA, ids.group, ids.reviewer]
      );
      // Tenant B has its own real grant; it must never leak into A's read.
      await client.query("INSERT INTO iam.instance_modules(instance_id,module_id,effective_active) VALUES($1,'ssf',true)", [tenantB]);
      await client.query("INSERT INTO iam.roles(id,instance_id,role_name,role_key,display_name,external_role_name) VALUES('10000000-0000-4000-8000-000000000006',$1,'reviewer','reviewer','Synthetic other reviewer','reviewer')", [tenantB]);
      await client.query("INSERT INTO iam.permissions(id,instance_id,permission_key,action,resource_type) VALUES('10000000-0000-4000-8000-000000000007',$1,'ssf.recording.review','ssf.recording.review','ssf')", [tenantB]);
      await client.query("INSERT INTO iam.role_permissions(instance_id,role_id,permission_id) VALUES($1,'10000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000007')", [tenantB]);
      await client.query("INSERT INTO iam.account_roles(instance_id,account_id,role_id) VALUES($1,$2,'10000000-0000-4000-8000-000000000006')", [tenantB, ids.other]);
      await client.query('COMMIT');
      expect(
        await readTenantPermissionDirectorySubjects({
          instanceId: tenantA,
          permissionIds: ['ssf.recording.review'],
        })
      ).toMatchObject([
        { keycloakSubject: 'synthetic-reviewer', displayName: 'Synthetic Reviewer' },
      ]);
      expect(
        await readTenantPermissionDirectorySubjects({
          instanceId: tenantB,
          permissionIds: ['ssf.recording.review'],
        })
      ).toMatchObject([{ keycloakSubject: 'synthetic-other' }]);
      await client.query('BEGIN');
      const read = async (instanceId = tenantA) =>
        loadTenantPermissionProjectionSubjectsWithClient(client, {
          instanceId,
          permissionIds: ['ssf.recording.review'],
          includeProfile: true,
        });
      expect(await read()).toMatchObject([
        {
          keycloakSubject: 'synthetic-reviewer',
          displayName: 'Synthetic Reviewer',
          languages: ['de', 'en-US'],
          permissionIds: ['ssf.recording.review'],
        },
      ]);
      expect(await read(tenantB)).toMatchObject([{ keycloakSubject: 'synthetic-other' }]);
      for (const scope of ['own', 'organization']) {
        await client.query('UPDATE iam.role_permissions SET access_scope=$1 WHERE role_id=$2', [
          scope,
          ids.role,
        ]);
        expect(await read()).toEqual([]);
      }
      await client.query("UPDATE iam.role_permissions SET access_scope='all' WHERE role_id=$1", [
        ids.role,
      ]);
      for (const predicate of [
        "status='inactive'",
        'is_blocked=true',
        "deletion_lifecycle_state='pseudonymized'",
        'soft_deleted_at=now()',
        'permanently_deleted_at=now()',
        'processing_restricted_at=now()',
        'deactivated_at=now()',
      ]) {
        await client.query('SAVEPOINT account_state');
        await client.query(`UPDATE iam.accounts SET ${predicate} WHERE id=$1`, [ids.reviewer]);
        expect(await read()).toEqual([]);
        await client.query('ROLLBACK TO SAVEPOINT account_state');
      }
      await client.query(
        "UPDATE iam.account_groups SET valid_from=now()+interval '1 day' WHERE account_id=$1",
        [ids.reviewer]
      );
      expect(await read()).toEqual([]);
      await client.query(
        "UPDATE iam.account_groups SET valid_from=now()-interval '2 days',valid_until=now()-interval '1 day' WHERE account_id=$1",
        [ids.reviewer]
      );
      expect(await read()).toEqual([]);
      await client.query(
        'UPDATE iam.account_groups SET valid_from=NULL,valid_until=NULL WHERE account_id=$1',
        [ids.reviewer]
      );
      await client.query('UPDATE iam.groups SET is_active=false WHERE id=$1', [ids.group]);
      expect(await read()).toEqual([]);
      await client.query(
        'INSERT INTO iam.account_roles(instance_id,account_id,role_id) VALUES($1,$2,$3)',
        [tenantA, ids.reviewer, ids.role]
      );
      expect(await read()).toHaveLength(1);
      await client.query(
        "UPDATE iam.account_roles SET valid_from=now()-interval '2 days',valid_to=now()-interval '1 day' WHERE account_id=$1",
        [ids.reviewer]
      );
      expect(await read()).toEqual([]);
      await client.query('UPDATE iam.groups SET is_active=true WHERE id=$1', [ids.group]);
      expect(await read()).toHaveLength(1);
      await client.query('DELETE FROM iam.role_permissions WHERE role_id=$1', [ids.role]);
      expect(await read()).toEqual([]);
      await client.query('COMMIT');
      expect(
        await readTenantPermissionDirectorySubjects({
          instanceId: tenantA,
          permissionIds: ['ssf.recording.review'],
        })
      ).toEqual([]);
      await client.query('BEGIN');
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await pool.end();
      await resolvePool()?.end();
    }
  }
);
