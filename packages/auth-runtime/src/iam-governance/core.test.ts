import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  withAuthenticatedUser: vi.fn(),
  withResolvedInstanceDb: vi.fn(),
  executeWorkflow: vi.fn(),
  buildGovernanceComplianceExport: vi.fn(),
  hasRequiredGovernanceRole: vi.fn(),
  readGovernanceCaseType: vi.fn(),
  requiresPrivilegedGovernanceWorkflowRole: vi.fn(),
  governanceRequestSafeParse: vi.fn(),
  asApiList: vi.fn(),
  createApiError: vi.fn(),
  readPage: vi.fn(),
  listGovernanceCases: vi.fn(),
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
  withResolvedInstanceDb: state.withResolvedInstanceDb,
}));

vi.mock('@sva/iam-governance/governance-workflow-executor', () => ({
  createGovernanceWorkflowExecutor: () => ({
    executeWorkflow: state.executeWorkflow,
    resolveImpersonationSubject: vi.fn(async () => ({ ok: true })),
  }),
}));

vi.mock('@sva/iam-governance/governance-compliance-export', () => ({
  buildGovernanceComplianceExport: state.buildGovernanceComplianceExport,
}));

vi.mock('@sva/iam-governance/governance-workflow-policy', () => ({
  governanceComplianceExportRoles: ['governance_exporter'],
  governanceReadRoles: ['governance_reader'],
  governanceWorkflowRoles: ['governance_admin'],
  hasRequiredGovernanceRole: state.hasRequiredGovernanceRole,
  readGovernanceCaseType: state.readGovernanceCaseType,
  requiresPrivilegedGovernanceWorkflowRole: state.requiresPrivilegedGovernanceWorkflowRole,
}));

vi.mock('../shared/schemas.js', () => ({
  governanceRequestSchema: {
    safeParse: state.governanceRequestSafeParse,
  },
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiList: state.asApiList,
  createApiError: state.createApiError,
  readPage: state.readPage,
}));

vi.mock('@sva/iam-governance', () => ({
  listGovernanceCases: state.listGovernanceCases,
}));

const defaultUser = {
  id: 'user-1',
  instanceId: 'instance-1',
  roles: ['governance_admin', 'governance_reader', 'governance_exporter'],
};

