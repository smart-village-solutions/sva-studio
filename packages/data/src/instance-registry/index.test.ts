import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../iam/repositories/types';
import { createInstanceRegistryRepository } from './index';

const createExecute =
  <TRow extends Record<string, unknown>>(result: SqlExecutionResult<TRow>): SqlExecutor['execute'] =>
  async <TResult>(_statement: SqlStatement) =>
    result as unknown as SqlExecutionResult<TResult>;

const createSequencedExecutor = (
  results: readonly SqlExecutionResult<Record<string, unknown>>[],
  statements: SqlStatement[] = []
): SqlExecutor['execute'] => {
  let index = 0;

  return async <TResult>(statement: SqlStatement) => {
    statements.push(statement);
    const result = results[index];
    index += 1;
    return (result ?? { rowCount: 0, rows: [] }) as SqlExecutionResult<TResult>;
  };
};

describe('instance registry repository', () => {
  it('maps list results', async () => {
    const execute = createExecute({
      rowCount: 1,
      rows: [
        {
          instance_id: 'hb',
          display_name: 'HB',
          status: 'active',
          parent_domain: 'studio.example.org',
          primary_hostname: 'hb.studio.example.org',
          realm_mode: 'existing',
          auth_realm: 'hb',
          auth_client_id: 'sva-studio',
          auth_issuer_url: null,
          theme_key: null,
          feature_flags: { provisioning: true },
          mainserver_config_ref: null,
          created_at: '2026-01-01T00:00:00.000Z',
          created_by: null,
          updated_at: '2026-01-01T00:00:00.000Z',
          updated_by: null,
        },
      ],
    });

    const repository = createInstanceRegistryRepository({ execute });
    const items = await repository.listInstances();

    assert.equal(items.length, 1);
    assert.deepEqual(items[0], {
      instanceId: 'hb',
      displayName: 'HB',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'hb.studio.example.org',
      realmMode: 'existing',
      authRealm: 'hb',
      authClientId: 'sva-studio',
      authIssuerUrl: undefined,
      authClientSecretConfigured: false,
      tenantAdminClient: undefined,
      tenantAdminBootstrap: undefined,
      themeKey: undefined,
      featureFlags: { provisioning: true },
      mainserverConfigRef: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: undefined,
      updatedAt: '2026-01-01T00:00:00.000Z',
      updatedBy: undefined,
    });
  });

  it('maps list results with tenant admin client and bootstrap details', async () => {
    const execute = createExecute({
      rowCount: 1,
      rows: [
        {
          instance_id: 'bb-guben',
          display_name: 'BB Guben',
          status: 'active',
          parent_domain: 'studio.example.org',
          primary_hostname: 'bb-guben.studio.example.org',
          realm_mode: 'existing',
          auth_realm: 'bb-guben',
          auth_client_id: 'sva-studio',
          auth_issuer_url: 'https://keycloak.example.org/realms/bb-guben',
          auth_client_secret_ciphertext: 'enc:tenant',
          tenant_admin_client_id: 'sva-studio-admin',
          tenant_admin_client_secret_ciphertext: 'enc:tenant-admin',
          tenant_admin_username: 'tenant-admin',
          tenant_admin_email: 'tenant@example.org',
          tenant_admin_first_name: 'Tenant',
          tenant_admin_last_name: 'Admin',
          theme_key: 'guben',
          feature_flags: { provisioning: true },
          mainserver_config_ref: 'mainserver-guben',
          created_at: '2026-01-01T00:00:00.000Z',
          created_by: 'seed',
          updated_at: '2026-01-02T00:00:00.000Z',
          updated_by: 'seed',
        },
      ],
    });

    const repository = createInstanceRegistryRepository({ execute });
    const items = await repository.listInstances();

    assert.equal(items.length, 1);
    assert.deepEqual(items[0], {
      instanceId: 'bb-guben',
      displayName: 'BB Guben',
      status: 'active',
      parentDomain: 'studio.example.org',
      primaryHostname: 'bb-guben.studio.example.org',
      realmMode: 'existing',
      authRealm: 'bb-guben',
      authClientId: 'sva-studio',
      authIssuerUrl: 'https://keycloak.example.org/realms/bb-guben',
      authClientSecretConfigured: true,
      tenantAdminClient: {
        clientId: 'sva-studio-admin',
        secretConfigured: true,
      },
      tenantAdminBootstrap: {
        username: 'tenant-admin',
        email: 'tenant@example.org',
        firstName: 'Tenant',
        lastName: 'Admin',
      },
      themeKey: 'guben',
      featureFlags: { provisioning: true },
      mainserverConfigRef: 'mainserver-guben',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'seed',
      updatedAt: '2026-01-02T00:00:00.000Z',
      updatedBy: 'seed',
    });
  });

  it('creates provisioning runs with passed metadata', async () => {
    const execute = createExecute({
      rowCount: 1,
      rows: [
        {
          id: 'run-1',
          instance_id: 'hb',
          operation: 'create',
          status: 'requested',
          step_key: null,
          idempotency_key: 'idem-1',
          error_code: null,
          error_message: null,
          request_id: 'req-1',
          actor_id: 'actor-1',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    const repository = createInstanceRegistryRepository({ execute });
    const run = await repository.createProvisioningRun({
      instanceId: 'hb',
      operation: 'create',
      status: 'requested',
      idempotencyKey: 'idem-1',
      requestId: 'req-1',
      actorId: 'actor-1',
    });

    assert.deepEqual(run, {
      id: 'run-1',
      instanceId: 'hb',
      operation: 'create',
      status: 'requested',
      stepKey: undefined,
      idempotencyKey: 'idem-1',
      errorCode: undefined,
      errorMessage: undefined,
      requestId: 'req-1',
      actorId: 'actor-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('returns null when no instance exists for id or hostname', async () => {
    const execute = createExecute({
      rowCount: 0,
      rows: [],
    });

    const repository = createInstanceRegistryRepository({ execute });

    assert.equal(await repository.getInstanceById('unknown'), null);
    assert.equal(await repository.resolveHostname('unknown.studio.example.org'), null);
  });

  it('maps provisioning runs and audit events with optional fields populated', async () => {
    const execute = createSequencedExecutor([
      {
        rowCount: 1,
        rows: [
          {
            id: 'run-2',
            instance_id: 'hb',
            operation: 'activate',
            status: 'active',
            step_key: 'finalize',
            idempotency_key: 'idem-2',
            error_code: 'transient',
            error_message: 'retry later',
            request_id: 'req-2',
            actor_id: 'actor-2',
            created_at: '2026-01-02T00:00:00.000Z',
            updated_at: '2026-01-02T00:00:01.000Z',
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: 'event-1',
            instance_id: 'hb',
            event_type: 'instance_activated',
            actor_id: 'actor-2',
            request_id: 'req-2',
            details: { previousStatus: 'provisioning' },
            created_at: '2026-01-02T00:00:02.000Z',
          },
        ],
      },
    ]);

    const repository = createInstanceRegistryRepository({ execute });

    assert.deepEqual(await repository.listProvisioningRuns('hb'), [
      {
        id: 'run-2',
        instanceId: 'hb',
        operation: 'activate',
        status: 'active',
        stepKey: 'finalize',
        idempotencyKey: 'idem-2',
        errorCode: 'transient',
        errorMessage: 'retry later',
        requestId: 'req-2',
        actorId: 'actor-2',
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:01.000Z',
      },
    ]);
    assert.deepEqual(await repository.listAuditEvents('hb'), [
      {
        id: 'event-1',
        instanceId: 'hb',
        eventType: 'instance_activated',
        actorId: 'actor-2',
        requestId: 'req-2',
        details: { previousStatus: 'provisioning' },
        createdAt: '2026-01-02T00:00:02.000Z',
      },
    ]);
  });

  it('loads the latest provisioning run for multiple instances in one query', async () => {
    const statements: SqlStatement[] = [];
    const execute = createSequencedExecutor(
      [
        {
          rowCount: 2,
          rows: [
            {
              id: 'run-2',
              instance_id: 'hb',
              operation: 'activate',
              status: 'active',
              step_key: null,
              idempotency_key: 'idem-hb',
              error_code: null,
              error_message: null,
              request_id: null,
              actor_id: null,
              created_at: '2026-01-02T00:00:00.000Z',
              updated_at: '2026-01-02T00:00:00.000Z',
            },
            {
              id: 'run-1',
              instance_id: 'demo',
              operation: 'create',
              status: 'requested',
              step_key: null,
              idempotency_key: 'idem-demo',
              error_code: null,
              error_message: null,
              request_id: null,
              actor_id: null,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
      statements
    );

    const repository = createInstanceRegistryRepository({ execute });
    const latestRuns = await repository.listLatestProvisioningRuns(['hb', 'demo']);

    assert.deepEqual(latestRuns, {
      hb: {
        id: 'run-2',
        instanceId: 'hb',
        operation: 'activate',
        status: 'active',
        stepKey: undefined,
        idempotencyKey: 'idem-hb',
        errorCode: undefined,
        errorMessage: undefined,
        requestId: undefined,
        actorId: undefined,
        createdAt: '2026-01-02T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
      demo: {
        id: 'run-1',
        instanceId: 'demo',
        operation: 'create',
        status: 'requested',
        stepKey: undefined,
        idempotencyKey: 'idem-demo',
        errorCode: undefined,
        errorMessage: undefined,
        requestId: undefined,
        actorId: undefined,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    assert.match(statements[0]?.text ?? '', /SELECT DISTINCT ON \(instance_id\)/);
  });

  it('creates instances and falls back to system actor plus empty feature flags', async () => {
    const statements: SqlStatement[] = [];
    const execute = createSequencedExecutor(
      [
        {
          rowCount: 1,
          rows: [
            {
              instance_id: 'demo',
              display_name: 'Demo',
              status: 'requested',
              parent_domain: 'studio.example.org',
              primary_hostname: 'demo.studio.example.org',
              realm_mode: 'new',
              auth_realm: 'demo',
              auth_client_id: 'sva-studio',
              auth_issuer_url: null,
              theme_key: null,
              feature_flags: null,
              mainserver_config_ref: null,
              created_at: '2026-01-03T00:00:00.000Z',
              created_by: 'system',
              updated_at: '2026-01-03T00:00:00.000Z',
              updated_by: 'system',
            },
          ],
        },
        {
          rowCount: 1,
          rows: [],
        },
      ],
      statements
    );

    const repository = createInstanceRegistryRepository({ execute });
    const instance = await repository.createInstance({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'requested',
      realmMode: 'new',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      authRealm: 'demo',
      authClientId: 'sva-studio',
    });

    assert.deepEqual(instance, {
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'requested',
      realmMode: 'new',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authIssuerUrl: undefined,
      authClientSecretConfigured: false,
      tenantAdminClient: undefined,
      tenantAdminBootstrap: undefined,
      themeKey: undefined,
      featureFlags: {},
      mainserverConfigRef: undefined,
      createdAt: '2026-01-03T00:00:00.000Z',
      createdBy: 'system',
      updatedAt: '2026-01-03T00:00:00.000Z',
      updatedBy: 'system',
    });
    assert.equal(statements.length, 2);
    assert.equal(statements[0]?.values[17], '{}');
    assert.equal(statements[0]?.values[19], 'system');
    assert.equal(statements[1]?.values[2], 'system');
  });

  it('returns null for missing status updates and persists empty audit details by default', async () => {
    const statements: SqlStatement[] = [];
    const execute = createSequencedExecutor(
      [
        {
          rowCount: 0,
          rows: [],
        },
        {
          rowCount: 1,
          rows: [],
        },
      ],
      statements
    );

    const repository = createInstanceRegistryRepository({ execute });

    assert.equal(
      await repository.setInstanceStatus({
        instanceId: 'unknown',
        status: 'archived',
      }),
      null
    );

    await repository.appendAuditEvent({
      instanceId: 'unknown',
      eventType: 'instance_archived',
    });

    assert.equal(statements[0]?.values[2], 'system');
    assert.equal(statements[1]?.values[2], null);
    assert.equal(statements[1]?.values[3], null);
    assert.equal(statements[1]?.values[4], '{}');
  });

  it('loads stored tenant client secret ciphertext by instance id', async () => {
    const execute = createExecute({
      rowCount: 1,
      rows: [{ auth_client_secret_ciphertext: 'enc:tenant-secret' }],
    });

    const repository = createInstanceRegistryRepository({ execute });

    assert.equal(await repository.getAuthClientSecretCiphertext('bb-guben'), 'enc:tenant-secret');
  });

  it('loads stored tenant admin client secret ciphertext by instance id', async () => {
    const execute = createExecute({
      rowCount: 1,
      rows: [{ tenant_admin_client_secret_ciphertext: 'enc:tenant-admin-secret' }],
    });

    const repository = createInstanceRegistryRepository({ execute });

    assert.equal(await repository.getTenantAdminClientSecretCiphertext('bb-guben'), 'enc:tenant-admin-secret');
  });

  it('updates instance auth bootstrap fields and can keep an existing tenant secret', async () => {
    const statements: SqlStatement[] = [];
    const execute = createSequencedExecutor(
      [
        {
          rowCount: 1,
          rows: [
            {
              instance_id: 'bb-guben',
              display_name: 'BB Guben',
              status: 'active',
              parent_domain: 'studio.smart-village.app',
              primary_hostname: 'bb-guben.studio.smart-village.app',
              realm_mode: 'existing',
              auth_realm: 'bb-guben',
              auth_client_id: 'sva-studio',
              auth_issuer_url: 'https://keycloak.smart-village.app/realms/bb-guben',
              auth_client_secret_ciphertext: 'enc:tenant-secret',
              tenant_admin_username: 'tenant-admin',
              tenant_admin_email: 'tenant@example.org',
              tenant_admin_first_name: 'Tenant',
              tenant_admin_last_name: 'Admin',
              theme_key: 'guben',
              feature_flags: { provisioning: true },
              mainserver_config_ref: 'mainserver-guben',
              created_at: '2026-01-01T00:00:00.000Z',
              created_by: 'seed',
              updated_at: '2026-01-02T00:00:00.000Z',
              updated_by: 'actor-1',
            },
          ],
        },
        {
          rowCount: 1,
          rows: [],
        },
      ],
      statements
    );

    const repository = createInstanceRegistryRepository({ execute });
    const instance = await repository.updateInstance({
      instanceId: 'bb-guben',
      displayName: 'BB Guben',
      realmMode: 'existing',
      parentDomain: 'studio.smart-village.app',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      authRealm: 'bb-guben',
      authClientId: 'sva-studio',
      authIssuerUrl: 'https://keycloak.smart-village.app/realms/bb-guben',
      keepExistingAuthClientSecret: true,
      tenantAdminBootstrap: {
        username: 'tenant-admin',
        email: 'tenant@example.org',
        firstName: 'Tenant',
        lastName: 'Admin',
      },
      actorId: 'actor-1',
      featureFlags: { provisioning: true },
      themeKey: 'guben',
      mainserverConfigRef: 'mainserver-guben',
    });

    assert.deepEqual(instance, {
      instanceId: 'bb-guben',
      displayName: 'BB Guben',
      status: 'active',
      realmMode: 'existing',
      parentDomain: 'studio.smart-village.app',
      primaryHostname: 'bb-guben.studio.smart-village.app',
      authRealm: 'bb-guben',
      authClientId: 'sva-studio',
      authIssuerUrl: 'https://keycloak.smart-village.app/realms/bb-guben',
      authClientSecretConfigured: true,
      tenantAdminClient: undefined,
      tenantAdminBootstrap: {
        username: 'tenant-admin',
        email: 'tenant@example.org',
        firstName: 'Tenant',
        lastName: 'Admin',
      },
      themeKey: 'guben',
      featureFlags: { provisioning: true },
      mainserverConfigRef: 'mainserver-guben',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: 'seed',
      updatedAt: '2026-01-02T00:00:00.000Z',
      updatedBy: 'actor-1',
    });
    assert.equal(statements[0]?.values[8], true);
    assert.equal(statements[0]?.values[9], null);
    assert.equal(statements[0]?.values[13], 'tenant-admin');
    assert.equal(statements[1]?.values[0], 'bb-guben.studio.smart-village.app');
  });

  it('returns an empty object when latest provisioning runs are requested for no instances', async () => {
    const repository = createInstanceRegistryRepository({
      execute: async () => {
        throw new Error('execute should not be called');
      },
    });

    assert.deepEqual(await repository.listLatestProvisioningRuns([]), {});
  });

  it('lists keycloak provisioning runs with mapped steps', async () => {
    const execute = createSequencedExecutor([
      {
        rowCount: 1,
        rows: [
          {
            id: 'run-1',
            instance_id: 'hb',
            mode: 'existing',
            intent: 'provision_admin_client',
            overall_status: 'running',
            drift_summary: 'Tenant admin client missing.',
            request_id: 'req-1',
            actor_id: 'actor-1',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:01:00.000Z',
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: 'step-1',
            run_id: 'run-1',
            step_key: 'tenant_admin_client',
            title: 'Tenant admin client anlegen',
            status: 'running',
            started_at: '2026-01-01T00:00:30.000Z',
            finished_at: null,
            summary: 'Client wird angelegt.',
            details: { phase: 'create' },
            request_id: 'req-1',
            created_at: '2026-01-01T00:00:30.000Z',
          },
        ],
      },
    ]);

    const repository = createInstanceRegistryRepository({ execute });

    assert.deepEqual(await repository.listKeycloakProvisioningRuns('hb'), [
      {
        id: 'run-1',
        instanceId: 'hb',
        mode: 'existing',
        intent: 'provision_admin_client',
        overallStatus: 'running',
        driftSummary: 'Tenant admin client missing.',
        requestId: 'req-1',
        actorId: 'actor-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:01:00.000Z',
        steps: [
          {
            stepKey: 'tenant_admin_client',
            title: 'Tenant admin client anlegen',
            status: 'running',
            startedAt: '2026-01-01T00:00:30.000Z',
            finishedAt: undefined,
            summary: 'Client wird angelegt.',
            details: { phase: 'create' },
            requestId: 'req-1',
          },
        ],
      },
    ]);
  });

  it('returns null when the requested keycloak provisioning run does not exist', async () => {
    const execute = createSequencedExecutor([
      {
        rowCount: 0,
        rows: [],
      },
    ]);

    const repository = createInstanceRegistryRepository({ execute });

    assert.equal(await repository.getKeycloakProvisioningRun('hb', 'run-missing'), null);
  });

  it('claims the next keycloak provisioning run and returns null when none is queued', async () => {
    const execute = createSequencedExecutor([
      {
        rowCount: 1,
        rows: [
          {
            id: 'run-queued',
            instance_id: 'hb',
            mode: 'existing',
            intent: 'provision',
            overall_status: 'running',
            drift_summary: 'Realm drift detected.',
            request_id: null,
            actor_id: null,
            created_at: '2026-01-02T00:00:00.000Z',
            updated_at: '2026-01-02T00:00:10.000Z',
          },
        ],
      },
      {
        rowCount: 0,
        rows: [],
      },
      {
        rowCount: 0,
        rows: [],
      },
    ]);

    const repository = createInstanceRegistryRepository({ execute });

    assert.deepEqual(await repository.claimNextKeycloakProvisioningRun(), {
      id: 'run-queued',
      instanceId: 'hb',
      mode: 'existing',
      intent: 'provision',
      overallStatus: 'running',
      driftSummary: 'Realm drift detected.',
      requestId: undefined,
      actorId: undefined,
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:10.000Z',
      steps: [],
    });
    assert.equal(await repository.claimNextKeycloakProvisioningRun(), null);
  });

  it('creates, updates and appends keycloak provisioning records', async () => {
    const execute = createSequencedExecutor([
      {
        rowCount: 1,
        rows: [
          {
            id: 'run-created',
            instance_id: 'hb',
            mutation: 'executeKeycloakProvisioning',
            idempotency_key: 'idem-kc-1',
            payload_fingerprint: 'fingerprint-1',
            mode: 'existing',
            intent: 'provision_admin_client',
            overall_status: 'planned',
            drift_summary: 'Plan created.',
            request_id: null,
            actor_id: null,
            created_at: '2026-01-03T00:00:00.000Z',
            updated_at: '2026-01-03T00:00:00.000Z',
            created: true,
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: 'run-created',
            instance_id: 'hb',
            mutation: 'executeKeycloakProvisioning',
            idempotency_key: 'idem-kc-1',
            payload_fingerprint: 'fingerprint-1',
            mode: 'existing',
            intent: 'provision_admin_client',
            overall_status: 'succeeded',
            drift_summary: 'Plan finished.',
            request_id: 'req-2',
            actor_id: 'actor-2',
            created_at: '2026-01-03T00:00:00.000Z',
            updated_at: '2026-01-03T00:02:00.000Z',
          },
        ],
      },
      {
        rowCount: 0,
        rows: [],
      },
      {
        rowCount: 0,
        rows: [],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: 'step-created',
            run_id: 'run-created',
            step_key: 'finalize',
            title: 'Abschluss',
            status: 'done',
            started_at: null,
            finished_at: '2026-01-03T00:02:00.000Z',
            summary: 'Provisioning abgeschlossen.',
            details: null,
            request_id: null,
            created_at: '2026-01-03T00:02:00.000Z',
          },
        ],
      },
    ]);

    const repository = createInstanceRegistryRepository({ execute });

    assert.deepEqual(
      await repository.createKeycloakProvisioningRun({
        instanceId: 'hb',
        mutation: 'executeKeycloakProvisioning',
        idempotencyKey: 'idem-kc-1',
        payloadFingerprint: 'fingerprint-1',
        mode: 'existing',
        intent: 'provision_admin_client',
        overallStatus: 'planned',
        driftSummary: 'Plan created.',
      }),
      {
        created: true,
        run: {
          id: 'run-created',
          instanceId: 'hb',
          mutation: 'executeKeycloakProvisioning',
          idempotencyKey: 'idem-kc-1',
          payloadFingerprint: 'fingerprint-1',
          mode: 'existing',
          intent: 'provision_admin_client',
          overallStatus: 'planned',
          driftSummary: 'Plan created.',
          requestId: undefined,
          actorId: undefined,
          createdAt: '2026-01-03T00:00:00.000Z',
          updatedAt: '2026-01-03T00:00:00.000Z',
          steps: [],
        },
      }
    );

    assert.deepEqual(
      await repository.updateKeycloakProvisioningRun({
        runId: 'run-created',
        overallStatus: 'succeeded',
        driftSummary: 'Plan finished.',
      }),
      {
        id: 'run-created',
        instanceId: 'hb',
        mutation: 'executeKeycloakProvisioning',
        idempotencyKey: 'idem-kc-1',
        payloadFingerprint: 'fingerprint-1',
        mode: 'existing',
        intent: 'provision_admin_client',
        overallStatus: 'succeeded',
        driftSummary: 'Plan finished.',
        requestId: 'req-2',
        actorId: 'actor-2',
        createdAt: '2026-01-03T00:00:00.000Z',
        updatedAt: '2026-01-03T00:02:00.000Z',
        steps: [],
      }
    );

    assert.equal(
      await repository.updateKeycloakProvisioningRun({
        runId: 'run-missing',
        overallStatus: 'failed',
      }),
      null
    );

    assert.deepEqual(
      await repository.appendKeycloakProvisioningStep({
        runId: 'run-created',
        stepKey: 'finalize',
        title: 'Abschluss',
        status: 'done',
        summary: 'Provisioning abgeschlossen.',
      }),
      {
        stepKey: 'finalize',
        title: 'Abschluss',
        status: 'done',
        startedAt: undefined,
        finishedAt: '2026-01-03T00:02:00.000Z',
        summary: 'Provisioning abgeschlossen.',
        details: {},
        requestId: undefined,
      }
    );
  });
});
