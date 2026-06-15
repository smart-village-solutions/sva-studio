import { describe, expect, it } from 'vitest';

import { createInstanceRegistryRepository } from './index.js';
import { createQueuedExecutor, keycloakRunRow, provisioningRow, stepRow } from './test-support.js';

describe('instance registry repository keycloak provisioning', () => {
  it('loads an existing keycloak provisioning run by id with mapped steps', async () => {
    const { executor } = createQueuedExecutor([[keycloakRunRow], [stepRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.getKeycloakProvisioningRun('tenant-a', 'kc-run-1')).resolves.toEqual({
      id: 'kc-run-1',
      instanceId: 'tenant-a',
      mutation: 'executeKeycloakProvisioning',
      idempotencyKey: 'idem-kc-1',
      payloadFingerprint: 'fingerprint-1',
      mode: 'shared',
      intent: 'reconcile',
      overallStatus: 'planned',
      driftSummary: 'No drift',
      requestId: undefined,
      actorId: 'actor-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      steps: [
        {
          stepKey: 'realm',
          title: 'Realm',
          status: 'success',
          startedAt: undefined,
          finishedAt: '2026-01-01T00:00:02.000Z',
          summary: 'Done',
          details: {},
          requestId: 'request-1',
        },
      ],
    });
  });

  it('returns empty projections for missing provisioning step lookups and null run updates', async () => {
    const { executor } = createQueuedExecutor([
      [],
      [{ ...keycloakRunRow, mutation: null, idempotency_key: null, payload_fingerprint: null }],
      [],
      [],
      [provisioningRow],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.listKeycloakProvisioningRuns('tenant-a')).resolves.toEqual([]);
    await expect(repository.claimNextKeycloakProvisioningRun()).resolves.toEqual({
      id: 'kc-run-1',
      instanceId: 'tenant-a',
      mode: 'shared',
      intent: 'reconcile',
      overallStatus: 'planned',
      driftSummary: 'No drift',
      requestId: undefined,
      actorId: 'actor-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:01.000Z',
      steps: [],
    });
    await expect(repository.updateKeycloakProvisioningRun({ runId: 'missing', overallStatus: 'failed' })).resolves.toBeNull();
    await expect(
      repository.createProvisioningRun({
        instanceId: 'tenant-a',
        operation: 'create',
        status: 'pending',
        idempotencyKey: 'idem-2',
        stepKey: 'bootstrap',
        errorCode: 'oops',
        errorMessage: 'boom',
        requestId: 'req-2',
        actorId: 'actor-2',
      })
    ).resolves.toMatchObject({
      stepKey: undefined,
      errorCode: undefined,
      errorMessage: undefined,
      requestId: 'request-1',
    });
  });

  it('deduplicates keycloak provisioning run creates by idempotency scope and detects payload reuse', async () => {
    const replayRow = {
      ...keycloakRunRow,
      created: false,
    };
    const { executor, statements } = createQueuedExecutor([[replayRow], [stepRow], [], [keycloakRunRow]]);
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

  it('filters claimed keycloak provisioning runs by creation timestamp when requested', async () => {
    const { executor, statements } = createQueuedExecutor([[keycloakRunRow], []]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.claimNextKeycloakProvisioningRun({
        createdAtOrAfter: '2026-05-27T12:00:00.000Z',
      })
    ).resolves.toMatchObject({
      id: 'kc-run-1',
      instanceId: 'tenant-a',
    });

    expect(statements[0]?.text).toContain('AND created_at >= $1::timestamptz');
    expect(statements[0]?.values).toEqual(['2026-05-27T12:00:00.000Z']);
  });
});
