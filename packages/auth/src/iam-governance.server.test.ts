import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  user: {
    id: 'keycloak-sub-actor',
    name: 'Actor',
    roles: ['support_admin'],
    instanceId: 'de-musterhausen',
  },
  queryHandler: null as null | ((text: string, values?: readonly unknown[]) => unknown),
}));

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
    handler({
      sessionId: 'session-1',
      user: state.user,
    })
  ),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: () => ({
    workspaceId: 'de-musterhausen',
    requestId: 'req-governance',
    traceId: 'trace-governance',
  }),
  toJsonErrorResponse: (status: number, code: string, publicMessage?: string, options?: { requestId?: string }) =>
    new Response(
      JSON.stringify({
        error: code,
        ...(publicMessage ? { message: publicMessage } : {}),
        ...(options?.requestId ? { requestId: options.requestId } : {}),
      }),
      { status, headers: { 'Content-Type': 'application/json' } }
    ),
  withRequestContext: async (_opts: unknown, handler: () => Promise<Response> | Response) => handler(),
}));

vi.mock('pg', () => ({
  Pool: class MockPool {
    async connect() {
      return {
        async query(text: string, values?: readonly unknown[]) {
          if (state.queryHandler) {
            const result = state.queryHandler(text, values) as { rowCount: number; rows: unknown[] } | undefined;
            if (result) {
              return result;
            }
          }
          return { rowCount: 0, rows: [] };
        },
        release() {
          return undefined;
        },
      };
    }
  },
}));

import {
  governanceComplianceExportHandler,
  governanceWorkflowHandler,
  listGovernanceCasesHandler,
  resolveImpersonationSubject,
} from './iam-governance.server';

