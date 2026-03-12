import { beforeEach, describe, expect, it, vi } from 'vitest';

type PermissionChangeRequestState = {
  id: string;
  requesterAccountId: string;
  targetAccountId: string;
  roleId: string;
  status: 'submitted' | 'approved' | 'applied';
};

const integrationState = vi.hoisted(() => ({
  user: {
    id: 'actor-sub',
    name: 'Actor',
    roles: ['iam_admin'],
    instanceId: 'de-musterhausen',
  },
  accounts: new Map<string, string>([
    ['actor-sub', 'acc-actor'],
    ['target-sub', 'acc-target'],
    ['approver-sub', 'acc-approver'],
  ]),
  permissionRequests: new Map<string, PermissionChangeRequestState>(),
  accountRoles: [] as Array<{ accountId: string; roleId: string }>,
}));

vi.mock('./middleware.server', () => ({
  withAuthenticatedUser: vi.fn(async (_request: Request, handler: (ctx: unknown) => Promise<Response>) =>
    handler({
      sessionId: 'session-1',
      user: integrationState.user,
    })
  ),
}));

vi.mock('@sva/sdk/server', () => ({
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getWorkspaceContext: () => ({
    workspaceId: integrationState.user.instanceId,
    requestId: 'req-integration',
    traceId: 'trace-integration',
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
          if (text.includes('SELECT a.id') && text.includes('iam.accounts')) {
            const keycloakSubject = values?.[1];
            const accountId =
              typeof keycloakSubject === 'string'
                ? integrationState.accounts.get(keycloakSubject)
                : undefined;
            return accountId ? { rowCount: 1, rows: [{ id: accountId }] } : { rowCount: 0, rows: [] };
          }

          if (text.includes('SELECT p.permission_key')) {
            return { rowCount: 1, rows: [{ permission_key: 'iam.admin' }] };
          }

          if (text.includes('INSERT INTO iam.permission_change_requests')) {
            const id = '71111111-1111-4111-8111-111111111111';
            integrationState.permissionRequests.set(id, {
              id,
              requesterAccountId: String(values?.[1]),
              targetAccountId: String(values?.[2]),
              roleId: String(values?.[3]),
              status: 'submitted',
            });
            return { rowCount: 1, rows: [{ id }] };
          }

          if (text.includes('FROM iam.permission_change_requests') && text.includes('requester_account_id')) {
            const id = String(values?.[0]);
            const request = integrationState.permissionRequests.get(id);
            if (!request) {
              return { rowCount: 0, rows: [] };
            }
            return {
              rowCount: 1,
              rows: [
                {
                  requester_account_id: request.requesterAccountId,
                  is_critical: true,
                  status: request.status,
                },
              ],
            };
          }

          if (text.includes("UPDATE iam.permission_change_requests") && text.includes("status = $3")) {
            const id = String(values?.[0]);
            const status = String(values?.[2]);
            const request = integrationState.permissionRequests.get(id);
            if (request && (status === 'approved' || status === 'rejected')) {
              request.status = status === 'approved' ? 'approved' : request.status;
            }
            return { rowCount: 1, rows: [] };
          }

          if (text.includes('SELECT target_account_id, role_id, status')) {
            const id = String(values?.[0]);
            const request = integrationState.permissionRequests.get(id);
            if (!request) {
              return { rowCount: 0, rows: [] };
            }
            return {
              rowCount: 1,
              rows: [
                {
                  target_account_id: request.targetAccountId,
                  role_id: request.roleId,
                  status: request.status,
                },
              ],
            };
          }

          if (text.includes('INSERT INTO iam.account_roles')) {
            integrationState.accountRoles.push({
              accountId: String(values?.[1]),
              roleId: String(values?.[2]),
            });
            return { rowCount: 1, rows: [] };
          }

          if (text.includes("SET status = 'applied'")) {
            const id = String(values?.[0]);
            const request = integrationState.permissionRequests.get(id);
            if (request) {
              request.status = 'applied';
            }
            return { rowCount: 1, rows: [] };
          }

          if (text.includes('INSERT INTO iam.activity_logs')) {
            return { rowCount: 1, rows: [] };
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

import { governanceWorkflowHandler } from './iam-governance.server';

describe('governance workflow integration', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    integrationState.permissionRequests.clear();
    integrationState.accountRoles = [];
    integrationState.user = {
      id: 'actor-sub',
      name: 'Actor',
      roles: ['iam_admin'],
      instanceId: 'de-musterhausen',
    };
  });

  it('runs end-to-end permission change flow: submit -> approve -> apply', async () => {
    const submit = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'submit_permission_change',
          instanceId: integrationState.user.instanceId,
          payload: {
            targetKeycloakSubject: 'target-sub',
            roleId: '22222222-2222-2222-8222-222222222222',
            ticketId: 'IAM-100',
            ticketState: 'open',
          },
        }),
      })
    );
    const submitted = (await submit.json()) as { workflowId: string; status: string };
    expect(submit.status).toBe(200);
    expect(submitted.status).toBe('ok');

    integrationState.user = {
      ...integrationState.user,
      id: 'approver-sub',
    };
    const approve = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'approve_permission_change',
          instanceId: 'de-musterhausen',
          payload: {
            requestId: submitted.workflowId,
            approval: 'approved',
          },
        }),
      })
    );
    const approved = (await approve.json()) as { status: string };
    expect(approve.status).toBe(200);
    expect(approved.status).toBe('ok');

    const apply = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'apply_permission_change',
          instanceId: 'de-musterhausen',
          payload: {
            requestId: submitted.workflowId,
          },
        }),
      })
    );
    const applied = (await apply.json()) as { status: string };
    expect(apply.status).toBe(200);
    expect(applied.status).toBe('ok');
    expect(integrationState.accountRoles).toEqual([
      {
        accountId: 'acc-target',
        roleId: '22222222-2222-2222-8222-222222222222',
      },
    ]);
  });

  it('enforces instance isolation for governance workflow endpoints', async () => {
    const response = await governanceWorkflowHandler(
      new Request('http://localhost/iam/governance/workflows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operation: 'submit_permission_change',
          instanceId: '22222222-2222-2222-8222-222222222222',
          payload: {
            targetKeycloakSubject: 'target-sub',
            roleId: '22222222-2222-2222-8222-222222222222',
            ticketId: 'IAM-100',
            ticketState: 'open',
          },
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'instance_scope_mismatch' });
  });
});