describe('iam governance runtime handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    state.logger.error.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.withAuthenticatedUser.mockReset();
    state.withResolvedInstanceDb.mockReset();
    state.executeWorkflow.mockReset();
    state.buildGovernanceComplianceExport.mockReset();
    state.hasRequiredGovernanceRole.mockReset();
    state.readGovernanceCaseType.mockReset();
    state.requiresPrivilegedGovernanceWorkflowRole.mockReset();
    state.governanceRequestSafeParse.mockReset();
    state.asApiList.mockReset();
    state.createApiError.mockReset();
    state.readPage.mockReset();
    state.listGovernanceCases.mockReset();

    state.withAuthenticatedUser.mockImplementation(async (_request, handler) => handler({ user: defaultUser }));
    state.withResolvedInstanceDb.mockImplementation(async (_resolver, _instanceId, work) => work({ query: vi.fn() }));
    state.hasRequiredGovernanceRole.mockReturnValue(true);
    state.readGovernanceCaseType.mockImplementation((value) => value ?? undefined);
    state.requiresPrivilegedGovernanceWorkflowRole.mockReturnValue(false);
    state.governanceRequestSafeParse.mockReturnValue({
      success: true,
      data: {
        instanceId: 'instance-1',
        operation: 'case.close',
      },
    });
    state.executeWorkflow.mockResolvedValue({ status: 'ok', workflowId: 'wf-1' });
    state.readPage.mockReturnValue({ page: 2, pageSize: 25 });
    state.listGovernanceCases.mockResolvedValue({ items: [{ id: 'case-1' }], total: 1 });
    state.asApiList.mockImplementation((items, meta, requestId) => ({ items, meta, requestId }));
    state.createApiError.mockImplementation((status, code, message, requestId) =>
      new Response(JSON.stringify({ error: { code, message }, requestId }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    state.buildGovernanceComplianceExport.mockResolvedValue({
      format: 'json',
      body: { ok: true },
      contentType: 'application/json',
    });
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

  it('rejects invalid workflow payloads, scope mismatches and missing privileged roles', async () => {
    const { governanceWorkflowHandler } = await import('./core.js');

    state.governanceRequestSafeParse.mockReturnValueOnce({ success: false });
    const invalidPayload = await governanceWorkflowHandler(
      new Request('https://example.test/api/v1/iam/governance/workflow', {
        method: 'POST',
        body: JSON.stringify({ bad: true }),
      })
    );
    expect(invalidPayload.status).toBe(400);

    state.governanceRequestSafeParse.mockReturnValueOnce({
      success: true,
      data: { instanceId: '', operation: 'case.close' },
    });
    const invalidInstance = await governanceWorkflowHandler(
      new Request('https://example.test/api/v1/iam/governance/workflow', {
        method: 'POST',
        body: JSON.stringify({ instanceId: '' }),
      })
    );
    expect(invalidInstance.status).toBe(400);

    state.governanceRequestSafeParse.mockReturnValueOnce({
      success: true,
      data: { instanceId: 'other-instance', operation: 'case.close' },
    });
    const mismatchedInstance = await governanceWorkflowHandler(
      new Request('https://example.test/api/v1/iam/governance/workflow', {
        method: 'POST',
        body: JSON.stringify({ instanceId: 'other-instance' }),
      })
    );
    expect(mismatchedInstance.status).toBe(403);

    state.requiresPrivilegedGovernanceWorkflowRole.mockReturnValueOnce(true);
    state.hasRequiredGovernanceRole.mockReturnValueOnce(false);
    const forbidden = await governanceWorkflowHandler(
      new Request('https://example.test/api/v1/iam/governance/workflow', {
        method: 'POST',
        body: JSON.stringify({ instanceId: 'instance-1', operation: 'case.close' }),
      })
    );
    expect(forbidden.status).toBe(403);
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Governance workflow denied due to missing role',
      expect.objectContaining({ operation: 'case.close', reason_code: 'forbidden' })
    );
  });

  it('returns workflow error results as 400, successful results as 200 and database failures as 503', async () => {
    const { governanceWorkflowHandler } = await import('./core.js');

    state.executeWorkflow.mockResolvedValueOnce({ status: 'error', reasonCode: 'workflow_invalid' });
    const rejected = await governanceWorkflowHandler(
      new Request('https://example.test/api/v1/iam/governance/workflow', {
        method: 'POST',
        body: JSON.stringify({ instanceId: 'instance-1', operation: 'case.close' }),
      })
    );
    expect(rejected.status).toBe(400);
    expect(state.logger.error).toHaveBeenCalledWith(
      'Governance workflow rejected',
      expect.objectContaining({ reason_code: 'workflow_invalid' })
    );

    state.executeWorkflow.mockResolvedValueOnce({ status: 'ok', workflowId: 'wf-2' });
    const success = await governanceWorkflowHandler(
      new Request('https://example.test/api/v1/iam/governance/workflow', {
        method: 'POST',
        body: JSON.stringify({ instanceId: 'instance-1', operation: 'case.close' }),
      })
    );
    expect(success.status).toBe(200);
    expect(state.logger.info).toHaveBeenCalledWith(
      'Governance workflow completed',
      expect.objectContaining({ workflow_id: 'wf-2' })
    );

    state.withResolvedInstanceDb.mockImplementationOnce(async () => {
      throw new Error('db down');
    });
    const failure = await governanceWorkflowHandler(
      new Request('https://example.test/api/v1/iam/governance/workflow', {
        method: 'POST',
        body: JSON.stringify({ instanceId: 'instance-1', operation: 'case.close' }),
      })
    );
    expect(failure.status).toBe(503);
  });

  it('guards governance case listing and returns paginated results or failures', async () => {
    const { listGovernanceCasesHandler } = await import('./core.js');

    state.hasRequiredGovernanceRole.mockReturnValueOnce(false);
    const forbidden = await listGovernanceCasesHandler(
      new Request('https://example.test/api/v1/iam/governance/cases?instanceId=instance-1')
    );
    expect(forbidden.status).toBe(403);

    state.hasRequiredGovernanceRole.mockReturnValue(true);
    state.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...defaultUser, instanceId: undefined } })
    );
    const missingInstance = await listGovernanceCasesHandler(
      new Request('https://example.test/api/v1/iam/governance/cases')
    );
    expect(missingInstance.status).toBe(400);

    const mismatched = await listGovernanceCasesHandler(
      new Request('https://example.test/api/v1/iam/governance/cases?instanceId=other-instance')
    );
    expect(mismatched.status).toBe(403);

    state.readGovernanceCaseType.mockReturnValueOnce(null);
    const invalidType = await listGovernanceCasesHandler(
      new Request('https://example.test/api/v1/iam/governance/cases?instanceId=instance-1&type=bad')
    );
    expect(invalidType.status).toBe(400);

    const success = await listGovernanceCasesHandler(
      new Request('https://example.test/api/v1/iam/governance/cases?instanceId=instance-1&type=dsr&status=open&search=test')
    );
    expect(success.status).toBe(200);
    await expect(success.json()).resolves.toMatchObject({
      items: [{ id: 'case-1' }],
      meta: { page: 2, pageSize: 25, total: 1 },
      requestId: 'req-1',
    });

    state.withResolvedInstanceDb.mockImplementationOnce(async () => {
      throw new Error('db down');
    });
    const dbFailure = await listGovernanceCasesHandler(
      new Request('https://example.test/api/v1/iam/governance/cases?instanceId=instance-1')
    );
    expect(dbFailure.status).toBe(503);
  });

  it('exports governance compliance as json or csv and enforces role and instance scope', async () => {
    const { governanceComplianceExportHandler } = await import('./core.js');

    state.hasRequiredGovernanceRole.mockReturnValueOnce(false);
    const forbidden = await governanceComplianceExportHandler(
      new Request('https://example.test/api/v1/iam/governance/compliance?instanceId=instance-1')
    );
    expect(forbidden.status).toBe(403);

    state.hasRequiredGovernanceRole.mockReturnValue(true);
    state.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...defaultUser, instanceId: undefined } })
    );
    const invalidInstance = await governanceComplianceExportHandler(
      new Request('https://example.test/api/v1/iam/governance/compliance')
    );
    expect(invalidInstance.status).toBe(400);

    const mismatched = await governanceComplianceExportHandler(
      new Request('https://example.test/api/v1/iam/governance/compliance?instanceId=other-instance')
    );
    expect(mismatched.status).toBe(403);

    state.buildGovernanceComplianceExport.mockResolvedValueOnce({
      format: 'csv',
      body: 'col\nvalue',
      contentType: 'text/csv; charset=utf-8',
    });
    const csv = await governanceComplianceExportHandler(
      new Request('https://example.test/api/v1/iam/governance/compliance?instanceId=instance-1&format=csv')
    );
    expect(csv.status).toBe(200);
    expect(csv.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    await expect(csv.text()).resolves.toBe('col\nvalue');

    const json = await governanceComplianceExportHandler(
      new Request('https://example.test/api/v1/iam/governance/compliance?instanceId=instance-1&format=json')
    );
    expect(json.status).toBe(200);
    await expect(json.json()).resolves.toEqual({ ok: true });

    state.withResolvedInstanceDb.mockImplementationOnce(async () => {
      throw new Error('db down');
    });
    const dbFailure = await governanceComplianceExportHandler(
      new Request('https://example.test/api/v1/iam/governance/compliance?instanceId=instance-1')
    );
    expect(dbFailure.status).toBe(503);
  });
});