describe('governanceWorkflowHandler', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    state.queryHandler = null;
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
    state.user = {
      id: 'keycloak-sub-actor',
      name: 'Actor',
      roles: ['support_admin'],
      instanceId: 'de-musterhausen',
    };
  });

  it('rejects permission change with invalid ticket state', async () => {
    const request = new Request('http://localhost/iam/governance/workflows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operation: 'submit_permission_change',
        instanceId: 'de-musterhausen',
        payload: {
          targetKeycloakSubject: 'keycloak-sub-target',
          roleId: '22222222-2222-2222-8222-222222222222',
          ticketId: 'IAM-1',
          ticketState: 'closed',
        },
      }),
    });

    const response = await governanceWorkflowHandler(request);
    const payload = (await response.json()) as { status: string; reasonCode?: string };

    expect(response.status).toBe(400);
    expect(payload.status).toBe('error');
    expect(payload.reasonCode).toBe('DENY_TICKET_STATE_INVALID');
  });

  it('rejects workflow request with invalid payload body', async () => {
    const request = new Request('http://localhost/iam/governance/workflows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    });

    const response = await governanceWorkflowHandler(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
  });

  it('rejects workflow request with malformed json body', async () => {
    const request = new Request('http://localhost/iam/governance/workflows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid-json',
    });

    const response = await governanceWorkflowHandler(request);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
  });

  it('rejects workflow request with cross-instance string scope', async () => {
    const request = new Request('http://localhost/iam/governance/workflows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operation: 'submit_permission_change',
        instanceId: 'invalid',
        payload: {
          targetKeycloakSubject: 'keycloak-sub-target',
          roleId: '22222222-2222-2222-8222-222222222222',
          ticketId: 'IAM-1',
          ticketState: 'open',
        },
      }),
    });

    const response = await governanceWorkflowHandler(request);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'instance_scope_mismatch' });
  });

  it('rejects self-approval of permission change', async () => {
    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-actor') {
        return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
      }
      if (text.includes('FROM iam.permission_change_requests')) {
        return { rowCount: 1, rows: [{ requester_account_id: 'acc-actor', is_critical: true, status: 'submitted' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const request = new Request('http://localhost/iam/governance/workflows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operation: 'approve_permission_change',
        instanceId: 'de-musterhausen',
        payload: {
          requestId: '33333333-3333-3333-8333-333333333333',
          approval: 'approved',
        },
      }),
    });

    const response = await governanceWorkflowHandler(request);
    const payload = (await response.json()) as { status: string; reasonCode?: string };

    expect(response.status).toBe(400);
    expect(payload.status).toBe('error');
    expect(payload.reasonCode).toBe('DENY_SELF_APPROVAL');
  });

  it('submits a permission change request and records an audit event', async () => {
    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-actor') {
        return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-target') {
        return { rowCount: 1, rows: [{ id: 'acc-target' }] };
      }
      if (text.includes('SELECT p.permission_key')) {
        return { rowCount: 1, rows: [{ permission_key: 'iam.users.manage' }] };
      }
      if (text.includes('INSERT INTO iam.permission_change_requests')) {
        return { rowCount: 1, rows: [{ id: 'workflow-1' }] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'submit_permission_change',
          instanceId: 'de-musterhausen',
          payload: {
            targetKeycloakSubject: 'keycloak-sub-target',
            roleId: '22222222-2222-2222-8222-222222222222',
            ticketId: 'IAM-42',
            ticketState: 'approved_for_execution',
            ticketSystem: 'service-now',
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      operation: 'submit_permission_change',
      status: 'ok',
      workflowId: 'workflow-1',
    });
  });

  it('applies approved permission changes and returns the workflow id', async () => {
    state.queryHandler = (text, values) => {
      if (text.includes('FROM iam.permission_change_requests')) {
        return {
          rowCount: 1,
          rows: [{ target_account_id: 'acc-target', role_id: 'role-1', status: 'approved' }],
        };
      }
      if (text.includes('INSERT INTO iam.account_roles')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes("UPDATE iam.permission_change_requests\nSET status = 'applied'")) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-actor') {
        return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'apply_permission_change',
          instanceId: 'de-musterhausen',
          payload: {
            requestId: '33333333-3333-3333-8333-333333333333',
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      operation: 'apply_permission_change',
      status: 'ok',
      workflowId: '33333333-3333-3333-8333-333333333333',
    });
  });

  it('creates a requested delegation for a future start date', async () => {
    let insertedValues: readonly unknown[] | undefined;

    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-actor') {
        return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-delegatee') {
        return { rowCount: 1, rows: [{ id: 'acc-delegatee' }] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-approver') {
        return { rowCount: 1, rows: [{ id: 'acc-approver' }] };
      }
      if (text.includes('INSERT INTO iam.delegations')) {
        insertedValues = values;
        return { rowCount: 1, rows: [{ id: 'delegation-1' }] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'create_delegation',
          instanceId: 'de-musterhausen',
          payload: {
            delegateeKeycloakSubject: 'keycloak-sub-delegatee',
            roleId: '22222222-2222-2222-8222-222222222222',
            approverKeycloakSubject: 'keycloak-sub-approver',
            ticketId: 'IAM-17',
            ticketState: 'open',
            startsAt: '2099-01-01T10:00:00.000Z',
            endsAt: '2099-01-10T10:00:00.000Z',
          },
        }),
      })
    );
    const payload = (await response.json()) as { status: string; workflowId?: string };

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      operation: 'create_delegation',
      status: 'ok',
      workflowId: 'delegation-1',
    });
    expect(insertedValues?.[4]).toBe('requested');
  });

  it('creates an active delegation when the start date is already effective', async () => {
    let insertedValues: readonly unknown[] | undefined;

    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-actor') {
        return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-delegatee') {
        return { rowCount: 1, rows: [{ id: 'acc-delegatee' }] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-approver') {
        return { rowCount: 1, rows: [{ id: 'acc-approver' }] };
      }
      if (text.includes('INSERT INTO iam.delegations')) {
        insertedValues = values;
        return { rowCount: 1, rows: [{ id: 'delegation-2' }] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'create_delegation',
          instanceId: 'de-musterhausen',
          payload: {
            delegateeKeycloakSubject: 'keycloak-sub-delegatee',
            roleId: '22222222-2222-2222-8222-222222222222',
            approverKeycloakSubject: 'keycloak-sub-approver',
            ticketId: 'IAM-18',
            ticketState: 'open',
            startsAt: '2025-01-01T10:00:00.000Z',
            endsAt: '2025-01-10T10:00:00.000Z',
          },
        }),
      })
    );
    const payload = (await response.json()) as { status: string; workflowId?: string };

    expect(response.status).toBe(200);
    expect(payload.workflowId).toBe('delegation-2');
    expect(insertedValues?.[4]).toBe('active');
  });

  it('rejects delegation requests with invalid dates', async () => {
    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'create_delegation',
          instanceId: 'de-musterhausen',
          payload: {
            delegateeKeycloakSubject: 'keycloak-sub-delegatee',
            roleId: '22222222-2222-2222-8222-222222222222',
            approverKeycloakSubject: 'keycloak-sub-approver',
            ticketId: 'IAM-19',
            ticketState: 'open',
            startsAt: 'not-a-date',
            endsAt: 'still-not-a-date',
          },
        }),
      })
    );
    const payload = (await response.json()) as { status: string; reasonCode?: string };

    expect(response.status).toBe(400);
    expect(payload.status).toBe('error');
    expect(payload.reasonCode).toBe('invalid_request');
  });

  it('rejects delegation revocation with an invalid delegation id', async () => {
    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'revoke_delegation',
          instanceId: 'de-musterhausen',
          payload: {
            delegationId: 'not-a-uuid',
          },
        }),
      })
    );
    const payload = (await response.json()) as { status: string; reasonCode?: string };

    expect(response.status).toBe(400);
    expect(payload.status).toBe('error');
    expect(payload.reasonCode).toBe('invalid_request');
  });

  it('rejects impersonation exceeding maximum duration', async () => {
    const request = new Request('http://localhost/iam/governance/workflows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operation: 'start_impersonation',
        instanceId: 'de-musterhausen',
        payload: {
          targetKeycloakSubject: 'keycloak-sub-target',
          approverKeycloakSubject: 'keycloak-sub-approver',
          securityApproverKeycloakSubject: 'keycloak-sub-security',
          ticketId: 'IAM-2',
          ticketState: 'open',
          durationMinutes: 121,
        },
      }),
    });

    const response = await governanceWorkflowHandler(request);
    const payload = (await response.json()) as { status: string; reasonCode?: string };

    expect(response.status).toBe(400);
    expect(payload.status).toBe('error');
    expect(payload.reasonCode).toBe('DENY_IMPERSONATION_DURATION_EXCEEDED');
  });

  it('rejects support-admin impersonation without a dedicated security approver', async () => {
    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-actor') {
        return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-target') {
        return { rowCount: 1, rows: [{ id: 'acc-target' }] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-approver') {
        return { rowCount: 1, rows: [{ id: 'acc-approver' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'start_impersonation',
          instanceId: 'de-musterhausen',
          payload: {
            targetKeycloakSubject: 'keycloak-sub-target',
            approverKeycloakSubject: 'keycloak-sub-approver',
            ticketId: 'IAM-20',
            ticketState: 'open',
            durationMinutes: 30,
          },
        }),
      })
    );
    const payload = (await response.json()) as { status: string; reasonCode?: string };

    expect(response.status).toBe(400);
    expect(payload.status).toBe('error');
    expect(payload.reasonCode).toBe('DENY_SELF_APPROVAL');
  });

  it('rejects starting impersonation when the security approver resolves to the actor', async () => {
    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-actor') {
        return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-target') {
        return { rowCount: 1, rows: [{ id: 'acc-target' }] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-approver') {
        return { rowCount: 1, rows: [{ id: 'acc-approver' }] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-security') {
        return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'start_impersonation',
          instanceId: 'de-musterhausen',
          payload: {
            targetKeycloakSubject: 'keycloak-sub-target',
            approverKeycloakSubject: 'keycloak-sub-approver',
            securityApproverKeycloakSubject: 'keycloak-sub-security',
            ticketId: 'IAM-25',
            ticketState: 'open',
            durationMinutes: 15,
          },
        }),
      })
    );
    const payload = (await response.json()) as { status: string; reasonCode?: string };

    expect(response.status).toBe(400);
    expect(payload.status).toBe('error');
    expect(payload.reasonCode).toBe('DENY_SELF_APPROVAL');
  });

  it('starts impersonation with dual approval and records audit metadata', async () => {
    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-actor') {
        return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-target') {
        return { rowCount: 1, rows: [{ id: 'acc-target' }] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-approver') {
        return { rowCount: 1, rows: [{ id: 'acc-approver' }] };
      }
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-security') {
        return { rowCount: 1, rows: [{ id: 'acc-security' }] };
      }
      if (text.includes('INSERT INTO iam.impersonation_sessions')) {
        return { rowCount: 1, rows: [{ id: 'impersonation-1' }] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'start_impersonation',
          instanceId: 'de-musterhausen',
          payload: {
            targetKeycloakSubject: 'keycloak-sub-target',
            approverKeycloakSubject: 'keycloak-sub-approver',
            securityApproverKeycloakSubject: 'keycloak-sub-security',
            ticketId: 'IAM-26',
            ticketState: 'in_progress',
            durationMinutes: 20,
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      operation: 'start_impersonation',
      status: 'ok',
      workflowId: 'impersonation-1',
    });
  });

  it('rejects ending impersonation with an invalid session id', async () => {
    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'end_impersonation',
          instanceId: 'de-musterhausen',
          payload: {
            sessionId: 'invalid-session',
          },
        }),
      })
    );
    const payload = (await response.json()) as { status: string; reasonCode?: string };

    expect(response.status).toBe(400);
    expect(payload.status).toBe('error');
    expect(payload.reasonCode).toBe('invalid_request');
  });

  it('ends active impersonation sessions and returns the session id', async () => {
    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id') && values?.[1] === 'keycloak-sub-actor') {
        return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
      }
      if (text.includes('UPDATE iam.impersonation_sessions')) {
        return {
          rowCount: 1,
          rows: [{ started_at: '2026-03-08T09:00:00.000Z', ticket_id: 'IAM-27' }],
        };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'end_impersonation',
          instanceId: 'de-musterhausen',
          payload: {
            sessionId: '44444444-4444-4444-8444-444444444444',
            reason: 'investigation_complete',
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      operation: 'end_impersonation',
      status: 'ok',
      workflowId: '44444444-4444-4444-8444-444444444444',
    });
  });

  it('rejects privileged workflow operations for users without governance role', async () => {
    state.user = {
      ...state.user,
      roles: [],
    };

    const request = new Request('http://localhost/iam/governance/workflows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operation: 'submit_permission_change',
        instanceId: 'de-musterhausen',
        payload: {
          targetKeycloakSubject: 'keycloak-sub-target',
          roleId: '22222222-2222-2222-8222-222222222222',
          ticketId: 'IAM-1',
          ticketState: 'open',
        },
      }),
    });

    const response = await governanceWorkflowHandler(request);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Governance workflow denied due to missing role',
      expect.objectContaining({
        operation: 'submit_permission_change',
        reason_code: 'forbidden',
        workspace_id: 'de-musterhausen',
        request_id: 'req-governance',
        trace_id: 'trace-governance',
      })
    );
  });

  it('allows legal text operations without governance roles', async () => {
    state.user = {
      ...state.user,
      roles: [],
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id')) {
        return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
      }
      if (text.includes('FROM iam.legal_text_versions')) {
        return { rowCount: 1, rows: [{ id: 'legal-version-1' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const operations = ['accept_legal_text', 'revoke_legal_acceptance'] as const;
    for (const operation of operations) {
      const request = new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation,
          instanceId: 'de-musterhausen',
          payload: {
            legalTextId: 'privacy-notice',
            legalTextVersion: 'v1',
            locale: 'de-DE',
          },
        }),
      });

      const response = await governanceWorkflowHandler(request);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(
        expect.objectContaining({
          operation,
          status: 'ok',
          workflowId: 'legal-version-1',
        })
      );
    }
  });

  it('rejects legal text operations when no active version exists', async () => {
    state.user = {
      ...state.user,
      roles: [],
    };
    state.queryHandler = (text) => {
      if (text.includes('SELECT a.id')) {
        return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
      }
      if (text.includes('FROM iam.legal_text_versions')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'accept_legal_text',
          instanceId: 'de-musterhausen',
          payload: {
            legalTextId: 'privacy-notice',
            legalTextVersion: 'v2',
            locale: 'de-DE',
          },
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      operation: 'accept_legal_text',
      status: 'error',
      reasonCode: 'legal_text_version_not_active',
    });
  });

  it('rejects legal text operations when required fields are missing', async () => {
    state.user = {
      ...state.user,
      roles: [],
    };

    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'accept_legal_text',
          instanceId: 'de-musterhausen',
          payload: {
            legalTextId: 'privacy-notice',
          },
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      operation: 'accept_legal_text',
      status: 'error',
      reasonCode: 'invalid_request',
    });
  });
});

