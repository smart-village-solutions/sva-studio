import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  withResolvedInstanceDb: vi.fn(),
  createPoolResolver: vi.fn(() => () => null),
  getIamDatabaseUrl: vi.fn(() => 'postgres://db.example/sva'),
  createStudioJob: vi.fn(),
  markStudioJobEnqueueFailed: vi.fn(),
  queueStudioJob: vi.fn(),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'req-test' })),
  collectDsrExportPayload: vi.fn(),
  serializeDsrExportPayload: vi.fn((format: string) => `${format}-payload`),
}));

vi.mock('../db.js', () => ({
  createPoolResolver: mocks.createPoolResolver,
  withResolvedInstanceDb: mocks.withResolvedInstanceDb,
}));

vi.mock('../runtime-secrets.js', () => ({
  getIamDatabaseUrl: mocks.getIamDatabaseUrl,
}));

vi.mock('../plugin-operations/core.shared.js', () => ({
  createStudioJob: mocks.createStudioJob,
  markStudioJobEnqueueFailed: mocks.markStudioJobEnqueueFailed,
}));

vi.mock('../plugin-operations/runner.js', () => ({
  queueStudioJob: mocks.queueStudioJob,
}));

vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: mocks.getWorkspaceContext,
}));

vi.mock('@sva/iam-governance/dsr-export-payload', () => ({
  collectDsrExportPayload: mocks.collectDsrExportPayload,
  serializeDsrExportPayload: mocks.serializeDsrExportPayload,
}));

describe('dsr export worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries export rows that are already marked failed by an earlier attempt', async () => {
    const exportJobRow = {
      id: 'export-1',
      target_account_id: 'account-1',
      format: 'csv' as const,
      status: 'failed' as const,
    };
    const accountRow = {
      id: 'account-1',
      keycloak_subject: 'kc-user-1',
      email_ciphertext: 'enc:v1:test',
      display_name_ciphertext: 'enc:v1:test',
      is_blocked: false,
      soft_deleted_at: null,
      delete_after: null,
      permanently_deleted_at: null,
      processing_restricted_at: null,
      processing_restriction_reason: null,
      non_essential_processing_opt_out_at: null,
      created_at: '2026-06-03T10:00:00.000Z',
      updated_at: '2026-06-03T10:00:00.000Z',
    };
    const query = vi.fn(async (text: string) => {
      if (text.includes('FROM iam.data_subject_export_jobs')) {
        return { rowCount: 1, rows: [exportJobRow] };
      }
      if (text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [accountRow] };
      }
      if (text.includes("status = 'completed'")) {
        return { rowCount: 1, rows: [] };
      }
      throw new Error(`unexpected query: ${text}`);
    });
    mocks.withResolvedInstanceDb.mockImplementation(async (_resolver, _instanceId, work) => work({ query }));
    mocks.collectDsrExportPayload.mockResolvedValue({
      meta: { generatedAt: '2026-06-03T10:05:00.000Z', instanceId: 'tenant-a', format: 'csv' },
      account: {
        id: 'account-1',
        isBlocked: false,
        createdAt: '2026-06-03T10:00:00.000Z',
        updatedAt: '2026-06-03T10:00:00.000Z',
      },
      organizations: [],
      roles: [],
      groups: [],
      legalHolds: [],
      dsrRequests: [],
      legalAcceptances: [],
      consents: { nonEssentialProcessingAllowed: true },
    });

    const { dsrExportStudioJobRegistration } = await import('./export-worker.js');
    const progressReporter = { reportProgress: vi.fn(async () => undefined) };

    const result = await dsrExportStudioJobRegistration.handler({
      job: {
        id: 'studio-job-1',
        instanceId: 'tenant-a',
        source: 'host',
        jobTypeId: 'dsr.export',
        queueName: 'host-operations',
        status: 'running',
        inputPayload: { exportJobId: 'export-1' },
        attempts: 0,
        maxAttempts: 3,
        idempotencyKey: 'idem-1',
        scheduledAt: '2026-06-03T10:00:00.000Z',
        createdAt: '2026-06-03T10:00:00.000Z',
        updatedAt: '2026-06-03T10:00:00.000Z',
      },
      progressReporter,
    } as never);

    expect(mocks.collectDsrExportPayload).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        instanceId: 'tenant-a',
        format: 'csv',
      })
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status = 'completed'"),
      expect.any(Array)
    );
    expect(result).toEqual(
      expect.objectContaining({
        progress: expect.objectContaining({
          currentStepKey: 'export-ready',
        }),
      })
    );
  });
});
