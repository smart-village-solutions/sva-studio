import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runWithWorkspaceContext } from '@sva/server-runtime';

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

const validDelegationPayload = {
  delegateeKeycloakSubject: 'delegatee-subject',
  roleId: uuid,
  approverKeycloakSubject: 'approver-subject',
  ticketId: 'JIRA-2',
  ticketState: 'open',
  startsAt: '2026-01-10T12:00:00.000Z',
  endsAt: '2026-01-11T12:00:00.000Z',
} as const;

const executeDelegation = (
  client: QueryClient,
  payload: Record<string, unknown>,
  currentActor: GovernanceActor = actor
) =>
  createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(client, currentActor, {
    operation: 'create_delegation',
    instanceId: currentActor.instanceId,
    payload,
  });

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
      '',
      'admin',
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

  describe('create delegation characterization', () => {
    it.each([
      'delegateeKeycloakSubject',
      'roleId',
      'approverKeycloakSubject',
      'ticketId',
      'startsAt',
      'endsAt',
    ] as const)('rejects a missing %s before querying the database', async (field) => {
      const payload: Record<string, unknown> = { ...validDelegationPayload };
      delete payload[field];
      const { client, queries } = createClient();

      await expect(executeDelegation(client, payload)).resolves.toEqual({
        operation: 'create_delegation',
        status: 'error',
        reasonCode: 'invalid_request',
      });
      expect(queries).toHaveLength(0);
    });

    it('rejects a missing ticket state with the ticket-required reason before querying', async () => {
      const payload: Record<string, unknown> = { ...validDelegationPayload };
      delete payload.ticketState;
      const { client, queries } = createClient();

      await expect(executeDelegation(client, payload)).resolves.toEqual({
        operation: 'create_delegation',
        status: 'error',
        reasonCode: 'DENY_TICKET_REQUIRED',
      });
      expect(queries).toHaveLength(0);
    });

    it('rejects an invalid role UUID before querying the database', async () => {
      const { client, queries } = createClient();

      await expect(executeDelegation(client, { ...validDelegationPayload, roleId: 'not-a-uuid' })).resolves.toEqual({
        operation: 'create_delegation',
        status: 'error',
        reasonCode: 'invalid_request',
      });
      expect(queries).toHaveLength(0);
    });

    it.each(['open', 'in_progress', 'approved_for_execution'])(
      'accepts the %s ticket state unchanged in persistence',
      async (ticketState) => {
        const { client, queries } = createClient([
          [{ id: 'delegator-account' }],
          [{ id: 'delegatee-account' }],
          [{ id: 'approver-account' }],
          [{ id: uuid }],
          [],
        ]);

        await expect(executeDelegation(client, { ...validDelegationPayload, ticketState })).resolves.toEqual({
          operation: 'create_delegation',
          status: 'ok',
          workflowId: uuid,
        });
        expect(queries[3]?.params?.[7]).toBe(ticketState);
      }
    );

    it('rejects an invalid ticket state before querying the database', async () => {
      const { client, queries } = createClient();

      await expect(
        executeDelegation(client, { ...validDelegationPayload, ticketState: 'closed' })
      ).resolves.toEqual({
        operation: 'create_delegation',
        status: 'error',
        reasonCode: 'DENY_TICKET_STATE_INVALID',
      });
      expect(queries).toHaveLength(0);
    });

    it.each([
      ['invalid start', 'not-a-date', validDelegationPayload.endsAt, 'invalid_request'],
      ['invalid end', validDelegationPayload.startsAt, 'not-a-date', 'invalid_request'],
      ['equal boundary', validDelegationPayload.startsAt, validDelegationPayload.startsAt, 'DENY_DELEGATION_DURATION_EXCEEDED'],
      ['negative duration', validDelegationPayload.endsAt, validDelegationPayload.startsAt, 'DENY_DELEGATION_DURATION_EXCEEDED'],
      ['overlong duration', validDelegationPayload.startsAt, '2026-02-09T12:00:00.001Z', 'DENY_DELEGATION_DURATION_EXCEEDED'],
    ] as const)('rejects %s before account resolution', async (_case, startsAt, endsAt, reasonCode) => {
      const { client, queries } = createClient();

      await expect(executeDelegation(client, { ...validDelegationPayload, startsAt, endsAt })).resolves.toEqual({
        operation: 'create_delegation',
        status: 'error',
        reasonCode,
      });
      expect(queries).toHaveLength(0);
    });

    it('accepts the exact thirty-day duration boundary', async () => {
      const { client, queries } = createClient([
        [{ id: 'delegator-account' }],
        [{ id: 'delegatee-account' }],
        [{ id: 'approver-account' }],
        [{ id: uuid }],
        [],
      ]);

      await expect(
        executeDelegation(client, {
          ...validDelegationPayload,
          endsAt: '2026-02-09T12:00:00.000Z',
        })
      ).resolves.toEqual({ operation: 'create_delegation', status: 'ok', workflowId: uuid });
      expect(queries[3]?.params?.slice(8)).toEqual([
        '2026-01-10T12:00:00.000Z',
        '2026-02-09T12:00:00.000Z',
      ]);
    });

    it('uses the actor subject as delegator fallback and preserves instance-scoped account query order', async () => {
      const { client, queries } = createClient([
        [{ id: 'delegator-account' }],
        [{ id: 'delegatee-account' }],
        [{ id: 'approver-account' }],
        [{ id: uuid }],
        [],
      ]);

      await expect(executeDelegation(client, validDelegationPayload)).resolves.toMatchObject({ status: 'ok' });
      expect(queries.slice(0, 3).map(({ params }) => params)).toEqual([
        ['tenant-a', 'actor-subject'],
        ['tenant-a', 'delegatee-subject'],
        ['tenant-a', 'approver-subject'],
      ]);
    });

    it.each([
      ['delegator', [[], [{ id: 'delegatee-account' }], [{ id: 'approver-account' }]], 3],
      ['delegatee', [[{ id: 'delegator-account' }], [], [{ id: 'approver-account' }]], 3],
      ['approver', [[{ id: 'delegator-account' }], [{ id: 'delegatee-account' }], []], 3],
    ] as const)('rejects when the %s account is missing after all account resolutions', async (_account, rows, queryCount) => {
      const { client, queries } = createClient(rows);

      await expect(executeDelegation(client, validDelegationPayload)).resolves.toEqual({
        operation: 'create_delegation',
        status: 'error',
        reasonCode: 'unauthorized',
      });
      expect(queries).toHaveLength(queryCount);
    });

    it('rejects self approval after resolving all three accounts and before persistence', async () => {
      const { client, queries } = createClient([
        [{ id: 'same-account' }],
        [{ id: 'delegatee-account' }],
        [{ id: 'same-account' }],
      ]);

      await expect(executeDelegation(client, validDelegationPayload)).resolves.toEqual({
        operation: 'create_delegation',
        status: 'error',
        reasonCode: 'DENY_SELF_APPROVAL',
      });
      expect(queries).toHaveLength(3);
    });

    it.each([
      ['equal-now start', '2026-01-10T12:00:00.000Z', 'active', 'governance_delegation_created'],
      ['past start', '2026-01-10T11:59:59.999Z', 'active', 'governance_delegation_created'],
      ['future start', '2026-01-10T12:00:00.001Z', 'requested', 'governance_delegation_requested'],
    ] as const)('persists and audits the %s as %s', async (_case, startsAt, status, eventType) => {
      const deps = createDeps();
      const { client, queries } = createClient([
        [{ id: 'delegator-account' }],
        [{ id: 'delegatee-account' }],
        [{ id: 'approver-account' }],
        [{ id: uuid }],
        [],
      ]);

      await expect(
        createGovernanceWorkflowExecutor(deps).executeWorkflow(client, actor, {
          operation: 'create_delegation',
          instanceId: 'tenant-a',
          payload: {
            ...validDelegationPayload,
            startsAt,
            endsAt: '2026-01-11T12:00:00.000Z',
          },
        })
      ).resolves.toEqual({ operation: 'create_delegation', status: 'ok', workflowId: uuid });
      expect(queries[3]?.params).toEqual([
        'tenant-a',
        'delegator-account',
        'delegatee-account',
        uuid,
        status,
        'approver-account',
        'JIRA-2',
        'open',
        startsAt,
        '2026-01-11T12:00:00.000Z',
      ]);
      expect(queries[4]?.sql).toContain('INSERT INTO iam.activity_logs');
      expect(queries[4]?.params?.slice(0, 3)).toEqual(['tenant-a', 'delegator-account', eventType]);
      expect(JSON.parse(String(queries[4]?.params?.[3]))).toMatchObject({
        instance_id: 'tenant-a',
        action: status === 'active' ? 'delegation_create' : 'delegation_request',
        result: 'success',
        target_ref: uuid,
        ticket_id: 'JIRA-2',
        request_id: 'request-1',
        trace_id: 'trace-1',
      });
    });

    it('returns database_unavailable when persistence does not return an id and emits no audit', async () => {
      const deps = createDeps();
      const { client, queries } = createClient([
        [{ id: 'delegator-account' }],
        [{ id: 'delegatee-account' }],
        [{ id: 'approver-account' }],
        [],
      ]);

      await expect(
        createGovernanceWorkflowExecutor(deps).executeWorkflow(client, actor, {
          operation: 'create_delegation',
          instanceId: 'tenant-a',
          payload: validDelegationPayload,
        })
      ).resolves.toEqual({
        operation: 'create_delegation',
        status: 'error',
        reasonCode: 'database_unavailable',
      });
      expect(queries).toHaveLength(4);
      expect(deps.logInfo).not.toHaveBeenCalled();
      expect(deps.logWarn).not.toHaveBeenCalled();
    });

    it.each([0, 3, 4])('propagates a query failure at ordered query index %s', async (failureIndex) => {
      const expectedError = new Error(`query-${failureIndex}-failed`);
      let queryIndex = 0;
      const client: QueryClient = {
        async query<T>() {
          const currentIndex = queryIndex++;
          if (currentIndex === failureIndex) {
            throw expectedError;
          }
          const rowsByIndex: Record<number, readonly Record<string, unknown>[]> = {
            0: [{ id: 'delegator-account' }],
            1: [{ id: 'delegatee-account' }],
            2: [{ id: 'approver-account' }],
            3: [{ id: uuid }],
            4: [],
          };
          const rows = rowsByIndex[currentIndex] ?? [];
          return { rowCount: rows.length, rows: rows as T[] };
        },
      };

      await expect(executeDelegation(client, validDelegationPayload)).rejects.toBe(expectedError);
      expect(queryIndex).toBe(failureIndex + 1);
    });
  });

  it('starts and ends impersonation sessions', async () => {
    const actorRequiringSecurityApprover = {
      ...actor,
      capabilities: { requiresIndependentSecurityApproverForImpersonation: true },
    };
    const missingSecurityApproval = createClient([
      [{ id: 'actor-account' }],
      [{ id: 'target-account' }],
      [{ id: 'approver-account' }],
    ]);
    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(
        missingSecurityApproval.client,
        actorRequiringSecurityApprover,
        {
          operation: 'start_impersonation',
          instanceId: 'tenant-a',
          payload: {
            targetKeycloakSubject: 'target',
            approverKeycloakSubject: 'approver',
            ticketId: 'JIRA-3',
            ticketState: 'open',
          },
        }
      )
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
    expect(accepted.queries[2]?.params).toEqual([
      'tenant-a',
      'tenant-a',
      'actor-subject',
      'version-1',
      'actor-account',
      '1.0',
      'accepted',
      'request-1',
      'trace-1',
    ]);

    const revoked = createClient([[{ id: 'actor-account' }], [{ id: 'version-1' }], [], []]);
    await expect(
      createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(revoked.client, actor, {
        operation: 'revoke_legal_acceptance',
        instanceId: 'tenant-a',
        payload: { legalTextId: 'terms', legalTextVersion: '1.0', reason: 'withdrawn' },
      })
    ).resolves.toEqual({ operation: 'revoke_legal_acceptance', status: 'ok', workflowId: 'version-1' });
    expect(revoked.queries[2]?.sql).toContain('SET revoked_at = now()');
    expect(revoked.queries[2]?.sql).toContain("action_type = 'revoked'");
    expect(revoked.queries[2]?.params).toEqual(['tenant-a', 'version-1', 'actor-account', 'withdrawn']);
  });

  it('uses the tenant instance instead of the generic default workspace for legal acceptance audit writes', async () => {
    const accepted = createClient([[{ id: 'actor-account' }], [{ id: 'version-1' }], [], []]);

    await expect(
      runWithWorkspaceContext({ workspaceId: 'default', requestId: 'request-1', traceId: 'trace-1' }, () =>
        createGovernanceWorkflowExecutor(createDeps()).executeWorkflow(accepted.client, actor, {
          operation: 'accept_legal_text',
          instanceId: 'tenant-a',
          payload: { legalTextId: 'terms', legalTextVersion: '1.0', locale: 'de-DE' },
        })
      )
    ).resolves.toEqual({ operation: 'accept_legal_text', status: 'ok', workflowId: 'version-1' });

    expect(accepted.queries[2]?.params?.[1]).toBe('tenant-a');
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
