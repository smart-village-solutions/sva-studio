import { createInstanceRegistryRepository } from '@sva/data-repositories';
import { Pool, type PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';

import { createInstanceRegistryRuntime } from './runtime-wiring.js';

const databaseName = process.env.INSTANCE_PROVISIONING_INTEGRATION_DB;
const integrationDescribe = databaseName ? describe : describe.skip;
const instanceId = 'integration-iam-baseline-partial';

const createExecutor = (client: Pool | PoolClient) => ({
  execute: async <TRow = Record<string, unknown>>(statement: {
    text: string;
    values: readonly unknown[];
  }) => {
    const result = await client.query<TRow>(statement.text, [...statement.values]);
    return {
      rowCount: result.rowCount ?? result.rows.length,
      rows: result.rows,
    };
  },
});

integrationDescribe('IAM baseline persistence', () => {
  it('commits core and known module grants while reporting a missing module contract', async () => {
    expect(databaseName).toBeTruthy();
    if (!databaseName) throw new Error('integration_database_required');

    const pool = new Pool({
      host: process.env.POSTGRES_HOST ?? '127.0.0.1',
      port: Number.parseInt(process.env.POSTGRES_HOST_PORT ?? '5432', 10),
      database: databaseName,
      user: process.env.POSTGRES_USER ?? 'sva',
      password: process.env.POSTGRES_PASSWORD,
      max: 2,
    });
    const repository = createInstanceRegistryRepository(createExecutor(pool));

    try {
      const created = await repository.createInstance({
        instanceId,
        displayName: 'Integration IAM Baseline Partial',
        status: 'requested',
        parentDomain: 'example.test',
        primaryHostname: `${instanceId}.example.test`,
        realmMode: 'existing',
        authRealm: instanceId,
        authClientId: 'sva-studio',
        authIssuerUrl: `https://auth.example.test/realms/${instanceId}`,
        tenantAdminClient: { clientId: 'sva-studio-realm-admin' },
        featureFlags: {},
      });
      expect(created).not.toBeNull();
      await pool.query(
        `
INSERT INTO iam.instance_modules (
  instance_id, module_id, activation_origin, effective_active, manual_override
)
VALUES ($1, 'ssf', 'manual', true, 'enabled'),
       ($1, 'legacy-module', 'manual', true, 'enabled');
`,
        [instanceId]
      );

      const runtime = createInstanceRegistryRuntime({
        resolvePool: () => ({
          connect: async () => {
            const client = await pool.connect();
            return {
              query: async <TRow = Record<string, unknown>>(
                text: string,
                values?: readonly unknown[]
              ) => {
                const result = await client.query<TRow>(text, [...(values ?? [])]);
                return { rowCount: result.rowCount ?? result.rows.length, rows: result.rows };
              },
              release: () => client.release(),
            };
          },
        }),
        createRepository: (executor) => createInstanceRegistryRepository(executor),
        serviceDeps: {
          invalidateHost: () => undefined,
          invalidatePermissionSnapshots: async () => undefined,
          moduleIamRegistry: new Map([
            [
              'ssf',
              {
                moduleId: 'ssf',
                permissionIds: ['ssf.configuration.tenant.read', 'ssf.configuration.tenant.manage'],
                systemRoles: [
                  {
                    roleName: 'system_admin',
                    permissionIds: [
                      'ssf.configuration.tenant.read',
                      'ssf.configuration.tenant.manage',
                    ],
                  },
                ],
              },
            ],
          ]),
        },
      });

      await expect(
        runtime.withScopedRegistryService(
          instanceId,
          (service) =>
            service.seedIamBaseline({
              instanceId,
              idempotencyKey: 'integration-iam-baseline-partial',
              actorId: 'integration-test',
              requestId: 'integration-iam-baseline-partial',
            }),
          { shouldReconcileActivationPolicies: async () => false }
        )
      ).resolves.toEqual({
        ok: false,
        reason: 'module_contract_missing',
        moduleIds: ['legacy-module'],
        errorCodes: ['unknown_module_contract:legacy-module'],
      });

      const persisted = await pool.query<{
        core_grants: string;
        known_module_grants: string;
        unknown_module_grants: string;
      }>(
        `
SELECT
  COUNT(*) FILTER (
    WHERE permission.permission_key = 'iam.user.read'
      AND role_permission.grant_origin_kind = 'bootstrap'
  )::text AS core_grants,
  COUNT(*) FILTER (
    WHERE permission.permission_key = 'ssf.configuration.tenant.read'
      AND role_permission.grant_origin_module_id = 'ssf'
  )::text AS known_module_grants,
  COUNT(*) FILTER (
    WHERE role_permission.grant_origin_module_id = 'legacy-module'
  )::text AS unknown_module_grants
FROM iam.roles role
JOIN iam.role_permissions role_permission
  ON role_permission.instance_id = role.instance_id
  AND role_permission.role_id = role.id
JOIN iam.permissions permission
  ON permission.instance_id = role_permission.instance_id
  AND permission.id = role_permission.permission_id
WHERE role.instance_id = $1 AND role.role_key = 'system_admin';
`,
        [instanceId]
      );

      expect(persisted.rows[0]).toEqual({
        core_grants: '1',
        known_module_grants: '1',
        unknown_module_grants: '0',
      });
    } finally {
      await pool.end();
    }
  });
});
