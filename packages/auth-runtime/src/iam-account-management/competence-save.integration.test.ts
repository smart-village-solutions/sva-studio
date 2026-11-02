import { Pool } from 'pg';
import { expect, it } from 'vitest';
import {
  createPostgresSsfAuthorizationProjectionStore,
  createSsfAuthorizationProjectionRuntime,
  provisionSsfTenant,
  type SsfAuthorizationProjection,
} from '@sva/plugin-ssf/runtime';
import { configureInstanceRegistryPluginRuntimeSnapshot } from '../iam-instance-registry/plugin-activation-policy-snapshot.js';
import { startConfiguredPluginTenantLifecycle } from '../plugin-tenant-lifecycle/runtime.js';
import { createStudioJobTaskList } from '../plugin-operations/runner-registry.js';
import {
  registerPluginOperationExecutionHandlers,
  getRegisteredStudioJobExecutionRegistry,
} from '../plugin-operations/runner-internal.js';
import { readTenantPermissionProjectionSubjects } from '../iam-authorization/tenant-permission-projection.js';
import { withInstanceScopedDb } from '../iam-authorization/shared-scope.js';
import { notifyPermissionInvalidation, emitActivityLog } from './shared-activity.js';

it.skipIf(!process.env.IAM_DIRECTORY_TEST_DATABASE_URL)(
  'a committed language edit during active reconciliation is durably retried, projected and read back without manual repair',
  async () => {
    const pool = new Pool({ connectionString: process.env.IAM_DIRECTORY_TEST_DATABASE_URL });
    const tenant = 'competence-save-test';
    const accountId = '20000000-0000-4000-8000-000000000001';
    const roleId = '20000000-0000-4000-8000-000000000002';
    const permissionId = '20000000-0000-4000-8000-000000000003';
    await pool.query(
      "INSERT INTO iam.instances(id,display_name,primary_hostname,auth_realm,auth_client_id,tenant_admin_client_id) VALUES($1,'Synthetic tenant',$1||'.example.test',$1,'studio','synthetic-admin')",
      [tenant]
    );
    await pool.query(
      "INSERT INTO iam.instance_modules(instance_id,module_id,effective_active) VALUES($1,'ssf',true)",
      [tenant]
    );
    await pool.query(
      "INSERT INTO iam.accounts(id,instance_id,keycloak_subject,status,competence_languages) VALUES($1,$2,'synthetic-reviewer','active',ARRAY['de'])",
      [accountId, tenant]
    );
    await pool.query('INSERT INTO iam.instance_memberships(instance_id,account_id) VALUES($1,$2)', [
      tenant,
      accountId,
    ]);
    await pool.query(
      "INSERT INTO iam.roles(id,instance_id,role_name,role_key,display_name,external_role_name) VALUES($1,$2,'reviewer','reviewer','Synthetic reviewer','reviewer')",
      [roleId, tenant]
    );
    await pool.query(
      "INSERT INTO iam.permissions(id,instance_id,permission_key,action,resource_type) VALUES($1,$2,'ssf.recording.review','ssf.recording.review','ssf')",
      [permissionId, tenant]
    );
    await pool.query(
      'INSERT INTO iam.role_permissions(instance_id,role_id,permission_id) VALUES($1,$2,$3)',
      [tenant, roleId, permissionId]
    );
    await pool.query(
      'INSERT INTO iam.account_roles(instance_id,account_id,role_id) VALUES($1,$2,$3)',
      [tenant, accountId, roleId]
    );
    configureInstanceRegistryPluginRuntimeSnapshot({
      activationPolicies: {
        revision: 'test',
        modules: [
          {
            moduleId: 'ssf',
            activationPolicy: 'optional',
            manifestVersion: 1,
            policyRevision: 'test',
          },
        ],
      },
      moduleIamContracts: [],
      pluginOidcClientRequirements: [],
      tenantLifecycles: [
        {
          pluginId: 'ssf',
          contractVersion: 1,
          operations: [{ operation: 'reconcile', jobTypeId: 'ssf.reconcile-authorization' }],
          readinessChecks: [
            {
              checkId: 'ssf.loginReady',
              required: true,
              titleKey: 'ssf.ready',
              repairOperation: 'reconcile',
            },
          ],
        },
      ],
    });
    let projection: SsfAuthorizationProjection = {
      contractVersion: '2.0',
      instanceId: tenant,
      subjects: [],
    };
    let releaseFirst: () => void = () => undefined;
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let signalFirst: () => void = () => undefined;
    const firstRead = new Promise<void>((resolve) => {
      signalFirst = resolve;
    });
    let writes = 0;
    const runtime = createSsfAuthorizationProjectionRuntime({
      source: { readSubjects: readTenantPermissionProjectionSubjects },
      store: createPostgresSsfAuthorizationProjectionStore(pool),
      readReadyRevision: async () => null,
      createTarget: async () => ({
        prepareLoginClients: async () => undefined,
        prepareRuntimeBaseline: async (id) => {
          await provisionSsfTenant(pool, id);
        },
        isReady: async () => true,
        suspendTokenIssuance: async () => undefined,
        resumeTokenIssuance: async () => undefined,
        revokeTenantSessions: async () => undefined,
        reconcile: async (desired) => {
          projection = desired;
          writes++;
          if (writes === 1) {
            signalFirst();
            await firstMayFinish;
          }
        },
        readBack: async () => projection,
      }),
    });
    registerPluginOperationExecutionHandlers({
      'ssf.reconcile-authorization': {
        queueName: 'plugin-operations',
        handler: async (context) => {
          const result = await runtime.reconcile(context.job.instanceId);
          if (result.status !== 'ready') throw new Error(`projection_${result.status}`);
          return {
            tenantLifecycle: {
              revision: result.authorizationRevision,
              checks: [{ checkId: 'ssf.loginReady', status: 'ready' }],
            },
          };
        },
      },
    });
    const tasks = createStudioJobTaskList(getRegisteredStudioJobExecutionRegistry);
    const helpers = { job: { attempts: 1, max_attempts: 5 } } as never;
    const execute = tasks.studio_job_execute;
    const retry = tasks.plugin_tenant_lifecycle_retry;
    if (!execute || !retry) throw new Error('worker tasks missing');
    const first = await startConfiguredPluginTenantLifecycle({
      instanceId: tenant,
      pluginId: 'ssf',
      operation: 'reconcile',
      scheduledAt: new Date().toISOString(),
    });
    const firstExecution = execute({ instanceId: tenant, jobId: first.job.id }, helpers);
    try {
      await firstRead;
      expect(projection.subjects[0]?.languages).toEqual(['de']);
      const { createUserUpdatePersistence } = await import('@sva/iam-admin');
      const persistence = createUserUpdatePersistence({
        assignGroups: async () => undefined,
        assignRoles: async () => undefined,
        clearUserSessionLoginBlock: async () => undefined,
        revokeUserSessions: async () => undefined,
        withInstanceScopedDb,
        emitActivityLog,
        notifyPermissionInvalidation,
        resolveUserDetail: async (client) => {
          const row = await client.query<{ competence_languages: string[] }>(
            'SELECT competence_languages FROM iam.accounts WHERE id=$1',
            [accountId]
          );
          return {
            id: accountId,
            keycloakSubject: 'synthetic-reviewer',
            displayName: 'Synthetic reviewer',
            status: 'active',
            isTechnicalAccount: false,
            roles: [],
            competenceLanguages: row.rows[0]?.competence_languages,
            mainserverUserApplicationSecretSet: false,
          };
        },
      });
      const save = async (competenceLanguages: string[]) =>
        persistence.persistUpdatedUserDetail({
          instanceId: tenant,
          userId: accountId,
          keycloakSubject: 'synthetic-reviewer',
          actorAccountId: accountId,
          payload: { competenceLanguages },
        });
      await save(['en-US']);
      const durable = await pool.query<{ payload: unknown; max_attempts: number }>(
        'SELECT payload,max_attempts FROM graphile_worker._private_jobs WHERE key=$1',
        [`plugin-tenant-lifecycle-reconcile:${tenant}:ssf`]
      );
      expect(durable.rows[0]?.max_attempts).toBe(25);
      const payload = durable.rows[0]?.payload;
      expect(payload).toEqual({ instanceId: tenant, pluginId: 'ssf', operation: 'reconcile' });
      await expect(retry(payload, helpers)).rejects.toThrow('request_conflict');
      releaseFirst();
      await firstExecution;
      const revision = (
        await pool.query<{ confirmed_revision: string }>(
          'SELECT confirmed_revision FROM ssf.authorization_projections WHERE instance_id=$1',
          [tenant]
        )
      ).rows[0]?.confirmed_revision;
      await retry(payload, helpers);
      const second = (
        await pool.query<{ active_job_id: string }>(
          "SELECT active_job_id FROM iam.instance_plugin_lifecycle WHERE instance_id=$1 AND plugin_id='ssf'",
          [tenant]
        )
      ).rows[0]?.active_job_id;
      await execute({ instanceId: tenant, jobId: second }, helpers);
      expect(projection.subjects[0]?.languages).toEqual(['en-US']);
      await save([]);
      await retry(payload, helpers);
      const third = (
        await pool.query<{ active_job_id: string }>(
          "SELECT active_job_id FROM iam.instance_plugin_lifecycle WHERE instance_id=$1 AND plugin_id='ssf'",
          [tenant]
        )
      ).rows[0]?.active_job_id;
      await execute({ instanceId: tenant, jobId: third }, helpers);
      expect(projection.subjects[0]?.languages ?? []).toEqual([]);
      expect(
        (
          await pool.query<{ confirmed_revision: string }>(
            'SELECT confirmed_revision FROM ssf.authorization_projections WHERE instance_id=$1',
            [tenant]
          )
        ).rows[0]?.confirmed_revision
      ).toBe(revision);
    } finally {
      releaseFirst();
      await firstExecution.catch(() => undefined);
      await pool.end();
    }
  },
  30000
);
