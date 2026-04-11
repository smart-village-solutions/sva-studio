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
    assert.equal(statements[0]?.values[15], '{}');
    assert.equal(statements[0]?.values[17], 'system');
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
    assert.equal(statements[0]?.values[10], 'tenant-admin');
    assert.equal(statements[1]?.values[0], 'bb-guben.studio.smart-village.app');
  });
});
