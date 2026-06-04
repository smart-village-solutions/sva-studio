import { beforeEach, describe, expect, it, vi } from 'vitest';

type SessionUser = {
  id: string;
  instanceId?: string;
  roles: string[];
};

type AccountRow = {
  id: string;
  keycloak_subject: string;
  email_ciphertext?: string | null;
  display_name_ciphertext?: string | null;
  processing_restricted_at?: string | null;
  non_essential_processing_opt_out_at?: string | null;
};

const mocks = vi.hoisted(() => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  withRequestContext: vi.fn(async (_input: unknown, handler: () => Promise<Response>) => handler()),
  withAuthenticatedUser: vi.fn(),
  validateCsrf: vi.fn(() => null),
  withResolvedInstanceDb: vi.fn(),
  createPoolResolver: vi.fn(() => () => null),
  createDsrExportFlows: vi.fn(),
  createDsrExportStatusHandlers: vi.fn(),
  runSelfExport: vi.fn(),
  runAdminExport: vi.fn(),
  getSelfExportStatus: vi.fn(),
  getAdminExportStatus: vi.fn(),
  runDsrMaintenance: vi.fn(),
  listAdminDsrCases: vi.fn(),
  getAdminDsrCase: vi.fn(),
  getSelfServiceActivityItem: vi.fn(),
  loadDsrSelfServiceOverview: vi.fn(),
  revokeUserSessions: vi.fn(async () => undefined),
  parseFieldEncryptionConfigFromEnv: vi.fn(() => ({ keyId: 'enc-1' })),
  encryptFieldValue: vi.fn((value: string) => `enc:${value}`),
  requireIdempotencyKey: vi.fn(() => ({ key: 'idem-1' })),
  reserveIdempotency: vi.fn(),
  completeIdempotency: vi.fn(),
  toPayloadHash: vi.fn(() => 'hash-1'),
  asApiItem: vi.fn((item: unknown, requestId?: string) => ({ data: item, requestId })),
  asApiList: vi.fn((items: unknown, page: unknown, requestId?: string) => ({ data: items, page, requestId })),
  createApiError: vi.fn((status: number, error: string, message: string, requestId?: string) =>
    new Response(JSON.stringify({ error, message, requestId }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
  readPage: vi.fn(() => ({ page: 1, pageSize: 20 })),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-test', traceId: 'trace-test' })),
  safeParse: vi.fn((body: unknown) => ({
    success: typeof body === 'object' && body !== null,
    data: body,
  })),
  authorizeInstancePermissionForUser: vi.fn(),
}));

class MockDsrAccountSnapshotNotFoundError extends Error {}

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => mocks.logger,
  getWorkspaceContext: mocks.getWorkspaceContext,
  withRequestContext: mocks.withRequestContext,
}));

vi.mock('@sva/core/security', () => ({
  encryptFieldValue: mocks.encryptFieldValue,
  parseFieldEncryptionConfigFromEnv: mocks.parseFieldEncryptionConfigFromEnv,
}));

vi.mock('@sva/iam-governance/dsr-export-flows', () => ({
  createDsrExportFlows: (...args: unknown[]) => {
    mocks.createDsrExportFlows(...args);
    return {
      runSelfExport: mocks.runSelfExport,
      runAdminExport: mocks.runAdminExport,
    };
  },
}));

vi.mock('@sva/iam-governance/dsr-export-status', () => ({
  createDsrExportStatusHandlers: (...args: unknown[]) => {
    mocks.createDsrExportStatusHandlers(...args);
    return {
      getSelfExportStatus: mocks.getSelfExportStatus,
      getAdminExportStatus: mocks.getAdminExportStatus,
    };
  },
}));

vi.mock('@sva/iam-governance/dsr-maintenance', () => ({
  runDsrMaintenance: mocks.runDsrMaintenance,
}));

vi.mock('@sva/iam-governance', () => ({
  getAdminDsrCase: mocks.getAdminDsrCase,
  getSelfServiceActivityItem: mocks.getSelfServiceActivityItem,
  listAdminDsrCases: mocks.listAdminDsrCases,
  loadDsrSelfServiceOverview: mocks.loadDsrSelfServiceOverview,
}));

vi.mock('@sva/iam-governance/dsr-read-models-internal', () => ({
  DsrAccountSnapshotNotFoundError: MockDsrAccountSnapshotNotFoundError,
}));

vi.mock('../middleware.js', () => ({
  withAuthenticatedUser: mocks.withAuthenticatedUser,
}));

vi.mock('../runtime-secrets.js', () => ({
  getIamDatabaseUrl: vi.fn(() => 'postgres://db.example/sva'),
}));

vi.mock('../session-revocation.js', () => ({
  revokeUserSessions: mocks.revokeUserSessions,
}));

vi.mock('../instance-permission-authorization.js', () => ({
  authorizeInstancePermissionForUser: mocks.authorizeInstancePermissionForUser,
  toInstancePermissionApiErrorCode: (error: string) =>
    error === 'missing_instance'
      ? 'invalid_instance_id'
      : error === 'invalid_action'
        ? 'invalid_request'
        : error === 'database_unavailable'
          ? 'database_unavailable'
          : 'forbidden',
}));