describe('governanceComplianceExportHandler', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
    state.user = {
      ...state.user,
      roles: ['iam_admin'],
    };
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.activity_logs')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa',
              event_type: 'governance_permission_change_submitted',
              payload: {
                event_id: 'evt-1',
                timestamp: '2026-02-28T12:00:00.000Z',
                instance_id: 'de-musterhausen',
                action: 'permission_change_submit',
                result: 'success',
                actor_pseudonym: 'abc',
                target_ref: 'wf-1',
                reason_code: 'DENY_TICKET_REQUIRED',
                request_id: 'req-1',
                trace_id: 'trace-1',
              },
              request_id: 'req-1',
              trace_id: 'trace-1',
              created_at: '2026-02-28T12:00:00.000Z',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };
  });

  it('exports csv with required governance fields', async () => {
    const response = await governanceComplianceExportHandler(
      new Request(
        'http://localhost/iam/governance/compliance/export?instanceId=de-musterhausen&format=csv'
      )
    );
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('event_id,timestamp,instance_id,action,result,actor_pseudonym,target_ref,reason_code,request_id,trace_id,event_type');
    expect(body).toContain('evt-1');
    expect(body).toContain('DENY_TICKET_REQUIRED');
  });

  it('rejects compliance export for users without compliance role', async () => {
    state.user = {
      ...state.user,
      roles: ['support_admin'],
    };

    const response = await governanceComplianceExportHandler(
      new Request(
        'http://localhost/iam/governance/compliance/export?instanceId=de-musterhausen&format=json'
      )
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Governance compliance export denied due to missing role',
      expect.objectContaining({
        operation: 'compliance_export',
        reason_code: 'forbidden',
        workspace_id: 'de-musterhausen',
        request_id: 'req-governance',
        trace_id: 'trace-governance',
      })
    );
  });

  it('rejects compliance export for cross-instance string scope', async () => {
    const response = await governanceComplianceExportHandler(
      new Request('http://localhost/iam/governance/compliance/export?instanceId=invalid&format=json')
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'instance_scope_mismatch' });
  });

  it('exports default json format when no format is provided', async () => {
    const response = await governanceComplianceExportHandler(
      new Request('http://localhost/iam/governance/compliance/export?instanceId=de-musterhausen')
    );
    const payload = (await response.json()) as {
      format: string;
      rows: Array<{ event_id: string; event_type: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.format).toBe('json');
    expect(payload.rows).toEqual([
      expect.objectContaining({
        event_id: 'evt-1',
        event_type: 'governance_permission_change_submitted',
      }),
    ]);
  });

  it('exports siem format with @timestamp field', async () => {
    const response = await governanceComplianceExportHandler(
      new Request(
        'http://localhost/iam/governance/compliance/export?instanceId=de-musterhausen&format=siem'
      )
    );
    const payload = (await response.json()) as {
      format: string;
      rows: Array<{ '@timestamp': string; event_id: string; action: string }>;
    };

    expect(response.status).toBe(200);
    expect(payload.format).toBe('siem');
    expect(payload.rows).toEqual([
      expect.objectContaining({
        '@timestamp': '2026-02-28T12:00:00.000Z',
        event_id: 'evt-1',
        action: 'permission_change_submit',
      }),
    ]);
  });

  it('rejects compliance export for cross-instance requests', async () => {
    const response = await governanceComplianceExportHandler(
      new Request(
        'http://localhost/iam/governance/compliance/export?instanceId=22222222-2222-2222-8222-222222222222&format=json'
      )
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'instance_scope_mismatch' });
  });
});

