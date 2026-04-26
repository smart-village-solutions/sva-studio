import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGovernanceWorkflowExecutor, type GovernanceActor } from './governance-workflow-executor.js';
import type { QueryClient } from './query-client.js';

const uuid = '00000000-0000-4000-8000-000000000001';
const actor: GovernanceActor = {
  keycloakSubject: 'actor-subject',
  instanceId: 'tenant-a',
  roles: ['iam_admin'],
  requestId: 'request-1',
  traceId: 'trace-1',
};

const createDeps = () => ({
  isUuid: vi.fn((value: string) => value.startsWith('00000000-')),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  buildLogContext: vi.fn((instanceId?: string) => ({ instance_id: instanceId ?? 'platform' })),
});

const createClient = (queuedRows: readonly (readonly Record<string, unknown>[])[] = []) => {
  const queue = [...queuedRows];
  const queries: { sql: string; params: readonly unknown[] }[] = [];
  const client: QueryClient = {
    async query<T>(sql: string, params: readonly unknown[] = []) {
      queries.push({ sql, params });
      const rows = queue.shift() ?? [];
      return {
        rowCount: rows.length,
        rows: rows as T[],
      };
    },
  };

  return { client, queries };
};

describe('governance workflow executor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('submits permission changes and emits audit records', async () => {
    const deps = createDeps();
    const { client, queries } = createClient([
      [{ id: 'requester-account' }],
      [{ id: 'target-account' }],
      [{ permission_key: 'iam.user.write' }],
      [{ id: uuid }],
      [],
    ]);

    await expect(
      createGovernanceWorkflowExecutor(deps).executeWorkflow(client, actor, {
        operation: 'submit_permission_change',
        instanceId: 'tenant-a',
        payload: {
          targetKeycloakSubject: 'target-subject',
          roleId: uuid,
          ticketId: 'JIRA-1',
          ticketState: 'approved_for_execution',
        },
      })
    ).resolves.toEqual({ operation: 'submit_permission_change', status: 'ok', workflowId: uuid });

    expect(queries[3]?.sql).toContain('INSERT INTO iam.permission_change_requests');
    expect(queries[3]?.params).toEqual([
      'tenant-a',
      'requester-account',
      'target-account',
      uuid,
      true,
      'JIRA-1',
      'jira',
      'approved_for_execution',
    ]);
    expect(queries.at(-1)?.sql).toContain('INSERT INTO iam.activity_logs');
    expect(deps.logInfo).toHaveBeenCalledWith('Governance audit event emitted', expect.objectContaining({ result: 'success' }));
  });

  it('rejects invalid permission change input before database writes', async () => {
    const { client, queries } = createClient();

    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(client, actor, {
        operation: 'submit_permission_change',
        instanceId: 'tenant-a',
        payload: {
          targetKeycloakSubject: 'target-subject',
          roleId: 'not-a-uuid',
          ticketId: 'JIRA-1',
          ticketState: 'open',
        },
      })
    ).resolves.toEqual({
      operation: 'submit_permission_change',
      status: 'error',
      reasonCode: 'invalid_request',
    });
    expect(queries).toHaveLength(0);
  });

  it('approves and rejects permission changes with policy guards', async () => {
    const selfApproval = createClient([
      [{ id: 'requester-account' }],
      [{ requester_account_id: 'requester-account', is_critical: false, status: 'submitted' }],
    ]);

    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(selfApproval.client, actor, {
        operation: 'approve_permission_change',
        instanceId: 'tenant-a',
        payload: { requestId: uuid },
      })
    ).resolves.toEqual({
      operation: 'approve_permission_change',
      status: 'error',
      reasonCode: 'DENY_SELF_APPROVAL',
    });

    const rejected = createClient([
      [{ id: 'approver-account' }],
      [{ requester_account_id: 'requester-account', is_critical: false, status: 'submitted' }],
      [],
      [],
    ]);
    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(rejected.client, actor, {
        operation: 'approve_permission_change',
        instanceId: 'tenant-a',
        payload: { requestId: uuid, approval: 'rejected', reason: 'conflict' },
      })
    ).resolves.toEqual({ operation: 'approve_permission_change', status: 'ok', workflowId: uuid });
    expect(rejected.queries[2]?.params).toEqual([uuid, 'tenant-a', 'rejected', 'approver-account', 'conflict']);
  });

  it('applies approved permission changes', async () => {
    const { client, queries } = createClient([
      [{ target_account_id: 'target-account', role_id: 'role-1', status: 'approved' }],
      [],
      [],
      [{ id: 'actor-account' }],
      [],
    ]);

    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(client, actor, {
        operation: 'apply_permission_change',
        instanceId: 'tenant-a',
        payload: { requestId: uuid },
      })
    ).resolves.toEqual({ operation: 'apply_permission_change', status: 'ok', workflowId: uuid });

    expect(queries[1]?.sql).toContain('INSERT INTO iam.account_roles');
    expect(queries[2]?.sql).toContain("SET status = 'applied'");
  });

  it('creates and revokes delegations with approval constraints', async () => {
    const tooLong = createClient();
    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(tooLong.client, actor, {
        operation: 'create_delegation',
        instanceId: 'tenant-a',
        payload: {
          delegateeKeycloakSubject: 'delegatee',
          roleId: uuid,
          approverKeycloakSubject: 'approver',
          ticketId: 'JIRA-2',
          ticketState: 'open',
          startsAt: '2026-01-10T12:00:00.000Z',
          endsAt: '2026-03-01T12:00:00.000Z',
        },
      })
    ).resolves.toEqual({
      operation: 'create_delegation',
      status: 'error',
      reasonCode: 'DENY_DELEGATION_DURATION_EXCEEDED',
    });

    const created = createClient([
      [{ id: 'delegator-account' }],
      [{ id: 'delegatee-account' }],
      [{ id: 'approver-account' }],
      [{ id: uuid }],
      [],
    ]);
    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(created.client, actor, {
        operation: 'create_delegation',
        instanceId: 'tenant-a',
        payload: {
          delegateeKeycloakSubject: 'delegatee',
          roleId: uuid,
          approverKeycloakSubject: 'approver',
          ticketId: 'JIRA-2',
          ticketState: 'open',
          startsAt: '2026-01-10T11:00:00.000Z',
          endsAt: '2026-01-11T11:00:00.000Z',
        },
      })
    ).resolves.toEqual({ operation: 'create_delegation', status: 'ok', workflowId: uuid });
    expect(created.queries[3]?.params).toContain('active');

    const revoked = createClient([[{ id: 'actor-account' }], [], []]);
    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(revoked.client, actor, {
        operation: 'revoke_delegation',
        instanceId: 'tenant-a',
        payload: { delegationId: uuid },
      })
    ).resolves.toEqual({ operation: 'revoke_delegation', status: 'ok', workflowId: uuid });
    expect(revoked.queries[1]?.sql).toContain("SET status = 'revoked'");
  });

  it('starts and ends impersonation sessions', async () => {
    const supportActor = { ...actor, roles: ['support_admin'] };
    const missingSecurityApproval = createClient([
      [{ id: 'actor-account' }],
      [{ id: 'target-account' }],
      [{ id: 'approver-account' }],
    ]);
    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(missingSecurityApproval.client, supportActor, {
        operation: 'start_impersonation',
        instanceId: 'tenant-a',
        payload: {
          targetKeycloakSubject: 'target',
          approverKeycloakSubject: 'approver',
          ticketId: 'JIRA-3',
          ticketState: 'open',
        },
      })
    ).resolves.toEqual({
      operation: 'start_impersonation',
      status: 'error',
      reasonCode: 'DENY_SELF_APPROVAL',
    });

    const started = createClient([
      [{ id: 'actor-account' }],
      [{ id: 'target-account' }],
      [{ id: 'approver-account' }],
      [{ id: uuid }],
      [],
    ]);
    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(started.client, actor, {
        operation: 'start_impersonation',
        instanceId: 'tenant-a',
        payload: {
          targetKeycloakSubject: 'target',
          approverKeycloakSubject: 'approver',
          ticketId: 'JIRA-3',
          ticketState: 'open',
          durationMinutes: 30,
        },
      })
    ).resolves.toEqual({ operation: 'start_impersonation', status: 'ok', workflowId: uuid });
    expect(started.queries[3]?.params).toContain(30);

    const ended = createClient([
      [{ id: 'actor-account' }],
      [{ started_at: '2026-01-10T11:55:00.000Z', ticket_id: 'JIRA-3' }],
      [],
    ]);
    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(ended.client, actor, {
        operation: 'end_impersonation',
        instanceId: 'tenant-a',
        payload: { sessionId: uuid, reason: 'done' },
      })
    ).resolves.toEqual({ operation: 'end_impersonation', status: 'ok', workflowId: uuid });
    expect(ended.queries[1]?.params).toEqual([uuid, 'tenant-a', 'done', 'actor-account']);
  });

  it('accepts and revokes legal text versions', async () => {
    const accepted = createClient([[{ id: 'actor-account' }], [{ id: 'version-1' }], [], []]);

    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(accepted.client, actor, {
        operation: 'accept_legal_text',
        instanceId: 'tenant-a',
        payload: { legalTextId: 'terms', legalTextVersion: '1.0', locale: 'de-DE' },
      })
    ).resolves.toEqual({ operation: 'accept_legal_text', status: 'ok', workflowId: 'version-1' });
    expect(accepted.queries[2]?.sql).toContain('INSERT INTO iam.legal_text_acceptances');

    const revoked = createClient([[{ id: 'actor-account' }], [{ id: 'version-1' }], [], []]);
    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(revoked.client, actor, {
        operation: 'revoke_legal_acceptance',
        instanceId: 'tenant-a',
        payload: { legalTextId: 'terms', legalTextVersion: '1.0', reason: 'withdrawn' },
      })
    ).resolves.toEqual({ operation: 'revoke_legal_acceptance', status: 'ok', workflowId: 'version-1' });
    expect(revoked.queries[2]?.sql).toContain('SET revoked_at = now()');
  });

  it('resolves active, expired and missing impersonation subjects', async () => {
    const executor = createGovernanceWorkflowExecutor(createDeps());

    await expect(
      executor.resolveImpersonationSubject({
        instanceId: 'tenant-a',
        actorKeycloakSubject: 'actor',
        targetKeycloakSubject: 'target',
        withInstanceScopedDb: async (_instanceId, work) =>
          work(createClient([[{ id: 'actor-account' }], [{ id: 'target-account' }], []]).client),
      })
    ).resolves.toEqual({ ok: false, reasonCode: 'DENY_TICKET_REQUIRED' });

    await expect(
      executor.resolveImpersonationSubject({
        instanceId: 'tenant-a',
        actorKeycloakSubject: 'actor',
        targetKeycloakSubject: 'target',
        withInstanceScopedDb: async (_instanceId, work) =>
          work(
            createClient([
              [{ id: 'actor-account' }],
              [{ id: 'target-account' }],
              [{ id: uuid, expires_at: '2026-01-10T12:30:00.000Z', ticket_id: 'JIRA-3' }],
            ]).client
          ),
      })
    ).resolves.toEqual({ ok: true });

    await expect(
      executor.resolveImpersonationSubject({
        instanceId: 'tenant-a',
        actorKeycloakSubject: 'actor',
        targetKeycloakSubject: 'target',
        withInstanceScopedDb: async (_instanceId, work) =>
          work(
            createClient([
              [{ id: 'actor-account' }],
              [{ id: 'target-account' }],
              [{ id: uuid, expires_at: '2026-01-10T11:59:00.000Z', ticket_id: 'JIRA-3' }],
              [],
              [],
            ]).client
          ),
      })
    ).resolves.toEqual({ ok: false, reasonCode: 'DENY_IMPERSONATION_DURATION_EXCEEDED' });
  });
});
