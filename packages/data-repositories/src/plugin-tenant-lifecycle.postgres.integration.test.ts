/** Host transitions against the real migrated disposable PostgreSQL database and iam_app role. */
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createInstanceRegistryRepository } from './instance-registry/index.js';
import { createPluginTenantLifecycleRepository } from './plugin-tenant-lifecycle/index.js';
import type { SqlExecutor } from './iam/repositories/types.js';

const url = process.env.APP_TRANSLATIONS_TEST_DATABASE_URL;
const pool = url ? new Pool({ connectionString: url, max: 2 }) : null;
const pluginId = 'app-translations';
const contractRevision = 'local-v1';
const lifecycle = {
  pluginId,
  contractRevision,
  operations: [{ operation: 'suspend' as const, jobTypeId: 'app-translations.lifecycle' }],
};
const scoped = async <T>(
  instanceId: string,
  work: (client: PoolClient, executor: SqlExecutor) => Promise<T>
) => {
  const client = await pool!.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE iam_app');
    await client.query("SELECT set_config('app.instance_id', $1, true)", [instanceId]);
    const executor: SqlExecutor = {
      execute: async (statement) => {
        const result = await client.query(statement.text, [...statement.values]);
        return { rows: result.rows, rowCount: result.rowCount ?? 0 };
      },
    };
    const result = await work(client, executor);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
const seedInstance = async () => {
  const id = `catalog-b-${randomUUID()}`;
  await pool!.query(
    `INSERT INTO iam.instances(id, display_name, primary_hostname, tenant_admin_client_id, auth_realm, auth_client_id, status)
    VALUES ($1, 'Local lifecycle test', $2, 'tenant-admin', $1, 'studio', 'active')`,
    [id, `${id}.test`]
  );
  return id;
};
const complete = async (
  client: PoolClient,
  executor: SqlExecutor,
  instanceId: string,
  operation: 'suspend' | 'reactivate'
) => {
  const repo = createPluginTenantLifecycleRepository(executor);
  const requested = await repo.requestLifecycle({
    instanceId,
    pluginId,
    operation,
    contractRevision,
  });
  const jobId = randomUUID();
  await client.query(
    `INSERT INTO iam.studio_jobs(id, instance_id, plugin_id, job_type_id, queue_name, status, input_payload, idempotency_key, scheduled_at)
    VALUES ($1::uuid, $2, $3, 'app-translations.lifecycle', 'plugin-operations', 'running', '{}', $1::text, now())`,
    [jobId, instanceId, pluginId]
  );
  await repo.claimLifecycle({
    instanceId,
    pluginId,
    operation,
    jobId,
    generation: requested.desiredGeneration,
  });
  const result = await repo.completeLifecycle({
    instanceId,
    pluginId,
    operation,
    jobId,
    generation: requested.desiredGeneration,
    readinessStatus: 'ready',
    readinessRevision: 'controlled-local-test-result',
    readinessChecks: [],
    contractRevision,
  });
  expect(result.outcome).toBe('applied');
  return (await repo.getLifecycle(instanceId, pluginId))!;
};
describe.skipIf(!url)('local plugin host transitions in PostgreSQL', () => {
  beforeAll(async () => {
    if (!pool || !url || !/^\/[^/]+_test$/.test(new URL(url).pathname))
      throw new Error('disposable_test_database_required');
    // Same narrow enqueue privilege as the production app bootstrap; no worker table access.
    await pool.query('GRANT USAGE ON SCHEMA graphile_worker TO iam_app');
    await pool.query(
      'GRANT EXECUTE ON FUNCTION graphile_worker.sva_enqueue_job(text,json,text,integer,text,timestamptz) TO iam_app'
    );
  });
  afterAll(async () => {
    await pool?.end();
  });
  it('revokes a completed suspension without another pending generation', async () => {
    const instanceId = await seedInstance();
    await scoped(instanceId, async (client, executor) => {
      const registry = createInstanceRegistryRepository(executor);
      await registry.assignModule(instanceId, pluginId, contractRevision);
      const suspended = await complete(client, executor, instanceId, 'suspend');
      expect(await registry.revokeModule(instanceId, pluginId)).toBe(true);
      expect(
        await registry.persistPluginTenantLifecycleReconcileIntents({
          instanceId,
          lifecycles: [lifecycle],
          forcePluginIds: [pluginId],
        })
      ).toEqual([]);
      const after = await createPluginTenantLifecycleRepository(executor).getLifecycle(
        instanceId,
        pluginId
      );
      expect(after).toEqual(suspended);
      expect(
        (await registry.getModuleActivationPolicy(instanceId, pluginId))?.effectiveActive
      ).toBe(false);
    });
  });
  it.each(['assignment', 'reconcile'] as const)(
    'keeps reassignment suspended until confirmed reactivation (%s)',
    async (path) => {
      const instanceId = await seedInstance();
      await scoped(instanceId, async (client, executor) => {
        const registry = createInstanceRegistryRepository(executor);
        const repo = createPluginTenantLifecycleRepository(executor);
        await registry.assignModule(instanceId, pluginId, contractRevision);
        await complete(client, executor, instanceId, 'suspend');
        await registry.revokeModule(instanceId, pluginId);
        await registry.assignModule(
          instanceId,
          pluginId,
          path === 'assignment' ? contractRevision : undefined
        );
        if (path === 'reconcile')
          await registry.persistPluginTenantLifecycleReconcileIntents({
            instanceId,
            lifecycles: [lifecycle],
            forcePluginIds: [pluginId],
          });
        const pending = await repo.getLifecycle(instanceId, pluginId);
        expect(pending).toMatchObject({
          desiredOperation: 'reactivate',
          accessState: 'suspended',
          readinessStatus: 'pending',
        });
        expect(pending!.desiredGeneration).toBeGreaterThan(pending!.completedGeneration);
        const activated = await complete(client, executor, instanceId, 'reactivate');
        expect(activated.accessState).toBe('active');
        expect(activated.desiredGeneration).toBe(activated.completedGeneration);
      });
    }
  );
});
