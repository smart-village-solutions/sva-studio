import { describe, expect, it } from 'vitest';

import { classifyInstanceMutationError } from './mutation-errors.js';
import {
  buildInstanceRegistryFailureLog,
  readInstanceRegistryStepKey,
  runInstanceRegistryStep,
} from './observability.js';

describe('instance registry observability', () => {
  it('allowlists PostgreSQL diagnostics and correlation fields', () => {
    const error = Object.assign(new Error('secret@example.test password=hunter2'), {
      code: '23505',
      table: 'instances',
      column: 'id',
      constraint: 'instances_pkey',
      detail: 'Key (email)=(secret@example.test) already exists',
      query: 'INSERT INTO iam.instances ...',
    });

    const log = buildInstanceRegistryFailureLog(error, {
      operation: 'create_instance', requestId: 'req-1', instanceId: 'demo', stepKey: 'registry_insert',
    }, classifyInstanceMutationError(error));

    expect(log).toMatchObject({
      operation: 'create_instance', result: 'failed', request_id: 'req-1', instance_id: 'demo',
      step_key: 'registry_insert', error_type: 'Error', error_code: '23505',
      database_table: 'instances', database_column: 'id', database_constraint: 'instances_pkey',
    });
    expect(JSON.stringify(log)).not.toContain('secret@example.test');
    expect(log).not.toHaveProperty('detail');
    expect(log).not.toHaveProperty('query');
  });

  it('never serializes raw provider diagnostics or secrets', () => {
    const fragments = [
      'admin@smart-village.app',
      'password=top-secret',
      'Bearer token-value',
      'postgres://user:password@database/internal',
      "VALUES ('private-value')",
    ];
    const error = Object.assign(new Error(fragments.join(' ')), {
      detail: fragments[0], hint: fragments[1], query: fragments[4], parameters: fragments,
      stack: fragments.join('\n'), code: '08006',
    });
    const serialized = JSON.stringify(buildInstanceRegistryFailureLog(error, {
      operation: 'create_instance', requestId: 'req-safe',
    }, classifyInstanceMutationError(error)));

    for (const fragment of fragments) expect(serialized).not.toContain(fragment);
  });

  it('keeps the concrete failure step without exposing it as an enumerable error field', async () => {
    const error = new Error('provider secret');
    await expect(runInstanceRegistryStep('audit_event_insert', async () => {
      throw error;
    })).rejects.toBe(error);
    expect(readInstanceRegistryStepKey(error)).toBe('audit_event_insert');
    expect(JSON.stringify(error)).not.toContain('audit_event_insert');
  });

  it('uses the stable classification when no provider code exists', () => {
    expect(buildInstanceRegistryFailureLog('boom', { operation: 'create_instance' }, {
      status: 500, code: 'internal_unclassified',
    })).toMatchObject({
      operation: 'create_instance', result: 'failed', error: 'internal_unclassified',
      error_type: 'string', error_code: 'internal_unclassified', classification: 'internal_unclassified', http_status: 500,
    });
  });
});
