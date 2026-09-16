import { strict as assert } from 'node:assert';

import { createInstanceRegistryRepository } from '@sva/data-repositories';
import { Pool, type PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { processNextQueuedKeycloakProvisioningRun } from './service-keycloak-execution.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { processNextTenantProvisioningRun } from './tenant-provisioning-orchestrator.js';
import {
  assertTenantProvisioningSnapshotCurrent,
  buildTenantProvisioningSnapshot,
} from './tenant-provisioning-snapshot.js';
import {
  buildExpectedClientConfig,
  buildExpectedTenantAdminClientConfig,
} from './provisioning-auth-utils.js';
import type { KeycloakProvisioningInput, KeycloakReadState } from './provisioning-auth-types.js';

const databaseName = process.env.INSTANCE_PROVISIONING_INTEGRATION_DB;
const integrationDescribe = databaseName ? describe : describe.skip;

const instanceId = 'integration-new-realm-recovery';
const primaryHostname = `${instanceId}.dialog.kassel.de`;
const authClientSecret = 'integration-auth-secret';
const tenantAdminClientSecret = 'integration-tenant-admin-secret';

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

const withInstanceLock =
  (
    pool: Pool,
    baseDeps: Omit<InstanceRegistryServiceDeps, 'repository' | 'withInstanceProvisioningLock'>
  ) =>
  async <T>(
    _instanceId: string,
    work: (lockedDeps: InstanceRegistryServiceDeps) => Promise<T>
  ): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const repository = createInstanceRegistryRepository(createExecutor(client));
      const result = await work({
        ...baseDeps,
        repository,
        withInstanceProvisioningLock: withInstanceLock(pool, baseDeps),
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

const buildAcceptedKeycloakState = (input: KeycloakProvisioningInput): KeycloakReadState => {
  const expectedClient = buildExpectedClientConfig(input.primaryHostname);
  const expectedTenantAdminClient = buildExpectedTenantAdminClientConfig(input.primaryHostname);
  return {
    client: {},
    expectedClient,
    expectedTenantAdminClient,
    realm: {
      realm: input.authRealm,
      smtpPasswordConfigured: false,
    },
    clientRepresentation: {
      id: 'integration-auth-client',
      clientId: input.authClientId,
      redirectUris: expectedClient.redirectUris,
      webOrigins: expectedClient.webOrigins,
      rootUrl: expectedClient.rootUrl,
      attributes: {
        'post.logout.redirect.uris': expectedClient.postLogoutRedirectUris.join('##'),
      },
    },
    tenantAdminClientRepresentation: {
      id: 'integration-tenant-admin-client',
      clientId: input.tenantAdminClient?.clientId,
      redirectUris: expectedTenantAdminClient.redirectUris,
      webOrigins: expectedTenantAdminClient.webOrigins,
      rootUrl: expectedTenantAdminClient.rootUrl,
      standardFlowEnabled: expectedTenantAdminClient.standardFlowEnabled,
      directAccessGrantsEnabled: expectedTenantAdminClient.directAccessGrantsEnabled,
      serviceAccountsEnabled: expectedTenantAdminClient.serviceAccountsEnabled,
      attributes: {
        'post.logout.redirect.uris': expectedTenantAdminClient.postLogoutRedirectUris.join('##'),
      },
    },
    pluginOidcClients: [],
    protocolMappers: [
      {
        name: 'instanceId',
        protocol: 'openid-connect',
        protocolMapper: 'oidc-usermodel-attribute-mapper',
        config: {
          'user.attribute': 'instanceId',
          'claim.name': 'instanceId',
          'jsonType.label': 'String',
          multivalued: 'false',
          'id.token.claim': 'true',
          'access.token.claim': 'true',
          'userinfo.token.claim': 'true',
        },
      },
    ],
    tenantAdminStatus: {
      tenantAdminExists: true,
      tenantAdminHasSystemAdmin: true,
    },
    keycloakClientSecret: authClientSecret,
    tenantAdminClientSecret,
    systemAdminRole: {
      externalName: 'system_admin',
      attributes: {
        managed_by: ['studio'],
        instance_id: [input.instanceId],
        role_key: ['system_admin'],
      },
    },
    realmBaselineAligned: true,
    userProfileBaselineAligned: true,
  };
};

integrationDescribe('tenant provisioning recovery persistence', () => {
  it('keeps correlated realm evidence through a local failure and replaces it on retry', async () => {
    assert(databaseName);
    const pool = new Pool({
      host: process.env.POSTGRES_HOST ?? '127.0.0.1',
      port: Number.parseInt(process.env.POSTGRES_HOST_PORT ?? '5432', 10),
      database: databaseName,
      user: process.env.POSTGRES_USER ?? 'sva',
      password: process.env.POSTGRES_PASSWORD,
      max: 4,
    });
    const repository = createInstanceRegistryRepository(createExecutor(pool));
    const provisionInstanceAuth = vi.fn(async () => undefined);
    const deleteProvisionedRealm = vi.fn(async () => undefined);
    const syncTenantAdminBootstrapAccount = vi.fn(async () => {
      throw new Error('local_admin_sync_failed');
    });
    const baseDeps = {
      invalidateHost: () => undefined,
      readPluginOidcClientRequirements: () => [],
      protectSecret: (value: string | undefined) => value ?? null,
      revealSecret: (value: string | null | undefined) => value ?? undefined,
      provisionInstanceAuth,
      deleteProvisionedRealm,
      readKeycloakClientSecretsViaProvisioner: async () => ({
        keycloakClientSecret: authClientSecret,
        tenantAdminClientSecret,
      }),
      readKeycloakStateViaProvisioner: async (input: KeycloakProvisioningInput) =>
        buildAcceptedKeycloakState(input),
      getKeycloakPreflight: async () => ({
        overallStatus: 'ready',
        checkedAt: new Date().toISOString(),
        checks: [],
      }),
      planKeycloakProvisioning: async () => ({
        overallStatus: 'ready',
        driftSummary: 'ready',
        steps: [],
      }),
      syncTenantAdminBootstrapAccount,
      listProvisioningRealmAssignments: async () => [{ instanceId, authRealm: instanceId }],
    } satisfies Omit<InstanceRegistryServiceDeps, 'repository' | 'withInstanceProvisioningLock'>;
    const deps: InstanceRegistryServiceDeps = {
      ...baseDeps,
      repository,
      withInstanceProvisioningLock: withInstanceLock(pool, baseDeps),
    };

    try {
      const created = await repository.createInstance({
        instanceId,
        displayName: 'Integration New Realm Recovery',
        status: 'requested',
        parentDomain: 'dialog.kassel.de',
        primaryHostname,
        realmMode: 'new',
        authRealm: instanceId,
        authClientId: 'sva-studio',
        authIssuerUrl: `https://auth.example.invalid/realms/${instanceId}`,
        tenantAdminClient: { clientId: 'sva-studio-realm-admin' },
        tenantAdminBootstrap: { username: 'tenant-admin' },
        featureFlags: {},
      });
      assert(created);
      const payloadFingerprint = 'integration-new-realm-recovery-payload';
      const desiredSnapshot = buildTenantProvisioningSnapshot(
        created,
        {
          instanceId,
          displayName: created.displayName,
          parentDomain: created.parentDomain,
          primaryHostname,
          realmMode: 'new',
          authRealm: created.authRealm,
          authClientId: created.authClientId,
          authIssuerUrl: created.authIssuerUrl,
          tenantAdminClient: { clientId: 'sva-studio-realm-admin' },
          tenantAdminBootstrap: { username: 'tenant-admin' },
          idempotencyKey: 'integration-parent',
          featureFlags: {},
        },
        payloadFingerprint,
        'kassel-traefik-file',
        {
          lifecycles: [
            {
              pluginId: 'integration-plugin',
              contractVersion: 1,
              contractRevision: '1',
              operations: [],
              readinessChecks: [],
            },
          ],
          oidcClients: [],
        }
      );
      await repository.createProvisioningRun({
        instanceId,
        operation: 'create',
        status: 'requested',
        stepKey: 'registry',
        idempotencyKey: 'integration-parent',
        payloadFingerprint,
        snapshotVersion: '2.0',
        desiredSnapshot,
        deadlineAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      });

      await processNextTenantProvisioningRun(deps, { workerId: 'integration-parent-worker' });
      const parentAfterQueue = (await repository.listProvisioningRuns(instanceId))[0];
      assert(parentAfterQueue?.childKeycloakRunId);
      const originalChildRunId = parentAfterQueue.childKeycloakRunId;

      await processNextQueuedKeycloakProvisioningRun(deps);

      const persistedInstance = await repository.getInstanceById(instanceId);
      const failedChild = await repository.getKeycloakProvisioningRun(
        instanceId,
        originalChildRunId
      );
      expect(provisionInstanceAuth).toHaveBeenCalledOnce();
      expect(syncTenantAdminBootstrapAccount).toHaveBeenCalledOnce();
      expect(deleteProvisionedRealm).not.toHaveBeenCalled();
      expect(persistedInstance?.realmMode).toBe('existing');
      expect(failedChild?.overallStatus).toBe('failed');

      await pool.query(
        `UPDATE iam.instance_provisioning_runs
           SET next_attempt_at = now()
           WHERE instance_id = $1 AND operation = 'create'`,
        [instanceId]
      );
      await processNextTenantProvisioningRun(deps, { workerId: 'integration-parent-worker' });
      const failedParent = (await repository.listProvisioningRuns(instanceId))[0];
      expect(failedParent).toMatchObject({
        status: 'failed',
        childKeycloakRunId: originalChildRunId,
        errorCode: 'keycloak_provisioning_failed',
      });

      const retried = await repository.retryProvisioningRun({
        instanceId,
        idempotencyKey: 'integration-parent',
        deadlineAt: new Date(Date.now() + 30 * 60_000).toISOString(),
        desiredSnapshot,
        keycloakReconcileRequired: false,
      });
      assert(retried);
      expect(retried.childKeycloakRunId).toBe(originalChildRunId);
      expect(await repository.setInstanceStatus({ instanceId, status: 'requested' })).toMatchObject(
        { status: 'requested' }
      );
      assert(persistedInstance);
      expect(() =>
        assertTenantProvisioningSnapshotCurrent(retried, persistedInstance)
      ).not.toThrow();
      expect(() =>
        assertTenantProvisioningSnapshotCurrent(
          { ...retried, childKeycloakRunId: undefined },
          persistedInstance
        )
      ).toThrow('provisioning_snapshot_drift');

      await processNextTenantProvisioningRun(deps, { workerId: 'integration-parent-retry-worker' });
      const parentAfterRetry = (await repository.listProvisioningRuns(instanceId))[0];
      assert(parentAfterRetry?.childKeycloakRunId);
      expect(parentAfterRetry.childKeycloakRunId).not.toBe(originalChildRunId);
      expect(parentAfterRetry).toMatchObject({ status: 'provisioning', stepKey: 'keycloak' });
      expect(
        await repository.getKeycloakProvisioningRun(instanceId, originalChildRunId)
      ).toMatchObject({
        overallStatus: 'failed',
      });
      expect(
        await repository.getKeycloakProvisioningRun(instanceId, parentAfterRetry.childKeycloakRunId)
      ).toMatchObject({ overallStatus: 'planned' });
    } finally {
      await pool.end();
    }
  }, 30_000);
});
