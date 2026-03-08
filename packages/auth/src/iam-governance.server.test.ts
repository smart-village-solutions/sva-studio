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
    instanceId: '11111111-1111-1111-8111-111111111111',
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
    workspaceId: '11111111-1111-1111-8111-111111111111',
    requestId: 'req-governance',
    traceId: 'trace-governance',
  }),
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

import { governanceComplianceExportHandler, governanceWorkflowHandler } from './iam-governance.server';

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
      instanceId: '11111111-1111-1111-8111-111111111111',
    };
  });

  it('rejects permission change with invalid ticket state', async () => {
    const request = new Request('http://localhost/iam/governance/workflows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operation: 'submit_permission_change',
        instanceId: '11111111-1111-1111-8111-111111111111',
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

  it('rejects workflow request with invalid instance id', async () => {
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

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_request' });
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
        instanceId: '11111111-1111-1111-8111-111111111111',
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

  it('rejects impersonation exceeding maximum duration', async () => {
    const request = new Request('http://localhost/iam/governance/workflows', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        operation: 'start_impersonation',
        instanceId: '11111111-1111-1111-8111-111111111111',
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
        instanceId: '11111111-1111-1111-8111-111111111111',
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
        workspace_id: '11111111-1111-1111-8111-111111111111',
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
      if (text.includes('INSERT INTO iam.legal_text_versions')) {
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
          instanceId: '11111111-1111-1111-8111-111111111111',
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
                instance_id: '11111111-1111-1111-8111-111111111111',
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
        'http://localhost/iam/governance/compliance/export?instanceId=11111111-1111-1111-8111-111111111111&format=csv'
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
        'http://localhost/iam/governance/compliance/export?instanceId=11111111-1111-1111-8111-111111111111&format=json'
      )
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Governance compliance export denied due to missing role',
      expect.objectContaining({
        operation: 'compliance_export',
        reason_code: 'forbidden',
        workspace_id: '11111111-1111-1111-8111-111111111111',
        request_id: 'req-governance',
        trace_id: 'trace-governance',
      })
    );
  });

  it('rejects compliance export for invalid instance id', async () => {
    const response = await governanceComplianceExportHandler(
      new Request('http://localhost/iam/governance/compliance/export?instanceId=invalid&format=json')
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_instance_id' });
  });
});
