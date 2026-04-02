import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { SqlExecutionResult, SqlExecutor, SqlStatement } from '../iam/repositories/types';
import { createInstanceRegistryRepository } from './index';

const createExecute =
  <TRow extends Record<string, unknown>>(result: SqlExecutionResult<TRow>): SqlExecutor['execute'] =>
  async <TResult>(_statement: SqlStatement) =>
    result as unknown as SqlExecutionResult<TResult>;

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
});
