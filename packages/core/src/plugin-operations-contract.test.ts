import { describe, expect, it } from 'vitest';

import {
  studioImportContract,
  studioJobContract,
  studioJobEventContract,
  studioJobErrorContract,
  studioPluginOperationErrorContract,
} from './plugin-operations-contract.js';

describe('plugin-operations-contract', () => {
  it('exposes stable generic job statuses including retry and cancellation states', () => {
    expect(studioJobContract.statuses).toEqual([
      'queued',
      'running',
      'retrying',
      'succeeded',
      'failed',
      'cancelled',
    ]);
    expect(studioJobContract.isStatus('retrying')).toBe(true);
    expect(studioJobContract.isStatus('paused')).toBe(false);
  });

  it('marks terminal job states explicitly', () => {
    expect(studioJobContract.terminalStatuses).toEqual(['succeeded', 'failed', 'cancelled']);
    expect(studioJobContract.isTerminalStatus('failed')).toBe(true);
    expect(studioJobContract.isTerminalStatus('running')).toBe(false);
  });

  it('defines a moderate import phase model for structured imports', () => {
    expect(studioImportContract.phases).toEqual([
      'ingestion',
      'schema-validation',
      'mapping',
      'preview',
      'commit',
      'completed',
    ]);
    expect(studioImportContract.isPhase('preview')).toBe(true);
    expect(studioImportContract.isPhase('upload')).toBe(false);
  });

  it('defines the stable host error contract for plugin operation endpoints', () => {
    expect(studioPluginOperationErrorContract.codes).toEqual([
      'unauthorized',
      'forbidden',
      'not_found',
      'invalid_request',
      'invalid_instance_id',
      'idempotency_key_required',
      'database_unavailable',
    ]);
    expect(studioPluginOperationErrorContract.isCode('database_unavailable')).toBe(true);
    expect(studioPluginOperationErrorContract.isCode('conflict')).toBe(false);
  });

  it('defines stable job error categories for host-managed execution failures', () => {
    expect(studioJobErrorContract.categories).toEqual([
      'retryable',
      'permanent',
      'validation',
      'external_dependency',
    ]);
    expect(studioJobErrorContract.isCategory('validation')).toBe(true);
    expect(studioJobErrorContract.isCategory('unknown')).toBe(false);
  });

  it('defines stable technical job lifecycle event types', () => {
    expect(studioJobEventContract.types).toEqual([
      'job.queued',
      'job.started',
      'job.progressed',
      'job.retrying',
      'job.succeeded',
      'job.failed',
      'job.cancelled',
    ]);
    expect(studioJobEventContract.isType('job.progressed')).toBe(true);
    expect(studioJobEventContract.isType('job.resumed')).toBe(false);
  });
});
