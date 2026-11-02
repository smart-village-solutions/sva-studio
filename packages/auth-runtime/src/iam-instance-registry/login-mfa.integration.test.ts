import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { createInstanceRegistryRepository } from '@sva/data-repositories';
import {
  createInstanceRegistryService,
  processClaimedKeycloakProvisioningRun,
  type InstanceRegistryServiceDeps,
} from '@sva/instance-registry';

const requireRunId = (runId: string | undefined): string => {
  if (!runId) throw new Error('Expected an existing provisioning run');
  return runId;
};

it.skipIf(!process.env.IAM_DIRECTORY_TEST_DATABASE_URL)(
  'persists desired state, queues the existing worker, preserves verified state on failure and fences superseded MFA jobs in PostgreSQL',
  async () => {
    const pool = new Pool({ connectionString: process.env.IAM_DIRECTORY_TEST_DATABASE_URL });
    const client = await pool.connect();
    await client.query('BEGIN');
    try {
      for (const tenant of ['mfa-db-a', 'mfa-db-b'])
        await client.query(
          "INSERT INTO iam.instances(id,display_name,primary_hostname,auth_realm,auth_client_id,tenant_admin_client_id) VALUES($1,'Synthetic tenant',$1||'.example.test',$1,'studio','synthetic-admin')",
          [tenant]
        );
      await client.query('SET LOCAL ROLE iam_app');
      await client.query("SELECT set_config('app.instance_id','mfa-db-a',true)");
      const repository = createInstanceRegistryRepository({
        execute: async (statement) => {
          const result = await client.query(statement.text, statement.values as unknown[]);
          return { rows: result.rows, rowCount: result.rowCount ?? 0 };
        },
      });
      let failProvider = false;
      const deps: InstanceRegistryServiceDeps = {
        repository,
        readPluginOidcClientRequirements: () => [],
        reconcileLoginMfa: async ({ mode }) => {
          if (failProvider) throw new Error('fixture_provider_failure');
          return { aligned: true, mode };
        },
      };
      const service = createInstanceRegistryService(deps);
      expect((await repository.getInstanceById('mfa-db-a'))?.loginMfaPolicy).toEqual({
        desiredMode: 'optional',
        appliedMode: null,
        status: 'pending',
      });
      const first = await service.updateLoginMfaPolicy({
        instanceId: 'mfa-db-a',
        expectedRevision: 0,
        mode: 'optional',
        actorId: 'fixture-actor',
      });
      expect(first.policy).toEqual({
        desiredMode: 'optional',
        appliedMode: null,
        status: 'pending',
      });
      const firstRun = await repository.getKeycloakProvisioningRun(
        'mfa-db-a',
        requireRunId(first.runId)
      );
      expect(firstRun?.steps[0].stepKey).toBe('queued');
      await processClaimedKeycloakProvisioningRun(deps, firstRun);
      expect((await repository.getInstanceById('mfa-db-a'))?.loginMfaPolicy).toEqual({
        desiredMode: 'optional',
        appliedMode: 'optional',
        status: 'applied',
      });
      failProvider = true;
      const failed = await service.updateLoginMfaPolicy({
        instanceId: 'mfa-db-a',
        expectedRevision: 1,
        mode: 'required',
        actorId: 'fixture-actor',
      });
      await processClaimedKeycloakProvisioningRun(
        deps,
        await repository.getKeycloakProvisioningRun('mfa-db-a', requireRunId(failed.runId))
      );
      expect((await repository.getInstanceById('mfa-db-a'))?.loginMfaPolicy).toEqual({
        desiredMode: 'required',
        appliedMode: 'optional',
        status: 'failed',
      });
      failProvider = false;
      const old = await service.updateLoginMfaPolicy({
        instanceId: 'mfa-db-a',
        expectedRevision: 2,
        mode: 'required',
        actorId: 'fixture-actor',
      });
      const latest = await service.updateLoginMfaPolicy({
        instanceId: 'mfa-db-a',
        expectedRevision: 3,
        mode: 'optional',
        actorId: 'fixture-actor',
      });
      expect(
        await repository.verifyLoginMfaPolicy({
          instanceId: 'mfa-db-a',
          revision: old.revision,
          mode: 'required',
          runId: old.runId,
        })
      ).toBe(false);
      await processClaimedKeycloakProvisioningRun(
        deps,
        await repository.getKeycloakProvisioningRun('mfa-db-a', requireRunId(old.runId))
      );
      expect((await repository.getInstanceById('mfa-db-a'))?.loginMfaPolicy?.status).toBe(
        'pending'
      );
      await processClaimedKeycloakProvisioningRun(
        deps,
        await repository.getKeycloakProvisioningRun('mfa-db-a', requireRunId(latest.runId))
      );
      expect((await repository.getInstanceById('mfa-db-a'))?.loginMfaPolicy).toEqual({
        desiredMode: 'optional',
        appliedMode: 'optional',
        status: 'applied',
      });
      const audit = await client.query(
        "SELECT details FROM iam.instance_audit_events WHERE instance_id='mfa-db-a' AND details->>'action'='iam.authenticationPolicy.manage'"
      );
      expect(audit.rowCount).toBeGreaterThanOrEqual(6);
      await client.query('RESET ROLE');
      expect((await repository.getInstanceById('mfa-db-b'))?.loginMfaPolicy).toEqual({
        desiredMode: 'optional',
        appliedMode: null,
        status: 'pending',
      });
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await pool.end();
    }
  }
);