describe('listGovernanceCasesHandler', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
    state.user = {
      ...state.user,
      roles: ['security_admin'],
      instanceId: 'de-musterhausen',
    };
    state.queryHandler = null;
  });

  it('rejects governance transparency reads for users without the required role', async () => {
    state.user = {
      ...state.user,
      roles: ['editor'],
    };

    const response = await listGovernanceCasesHandler(
      new Request('http://localhost/iam/governance/workflows?instanceId=de-musterhausen')
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'forbidden',
      },
    });
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Governance read denied due to missing role',
      expect.objectContaining({
        operation: 'list_governance_cases',
        reason_code: 'forbidden',
      })
    );
  });

  it('rejects missing or cross-instance governance reads before querying', async () => {
    state.user = {
      ...state.user,
      instanceId: '',
    };

    const missingInstanceResponse = await listGovernanceCasesHandler(
      new Request('http://localhost/iam/governance/workflows')
    );
    expect(missingInstanceResponse.status).toBe(400);

    state.user = {
      ...state.user,
      instanceId: 'de-musterhausen',
    };

    const crossInstanceResponse = await listGovernanceCasesHandler(
      new Request('http://localhost/iam/governance/workflows?instanceId=fr-anderswo')
    );

    expect(crossInstanceResponse.status).toBe(403);
  });

  it('lists governance cases with filters and reports database failures', async () => {
    state.queryHandler = (text, values) => {
      if (text.includes('FROM iam.permission_change_requests request')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('FROM iam.delegations delegation')) {
        expect(values).toEqual(['de-musterhausen', null]);
        return {
          rowCount: 1,
          rows: [
            {
              id: 'delegation-1',
              status: 'active',
              ticket_id: 'IAM-123',
              ticket_system: 'jira',
              ticket_state: 'approved',
              starts_at: '2026-03-10T10:00:00.000Z',
              ends_at: '2026-03-12T10:00:00.000Z',
              created_at: '2026-03-10T09:00:00.000Z',
              updated_at: '2026-03-10T09:30:00.000Z',
              revoked_at: null,
              role_id: 'role-1',
              role_name: 'editor',
              role_display_name: 'Editor',
              delegator_account_id: 'acc-actor',
              delegatee_account_id: 'acc-target',
              delegator_display_name_ciphertext: 'Alice',
              delegator_first_name_ciphertext: 'Alice',
              delegator_last_name_ciphertext: 'Admin',
              delegator_keycloak_subject: 'actor-sub',
              delegatee_display_name_ciphertext: 'Bob',
              delegatee_first_name_ciphertext: 'Bob',
              delegatee_last_name_ciphertext: 'Builder',
              delegatee_keycloak_subject: 'target-sub',
            },
          ],
        };
      }
      if (text.includes('FROM iam.impersonation_sessions session')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('FROM iam.legal_text_acceptances acceptance')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await listGovernanceCasesHandler(
      new Request('http://localhost/iam/governance/workflows?instanceId=de-musterhausen&page=2&pageSize=10')
    );
    const payload = (await response.json()) as {
      data: Array<{ id: string; type: string; ticketId?: string }>;
      pagination: { page: number; pageSize: number; total: number };
    };

    expect(response.status).toBe(200);
    expect(payload.pagination).toEqual({ page: 2, pageSize: 10, total: 1 });
    expect(Array.isArray(payload.data)).toBe(true);

    state.queryHandler = () => {
      throw new Error('governance db down');
    };

    const errorResponse = await listGovernanceCasesHandler(
      new Request('http://localhost/iam/governance/workflows?instanceId=de-musterhausen')
    );

    expect(errorResponse.status).toBe(503);
    expect(state.logger.error).toHaveBeenCalledWith(
      'Governance read failed',
      expect.objectContaining({
        operation: 'list_governance_cases',
        error: 'governance db down',
      })
    );
  });

  it('allows support_admin to read governance transparency cases', async () => {
    state.user = {
      ...state.user,
      roles: ['support_admin'],
    };
    state.queryHandler = (text) => {
      if (
        text.includes('FROM iam.permission_change_requests request') ||
        text.includes('FROM iam.delegations delegation') ||
        text.includes('FROM iam.impersonation_sessions session') ||
        text.includes('FROM iam.legal_text_acceptances acceptance')
      ) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await listGovernanceCasesHandler(
      new Request('http://localhost/iam/governance/workflows?instanceId=de-musterhausen')
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [],
      pagination: {
        total: 0,
      },
    });
  });
});

