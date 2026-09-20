import { strict as assert } from 'node:assert';

import type { KeycloakTenantPlan } from '@sva/core';
import { createInstanceRegistryRepository } from '@sva/data-repositories';
import { Pool, type PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { processNextQueuedKeycloakProvisioningRun } from './service-keycloak-execution.js';
import { createPlanKeycloakProvisioningHandler } from './service-keycloak-readers.js';
import { createInstanceRegistryService } from './service.js';
import { createInstanceRegistryRuntime } from './runtime-wiring.js';
import type { InstanceRegistryServiceDeps } from './service-types.js';
import { processNextTenantProvisioningRun } from './tenant-provisioning-orchestrator.js';
import {
  assertTenantProvisioningSnapshotCurrent,
  buildTenantProvisioningSnapshot,
} from './tenant-provisioning-snapshot.js';
import { buildKeycloakSnapshotInputFingerprint } from './provisioning-auth-policy.js';
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
        managed_by: 'studio',
        instance_id: input.instanceId,
        artifact_key: 'login_client',
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
        managed_by: 'studio',
        instance_id: input.instanceId,
        artifact_key: 'tenant_admin_client',
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
  it('commits the durable minimum without background callbacks and rolls it back atomically on audit failure', async () => {
    assert(databaseName);
    const committedInstanceId = 'integration-create-durable-minimum';
    const rolledBackInstanceId = 'integration-create-rollback';
    const pool = new Pool({
      host: process.env.POSTGRES_HOST ?? '127.0.0.1',
      port: Number.parseInt(process.env.POSTGRES_HOST_PORT ?? '5432', 10),
      database: databaseName,
      user: process.env.POSTGRES_USER ?? 'sva',
      password: process.env.POSTGRES_PASSWORD,
      max: 4,
    });
    const runtimePool = {
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
    };
    const createRuntime = (failAuditFor?: string) =>
      createInstanceRegistryRuntime({
        resolvePool: () => runtimePool,
        createRepository: (executor) => {
          const repository = createInstanceRegistryRepository(executor);
          return failAuditFor
            ? {
                ...repository,
                appendAuditEvent: async (input) => {
                  if (input.instanceId === failAuditFor) throw new Error('injected_audit_failure');
                  return repository.appendAuditEvent(input);
                },
              }
            : repository;
        },
        serviceDeps: {
          invalidateHost: () => undefined,
          protectSecret: (value: string | undefined) => value ?? null,
          revealSecret: (value: string | null | undefined) => value ?? undefined,
          readPluginOidcClientRequirements: () => [],
          readKeycloakStateViaProvisioner: async (input) => buildAcceptedKeycloakState(input),
          isAutomatedTenantProvisioningEnabled: () => false,
        },
      });
    const createInput = (targetInstanceId: string) => ({
      instanceId: targetInstanceId,
      displayName: `Integration ${targetInstanceId}`,
      parentDomain: 'studio.example.org',
      realmMode: 'existing' as const,
      authRealm: targetInstanceId,
      authClientId: 'sva-studio-login',
      authIssuerUrl: `https://auth.example.invalid/realms/${targetInstanceId}`,
      tenantAdminClient: { clientId: 'sva-studio-realm-admin' },
      tenantAdminBootstrap: {
        username: 'tenant-admin',
        email: 'tenant-admin@example.invalid',
        firstName: 'Tenant',
        lastName: 'Admin',
      },
      idempotencyKey: `create-${targetInstanceId}`,
      actorId: 'integration-test',
      requestId: `request-${targetInstanceId}`,
    });

    try {
      const runtime = createRuntime();
      const committed = await runtime.withRegistryCreateService(committedInstanceId, (service) =>
        service.createProvisioningRequest(createInput(committedInstanceId))
      );
      expect(committed).toMatchObject({ ok: true });

      const repeated = await runtime.withRegistryCreateService(committedInstanceId, (service) =>
        service.createProvisioningRequest(createInput(committedInstanceId))
      );
      expect(repeated).toMatchObject({ ok: true });

      const committedCounts = await pool.query<{
        instances: string;
        runs: string;
        audits: string;
      }>(
        `SELECT
           (SELECT count(*) FROM iam.instances WHERE id = $1)::text AS instances,
           (SELECT count(*) FROM iam.instance_provisioning_runs WHERE instance_id = $1)::text AS runs,
           (SELECT count(*) FROM iam.instance_audit_events WHERE instance_id = $1)::text AS audits`,
        [committedInstanceId]
      );
      expect(committedCounts.rows[0]).toEqual({ instances: '1', runs: '1', audits: '1' });

      const failingRuntime = createRuntime(rolledBackInstanceId);
      await expect(
        failingRuntime.withRegistryCreateService(rolledBackInstanceId, (service) =>
          service.createProvisioningRequest(createInput(rolledBackInstanceId))
        )
      ).rejects.toThrow('injected_audit_failure');

      const rolledBackCounts = await pool.query<{
        instances: string;
        runs: string;
        audits: string;
      }>(
        `SELECT
           (SELECT count(*) FROM iam.instances WHERE id = $1)::text AS instances,
           (SELECT count(*) FROM iam.instance_provisioning_runs WHERE instance_id = $1)::text AS runs,
           (SELECT count(*) FROM iam.instance_audit_events WHERE instance_id = $1)::text AS audits`,
        [rolledBackInstanceId]
      );
      expect(rolledBackCounts.rows[0]).toEqual({ instances: '0', runs: '0', audits: '0' });
    } finally {
      await pool.query('DELETE FROM iam.instances WHERE id = ANY($1::text[])', [
        [committedInstanceId, rolledBackInstanceId],
      ]);
      await pool.end();
    }
  }, 30_000);

  it('allows exactly one concurrent retry reservation and requires its lease to requeue', async () => {
    assert(databaseName);
    const retryReservationInstanceId = 'integration-retry-reservation';
    const pool = new Pool({
      host: process.env.POSTGRES_HOST ?? '127.0.0.1',
      port: Number.parseInt(process.env.POSTGRES_HOST_PORT ?? '5432', 10),
      database: databaseName,
      user: process.env.POSTGRES_USER ?? 'sva',
      password: process.env.POSTGRES_PASSWORD,
      max: 4,
    });
    const repository = createInstanceRegistryRepository(createExecutor(pool));

    try {
      const created = await repository.createInstance({
        instanceId: retryReservationInstanceId,
        displayName: 'Integration Retry Reservation',
        status: 'failed',
        parentDomain: 'dialog.kassel.de',
        primaryHostname: `${retryReservationInstanceId}.dialog.kassel.de`,
        realmMode: 'existing',
        authRealm: retryReservationInstanceId,
        authClientId: 'sva-studio',
        authIssuerUrl: `https://auth.example.invalid/realms/${retryReservationInstanceId}`,
        tenantAdminClient: { clientId: 'sva-studio-realm-admin' },
        featureFlags: {},
      });
      assert(created);
      await repository.createProvisioningRun({
        instanceId: retryReservationInstanceId,
        operation: 'create',
        status: 'failed',
        stepKey: 'login',
        idempotencyKey: 'integration-retry-reservation',
        payloadFingerprint: 'integration-retry-reservation-payload',
        snapshotVersion: '2.0',
        desiredSnapshot: { automationMode: 'kassel-traefik-file' },
      });

      const reservationInput = (leaseOwner: string) => ({
        instanceId: retryReservationInstanceId,
        idempotencyKey: 'integration-retry-reservation',
        leaseOwner,
        leaseExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      });
      const [firstReservation, secondReservation] = await Promise.all([
        repository.reserveProvisioningRetryRun(reservationInput('retry-reservation-first')),
        repository.reserveProvisioningRetryRun(reservationInput('retry-reservation-second')),
      ]);
      const reservations = [firstReservation, secondReservation].filter(
        (reservation): reservation is NonNullable<typeof reservation> => reservation !== null
      );
      expect(reservations).toHaveLength(1);
      const winner = reservations[0];
      assert(winner);

      const losingLeaseOwner =
        winner.leaseOwner === 'retry-reservation-first'
          ? 'retry-reservation-second'
          : 'retry-reservation-first';
      await expect(
        repository.retryProvisioningRun({
          instanceId: retryReservationInstanceId,
          idempotencyKey: 'integration-retry-reservation',
          leaseOwner: losingLeaseOwner,
          deadlineAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          desiredSnapshot: { automationMode: 'kassel-traefik-file' },
          keycloakReconcileRequired: false,
        })
      ).resolves.toBeNull();
      await expect(
        repository.retryProvisioningRun({
          instanceId: retryReservationInstanceId,
          idempotencyKey: 'integration-retry-reservation',
          leaseOwner: winner.leaseOwner ?? '',
          deadlineAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          desiredSnapshot: { automationMode: 'kassel-traefik-file' },
          keycloakReconcileRequired: false,
        })
      ).resolves.toMatchObject({ status: 'requested' });
    } finally {
      await pool.query('DELETE FROM iam.instances WHERE id = $1', [retryReservationInstanceId]);
      await pool.end();
    }
  });

  it('activates through the shared service only after current persisted readiness evidence', async () => {
    assert(databaseName);
    const activationInstanceId = 'integration-manual-activation';
    const pool = new Pool({
      host: process.env.POSTGRES_HOST ?? '127.0.0.1',
      port: Number.parseInt(process.env.POSTGRES_HOST_PORT ?? '5432', 10),
      database: databaseName,
      user: process.env.POSTGRES_USER ?? 'sva',
      password: process.env.POSTGRES_PASSWORD,
      max: 4,
    });
    const repository = createInstanceRegistryRepository(createExecutor(pool));
    const baseDeps = {
      invalidateHost: () => undefined,
      protectSecret: (value: string | undefined) => value ?? null,
      revealSecret: (value: string | null | undefined) => value ?? undefined,
      readPluginOidcClientRequirements: () => [],
      isAutomatedTenantProvisioningEnabled: () => false,
      moduleIamRegistry: new Map([['news', { permissionIds: ['news.read'], systemRoles: [] }]]),
    } satisfies Omit<InstanceRegistryServiceDeps, 'repository' | 'withInstanceProvisioningLock'>;
    try {
      const instance = await repository.createInstance({
        instanceId: activationInstanceId,
        displayName: 'Integration Manual Activation',
        status: 'provisioning',
        parentDomain: 'studio.example.org',
        primaryHostname: `${activationInstanceId}.studio.example.org`,
        realmMode: 'existing',
        authRealm: activationInstanceId,
        authClientId: 'sva-studio-login',
        authIssuerUrl: `https://auth.example.invalid/realms/${activationInstanceId}`,
        tenantAdminClient: { clientId: 'sva-studio-realm-admin' },
        tenantAdminBootstrap: {
          username: 'tenant-admin',
          email: 'tenant-admin@example.invalid',
          firstName: 'Tenant',
          lastName: 'Admin',
        },
        featureFlags: {},
      });
      assert(instance);

      const inputFingerprint = buildKeycloakSnapshotInputFingerprint(instance);
      const keycloakRun = await repository.createKeycloakProvisioningRun({
        instanceId: activationInstanceId,
        mutation: 'executeKeycloakProvisioning',
        idempotencyKey: 'integration-manual-activation-keycloak',
        payloadFingerprint: 'integration-manual-activation-payload',
        mode: 'existing',
        intent: 'provision',
        overallStatus: 'planned',
        driftSummary: 'Kein Drift.',
      });
      await repository.appendKeycloakProvisioningStep({
        runId: keycloakRun.run.id,
        stepKey: 'status_snapshot',
        title: 'Postflight',
        status: 'done',
        summary: 'Aktuelle technische Evidenz ist bereit.',
        details: {
          policyVersion: 3,
          inputFingerprint,
          status: {
            realmExists: true,
            clientExists: true,
            tenantAdminClientExists: true,
            systemAdminRoleExists: true,
            tenantAdminExists: true,
            tenantAdminHasSystemAdmin: true,
            redirectUrisMatch: true,
            logoutUrisMatch: true,
            webOriginsMatch: true,
            pluginOidcClientsAligned: true,
            clientSecretConfigured: true,
            tenantClientSecretReadable: true,
            clientSecretAligned: true,
            tenantAdminClientSecretConfigured: true,
            tenantAdminClientSecretReadable: true,
            tenantAdminClientSecretAligned: true,
            runtimeSecretSource: 'tenant',
            realmBaselineAligned: true,
            userProfileBaselineAligned: true,
            instanceIdMapperAligned: true,
            smtpPasswordConfigured: true,
          },
          preflight: { overallStatus: 'ready', checkedAt: new Date().toISOString(), checks: [] },
          plan: {
            contractVersion: '1.0',
            fingerprint: 'a'.repeat(64),
            mode: 'existing',
            overallStatus: 'ready',
            generatedAt: new Date().toISOString(),
            driftSummary: 'Kein Drift.',
            steps: [],
          },
        },
      });
      await repository.updateKeycloakProvisioningRun({
        runId: keycloakRun.run.id,
        overallStatus: 'succeeded',
        driftSummary: 'Kein Drift.',
      });
      await repository.appendAuditEvent({
        instanceId: activationInstanceId,
        eventType: 'tenant_iam_access_probed',
        requestId: 'integration-manual-activation-access',
        details: { status: 'ready', summary: 'Zugriff bestätigt.' },
      });
      await pool.query(
        `INSERT INTO iam.instance_modules (instance_id, module_id)
         VALUES ($1, 'news')`,
        [activationInstanceId]
      );
      await pool.query(
        `INSERT INTO iam.roles (
           instance_id, role_key, role_name, display_name, external_role_name,
           is_system_role, role_level, managed_by, sync_state, last_synced_at
         ) VALUES ($1, 'system_admin', 'System Admin', 'System Admin', 'system_admin',
           true, 100, 'studio', 'synced', now())`,
        [activationInstanceId]
      );

      const service = createInstanceRegistryService({ ...baseDeps, repository });
      await expect(
        service.changeStatus({
          instanceId: activationInstanceId,
          nextStatus: 'active',
          idempotencyKey: 'integration-manual-activation',
          actorId: 'integration-test',
          requestId: 'integration-manual-activation-request',
        })
      ).resolves.toMatchObject({ ok: true, instance: { status: 'active' } });

      await expect(repository.getInstanceById(activationInstanceId)).resolves.toMatchObject({
        status: 'active',
      });
      await expect(repository.listAuditEvents(activationInstanceId)).resolves.toEqual(
        expect.arrayContaining([expect.objectContaining({ eventType: 'instance_activated' })])
      );
    } finally {
      await pool.query('DELETE FROM iam.instances WHERE id = $1', [activationInstanceId]);
      await pool.end();
    }
  }, 30_000);

  it('keeps correlated realm evidence and fails a retry closed when the current plan is blocked', async () => {
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
    let confirmedWorkerPlan: KeycloakTenantPlan | undefined;
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
      planKeycloakProvisioning: async () => {
        assert(confirmedWorkerPlan);
        return confirmedWorkerPlan;
      },
      syncTenantAdminBootstrapAccount,
      listProvisioningRealmAssignments: async () => [{ instanceId, authRealm: instanceId }],
    } satisfies Omit<InstanceRegistryServiceDeps, 'repository' | 'withInstanceProvisioningLock'>;
    const deps: InstanceRegistryServiceDeps = {
      ...baseDeps,
      repository,
      withInstanceProvisioningLock: withInstanceLock(pool, baseDeps),
    };

    try {
      await pool.query('DELETE FROM iam.instances WHERE id = $1', [instanceId]);
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
          activationPolicies: [
            {
              moduleId: 'integration-plugin',
              activationPolicy: 'automatic',
              manifestVersion: 1,
              policyRevision: '1',
            },
          ],
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
      confirmedWorkerPlan =
        (await createPlanKeycloakProvisioningHandler(deps)(instanceId)) ?? undefined;
      assert(confirmedWorkerPlan);

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

      const retryLeaseOwner = 'integration-parent-retry-reservation';
      const reservedRetry = await repository.reserveProvisioningRetryRun({
        instanceId,
        idempotencyKey: 'integration-parent',
        leaseOwner: retryLeaseOwner,
        leaseExpiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
      });
      assert(reservedRetry);
      const retried = await repository.retryProvisioningRun({
        instanceId,
        idempotencyKey: 'integration-parent',
        leaseOwner: retryLeaseOwner,
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
      expect(parentAfterRetry.childKeycloakRunId).toBe(originalChildRunId);
      expect(parentAfterRetry).toMatchObject({
        status: 'failed',
        stepKey: 'registry',
        errorCode: 'keycloak_plan_blocked',
      });
      expect(
        await repository.getKeycloakProvisioningRun(instanceId, originalChildRunId)
      ).toMatchObject({
        overallStatus: 'failed',
      });
    } finally {
      await pool.query('DELETE FROM iam.instances WHERE id = $1', [instanceId]);
      await pool.end();
    }
  }, 30_000);
});
