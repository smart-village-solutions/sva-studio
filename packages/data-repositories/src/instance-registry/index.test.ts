import { describe, expect, it } from 'vitest';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../iam/repositories/types.js';
import { createInstanceRegistryRepository } from './index.js';

const instanceRow = {
  instance_id: 'tenant-a',
  display_name: 'Tenant A',
  status: 'active',
  parent_domain: 'example.test',
  primary_hostname: 'tenant-a.example.test',
  realm_mode: 'shared',
  auth_realm: 'sva',
  auth_client_id: 'studio',
  auth_issuer_url: null,
  auth_client_secret_ciphertext: 'secret-cipher',
  tenant_admin_client_id: 'tenant-admin',
  tenant_admin_client_secret_ciphertext: null,
  tenant_admin_username: 'admin',
  tenant_admin_email: null,
  tenant_admin_first_name: 'Ada',
  tenant_admin_last_name: null,
  theme_key: null,
  feature_flags: null,
  mainserver_config_ref: null,
  created_at: '2026-01-01T00:00:00.000Z',
  created_by: null,
  updated_at: '2026-01-02T00:00:00.000Z',
  updated_by: 'actor-1',
};

const provisioningRow = {
  id: 'run-1',
  instance_id: 'tenant-a',
  operation: 'create',
  status: 'pending',
  step_key: null,
  idempotency_key: 'idem-1',
  error_code: null,
  error_message: null,
  request_id: 'request-1',
  actor_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:01.000Z',
};

const keycloakRunRow = {
  id: 'kc-run-1',
  instance_id: 'tenant-a',
  mutation: 'executeKeycloakProvisioning',
  idempotency_key: 'idem-kc-1',
  payload_fingerprint: 'fingerprint-1',
  mode: 'shared',
  intent: 'reconcile',
  overall_status: 'planned',
  drift_summary: 'No drift',
  request_id: null,
  actor_id: 'actor-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:01.000Z',
  created: true,
};

const stepRow = {
  id: 'step-id',
  run_id: 'kc-run-1',
  step_key: 'realm',
  title: 'Realm',
  status: 'success',
  started_at: null,
  finished_at: '2026-01-01T00:00:02.000Z',
  summary: 'Done',
  details: null,
  request_id: 'request-1',
  created_at: '2026-01-01T00:00:00.000Z',
};

const createQueuedExecutor = (queuedRows: readonly (readonly Record<string, unknown>[])[]) => {
  const statements: SqlStatement[] = [];
  const queue = [...queuedRows];
  const executor: SqlExecutor = {
    async execute<TRow = Record<string, unknown>>(statement: SqlStatement): Promise<SqlExecutionResult<TRow>> {
      statements.push(statement);
      const rows = queue.shift() ?? [];
      return {
        rowCount: rows.length,
        rows: rows as readonly TRow[],
      };
    },
  };

  return { executor, statements };
};

