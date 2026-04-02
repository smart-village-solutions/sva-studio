import { describe, expect, it } from 'vitest';

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

describe('instance registry repository (vitest)', () => {
  it('maps list results with nullable fields', async () => {
    const execute = createExecute({
      rowCount: 1,
      rows: [
        {
          instance_id: 'hb',
          display_name: 'HB',
          status: 'active',
          parent_domain: 'studio.example.org',
          primary_hostname: 'hb.studio.example.org',
          auth_realm: 'hb',
          auth_client_id: 'sva-studio',
          auth_issuer_url: null,
          theme_key: null,
          feature_flags: null,
          mainserver_config_ref: null,
          created_at: '2026-01-01T00:00:00.000Z',
          created_by: null,
          updated_at: '2026-01-01T00:00:00.000Z',
          updated_by: null,
        },
      ],
    });

    const repository = createInstanceRegistryRepository({ execute });

    await expect(repository.listInstances()).resolves.toEqual([
      {
        instanceId: 'hb',
        displayName: 'HB',
        status: 'active',
        parentDomain: 'studio.example.org',
        primaryHostname: 'hb.studio.example.org',
        authRealm: 'hb',
        authClientId: 'sva-studio',
        authIssuerUrl: undefined,
        themeKey: undefined,
        featureFlags: {},
        mainserverConfigRef: undefined,
        createdAt: '2026-01-01T00:00:00.000Z',
        createdBy: undefined,
        updatedAt: '2026-01-01T00:00:00.000Z',
        updatedBy: undefined,
      },
    ]);
  });

  it('returns null when lookups have no rows', async () => {
    const execute = createExecute({
      rowCount: 0,
      rows: [],
    });

    const repository = createInstanceRegistryRepository({ execute });

    await expect(repository.getInstanceById('unknown')).resolves.toBeNull();
    await expect(repository.resolveHostname('unknown.studio.example.org')).resolves.toBeNull();
    await expect(repository.setInstanceStatus({ instanceId: 'unknown', status: 'archived' })).resolves.toBeNull();
  });

  it('maps provisioning runs and audit events including optional fields', async () => {
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
            actor_id: null,
            request_id: null,
            details: null,
            created_at: '2026-01-02T00:00:02.000Z',
          },
        ],
      },
    ]);

    const repository = createInstanceRegistryRepository({ execute });

    await expect(repository.listProvisioningRuns('hb')).resolves.toEqual([
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
    await expect(repository.listAuditEvents('hb')).resolves.toEqual([
      {
        id: 'event-1',
        instanceId: 'hb',
        eventType: 'instance_activated',
        actorId: undefined,
        requestId: undefined,
        details: {},
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

    await expect(repository.listLatestProvisioningRuns(['hb', 'demo'])).resolves.toEqual({
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
    expect(statements[0]?.text).toMatch(/SELECT DISTINCT ON \(instance_id\)/);
  });

  it('creates instances with default actors and writes hostname rows', async () => {
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

    await expect(
      repository.createInstance({
        instanceId: 'demo',
        displayName: 'Demo',
        status: 'requested',
        parentDomain: 'studio.example.org',
        primaryHostname: 'demo.studio.example.org',
        authRealm: 'demo',
        authClientId: 'sva-studio',
      })
    ).resolves.toEqual({
      instanceId: 'demo',
      displayName: 'Demo',
      status: 'requested',
      parentDomain: 'studio.example.org',
      primaryHostname: 'demo.studio.example.org',
      authRealm: 'demo',
      authClientId: 'sva-studio',
      authIssuerUrl: undefined,
      themeKey: undefined,
      featureFlags: {},
      mainserverConfigRef: undefined,
      createdAt: '2026-01-03T00:00:00.000Z',
      createdBy: 'system',
      updatedAt: '2026-01-03T00:00:00.000Z',
      updatedBy: 'system',
    });
    expect(statements).toHaveLength(2);
    expect(statements[0]?.values[9]).toBe('{}');
    expect(statements[0]?.values[11]).toBe('system');
    expect(statements[1]?.values[2]).toBe('system');
  });

  it('writes provisioning and audit statements with null-safe defaults', async () => {
    const statements: SqlStatement[] = [];
    const execute = createSequencedExecutor(
      [
        {
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
              request_id: null,
              actor_id: null,
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-01-01T00:00:00.000Z',
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

    await expect(
      repository.createProvisioningRun({
        instanceId: 'hb',
        operation: 'create',
        status: 'requested',
        idempotencyKey: 'idem-1',
      })
    ).resolves.toEqual({
      id: 'run-1',
      instanceId: 'hb',
      operation: 'create',
      status: 'requested',
      stepKey: undefined,
      idempotencyKey: 'idem-1',
      errorCode: undefined,
      errorMessage: undefined,
      requestId: undefined,
      actorId: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await repository.appendAuditEvent({
      instanceId: 'hb',
      eventType: 'instance_requested',
    });

    expect(statements[0]?.values.slice(3)).toEqual([null, 'idem-1', null, null, null, null]);
    expect(statements[1]?.values[2]).toBe(null);
    expect(statements[1]?.values[3]).toBe(null);
    expect(statements[1]?.values[4]).toBe('{}');
  });
});
