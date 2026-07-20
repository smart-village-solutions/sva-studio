import { describe, expect, it } from 'vitest';

import { createInstanceRegistryRepository } from './index.js';
import { createQueuedExecutor, instanceRow, keycloakRunRow, provisioningRow, stepRow } from './test-support.js';

describe('instance registry repository provisioning', () => {
  it('maps provisioning and audit projections', async () => {
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

  it('reads tenant IAM access probe and reconcile summary evidence', async () => {
    const { executor, statements } = createQueuedExecutor([
      [
        {
          checked_at: '2026-04-29T10:00:00.000Z',
          status: 'blocked',
          summary: 'Tenant-Admin-Client darf Rollen nicht lesen.',
          error_code: 'IDP_FORBIDDEN',
          request_id: 'req-probe-1',
        },
      ],
      [
        {
          sync_state: 'failed',
          role_count: 3,
          failed_count: 1,
          pending_count: 1,
          last_synced_at: '2026-04-29T09:55:00.000Z',
          last_error_code: 'IDP_CONFLICT',
        },
      ],
      [
        {
          request_id: 'req-reconcile-1',
          created_at: '2026-04-29T09:56:00.000Z',
        },
      ],
      [{ legacy_artifact_count: 0 }],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.getLatestTenantIamAccessProbe('tenant-a')).resolves.toEqual({
      checkedAt: '2026-04-29T10:00:00.000Z',
      status: 'blocked',
      summary: 'Tenant-Admin-Client darf Rollen nicht lesen.',
      errorCode: 'IDP_FORBIDDEN',
      requestId: 'req-probe-1',
    });
    await expect(repository.getRoleReconcileSummary('tenant-a')).resolves.toEqual({
      status: 'degraded',
      summary: '1 Rollen mit Fehler, 1 Rollen im Backlog.',
      checkedAt: '2026-04-29T09:55:00.000Z',
      errorCode: 'IDP_CONFLICT',
      requestId: 'req-reconcile-1',
    });
    expect(statements[0]?.text.includes('tenant_iam_access_probed')).toBe(true);
    expect(statements[1]?.text.includes('FROM iam.roles')).toBe(true);
  });

  it('returns null when tenant IAM probe and role reconcile evidence are missing', async () => {
    const { executor } = createQueuedExecutor([
      [],
      [{ sync_state: null, role_count: 0, failed_count: 0, pending_count: 0, last_synced_at: null, last_error_code: null }],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.getLatestTenantIamAccessProbe('tenant-a')).resolves.toBeNull();
    await expect(repository.getRoleReconcileSummary('tenant-a')).resolves.toBeNull();
  });

  it('maps tenant IAM probe defaults and ready or pending reconcile summaries', async () => {
    const { executor } = createQueuedExecutor([
      [
        {
          checked_at: '2026-04-29T10:01:00.000Z',
          status: 'unknown',
          summary: 'Keine Rechteprobe vorhanden.',
          error_code: null,
          request_id: null,
        },
      ],
      [
        {
          sync_state: 'synced',
          role_count: 2,
          failed_count: 0,
          pending_count: 0,
          last_synced_at: '2026-04-29T10:02:00.000Z',
          last_error_code: null,
        },
      ],
      [{ request_id: null, created_at: '2026-04-29T10:02:00.000Z' }],
      [{ legacy_artifact_count: 0 }],
      [
        {
          sync_state: 'pending',
          role_count: 3,
          failed_count: 0,
          pending_count: 2,
          last_synced_at: null,
          last_error_code: null,
        },
      ],
      [{ request_id: 'req-pending-1', created_at: '2026-04-29T10:03:00.000Z' }],
      [{ legacy_artifact_count: 0 }],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.getLatestTenantIamAccessProbe('tenant-a')).resolves.toEqual({
      checkedAt: '2026-04-29T10:01:00.000Z',
      status: 'unknown',
      summary: 'Keine Rechteprobe vorhanden.',
    });
    await expect(repository.getRoleReconcileSummary('tenant-a')).resolves.toEqual({
      status: 'ready',
      summary: 'Letzter Rollenabgleich ist synchron.',
      checkedAt: '2026-04-29T10:02:00.000Z',
    });
    await expect(repository.getRoleReconcileSummary('tenant-a')).resolves.toEqual({
      status: 'degraded',
      summary: '2 Rollen im Backlog.',
      requestId: 'req-pending-1',
    });
  });

  it('combines failed or pending reconcile state with legacy admin artifact drift evidence', async () => {
    const { executor } = createQueuedExecutor([
      [
        {
          sync_state: 'failed',
          role_count: 4,
          failed_count: 1,
          pending_count: 2,
          last_synced_at: '2026-04-29T10:04:00.000Z',
          last_error_code: null,
        },
      ],
      [{ request_id: null, created_at: '2026-04-29T10:04:00.000Z' }],
      [{ legacy_artifact_count: 3 }],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.getRoleReconcileSummary('tenant-a')).resolves.toEqual({
      status: 'degraded',
      summary: '1 Rollen mit Fehler, 2 Rollen im Backlog. 3 Legacy-Admin-Artefakte erfordern manuelle Bereinigung.',
      checkedAt: '2026-04-29T10:04:00.000Z',
      errorCode: 'LEGACY_ADMIN_ARTIFACT_DRIFT',
    });
  });

  it('marks synced role catalogs as degraded when legacy admin artifacts still exist', async () => {
    const { executor } = createQueuedExecutor([
      [
        {
          sync_state: 'synced',
          role_count: 2,
          failed_count: 0,
          pending_count: 0,
          last_synced_at: '2026-04-29T10:02:00.000Z',
          last_error_code: null,
        },
      ],
      [{ request_id: 'req-synced-1', created_at: '2026-04-29T10:02:00.000Z' }],
      [{ legacy_artifact_count: 2 }],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(repository.getRoleReconcileSummary('tenant-a')).resolves.toEqual({
      status: 'degraded',
      summary: '2 Legacy-Admin-Artefakte erfordern manuelle Bereinigung.',
      checkedAt: '2026-04-29T10:02:00.000Z',
      errorCode: 'LEGACY_ADMIN_ARTIFACT_DRIFT',
      requestId: 'req-synced-1',
    });
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
        featureFlags: { preview: true },
        mainserverConfigRef: 'mainserver-ref',
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
    expect(statements[0]?.text).toContain('$18::jsonb, $19, $20, $20');
    expect(statements[0]?.values.at(17)).toBe('{"preview":true}');
    expect(statements[0]?.values.at(18)).toBe('mainserver-ref');
    expect(statements[2]?.values.at(8)).toBe(true);
    expect(statements[0]?.text).toContain('ON CONFLICT (id) DO NOTHING');
  });

  it('returns null when createInstance loses a race against an existing instance id', async () => {
    const { executor, statements } = createQueuedExecutor([[], []]);
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
    ).resolves.toBeNull();

    expect(statements[0]?.text).toContain('ON CONFLICT (id) DO NOTHING');
  });

  it('annotates create and primary-hostname failures with their precise process step', async () => {
    const insertError = new Error('sensitive insert diagnostics');
    const insertRepository = createInstanceRegistryRepository({
      execute: async () => { throw insertError; },
    });
    const input = {
      instanceId: 'tenant-a', displayName: 'Tenant A', status: 'active' as const,
      parentDomain: 'example.test', primaryHostname: 'tenant-a.example.test',
      realmMode: 'shared' as const, authRealm: 'sva', authClientId: 'studio', actorId: 'actor-1',
    };

    await expect(insertRepository.createInstance(input)).rejects.toBe(insertError);
    expect((insertError as Error & { instanceRegistryStep?: string }).instanceRegistryStep).toBe('registry_insert');

    const hostnameError = new Error('sensitive hostname diagnostics');
    let invocation = 0;
    const hostnameRepository = createInstanceRegistryRepository({
      execute: async <TRow>() => {
        invocation += 1;
        if (invocation === 1) return { rowCount: 1, rows: [instanceRow] as TRow[] };
        throw hostnameError;
      },
    });
    await expect(hostnameRepository.createInstance(input)).rejects.toBe(hostnameError);
    expect((hostnameError as Error & { instanceRegistryStep?: string }).instanceRegistryStep).toBe('primary_hostname_upsert');
  });

  it('returns null for empty mutations and maps created runs and steps', async () => {
    const { executor } = createQueuedExecutor([[], [], [provisioningRow], [keycloakRunRow], [], [keycloakRunRow], [stepRow], [stepRow]]);
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

  it('writes audit events with a normalized empty details object', async () => {
    const { executor, statements } = createQueuedExecutor([]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.appendAuditEvent({
        instanceId: 'tenant-a',
        eventType: 'instance.created',
      })
    ).resolves.toBeUndefined();

    expect(statements).toHaveLength(1);
    expect(statements[0]?.text).toContain('INSERT INTO iam.instance_audit_events');
    expect(statements[0]?.values).toEqual(['tenant-a', 'instance.created', null, null, '{}']);
  });
});
