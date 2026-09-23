import { describe, expect, it } from 'vitest';

import { createInstanceRegistryRepository } from './index.js';
import {
  createQueuedExecutor,
  instanceRow,
  keycloakRunRow,
  provisioningRow,
  stepRow,
} from './test-support.js';

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
      {
        id: 'run-1',
        instanceId: 'tenant-a',
        payloadFingerprint: 'create-fingerprint-1',
        requestId: 'request-1',
      },
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
    await expect(
      repository.getKeycloakProvisioningRun('tenant-a', 'kc-run-1')
    ).resolves.toMatchObject({
      id: 'kc-run-1',
      steps: [{ stepKey: 'realm' }],
    });
    expect(statements.some((statement) => statement.text.includes('WHERE run_id IN ($1)'))).toBe(
      true
    );
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
      [
        {
          sync_state: null,
          role_count: 0,
          failed_count: 0,
          pending_count: 0,
          last_synced_at: null,
          last_error_code: null,
        },
      ],
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
      summary:
        '1 Rollen mit Fehler, 2 Rollen im Backlog. 3 Legacy-Admin-Artefakte erfordern manuelle Bereinigung.',
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
    const { executor, statements } = createQueuedExecutor([
      [instanceRow],
      [{ hostname: 'tenant-a.example.test' }],
      [instanceRow],
      [],
      [{ hostname: 'tenant-a.example.test' }],
    ]);
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

    expect(
      statements.filter((statement) => statement.text.includes('iam.instance_hostnames'))
    ).toHaveLength(3);
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

  it('updates only the realm mode after a newly provisioned realm is finalized', async () => {
    const { executor, statements } = createQueuedExecutor([[instanceRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.setInstanceRealmMode({
        instanceId: 'tenant-a',
        realmMode: 'existing',
        actorId: 'worker-1',
        requestId: 'request-1',
      })
    ).resolves.toMatchObject({ instanceId: 'tenant-a' });

    expect(statements[0]).toMatchObject({
      values: ['tenant-a', 'existing', 'worker-1'],
    });
    expect(statements[0]?.text).toContain('SET\n  realm_mode = $2');
    expect(statements[0]?.text).not.toContain('auth_client_secret_ciphertext =');
  });

  it('annotates create and primary-hostname failures with their precise process step', async () => {
    const insertError = new Error('sensitive insert diagnostics');
    const insertRepository = createInstanceRegistryRepository({
      execute: async () => {
        throw insertError;
      },
    });
    const input = {
      instanceId: 'tenant-a',
      displayName: 'Tenant A',
      status: 'active' as const,
      parentDomain: 'example.test',
      primaryHostname: 'tenant-a.example.test',
      realmMode: 'shared' as const,
      authRealm: 'sva',
      authClientId: 'studio',
      actorId: 'actor-1',
    };

    await expect(insertRepository.createInstance(input)).rejects.toBe(insertError);
    expect((insertError as Error & { instanceRegistryStep?: string }).instanceRegistryStep).toBe(
      'registry_insert'
    );

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
    expect((hostnameError as Error & { instanceRegistryStep?: string }).instanceRegistryStep).toBe(
      'primary_hostname_upsert'
    );
  });

  it('returns null for empty mutations and maps created runs and steps', async () => {
    const { executor, statements } = createQueuedExecutor([
      [],
      [],
      [{ instance_exists: false }],
      [provisioningRow],
      [keycloakRunRow],
      [],
      [keycloakRunRow],
      [stepRow],
      [stepRow],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.setInstanceStatus({ instanceId: 'missing', status: 'active' })
    ).resolves.toBeNull();
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
        payloadFingerprint: 'create-fingerprint-1',
      })
    ).resolves.toMatchObject({ id: 'run-1' });
    expect(statements[3]?.text).toContain('payload_fingerprint');
    expect(statements[3]?.values).toContain('create-fingerprint-1');
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
    await expect(
      repository.updateKeycloakProvisioningRun({ runId: 'missing', overallStatus: 'failed' })
    ).resolves.toBeNull();
    await expect(
      repository.updateKeycloakProvisioningRun({
        runId: 'kc-run-1',
        overallStatus: 'success',
        driftSummary: 'Clean',
      })
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

  it('claims due Kassel parent runs with a lease and skip-locked ordering', async () => {
    const claimedRow = {
      ...provisioningRow,
      status: 'provisioning',
      lease_owner: 'worker-1',
      lease_expires_at: '2026-01-01T00:00:30.000Z',
      attempt_count: 1,
    };
    const { executor, statements } = createQueuedExecutor([[claimedRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.claimNextProvisioningRun({
        workerId: 'worker-1',
        leaseExpiresAt: '2026-01-01T00:00:30.000Z',
        parentDomain: 'dialog.kassel.de',
      })
    ).resolves.toMatchObject({
      id: 'run-1',
      status: 'provisioning',
      leaseOwner: 'worker-1',
      attemptCount: 1,
    });
    expect(statements[0]?.text).toContain('FOR UPDATE OF run SKIP LOCKED');
    expect(statements[0]?.text).toContain('run.lease_expires_at <= now()');
    expect(statements[0]?.text).toContain(
      "run.desired_snapshot->>'automationMode' = 'kassel-traefik-file'"
    );
    expect(statements[0]?.text).toContain("run.snapshot_version IN ('2.0', '3.0')");
    expect(statements[0]?.text).toContain(
      "instance.status IN ('requested', 'validated', 'provisioning')"
    );
    expect(statements[0]?.text).toContain("'awaiting_plan_confirmation'");
    expect(statements[0]?.text).toContain("'awaiting_tenant_secret'");
    expect(statements[0]?.text).toContain("'tenant_secret_rotation_running'");
    expect(statements[0]?.values).toEqual([
      'worker-1',
      '2026-01-01T00:00:30.000Z',
      'dialog.kassel.de',
    ]);
  });

  it('binds confirmed Keycloak work to the exact waiting parent state', async () => {
    const { executor, statements } = createQueuedExecutor([
      [provisioningRow],
      [provisioningRow],
      [provisioningRow],
    ]);
    const repository = createInstanceRegistryRepository(executor);

    await repository.confirmProvisioningPlan({
      runId: 'run-1',
      instanceId: 'tenant-a',
      expectedPlanFingerprint: 'old-plan',
      planFingerprint: 'confirmed-plan',
      childKeycloakRunId: '11111111-1111-4111-8111-111111111111',
      actorId: 'operator-1',
      requestId: 'request-1',
    });
    await repository.bindProvisioningRemediation({
      runId: 'run-1',
      instanceId: 'tenant-a',
      expectedPlanFingerprint: 'blocked-plan',
      planFingerprint: 'confirmed-rotation-plan',
      childKeycloakRunId: '22222222-2222-4222-8222-222222222222',
      actorId: 'operator-1',
      requestId: 'request-2',
    });
    await repository.completeProvisioningRemediation({
      instanceId: 'tenant-a',
      childKeycloakRunId: '22222222-2222-4222-8222-222222222222',
      succeeded: false,
    });

    expect(statements[0]?.text).toContain("step_key = 'keycloak'");
    expect(statements[0]?.text).toContain("planFingerprint}' = $3");
    expect(statements[0]?.values).toEqual([
      'run-1',
      'tenant-a',
      'old-plan',
      'confirmed-plan',
      '11111111-1111-4111-8111-111111111111',
      'operator-1',
      'request-1',
    ]);
    expect(statements[1]?.text).toContain("'tenant_secret_rotation_running'");
    expect(statements[1]?.values).toEqual([
      'run-1',
      'tenant-a',
      'blocked-plan',
      'confirmed-rotation-plan',
      '22222222-2222-4222-8222-222222222222',
      'operator-1',
      'request-2',
    ]);
    expect(statements[2]?.text).toContain("'awaiting_tenant_secret'");
    expect(statements[2]?.values).toEqual([
      'tenant-a',
      '22222222-2222-4222-8222-222222222222',
      false,
    ]);
  });

  it('returns null when the expected provisioning state changed concurrently', async () => {
    const { executor } = createQueuedExecutor([[], [], []]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.confirmProvisioningPlan({
        runId: 'run-1',
        instanceId: 'tenant-a',
        expectedPlanFingerprint: 'old-plan',
        planFingerprint: 'confirmed-plan',
        childKeycloakRunId: '11111111-1111-4111-8111-111111111111',
        actorId: 'operator-1',
        requestId: 'request-1',
      })
    ).resolves.toBeNull();
    await expect(
      repository.bindProvisioningRemediation({
        runId: 'run-1',
        instanceId: 'tenant-a',
        expectedPlanFingerprint: 'blocked-plan',
        planFingerprint: 'confirmed-rotation-plan',
        childKeycloakRunId: '22222222-2222-4222-8222-222222222222',
        actorId: 'operator-1',
        requestId: 'request-2',
      })
    ).resolves.toBeNull();
    await expect(
      repository.completeProvisioningRemediation({
        instanceId: 'tenant-a',
        childKeycloakRunId: '22222222-2222-4222-8222-222222222222',
        succeeded: false,
      })
    ).resolves.toBeNull();
  });

  it('advances only the currently leased parent run and merges safe evidence', async () => {
    const updatedRow = {
      ...provisioningRow,
      status: 'provisioning',
      step_key: 'tls',
      terminal_evidence: { routerName: 'studio-tenant-a', status: 200 },
    };
    const { executor, statements } = createQueuedExecutor([[updatedRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.updateProvisioningRun({
        runId: '00000000-0000-4000-8000-000000000001',
        leaseOwner: 'worker-1',
        status: 'provisioning',
        stepKey: 'tls',
        terminalEvidence: { status: 200 },
      })
    ).resolves.toMatchObject({ stepKey: 'tls', terminalEvidence: { status: 200 } });
    expect(statements[0]?.text).toContain("terminal_evidence || COALESCE($9::jsonb, '{}'::jsonb)");
    expect(statements[0]?.text).toContain('WHERE id = $1::uuid AND lease_owner = $2');
    expect(statements[0]?.text).toContain('lease_expires_at > now()');
    expect(statements[0]?.values[1]).toBe('worker-1');
  });

  it('records a safe post-commit wake-up failure without making the run unclaimable', async () => {
    const failedWakeupRow = {
      ...provisioningRow,
      status: 'requested',
      error_code: 'post_commit_wakeup_failed',
      error_message: 'Post-Commit-Wake-up fehlgeschlagen.',
      terminal_evidence: {
        postCommitWakeup: {
          status: 'failed',
          code: 'post_commit_wakeup_failed',
          checkedAt: '2026-01-01T00:00:10.000Z',
        },
      },
    };
    const { executor, statements } = createQueuedExecutor([[failedWakeupRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.recordProvisioningWakeupFailure({
        instanceId: 'tenant-a',
        errorCode: 'post_commit_wakeup_failed',
        errorMessage: 'Post-Commit-Wake-up fehlgeschlagen.',
        occurredAt: '2026-01-01T00:00:10.000Z',
      })
    ).resolves.toMatchObject({
      status: 'requested',
      errorCode: 'post_commit_wakeup_failed',
    });
    expect(statements[0]?.text).toContain("status IN ('requested', 'validated', 'provisioning')");
    expect(statements[0]?.text).toContain('SELECT id AS candidate_run_id');
    expect(statements[0]?.text).toContain('run.id = candidate.candidate_run_id');
    expect(statements[0]?.text).toContain('next_attempt_at = LEAST(run.next_attempt_at, now())');
    expect(statements[0]?.text).toContain("'postCommitWakeup'");
    expect(statements[0]?.text).not.toContain('lease_owner = NULL');
    expect(statements[0]?.values).toEqual([
      'tenant-a',
      'post_commit_wakeup_failed',
      'Post-Commit-Wake-up fehlgeschlagen.',
      '2026-01-01T00:00:10.000Z',
    ]);
  });

  it('renews only a still-active parent-run lease owned by the worker', async () => {
    const renewedRow = {
      ...provisioningRow,
      status: 'provisioning',
      lease_owner: 'worker-1',
      lease_expires_at: '2026-01-01T00:01:00.000Z',
    };
    const { executor, statements } = createQueuedExecutor([[renewedRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.renewProvisioningRunLease({
        runId: '00000000-0000-4000-8000-000000000001',
        leaseOwner: 'worker-1',
        leaseExpiresAt: '2026-01-01T00:01:00.000Z',
      })
    ).resolves.toMatchObject({ leaseOwner: 'worker-1' });
    expect(statements[0]?.text).toContain("status = 'provisioning'");
    expect(statements[0]?.text).toContain('lease_expires_at > now()');
    expect(statements[0]?.values).toEqual([
      '00000000-0000-4000-8000-000000000001',
      'worker-1',
      '2026-01-01T00:01:00.000Z',
    ]);
  });

  it('requeues only a failed versioned create run without deleting prior evidence', async () => {
    const retriedRow = {
      ...provisioningRow,
      snapshot_version: '2.0',
      status: 'requested',
      step_key: 'lifecycle',
      terminal_evidence: { failedStep: 'login' },
    };
    const { executor, statements } = createQueuedExecutor([[retriedRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.retryProvisioningRun({
        instanceId: 'tenant-a',
        idempotencyKey: 'idem-1',
        leaseOwner: 'retry-lease-1',
        actorId: 'actor-2',
        requestId: 'request-2',
        deadlineAt: '2026-01-01T01:00:00.000Z',
        desiredSnapshot: { pluginSnapshotVersion: '1.0' },
        keycloakReconcileRequired: true,
      })
    ).resolves.toMatchObject({
      status: 'requested',
      stepKey: 'lifecycle',
      terminalEvidence: { failedStep: 'login' },
    });
    expect(statements[0]?.text).toContain(
      "snapshot_version IN ('2.0', '3.0') AND status = 'failed'"
    );
    expect(statements[0]?.text).toContain('lease_owner = $8 AND lease_expires_at > now()');
    expect(statements[0]?.text).toContain(
      "WHEN step_key IN ('registry', 'keycloak') THEN 'registry'"
    );
    expect(statements[0]?.text).toContain("WHEN $7::boolean THEN 'registry'");
    expect(statements[0]?.text).toContain('WHEN $7::boolean THEN child_keycloak_run_id');
    expect(statements[0]?.text).toContain(
      "'module_readiness', 'login', 'tenant_iam_roles', 'tenant_iam_access', 'activate'"
    );
    expect(statements[0]?.text).not.toContain('terminal_evidence =');
    expect(statements[0]?.text).toContain('desired_snapshot = $6::jsonb');
    expect(statements[0]?.values?.[5]).toBe('{"pluginSnapshotVersion":"1.0"}');
    expect(statements[0]?.values?.[6]).toBe(true);
    expect(statements[0]?.values?.[7]).toBe('retry-lease-1');
  });

  it('preserves new-realm transition evidence when a retry does not require OIDC reconcile', async () => {
    const { executor, statements } = createQueuedExecutor([[provisioningRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await repository.retryProvisioningRun({
      instanceId: 'tenant-a',
      idempotencyKey: 'idem-1',
      leaseOwner: 'retry-lease-2',
      deadlineAt: '2026-01-01T01:00:00.000Z',
      desiredSnapshot: { realmMode: 'new' },
      keycloakReconcileRequired: false,
    });

    expect(statements[0]?.text).toContain(
      "WHEN $6::jsonb ->> 'realmMode' = 'new' THEN child_keycloak_run_id"
    );
    expect(statements[0]?.values?.[6]).toBe(false);
  });

  it('reserves only an unleased failed versioned create run before retry preparation', async () => {
    const reservedRow = {
      ...provisioningRow,
      snapshot_version: '2.0',
      status: 'failed',
      lease_owner: 'retry-lease-1',
      lease_expires_at: '2026-01-01T00:05:00.000Z',
    };
    const { executor, statements } = createQueuedExecutor([[reservedRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.reserveProvisioningRetryRun({
        instanceId: 'tenant-a',
        idempotencyKey: 'idem-1',
        leaseOwner: 'retry-lease-1',
        leaseExpiresAt: '2026-01-01T00:05:00.000Z',
      })
    ).resolves.toMatchObject({ status: 'failed', leaseOwner: 'retry-lease-1' });

    expect(statements[0]?.text).toContain(
      "snapshot_version IN ('2.0', '3.0') AND status = 'failed'"
    );
    expect(statements[0]?.text).toContain(
      '(lease_expires_at IS NULL OR lease_expires_at <= now())'
    );
    expect(statements[0]?.values).toEqual([
      'tenant-a',
      'idem-1',
      'retry-lease-1',
      '2026-01-01T00:05:00.000Z',
    ]);
  });

  it('releases a failed retry reservation only for its owner', async () => {
    const releasedRow = {
      ...provisioningRow,
      snapshot_version: '2.0',
      status: 'failed',
      lease_owner: null,
      lease_expires_at: null,
    };
    const { executor, statements } = createQueuedExecutor([[releasedRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.releaseProvisioningRetryReservation({
        instanceId: 'tenant-a',
        idempotencyKey: 'idem-1',
        leaseOwner: 'retry-lease-1',
      })
    ).resolves.toMatchObject({ status: 'failed', leaseOwner: undefined });

    expect(statements[0]?.text).toContain("status = 'failed' AND lease_owner = $3");
    expect(statements[0]?.values).toEqual(['tenant-a', 'idem-1', 'retry-lease-1']);
  });

  it('renews a failed retry reservation only while its owner still holds it', async () => {
    const renewedRow = {
      ...provisioningRow,
      snapshot_version: '2.0',
      status: 'failed',
      lease_owner: 'retry-lease-1',
      lease_expires_at: '2026-01-01T00:10:00.000Z',
    };
    const { executor, statements } = createQueuedExecutor([[renewedRow]]);
    const repository = createInstanceRegistryRepository(executor);

    await expect(
      repository.renewProvisioningRetryReservation({
        instanceId: 'tenant-a',
        idempotencyKey: 'idem-1',
        leaseOwner: 'retry-lease-1',
        leaseExpiresAt: '2026-01-01T00:10:00.000Z',
      })
    ).resolves.toMatchObject({ status: 'failed', leaseOwner: 'retry-lease-1' });

    expect(statements[0]?.text).toContain("status = 'failed'");
    expect(statements[0]?.text).toContain('lease_owner = $3 AND lease_expires_at > now()');
    expect(statements[0]?.values).toEqual([
      'tenant-a',
      'idem-1',
      'retry-lease-1',
      '2026-01-01T00:10:00.000Z',
    ]);
  });
});