vi.mock('../db.js', () => ({
  createPoolResolver: mocks.createPoolResolver,
  jsonResponse: (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  textResponse: (status: number, body: string) => new Response(body, { status }),
  withResolvedInstanceDb: mocks.withResolvedInstanceDb,
}));

vi.mock('../log-context.js', () => ({
  buildLogContext: vi.fn(() => ({ trace_id: 'trace-test' })),
}));

vi.mock('../shared/schemas.js', () => ({
  dataSubjectRightsRequestSchema: {
    safeParse: mocks.safeParse,
  },
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({
  asApiItem: mocks.asApiItem,
  asApiList: mocks.asApiList,
  createApiError: mocks.createApiError,
  readPage: mocks.readPage,
  requireIdempotencyKey: mocks.requireIdempotencyKey,
  toPayloadHash: mocks.toPayloadHash,
}));

vi.mock('../iam-account-management/shared.js', () => ({
  completeIdempotency: mocks.completeIdempotency,
  reserveIdempotency: mocks.reserveIdempotency,
}));

vi.mock('../iam-account-management/csrf.js', () => ({
  validateCsrf: mocks.validateCsrf,
}));

const baseUser: SessionUser = {
  id: 'kc-user-1',
  instanceId: 'de-test',
  roles: ['editor'],
};

const buildAccount = (overrides: Partial<AccountRow> = {}): AccountRow => ({
  id: 'account-1',
  keycloak_subject: 'kc-user-1',
  email_ciphertext: 'enc:mail',
  display_name_ciphertext: 'enc:name',
  processing_restricted_at: null,
  non_essential_processing_opt_out_at: null,
  ...overrides,
});

const buildDbClient = (options: {
  account?: AccountRow | null;
  hasLegalHold?: boolean;
  legalHoldInsertId?: string;
  releaseCount?: number;
  requestIds?: string[];
} = {}) => {
  const requestIds = [...(options.requestIds ?? ['request-1', 'request-2'])];

  return {
    query: vi.fn(async (text: string) => {
      if (text.includes('FROM iam.accounts a')) {
        return options.account
          ? { rowCount: 1, rows: [options.account] }
          : { rowCount: 0, rows: [] };
      }

      if (text.includes('FROM iam.legal_holds')) {
        return options.hasLegalHold ? { rowCount: 1, rows: [{ id: 'hold-1' }] } : { rowCount: 0, rows: [] };
      }

      if (text.includes('INSERT INTO iam.data_subject_requests')) {
        return { rowCount: 1, rows: [{ id: requestIds.shift() ?? 'request-x' }] };
      }

      if (text.includes('INSERT INTO iam.legal_holds')) {
        return { rowCount: 1, rows: [{ id: options.legalHoldInsertId ?? 'hold-created-1' }] };
      }

      if (text.includes('UPDATE iam.legal_holds')) {
        return {
          rowCount: options.releaseCount ?? 1,
          rows: Array.from({ length: options.releaseCount ?? 1 }, (_, index) => ({ id: `released-${index + 1}` })),
        };
      }

      return { rowCount: 1, rows: [] };
    }),
  };
};

const expectJson = async (response: Response) => response.json();

describe('iam data subject rights handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mocks.withAuthenticatedUser.mockImplementation(async (_request: Request, handler: (ctx: { user: SessionUser }) => Promise<Response>) =>
      handler({ user: baseUser })
    );
    mocks.withResolvedInstanceDb.mockImplementation(async (_resolver: unknown, instanceId: string, work: (client: ReturnType<typeof buildDbClient>) => Promise<Response>) =>
      work(buildDbClient({ account: buildAccount({ id: 'account-1', keycloak_subject: 'kc-user-1' }) }))
    );
    mocks.runDsrMaintenance.mockResolvedValue({ dryRun: false, affected: 0 });
    mocks.loadDsrSelfServiceOverview.mockResolvedValue({ totals: { open: 1 } });
    mocks.getSelfServiceActivityItem.mockResolvedValue({ id: 'case-1', type: 'request' });
    mocks.listAdminDsrCases.mockResolvedValue({ items: [{ id: 'case-1' }], total: 1 });
    mocks.getAdminDsrCase.mockResolvedValue({ id: 'case-1' });
    mocks.authorizeInstancePermissionForUser.mockResolvedValue({ ok: true, permissions: [] });
  });

  it('rejects invalid self-export formats before touching the database', async () => {
    const { dataExportHandler } = await import('./core.js');

    const response = await dataExportHandler(
      new Request('http://localhost/iam/me/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-1' },
        body: JSON.stringify({ format: 'pdf', async: false }),
      })
    );

    expect(response.status).toBe(400);
    await expect(expectJson(response)).resolves.toEqual({ error: 'invalid_export_format' });
    expect(mocks.withResolvedInstanceDb).not.toHaveBeenCalled();
  }, 15_000);

  it('accepts async self exports via query instance scope and string async flag', async () => {
    const { dataExportHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, instanceId: undefined } })
    );
    mocks.runSelfExport.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'accepted' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const response = await dataExportHandler(
      new Request('http://localhost/iam/me/data-export?instanceId=de-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-1' },
        body: JSON.stringify({ format: 'json', async: 'true' }),
      })
    );

    expect(mocks.runSelfExport).toHaveBeenCalledWith({
      client: expect.anything(),
      instanceId: 'de-query',
      keycloakSubject: 'kc-user-1',
      exportRequest: {
        instanceId: undefined,
        format: 'json',
        async: true,
      },
      idempotencyKey: 'idem-1',
    });
    expect(response.status).toBe(202);
    await expect(expectJson(response)).resolves.toEqual({ status: 'accepted' });
  });

  it('rejects self exports without any resolvable instance context', async () => {
    const { dataExportHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, instanceId: undefined } })
    );

    const response = await dataExportHandler(
      new Request('http://localhost/iam/me/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-1' },
        body: JSON.stringify({ format: 'json', async: false }),
      })
    );

    expect(response.status).toBe(400);
    await expect(expectJson(response)).resolves.toEqual({ error: 'invalid_instance_id' });
  });

  it('rejects malformed self-export request bodies before touching the database', async () => {
    const { dataExportHandler } = await import('./core.js');

    const response = await dataExportHandler(
      new Request('http://localhost/iam/me/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-1' },
        body: '{',
      })
    );

    expect(response.status).toBe(400);
    await expect(expectJson(response)).resolves.toEqual({ error: 'invalid_request' });
    expect(mocks.withResolvedInstanceDb).not.toHaveBeenCalled();
  });

  it('rejects self exports when the requested instance leaves the authenticated scope', async () => {
    const { dataExportHandler } = await import('./core.js');

    const response = await dataExportHandler(
      new Request('http://localhost/iam/me/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-1' },
        body: JSON.stringify({ instanceId: 'other-instance', format: 'json', async: '1' }),
      })
    );

    expect(response.status).toBe(403);
    await expect(expectJson(response)).resolves.toEqual({ error: 'instance_scope_mismatch' });
    expect(mocks.withResolvedInstanceDb).not.toHaveBeenCalled();
  });

  it('rejects admin exports without a target subject', async () => {
    const { adminDataExportHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['iam_admin'] } })
    );

    const response = await adminDataExportHandler(
      new Request('http://localhost/iam/admin/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-1' },
        body: JSON.stringify({ format: 'json' }),
      })
    );

    expect(response.status).toBe(400);
    await expect(expectJson(response)).resolves.toEqual({ error: 'missing_target_keycloak_subject' });
  });

  it('rejects admin exports without a resolvable instance context', async () => {
    const { adminDataExportHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, instanceId: undefined, roles: ['iam_admin'] } })
    );

    const response = await adminDataExportHandler(
      new Request('http://localhost/iam/admin/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-1' },
        body: JSON.stringify({ format: 'json', targetKeycloakSubject: 'kc-target-1' }),
      })
    );

    expect(response.status).toBe(400);
    await expect(expectJson(response)).resolves.toEqual({ error: 'invalid_instance_id' });
  });

  it('rejects admin exports outside the authenticated instance scope', async () => {
    const { adminDataExportHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['iam_admin'] } })
    );

    const response = await adminDataExportHandler(
      new Request('http://localhost/iam/admin/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-1' },
        body: JSON.stringify({
          instanceId: 'other-instance',
          format: 'json',
          targetKeycloakSubject: 'kc-target-1',
        }),
      })
    );

    expect(response.status).toBe(403);
    await expect(expectJson(response)).resolves.toEqual({ error: 'instance_scope_mismatch' });
  });

  it('delegates admin exports and surfaces idempotency or database failures', async () => {
    const { adminDataExportHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['iam_admin'] } })
    );
    mocks.runAdminExport.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'accepted' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const accepted = await adminDataExportHandler(
      new Request('http://localhost/iam/admin/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-1' },
        body: JSON.stringify({ format: 'csv', targetKeycloakSubject: 'kc-target-1', async: false }),
      })
    );

    expect(mocks.runAdminExport).toHaveBeenCalledWith({
      client: expect.anything(),
      instanceId: 'de-test',
      actorKeycloakSubject: 'kc-user-1',
      exportRequest: {
        instanceId: undefined,
        targetKeycloakSubject: 'kc-target-1',
        format: 'csv',
        async: false,
      },
      idempotencyKey: 'idem-1',
    });
    expect(accepted.status).toBe(202);
    await expect(expectJson(accepted)).resolves.toEqual({ status: 'accepted' });

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['iam_admin'] } })
    );
    mocks.requireIdempotencyKey.mockReturnValueOnce({
      error: new Response(JSON.stringify({ error: 'missing_idempotency_key' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    });

    const missingKey = await adminDataExportHandler(
      new Request('http://localhost/iam/admin/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: 'json', targetKeycloakSubject: 'kc-target-1' }),
      })
    );

    expect(missingKey.status).toBe(400);
    await expect(expectJson(missingKey)).resolves.toEqual({ error: 'missing_idempotency_key' });

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['iam_admin'] } })
    );
    mocks.withResolvedInstanceDb.mockRejectedValueOnce(new Error('admin export down'));

    const unavailable = await adminDataExportHandler(
      new Request('http://localhost/iam/admin/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-1' },
        body: JSON.stringify({ format: 'json', targetKeycloakSubject: 'kc-target-1' }),
      })
    );

    expect(unavailable.status).toBe(503);
    await expect(expectJson(unavailable)).resolves.toEqual({ error: 'database_unavailable' });
  });

  it('redirects rectification requests to the dedicated profile correction endpoint', async () => {
    const { dataSubjectRequestHandler } = await import('./core.js');

    const response = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'rectification', payload: {} }),
      })
    );

    expect(response.status).toBe(400);
    await expect(expectJson(response)).resolves.toEqual({ error: 'use_profile_correction_endpoint' });
  });

  it('returns not_found when the requester account cannot be resolved', async () => {
    const { dataSubjectRequestHandler } = await import('./core.js');

    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, instanceId, work) =>
      work(buildDbClient({ account: null }))
    );

    const response = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'deletion', payload: { reason: 'cleanup' } }),
      })
    );

    expect(response.status).toBe(404);
    await expect(expectJson(response)).resolves.toEqual({ error: 'account_not_found' });
  });

  it('accepts generic access requests and maps request persistence failures to service unavailable', async () => {
    const { dataSubjectRequestHandler } = await import('./core.js');

    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, _instanceId, work) =>
      work(
        buildDbClient({
          account: buildAccount({ id: 'account-access', keycloak_subject: 'kc-user-1' }),
          requestIds: ['access-1'],
        })
      )
    );

    const accepted = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'access', payload: { scope: 'full' } }),
      })
    );

    expect(accepted.status).toBe(200);
    await expect(expectJson(accepted)).resolves.toEqual({
      requestId: 'access-1',
      status: 'accepted',
    });

    mocks.withResolvedInstanceDb.mockRejectedValueOnce(new Error('request persistence down'));

    const unavailable = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'access', payload: {} }),
      })
    );

    expect(unavailable.status).toBe(503);
    await expect(expectJson(unavailable)).resolves.toEqual({ error: 'database_unavailable' });
  });

  it('returns blocked_legal_hold when a deletion request hits an active hold', async () => {
    const { dataSubjectRequestHandler } = await import('./core.js');

    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, instanceId, work) =>
      work(
        buildDbClient({
          account: buildAccount({ id: 'account-42' }),
          hasLegalHold: true,
          requestIds: ['blocked-request-1'],
        })
      )
    );

    const response = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'deletion', payload: { reason: 'cleanup' } }),
      })
    );

    expect(response.status).toBe(200);
    await expect(expectJson(response)).resolves.toEqual({
      requestId: 'blocked-request-1',
      status: 'blocked_legal_hold',
    });
    expect(mocks.revokeUserSessions).not.toHaveBeenCalled();
  });

  it('revokes active sessions when a deletion request enters processing', async () => {
    const { dataSubjectRequestHandler } = await import('./core.js');
    const events: string[] = [];

    mocks.revokeUserSessions.mockImplementationOnce(async () => {
      events.push('revoke');
    });
    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, _instanceId, work) => {
      events.push('tx:start');
      const result = await work(
        buildDbClient({
          account: buildAccount({ id: 'account-77', keycloak_subject: 'kc-user-1' }),
          requestIds: ['deletion-request-1'],
        })
      );
      events.push('tx:end');
      return result;
    });

    const response = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'deletion', payload: { reason: 'cleanup' } }),
      })
    );

    expect(response.status).toBe(200);
    await expect(expectJson(response)).resolves.toEqual({
      requestId: 'deletion-request-1',
      status: 'processing',
    });
    expect(mocks.revokeUserSessions).toHaveBeenCalledWith({
      keycloakSubject: 'kc-user-1',
      reason: 'dsr_deletion_requested',
    });
    expect(events).toEqual(['tx:start', 'tx:end', 'revoke']);
  });

  it('blocks optional processing when restriction or objection flags are active', async () => {
    const { optionalProcessingExecuteHandler } = await import('./core.js');

    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, instanceId, work) =>
      work(
        buildDbClient({
          account: buildAccount({
            processing_restricted_at: '2026-05-01T10:00:00.000Z',
            non_essential_processing_opt_out_at: '2026-05-01T11:00:00.000Z',
          }),
        })
      )
    );

    const response = await optionalProcessingExecuteHandler(
      new Request('http://localhost/iam/me/optional-processing?instanceId=de-test')
    );

    expect(response.status).toBe(423);
    await expect(expectJson(response)).resolves.toEqual({
      error: 'processing_restricted',
      blockedByRestriction: true,
      blockedByObjection: true,
    });
  });

  it('completes restriction requests and persists the restriction reason', async () => {
    const { dataSubjectRequestHandler } = await import('./core.js');

    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, _instanceId, work) =>
      work(
        buildDbClient({
          account: buildAccount({ id: 'account-55', keycloak_subject: 'kc-user-1' }),
          requestIds: ['restriction-1'],
        })
      )
    );

    const response = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'restriction',
          payload: { reason: 'manual-review' },
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(expectJson(response)).resolves.toEqual({
      requestId: 'restriction-1',
      status: 'completed',
    });
  });

  it('completes objection requests and accepts an empty payload object', async () => {
    const { dataSubjectRequestHandler } = await import('./core.js');

    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, _instanceId, work) =>
      work(
        buildDbClient({
          account: buildAccount({ id: 'account-56', keycloak_subject: 'kc-user-1' }),
          requestIds: ['objection-1'],
        })
      )
    );

    const response = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'objection',
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(expectJson(response)).resolves.toEqual({
      requestId: 'objection-1',
      status: 'completed',
    });
  });

  it('rejects unsupported DSR request types and instance mismatches early', async () => {
    const { dataSubjectRequestHandler } = await import('./core.js');

    const invalidType = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'portability' }),
      })
    );

    expect(invalidType.status).toBe(400);
    await expect(expectJson(invalidType)).resolves.toEqual({ error: 'invalid_request_type' });

    const mismatch = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: 'other-instance', type: 'deletion', payload: {} }),
      })
    );

    expect(mismatch.status).toBe(403);
    await expect(expectJson(mismatch)).resolves.toEqual({ error: 'instance_scope_mismatch' });
    expect(mocks.withResolvedInstanceDb).not.toHaveBeenCalled();
  });

  it('allows optional processing when no restriction flags are active', async () => {
    const { optionalProcessingExecuteHandler } = await import('./core.js');

    const response = await optionalProcessingExecuteHandler(
      new Request('http://localhost/iam/me/optional-processing?instanceId=de-test')
    );

    expect(response.status).toBe(200);
    await expect(expectJson(response)).resolves.toEqual({
      status: 'ok',
      executed: true,
    });
  });

  it('returns account_not_found and database_unavailable for optional processing edge cases', async () => {
    const { optionalProcessingExecuteHandler } = await import('./core.js');

    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, _instanceId, work) => work(buildDbClient({ account: null })));

    const missingAccount = await optionalProcessingExecuteHandler(
      new Request('http://localhost/iam/me/optional-processing?instanceId=de-test')
    );

    expect(missingAccount.status).toBe(404);
    await expect(expectJson(missingAccount)).resolves.toEqual({ error: 'account_not_found' });

    mocks.withResolvedInstanceDb.mockRejectedValueOnce(new Error('optional processing db down'));

    const unavailable = await optionalProcessingExecuteHandler(
      new Request('http://localhost/iam/me/optional-processing?instanceId=de-test')
    );

    expect(unavailable.status).toBe(503);
    await expect(expectJson(unavailable)).resolves.toEqual({ error: 'database_unavailable' });
  });

  it('rejects invalid legal hold expiration timestamps before database access', async () => {
    const { legalHoldApplyHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['system_admin'] } })
    );

    const response = await legalHoldApplyHandler(
      new Request('http://localhost/iam/admin/legal-holds/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetKeycloakSubject: 'kc-target-1',
          holdUntil: 'not-a-date',
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(expectJson(response)).resolves.toEqual({ error: 'invalid_hold_until' });
    expect(mocks.withResolvedInstanceDb).not.toHaveBeenCalled();
  });

  it('returns target_account_not_found when applying a legal hold to an unknown subject', async () => {
    const { legalHoldApplyHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['system_admin'] } })
    );
    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, instanceId, work) =>
      work(buildDbClient({ account: null }))
    );

    const response = await legalHoldApplyHandler(
      new Request('http://localhost/iam/admin/legal-holds/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetKeycloakSubject: 'kc-target-1',
        }),
      })
    );

    expect(response.status).toBe(404);
    await expect(expectJson(response)).resolves.toEqual({ error: 'target_account_not_found' });
  });

  it('returns target_account_not_found when releasing a legal hold for an unknown subject', async () => {
    const { legalHoldReleaseHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['system_admin'] } })
    );
    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, instanceId, work) =>
      work(buildDbClient({ account: null }))
    );

    const response = await legalHoldReleaseHandler(
      new Request('http://localhost/iam/admin/legal-holds/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetKeycloakSubject: 'kc-target-1',
        }),
      })
    );

    expect(response.status).toBe(404);
    await expect(expectJson(response)).resolves.toEqual({ error: 'target_account_not_found' });
  });

  it('maps missing DSR account snapshots to not_found for self-service overview', async () => {
    const { getMyDataSubjectRightsHandler } = await import('./core.js');

    mocks.loadDsrSelfServiceOverview.mockRejectedValueOnce(new MockDsrAccountSnapshotNotFoundError('missing'));

    const response = await getMyDataSubjectRightsHandler(
      new Request('http://localhost/iam/me/data-subject-rights/overview?instanceId=de-test')
    );

    expect(response.status).toBe(404);
    await expect(expectJson(response)).resolves.toEqual({
      error: 'not_found',
      message: 'Konto nicht gefunden.',
      requestId: 'req-test',
    });
  });

  it('returns not_found and service unavailable branches for self-service overview account resolution', async () => {
    const { getMyDataSubjectRightsHandler } = await import('./core.js');

    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, _instanceId, work) =>
      work(buildDbClient({ account: null }))
    );

    const missingAccount = await getMyDataSubjectRightsHandler(
      new Request('http://localhost/iam/me/data-subject-rights/overview?instanceId=de-test')
    );

    expect(missingAccount.status).toBe(404);
    await expect(expectJson(missingAccount)).resolves.toEqual({
      error: 'not_found',
      message: 'Konto nicht gefunden.',
      requestId: 'req-test',
    });

    mocks.withResolvedInstanceDb.mockRejectedValueOnce(new Error('overview db down'));

    const unavailable = await getMyDataSubjectRightsHandler(
      new Request('http://localhost/iam/me/data-subject-rights/overview?instanceId=de-test')
    );

    expect(unavailable.status).toBe(503);
    await expect(expectJson(unavailable)).resolves.toEqual({
      error: 'database_unavailable',
      message: 'DSR-Daten konnten nicht geladen werden.',
      requestId: 'req-test',
    });
  });

  it('returns self-service privacy activity details for the authenticated account', async () => {
    const { getMyDataSubjectRightsCaseHandler } = await import('./core.js');

    const success = await getMyDataSubjectRightsCaseHandler(
      new Request('http://localhost/iam/me/data-subject-rights/cases/123e4567-e89b-42d3-a456-426614174000?instanceId=de-test')
    );
    expect(success.status).toBe(200);
    await expect(expectJson(success)).resolves.toEqual({
      data: { id: 'case-1', type: 'request' },
      requestId: 'req-test',
    });

    mocks.getSelfServiceActivityItem.mockResolvedValueOnce(null);
    const notFound = await getMyDataSubjectRightsCaseHandler(
      new Request('http://localhost/iam/me/data-subject-rights/cases/123e4567-e89b-42d3-a456-426614174000?instanceId=de-test')
    );
    expect(notFound.status).toBe(404);

    const invalidCaseId = await getMyDataSubjectRightsCaseHandler(
      new Request('http://localhost/iam/me/data-subject-rights/cases/not-a-uuid?instanceId=de-test')
    );
    expect(invalidCaseId.status).toBe(400);

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, instanceId: undefined } })
    );
    const missingInstance = await getMyDataSubjectRightsCaseHandler(
      new Request('http://localhost/iam/me/data-subject-rights/cases/123e4567-e89b-42d3-a456-426614174000')
    );
    expect(missingInstance.status).toBe(400);
  });

  it('passes dryRun through to the DSR maintenance runner', async () => {
    const { dataSubjectMaintenanceHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['support_admin'] } })
    );
    mocks.runDsrMaintenance.mockResolvedValueOnce({ dryRun: true, affected: 3 });

    const response = await dataSubjectMaintenanceHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      })
    );

    expect(mocks.runDsrMaintenance).toHaveBeenCalledWith(expect.anything(), {
      instanceId: 'de-test',
      dryRun: true,
    });
    expect(response.status).toBe(200);
    await expect(expectJson(response)).resolves.toEqual({ dryRun: true, affected: 3 });
  });

  it('rejects missing and mismatched instance scopes for DSR maintenance', async () => {
    const { dataSubjectMaintenanceHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, instanceId: undefined, roles: ['support_admin'] } })
    );

    const missingInstance = await dataSubjectMaintenanceHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      })
    );

    expect(missingInstance.status).toBe(400);
    await expect(expectJson(missingInstance)).resolves.toEqual({ error: 'invalid_instance_id' });

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['support_admin'] } })
    );

    const mismatch = await dataSubjectMaintenanceHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: 'other-instance', dryRun: false }),
      })
    );

    expect(mismatch.status).toBe(403);
    await expect(expectJson(mismatch)).resolves.toEqual({ error: 'instance_scope_mismatch' });
  });

  it('maps maintenance database failures to service unavailable', async () => {
    const { dataSubjectMaintenanceHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['support_admin'] } })
    );
    mocks.withResolvedInstanceDb.mockRejectedValueOnce(new Error('maintenance down'));

    const response = await dataSubjectMaintenanceHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      })
    );

    expect(response.status).toBe(503);
    await expect(expectJson(response)).resolves.toEqual({ error: 'database_unavailable' });
  });

  it('rejects invalid admin export status job ids before database access', async () => {
    const { adminDataExportStatusHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['iam_admin'] } })
    );

    const response = await adminDataExportStatusHandler(
      new Request('http://localhost/iam/admin/data-export/status?instanceId=de-test&jobId=not-a-uuid')
    );

    expect(response.status).toBe(400);
    await expect(expectJson(response)).resolves.toEqual({ error: 'invalid_job_id' });
    expect(mocks.withResolvedInstanceDb).not.toHaveBeenCalled();
  });

  it('rejects admin export status requests outside the user instance scope', async () => {
    const { adminDataExportStatusHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['iam_admin'] } })
    );

    const response = await adminDataExportStatusHandler(
      new Request(
        'http://localhost/iam/admin/data-export/status?instanceId=other-instance&jobId=123e4567-e89b-42d3-a456-426614174000'
      )
    );

    expect(response.status).toBe(403);
    await expect(expectJson(response)).resolves.toEqual({ error: 'instance_scope_mismatch' });
  });

  it('maps admin export status lookup failures to service unavailable', async () => {
    const { adminDataExportStatusHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['iam_admin'] } })
    );
    mocks.withResolvedInstanceDb.mockRejectedValueOnce(new Error('status db down'));

    const response = await adminDataExportStatusHandler(
      new Request(
        'http://localhost/iam/admin/data-export/status?instanceId=de-test&jobId=123e4567-e89b-42d3-a456-426614174000'
      )
    );

    expect(response.status).toBe(503);
    await expect(expectJson(response)).resolves.toEqual({ error: 'database_unavailable' });
  });

  it('requires DSR read permission for the DSR case list', async () => {
    const { listAdminDataSubjectRightsCasesHandler } = await import('./core.js');
    mocks.authorizeInstancePermissionForUser.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung für DSR-Transparenz.',
    });

    const response = await listAdminDataSubjectRightsCasesHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/cases?instanceId=de-test')
    );

    expect(response.status).toBe(403);
    await expect(expectJson(response)).resolves.toEqual({
      error: 'forbidden',
      message: 'Keine Berechtigung für DSR-Transparenz.',
      requestId: 'req-test',
    });
  });

  it('validates instance scope for the DSR case list and maps backend failures', async () => {
    const { listAdminDataSubjectRightsCasesHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, instanceId: undefined, roles: ['support_admin'] } })
    );

    const missingInstance = await listAdminDataSubjectRightsCasesHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/cases')
    );

    expect(missingInstance.status).toBe(400);
    await expect(expectJson(missingInstance)).resolves.toEqual({
      error: 'invalid_instance_id',
      message: 'Instanzkontext fehlt.',
      requestId: 'req-test',
    });

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['support_admin'] } })
    );

    const mismatch = await listAdminDataSubjectRightsCasesHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/cases?instanceId=other-instance')
    );

    expect(mismatch.status).toBe(403);
    await expect(expectJson(mismatch)).resolves.toEqual({
      error: 'forbidden',
      message: 'Instanzkontext unzulässig.',
      requestId: 'req-test',
    });

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['support_admin'] } })
    );
    mocks.withResolvedInstanceDb.mockRejectedValueOnce(new Error('case list down'));

    const unavailable = await listAdminDataSubjectRightsCasesHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/cases?instanceId=de-test')
    );

    expect(unavailable.status).toBe(503);
    await expect(expectJson(unavailable)).resolves.toEqual({
      error: 'database_unavailable',
      message: 'DSR-Fälle konnten nicht geladen werden.',
      requestId: 'req-test',
    });
  });

  it('delegates self export status lookups to the status handler', async () => {
    const { dataExportStatusHandler } = await import('./core.js');

    mocks.getSelfExportStatus.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ready' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const response = await dataExportStatusHandler(
      new Request('http://localhost/iam/me/data-export/status?instanceId=de-test&jobId=123e4567-e89b-12d3-a456-426614174000&download=json')
    );

    expect(mocks.getSelfExportStatus).toHaveBeenCalledWith({
      client: expect.anything(),
      instanceId: 'de-test',
      keycloakSubject: 'kc-user-1',
      jobId: '123e4567-e89b-12d3-a456-426614174000',
      downloadFormat: 'json',
    });
    expect(response.status).toBe(200);
    await expect(expectJson(response)).resolves.toEqual({ status: 'ready' });
  });

  it('rejects self export status lookups without a resolvable instance context', async () => {
    const { dataExportStatusHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, instanceId: undefined } })
    );

    const response = await dataExportStatusHandler(
      new Request('http://localhost/iam/me/data-export/status?jobId=123e4567-e89b-12d3-a456-426614174000')
    );

    expect(response.status).toBe(400);
    await expect(expectJson(response)).resolves.toEqual({ error: 'invalid_instance_id' });
  });

  it('maps self export status backend failures to service unavailable', async () => {
    const { dataExportStatusHandler } = await import('./core.js');

    mocks.withResolvedInstanceDb.mockRejectedValueOnce(new Error('status lookup down'));

    const response = await dataExportStatusHandler(
      new Request('http://localhost/iam/me/data-export/status?instanceId=de-test&jobId=123e4567-e89b-12d3-a456-426614174000')
    );

    expect(response.status).toBe(503);
    await expect(expectJson(response)).resolves.toEqual({ error: 'database_unavailable' });
  });

  it('rejects missing self export status job ids before database access', async () => {
    const { dataExportStatusHandler } = await import('./core.js');

    const response = await dataExportStatusHandler(
      new Request('http://localhost/iam/me/data-export/status?instanceId=de-test')
    );

    expect(response.status).toBe(400);
    await expect(expectJson(response)).resolves.toEqual({ error: 'invalid_job_id' });
    expect(mocks.withResolvedInstanceDb).not.toHaveBeenCalled();
  });

  it('returns encryption_not_configured when profile correction cannot encrypt fields', async () => {
    const { profileCorrectionHandler } = await import('./core.js');

    mocks.parseFieldEncryptionConfigFromEnv.mockReturnValueOnce(null);

    const response = await profileCorrectionHandler(
      new Request('http://localhost/iam/me/profile-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.test' }),
      })
    );

    expect(response.status).toBe(503);
    await expect(expectJson(response)).resolves.toEqual({ error: 'encryption_not_configured' });
    expect(mocks.withResolvedInstanceDb).not.toHaveBeenCalled();
  });

  it('rejects profile corrections without any changed profile fields', async () => {
    const { profileCorrectionHandler } = await import('./core.js');

    const response = await profileCorrectionHandler(
      new Request('http://localhost/iam/me/profile-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'noop' }),
      })
    );

    expect(response.status).toBe(400);
    await expect(expectJson(response)).resolves.toEqual({ error: 'missing_profile_fields' });
  });

  it('returns encryption_failed when one encrypted profile field cannot be produced', async () => {
    const { profileCorrectionHandler } = await import('./core.js');

    mocks.encryptFieldValue.mockImplementationOnce((value: string) => `enc:${value}`).mockImplementationOnce(() => {
      throw new Error('encryption failed');
    });

    const response = await profileCorrectionHandler(
      new Request('http://localhost/iam/me/profile-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'new@example.test',
          displayName: 'Broken Name',
        }),
      })
    );

    expect(response.status).toBe(500);
    await expect(expectJson(response)).resolves.toEqual({ error: 'encryption_failed' });
  });

  it('maps profile correction database failures to service unavailable', async () => {
    const { profileCorrectionHandler } = await import('./core.js');

    mocks.withResolvedInstanceDb.mockRejectedValueOnce(new Error('profile db down'));

    const response = await profileCorrectionHandler(
      new Request('http://localhost/iam/me/profile-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@example.test' }),
      })
    );

    expect(response.status).toBe(503);
    await expect(expectJson(response)).resolves.toEqual({ error: 'database_unavailable' });
  });

  it('persists profile corrections and returns a completed rectification request', async () => {
    const { profileCorrectionHandler } = await import('./core.js');

    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, instanceId, work) =>
      work(
        buildDbClient({
          account: buildAccount({
            id: 'account-77',
            keycloak_subject: 'kc-user-1',
            email_ciphertext: 'old-email',
            display_name_ciphertext: 'old-display',
          }),
          requestIds: ['rectify-1'],
        })
      )
    );

    const response = await profileCorrectionHandler(
      new Request('http://localhost/iam/me/profile-correction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'new@example.test',
          displayName: 'New Display Name',
          reason: 'fix-typo',
        }),
      })
    );

    expect(mocks.encryptFieldValue).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
    await expect(expectJson(response)).resolves.toEqual({
      status: 'ok',
      requestId: 'rectify-1',
    });
  });

  it('creates a legal hold and emits an audit event on success', async () => {
    const { legalHoldApplyHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['system_admin'] } })
    );
    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, instanceId, work) =>
      work(
        buildDbClient({
          account: buildAccount({ id: 'target-1', keycloak_subject: 'kc-target-1' }),
          legalHoldInsertId: 'hold-99',
        })
      )
    );

    const response = await legalHoldApplyHandler(
      new Request('http://localhost/iam/admin/legal-holds/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetKeycloakSubject: 'kc-target-1',
          holdReason: 'investigation',
          holdUntil: '2026-06-01T12:00:00.000Z',
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(expectJson(response)).resolves.toEqual({
      legalHoldId: 'hold-99',
      status: 'active',
    });
  });

  it('returns the released hold count when a legal hold is removed', async () => {
    const { legalHoldReleaseHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['system_admin'] } })
    );
    mocks.withResolvedInstanceDb.mockImplementationOnce(async (_resolver, instanceId, work) =>
      work(
        buildDbClient({
          account: buildAccount({ id: 'target-1', keycloak_subject: 'kc-target-1' }),
          releaseCount: 2,
        })
      )
    );

    const response = await legalHoldReleaseHandler(
      new Request('http://localhost/iam/admin/legal-holds/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetKeycloakSubject: 'kc-target-1',
          releaseReason: 'resolved',
        }),
      })
    );

    expect(response.status).toBe(200);
    await expect(expectJson(response)).resolves.toEqual({
      releasedCount: 2,
    });
  });

  it('maps legal hold apply backend failures to service unavailable', async () => {
    const { legalHoldApplyHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['system_admin'] } })
    );
    mocks.withResolvedInstanceDb.mockRejectedValueOnce(new Error('hold apply down'));

    const response = await legalHoldApplyHandler(
      new Request('http://localhost/iam/admin/legal-holds/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetKeycloakSubject: 'kc-target-1' }),
      })
    );

    expect(response.status).toBe(503);
    await expect(expectJson(response)).resolves.toEqual({ error: 'database_unavailable' });
  });

  it('requires DSR permissions for hold, maintenance and export endpoints', async () => {
    const { legalHoldApplyHandler, legalHoldReleaseHandler, dataSubjectMaintenanceHandler, adminDataExportHandler, adminDataExportStatusHandler } =
      await import('./core.js');

    mocks.authorizeInstancePermissionForUser
      .mockResolvedValueOnce({ ok: false, status: 403, error: 'forbidden', message: 'Keine Berechtigung.' })
      .mockResolvedValueOnce({ ok: false, status: 403, error: 'forbidden', message: 'Keine Berechtigung.' })
      .mockResolvedValueOnce({ ok: false, status: 403, error: 'forbidden', message: 'Keine Berechtigung.' })
      .mockResolvedValueOnce({ ok: false, status: 403, error: 'forbidden', message: 'Keine Berechtigung.' })
      .mockResolvedValueOnce({ ok: false, status: 403, error: 'forbidden', message: 'Keine Berechtigung.' });

    const apply = await legalHoldApplyHandler(
      new Request('http://localhost/iam/admin/legal-holds/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetKeycloakSubject: 'kc-target-1' }),
      })
    );
    expect(apply.status).toBe(403);
    await expect(expectJson(apply)).resolves.toEqual({ error: 'forbidden' });

    const release = await legalHoldReleaseHandler(
      new Request('http://localhost/iam/admin/legal-holds/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetKeycloakSubject: 'kc-target-1' }),
      })
    );
    expect(release.status).toBe(403);
    await expect(expectJson(release)).resolves.toEqual({ error: 'forbidden' });

    const maintenance = await dataSubjectMaintenanceHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      })
    );
    expect(maintenance.status).toBe(403);
    await expect(expectJson(maintenance)).resolves.toEqual({ error: 'forbidden' });

    const adminExport = await adminDataExportHandler(
      new Request('http://localhost/iam/admin/data-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'idem-1' },
        body: JSON.stringify({ format: 'json', targetKeycloakSubject: 'kc-target-1' }),
      })
    );
    expect(adminExport.status).toBe(403);
    await expect(expectJson(adminExport)).resolves.toEqual({ error: 'forbidden' });

    const adminStatus = await adminDataExportStatusHandler(
      new Request('http://localhost/iam/admin/data-export/status?instanceId=de-test&jobId=123e4567-e89b-42d3-a456-426614174000')
    );
    expect(adminStatus.status).toBe(403);
    await expect(expectJson(adminStatus)).resolves.toEqual({ error: 'forbidden' });
  });

  it('maps legal hold release backend failures to service unavailable', async () => {
    const { legalHoldReleaseHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['system_admin'] } })
    );
    mocks.withResolvedInstanceDb.mockRejectedValueOnce(new Error('hold release down'));

    const response = await legalHoldReleaseHandler(
      new Request('http://localhost/iam/admin/legal-holds/release', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetKeycloakSubject: 'kc-target-1' }),
      })
    );

    expect(response.status).toBe(503);
    await expect(expectJson(response)).resolves.toEqual({ error: 'database_unavailable' });
  });

  it('rejects admin export status lookups without a resolvable instance context', async () => {
    const { adminDataExportStatusHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, instanceId: undefined, roles: ['iam_admin'] } })
    );

    const response = await adminDataExportStatusHandler(
      new Request('http://localhost/iam/admin/data-export/status?jobId=123e4567-e89b-42d3-a456-426614174000')
    );

    expect(response.status).toBe(400);
    await expect(expectJson(response)).resolves.toEqual({ error: 'invalid_instance_id' });
  });

  it('delegates admin export status lookups to the status handler', async () => {
    const { adminDataExportStatusHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['iam_admin'] } })
    );
    mocks.getAdminExportStatus.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ready' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const response = await adminDataExportStatusHandler(
      new Request('http://localhost/iam/admin/data-export/status?instanceId=de-test&jobId=123e4567-e89b-42d3-a456-426614174000&download=csv')
    );

    expect(mocks.getAdminExportStatus).toHaveBeenCalledWith({
      client: expect.anything(),
      instanceId: 'de-test',
      jobId: '123e4567-e89b-42d3-a456-426614174000',
      downloadFormat: 'csv',
    });
    expect(response.status).toBe(200);
    await expect(expectJson(response)).resolves.toEqual({ status: 'ready' });
  });

  it('lists admin DSR cases with normalized paging and filters', async () => {
    const { listAdminDataSubjectRightsCasesHandler } = await import('./core.js');

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['support_admin'] } })
    );
    mocks.readPage.mockReturnValueOnce({ page: 2, pageSize: 10 });
    mocks.listAdminDsrCases.mockResolvedValueOnce({
      items: [{ id: 'case-1' }, { id: 'case-2' }],
      total: 2,
    });

    const response = await listAdminDataSubjectRightsCasesHandler(
      new Request(
        'http://localhost/iam/admin/data-subject-rights/cases?instanceId=de-test&type=deletion&status=accepted&search=alice'
      )
    );

    expect(mocks.listAdminDsrCases).toHaveBeenCalledWith(expect.anything(), {
      instanceId: 'de-test',
      page: 2,
      pageSize: 10,
      search: 'alice',
      type: 'deletion',
      status: 'accepted',
    });
    expect(response.status).toBe(200);
    await expect(expectJson(response)).resolves.toEqual({
      data: [{ id: 'case-1' }, { id: 'case-2' }],
      page: { page: 2, pageSize: 10, total: 2 },
      requestId: 'req-test',
    });
  });

  it('guards admin DSR case detail and maps not-found or backend failures', async () => {
    const { getAdminDataSubjectRightsCaseHandler } = await import('./core.js');
    mocks.authorizeInstancePermissionForUser.mockResolvedValueOnce({
      ok: false,
      status: 403,
      error: 'forbidden',
      message: 'Keine Berechtigung für DSR-Transparenz.',
    });

    const forbidden = await getAdminDataSubjectRightsCaseHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/cases/123e4567-e89b-42d3-a456-426614174000?instanceId=de-test')
    );
    expect(forbidden.status).toBe(403);

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, instanceId: undefined, roles: ['support_admin'] } })
    );
    const missingInstance = await getAdminDataSubjectRightsCaseHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/cases/123e4567-e89b-42d3-a456-426614174000')
    );
    expect(missingInstance.status).toBe(400);

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['support_admin'] } })
    );
    const invalidCaseId = await getAdminDataSubjectRightsCaseHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/cases/not-a-uuid?instanceId=de-test')
    );
    expect(invalidCaseId.status).toBe(400);

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['support_admin'] } })
    );
    const success = await getAdminDataSubjectRightsCaseHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/cases/123e4567-e89b-42d3-a456-426614174000?instanceId=de-test')
    );
    expect(success.status).toBe(200);
    await expect(expectJson(success)).resolves.toEqual({
      data: { id: 'case-1' },
      requestId: 'req-test',
    });

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['support_admin'] } })
    );
    mocks.getAdminDsrCase.mockResolvedValueOnce(null);
    const notFound = await getAdminDataSubjectRightsCaseHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/cases/123e4567-e89b-42d3-a456-426614174000?instanceId=de-test')
    );
    expect(notFound.status).toBe(404);

    mocks.withAuthenticatedUser.mockImplementationOnce(async (_request, handler) =>
      handler({ user: { ...baseUser, roles: ['support_admin'] } })
    );
    mocks.withResolvedInstanceDb.mockRejectedValueOnce(new Error('case detail down'));
    const unavailable = await getAdminDataSubjectRightsCaseHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/cases/123e4567-e89b-42d3-a456-426614174000?instanceId=de-test')
    );
    expect(unavailable.status).toBe(503);
    await expect(expectJson(unavailable)).resolves.toMatchObject({
      error: 'database_unavailable',
    });
  });
});
