import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  withAuthenticatedUser: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
  getWorkspaceContext: () => ({ requestId: 'req-1', traceId: 'trace-1' }),
  withRequestContext: async (_input: unknown, work: () => Promise<Response>) => work(),
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('../runtime-secrets.js', () => ({
  getIamDatabaseUrl: () => undefined,
}));

vi.mock('../db.js', () => ({
  createPoolResolver: () => () => null,
  jsonResponse: (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  withResolvedInstanceDb: vi.fn(),
}));

vi.mock('@sva/iam-governance/governance-workflow-executor', () => ({
  createGovernanceWorkflowExecutor: () => ({
    executeWorkflow: vi.fn(),
  }),
}));

vi.mock('@sva/iam-governance/governance-compliance-export', () => ({
  buildGovernanceComplianceExport: vi.fn(),
}));

vi.mock('@sva/iam-governance/governance-workflow-policy', () => ({
  governanceComplianceExportRoles: [],
  governanceReadRoles: [],
  governanceWorkflowRoles: [],
  hasRequiredGovernanceRole: () => true,
  readGovernanceCaseType: vi.fn(),
  requiresPrivilegedGovernanceWorkflowRole: () => false,
}));

vi.mock('../shared/schemas.js', () => ({
  governanceRequestSchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiList: vi.fn(),
  createApiError: vi.fn(),
  readPage: vi.fn(),
}));

vi.mock('@sva/iam-governance', () => ({
  listGovernanceCases: vi.fn(),
}));

describe('governance workflow handler logging', () => {
  beforeEach(() => {
    vi.resetModules();
    state.logger.error.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.withAuthenticatedUser.mockReset();
    state.withAuthenticatedUser.mockImplementation(async (_request, handler) =>
      handler({ user: { id: 'user-1', instanceId: 'instance-1', roles: ['admin'] } })
    );
  });

  it('logs invalid JSON request bodies before returning invalid_request', async () => {
    const { governanceWorkflowHandler } = await import('./core.js');

    const request = new Request('https://example.test/api/v1/iam/governance/workflow', {
      method: 'POST',
      body: '{invalid json',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await governanceWorkflowHandler(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_request' });
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Governance workflow request body could not be parsed',
      expect.objectContaining({
        reason_code: 'invalid_json',
        request_id: 'req-1',
        trace_id: 'trace-1',
      })
    );
  });
});