describe('instance registry repository', () => {
  it('maps instance list rows and builds list filters', async () => {
    const { executor, statements } = createQueuedExecutor([[instanceRow]]);

    await expect(
      createInstanceRegistryRepository(executor).listInstances({ search: ' Tenant ', status: 'active' })
    ).resolves.toEqual([
      {
        instanceId: 'tenant-a',
        displayName: 'Tenant A',
        status: 'active',
        parentDomain: 'example.test',
        primaryHostname: 'tenant-a.example.test',
        realmMode: 'shared',
        authRealm: 'sva',
        authClientId: 'studio',
        authClientSecretConfigured: true,
        tenantAdminClient: {
          clientId: 'tenant-admin',
          secretConfigured: false,
        },
        tenantAdminBootstrap: {
          username: 'admin',
          firstName: 'Ada',
        },
        featureFlags: {},
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        updatedBy: 'actor-1',
      },
    ]);
    expect(statements[0]?.values).toEqual(['Tenant', 'active']);
  });

  it('returns null for missing lookups and reads encrypted credential columns', async () => {
    const { executor } = createQueuedExecutor([
      [],
      [{ auth_client_secret_ciphertext: 'auth-cipher' }],
      [{ tenant_admin_client_secret_ciphertext: null }],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.getInstanceById('missing')).resolves.toBeNull();
    await expect(repository.getAuthClientSecretCiphertext('tenant-a')).resolves.toBe('auth-cipher');
    await expect(repository.getTenantAdminClientSecretCiphertext('tenant-a')).resolves.toBeNull();
  });

  it('maps provisioning, audit and keycloak run projections', async () => {
    const { executor, statements } = createQueuedExecutor([
      [provisioningRow],
      [provisioningRow],
      [
        {
          id: 'audit-1',
          instance_id: 'tenant-a',
          event_type: 'instance.created',
          actor_id: null,
          request_id: null,
          details: null,
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      [keycloakRunRow],
      [stepRow],
      [keycloakRunRow],
      [stepRow],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.listProvisioningRuns('tenant-a')).resolves.toMatchObject([
      { id: 'run-1', instanceId: 'tenant-a', requestId: 'request-1' },
    ]);
    await expect(repository.listLatestProvisioningRuns([])).resolves.toEqual({});
    await expect(repository.listLatestProvisioningRuns(['tenant-a'])).resolves.toMatchObject({
      'tenant-a': { id: 'run-1', instanceId: 'tenant-a' },
    });
    await expect(repository.listAuditEvents('tenant-a')).resolves.toEqual([
      {
        id: 'audit-1',
        instanceId: 'tenant-a',
        eventType: 'instance.created',
        details: {},
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    await expect(repository.listKeycloakProvisioningRuns('tenant-a')).resolves.toMatchObject([
      {
        id: 'kc-run-1',
        steps: [{ stepKey: 'realm', details: {}, requestId: 'request-1' }],
      },
    ]);
    await expect(repository.getKeycloakProvisioningRun('tenant-a', 'kc-run-1')).resolves.toMatchObject({
      id: 'kc-run-1',
      steps: [{ stepKey: 'realm' }],
    });
    expect(statements.some((statement) => statement.text.includes('WHERE run_id IN ($1)'))).toBe(true);
  });

  it('creates and updates instances with hostname side effects', async () => {
    const { executor, statements } = createQueuedExecutor([[instanceRow], [], [instanceRow], []]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.createInstance({
        instanceId: 'tenant-a',
        displayName: 'Tenant A',
        status: 'active',
        parentDomain: 'example.test',
        primaryHostname: 'tenant-a.example.test',
        realmMode: 'shared',
        authRealm: 'sva',
        authClientId: 'studio',
        actorId: 'actor-1',
      })
    ).resolves.toMatchObject({ instanceId: 'tenant-a' });

    await expect(
      repository.updateInstance({
        instanceId: 'tenant-a',
        displayName: 'Tenant A',
        parentDomain: 'example.test',
        primaryHostname: 'tenant-a.example.test',
        realmMode: 'shared',
        authRealm: 'sva',
        authClientId: 'studio',
        keepExistingAuthClientSecret: true,
      })
    ).resolves.toMatchObject({ instanceId: 'tenant-a' });

    expect(statements.filter((statement) => statement.text.includes('iam.instance_hostnames'))).toHaveLength(2);
    expect(statements[0]?.values.at(17)).toBe('{}');
    expect(statements[2]?.values.at(8)).toBe(true);
  });

  it('returns null for empty mutations and maps created runs and steps', async () => {
    const { executor } = createQueuedExecutor([
      [],
      [],
      [provisioningRow],
      [keycloakRunRow],
      [],
      [keycloakRunRow],
      [stepRow],
      [stepRow],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.setInstanceStatus({ instanceId: 'missing', status: 'active' })).resolves.toBeNull();
    await expect(
      repository.updateInstance({
        instanceId: 'missing',
        displayName: 'Missing',
        parentDomain: 'example.test',
        primaryHostname: 'missing.example.test',
        realmMode: 'shared',
        authRealm: 'sva',
        authClientId: 'studio',
      })
    ).resolves.toBeNull();
    await expect(
      repository.createProvisioningRun({
        instanceId: 'tenant-a',
        operation: 'create',
        status: 'pending',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toMatchObject({ id: 'run-1' });
    await expect(
      repository.createKeycloakProvisioningRun({
        instanceId: 'tenant-a',
        mutation: 'executeKeycloakProvisioning',
        idempotencyKey: 'idem-kc-1',
        payloadFingerprint: 'fingerprint-1',
        mode: 'shared',
        intent: 'reconcile',
        overallStatus: 'planned',
        driftSummary: 'No drift',
      })
    ).resolves.toMatchObject({ created: true, run: { id: 'kc-run-1', steps: [] } });
    await expect(repository.updateKeycloakProvisioningRun({ runId: 'missing', overallStatus: 'failed' })).resolves.toBeNull();
    await expect(
      repository.updateKeycloakProvisioningRun({ runId: 'kc-run-1', overallStatus: 'success', driftSummary: 'Clean' })
    ).resolves.toMatchObject({ id: 'kc-run-1', steps: [{ stepKey: 'realm' }] });
    await expect(
      repository.appendKeycloakProvisioningStep({
        runId: 'kc-run-1',
        stepKey: 'realm',
        title: 'Realm',
        status: 'success',
        summary: 'Done',
      })
    ).resolves.toEqual({
      stepKey: 'realm',
      title: 'Realm',
      status: 'success',
      finishedAt: '2026-01-01T00:00:02.000Z',
      summary: 'Done',
      details: {},
      requestId: 'request-1',
    });
  });

  it('deduplicates keycloak provisioning run creates by idempotency scope and detects payload reuse', async () => {
    const replayRow = {
      ...keycloakRunRow,
      created: false,
    };
    const { executor, statements } = createQueuedExecutor([
      [replayRow],
      [stepRow],
      [],
      [keycloakRunRow],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.createKeycloakProvisioningRun({
        instanceId: 'tenant-a',
        mutation: 'reconcileKeycloak',
        idempotencyKey: 'idem-kc-1',
        payloadFingerprint: 'fingerprint-1',
        mode: 'shared',
        intent: 'reconcile',
        overallStatus: 'planned',
        driftSummary: 'No drift',
      })
    ).resolves.toMatchObject({
      created: false,
      run: {
        id: 'kc-run-1',
        steps: [{ stepKey: 'realm' }],
      },
    });

    await expect(
      repository.createKeycloakProvisioningRun({
        instanceId: 'tenant-a',
        mutation: 'reconcileKeycloak',
        idempotencyKey: 'idem-kc-1',
        payloadFingerprint: 'different-fingerprint',
        mode: 'shared',
        intent: 'reconcile',
        overallStatus: 'planned',
        driftSummary: 'No drift',
      })
    ).rejects.toThrow('idempotency_key_reuse');

    expect(statements[0]?.text).toContain('ON CONFLICT (instance_id, mutation, idempotency_key)');
    expect(statements[0]?.text).toContain('payload_fingerprint = EXCLUDED.payload_fingerprint');
  });

  it('reports a keycloak provisioning idempotency conflict when the conflicting row cannot be reloaded', async () => {
    const { executor } = createQueuedExecutor([[], []]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.createKeycloakProvisioningRun({
        instanceId: 'tenant-a',
        mutation: 'reconcileKeycloak',
        idempotencyKey: 'idem-kc-1',
        payloadFingerprint: 'fingerprint-1',
        mode: 'shared',
        intent: 'reconcile',
        overallStatus: 'planned',
        driftSummary: 'No drift',
      })
    ).rejects.toThrow('keycloak_provisioning_run_idempotency_conflict');
  });
});