describe('resolveImpersonationSubject', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    state.logger.debug.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();
    state.queryHandler = null;
  });

  it('returns instance scope mismatch when actor or target account cannot be resolved', async () => {
    state.queryHandler = () => ({ rowCount: 0, rows: [] });

    const result = await resolveImpersonationSubject({
      instanceId: 'de-musterhausen',
      actorKeycloakSubject: 'missing-actor',
      targetKeycloakSubject: 'target-sub',
    });

    expect(result).toEqual({
      ok: false,
      reasonCode: 'DENY_INSTANCE_SCOPE_MISMATCH',
    });
  });

  it('returns ticket required when no active impersonation session exists', async () => {
    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id')) {
        const keycloakSubject = values?.[1];
        if (keycloakSubject === 'actor-sub') {
          return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
        }
        if (keycloakSubject === 'target-sub') {
          return { rowCount: 1, rows: [{ id: 'acc-target' }] };
        }
      }
      if (text.includes('FROM iam.impersonation_sessions')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const result = await resolveImpersonationSubject({
      instanceId: 'de-musterhausen',
      actorKeycloakSubject: 'actor-sub',
      targetKeycloakSubject: 'target-sub',
    });

    expect(result).toEqual({
      ok: false,
      reasonCode: 'DENY_TICKET_REQUIRED',
    });
  });

  it('expires stale impersonation sessions and returns duration exceeded', async () => {
    const executedStatements: string[] = [];
    state.queryHandler = (text, values) => {
      executedStatements.push(text);
      if (text.includes('SELECT a.id')) {
        const keycloakSubject = values?.[1];
        if (keycloakSubject === 'actor-sub') {
          return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
        }
        if (keycloakSubject === 'target-sub') {
          return { rowCount: 1, rows: [{ id: 'acc-target' }] };
        }
      }
      if (text.includes('FROM iam.impersonation_sessions')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'session-1',
              expires_at: '2026-02-01T10:00:00.000Z',
              ticket_id: 'IAM-99',
            },
          ],
        };
      }
      if (text.includes('UPDATE iam.impersonation_sessions')) {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('INSERT INTO iam.activity_logs')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const result = await resolveImpersonationSubject({
      instanceId: 'de-musterhausen',
      actorKeycloakSubject: 'actor-sub',
      targetKeycloakSubject: 'target-sub',
    });

    expect(result).toEqual({
      ok: false,
      reasonCode: 'DENY_IMPERSONATION_DURATION_EXCEEDED',
    });
    expect(executedStatements.some((statement) => statement.includes('UPDATE iam.impersonation_sessions'))).toBe(true);
    expect(executedStatements.some((statement) => statement.includes('INSERT INTO iam.activity_logs'))).toBe(true);
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Impersonation session expired',
      expect.objectContaining({
        operation: 'impersonate_timeout',
        ticket_id: 'IAM-99',
      })
    );
  });

  it('returns ok for active impersonation sessions', async () => {
    state.queryHandler = (text, values) => {
      if (text.includes('SELECT a.id')) {
        const keycloakSubject = values?.[1];
        if (keycloakSubject === 'actor-sub') {
          return { rowCount: 1, rows: [{ id: 'acc-actor' }] };
        }
        if (keycloakSubject === 'target-sub') {
          return { rowCount: 1, rows: [{ id: 'acc-target' }] };
        }
      }
      if (text.includes('FROM iam.impersonation_sessions')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'session-1',
              expires_at: '2099-02-01T10:00:00.000Z',
              ticket_id: 'IAM-100',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const result = await resolveImpersonationSubject({
      instanceId: 'de-musterhausen',
      actorKeycloakSubject: 'actor-sub',
      targetKeycloakSubject: 'target-sub',
    });

    expect(result).toEqual({ ok: true });
  });

  it('returns database_unavailable when the lookup fails unexpectedly', async () => {
    state.queryHandler = () => {
      throw new Error('db down');
    };

    const result = await resolveImpersonationSubject({
      instanceId: 'de-musterhausen',
      actorKeycloakSubject: 'actor-sub',
      targetKeycloakSubject: 'target-sub',
    });

    expect(result).toEqual({
      ok: false,
      reasonCode: 'database_unavailable',
    });
  });
});
