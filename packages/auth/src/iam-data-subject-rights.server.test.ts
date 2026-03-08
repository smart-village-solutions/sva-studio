import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  user: {
    id: 'keycloak-sub-1',
    name: 'User',
    roles: ['member'],
    instanceId: '11111111-1111-1111-8111-111111111111',
  },
  queryHandler: null as null | ((text: string, values?: readonly unknown[]) => { rowCount: number; rows: unknown[] }),
  encryptionConfig: {
    activeKeyId: 'k1',
    keyring: { k1: 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=' },
  } as { activeKeyId: string; keyring: Record<string, string> } | null,
  encryptFieldValueImpl: null as null | ((value: string) => string),
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
  createSdkLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getWorkspaceContext: () => ({
    workspaceId: state.user.instanceId,
    requestId: 'req-dsr-test',
    traceId: 'trace-dsr-test',
  }),
  withRequestContext: async (_opts: unknown, handler: () => Promise<Response> | Response) => handler(),
}));

vi.mock('@sva/core/security', async () => {
  return {
    parseFieldEncryptionConfigFromEnv: () => state.encryptionConfig,
    decryptFieldValue: vi.fn(() => 'decrypted-value'),
    encryptFieldValue: vi.fn((value: string) => {
      if (state.encryptFieldValueImpl) {
        return state.encryptFieldValueImpl(value);
      }
      return 'enc:v1:k1:iv:tag:ciphertext';
    }),
  };
});

vi.mock('pg', () => ({
  Pool: class MockPool {
    async connect() {
      return {
        async query(text: string, values?: readonly unknown[]) {
          if (state.queryHandler) {
            const handled = state.queryHandler(text, values);
            if (handled) {
              return handled;
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
  adminDataExportHandler,
  adminDataExportStatusHandler,
  dataExportHandler,
  dataExportStatusHandler,
  dataSubjectMaintenanceHandler,
  dataSubjectRequestHandler,
  legalHoldApplyHandler,
  legalHoldReleaseHandler,
  optionalProcessingExecuteHandler,
  profileCorrectionHandler,
} from './iam-data-subject-rights.server';

describe('iam data subject rights handlers', () => {
  beforeEach(() => {
    process.env.IAM_DATABASE_URL = 'postgres://iam-test';
    delete process.env.IAM_DSR_DELETE_RETENTION_HOURS;
    state.user = {
      id: 'keycloak-sub-1',
      name: 'User',
      roles: ['member'],
      instanceId: '11111111-1111-1111-8111-111111111111',
    };
    state.queryHandler = null;
    state.encryptionConfig = {
      activeKeyId: 'k1',
      keyring: { k1: 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=' },
    };
    state.encryptFieldValueImpl = null;
  });

  it('returns sync self export as JSON with account, orgs and roles', async () => {
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.accounts a')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'acc-1',
              keycloak_subject: 'keycloak-sub-1',
              email_ciphertext: 'enc:v1:k1:iv:tag:cipher',
              display_name_ciphertext: 'enc:v1:k1:iv:tag:cipher2',
              is_blocked: false,
              soft_deleted_at: null,
              delete_after: null,
              permanently_deleted_at: null,
              processing_restricted_at: null,
              processing_restriction_reason: null,
              non_essential_processing_opt_out_at: null,
              created_at: '2026-02-28T10:00:00.000Z',
              updated_at: '2026-02-28T10:00:00.000Z',
            },
          ],
        };
      }
      if (text.includes('FROM iam.account_organizations')) {
        return {
          rowCount: 1,
          rows: [{ id: 'org-1', organization_key: 'org-main', display_name: 'Main Org' }],
        };
      }
      if (text.includes('FROM iam.account_roles')) {
        return {
          rowCount: 1,
          rows: [{ id: 'role-1', role_name: 'editor', description: 'Editor role' }],
        };
      }
      if (text.includes('FROM iam.legal_holds')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('FROM iam.data_subject_requests')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('INSERT INTO iam.data_subject_requests')) {
        return { rowCount: 1, rows: [{ id: 'req-access-1' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await dataExportHandler(
      new Request('http://localhost/iam/me/data-export?format=json', { method: 'GET' })
    );

    expect(response.status).toBe(200);
    const payload = JSON.parse(await response.text()) as { account: { keycloakSubject: string }; organizations: unknown[]; roles: unknown[] };
    expect(payload.account.keycloakSubject).toBe('keycloak-sub-1');
    expect(payload.organizations).toHaveLength(1);
    expect(payload.roles).toHaveLength(1);
  });

  it('creates async export job with queued status', async () => {
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.accounts a')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'acc-1',
              keycloak_subject: 'keycloak-sub-1',
              email_ciphertext: null,
              display_name_ciphertext: null,
              is_blocked: false,
              soft_deleted_at: null,
              delete_after: null,
              permanently_deleted_at: null,
              processing_restricted_at: null,
              processing_restriction_reason: null,
              non_essential_processing_opt_out_at: null,
              created_at: '2026-02-28T10:00:00.000Z',
              updated_at: '2026-02-28T10:00:00.000Z',
            },
          ],
        };
      }
      if (text.includes('INSERT INTO iam.data_subject_export_jobs')) {
        return { rowCount: 1, rows: [{ id: 'job-1', status: 'queued' }] };
      }
      if (text.includes('INSERT INTO iam.data_subject_requests')) {
        return { rowCount: 1, rows: [{ id: 'req-1' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await dataExportHandler(
      new Request('http://localhost/iam/me/data-export?format=csv&async=true', { method: 'GET' })
    );
    const payload = (await response.json()) as { status: string; exportJobId: string };

    expect(response.status).toBe(202);
    expect(payload.status).toBe('queued');
    expect(payload.exportJobId).toBe('job-1');
  });

  it('rejects export for invalid format', async () => {
    const response = await dataExportHandler(
      new Request('http://localhost/iam/me/data-export?format=invalid', { method: 'GET' })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_export_format' });
  });

  it('rejects export status when job id is invalid', async () => {
    const response = await dataExportStatusHandler(
      new Request('http://localhost/iam/me/data-export/status?jobId=invalid', { method: 'GET' })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_job_id' });
  });

  it('exports csv format with flattened key-value rows', async () => {
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.accounts a')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'acc-1',
              keycloak_subject: 'keycloak-sub-1',
              email_ciphertext: null,
              display_name_ciphertext: null,
              is_blocked: false,
              soft_deleted_at: null,
              delete_after: null,
              permanently_deleted_at: null,
              processing_restricted_at: null,
              processing_restriction_reason: null,
              non_essential_processing_opt_out_at: null,
              created_at: '2026-02-28T10:00:00.000Z',
              updated_at: '2026-02-28T10:00:00.000Z',
            },
          ],
        };
      }
      if (text.includes('FROM iam.account_organizations')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('FROM iam.account_roles')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('FROM iam.legal_holds')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('FROM iam.data_subject_requests')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('INSERT INTO iam.data_subject_requests')) {
        return { rowCount: 1, rows: [{ id: 'req-export-csv' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await dataExportHandler(
      new Request('http://localhost/iam/me/data-export?format=csv', { method: 'GET' })
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('field,value');
    expect(body).toContain('account.keycloakSubject,keycloak-sub-1');
  });

  it('blocks deletion request when legal hold is active', async () => {
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.accounts a')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'acc-1',
              keycloak_subject: 'keycloak-sub-1',
              email_ciphertext: null,
              display_name_ciphertext: null,
              is_blocked: false,
              soft_deleted_at: null,
              delete_after: null,
              permanently_deleted_at: null,
              processing_restricted_at: null,
              processing_restriction_reason: null,
              non_essential_processing_opt_out_at: null,
              created_at: '2026-02-28T10:00:00.000Z',
              updated_at: '2026-02-28T10:00:00.000Z',
            },
          ],
        };
      }
      if (text.includes('FROM iam.legal_holds')) {
        return { rowCount: 1, rows: [{ id: 'hold-1' }] };
      }
      if (text.includes('INSERT INTO iam.data_subject_requests')) {
        return { rowCount: 1, rows: [{ id: 'req-delete-1' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'deletion',
          instanceId: '11111111-1111-1111-8111-111111111111',
          payload: { reason: 'user_request' },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      requestId: 'req-delete-1',
      status: 'blocked_legal_hold',
    });
  });

  it('blocks optional processing when restriction is active', async () => {
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.accounts a')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'acc-1',
              keycloak_subject: 'keycloak-sub-1',
              email_ciphertext: null,
              display_name_ciphertext: null,
              is_blocked: false,
              soft_deleted_at: null,
              delete_after: null,
              permanently_deleted_at: null,
              processing_restricted_at: '2026-02-28T10:00:00.000Z',
              processing_restriction_reason: 'pending_verification',
              non_essential_processing_opt_out_at: null,
              created_at: '2026-02-28T10:00:00.000Z',
              updated_at: '2026-02-28T10:00:00.000Z',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await optionalProcessingExecuteHandler(
      new Request('http://localhost/iam/me/optional-processing/execute', {
        method: 'POST',
      })
    );
    const payload = (await response.json()) as { error: string; blockedByRestriction: boolean };

    expect(response.status).toBe(423);
    expect(payload.error).toBe('processing_restricted');
    expect(payload.blockedByRestriction).toBe(true);
  });

  it('creates Art.-19 recipient notification evidence for restriction requests', async () => {
    const executedStatements: string[] = [];
    state.queryHandler = (text) => {
      executedStatements.push(text);
      if (text.includes('FROM iam.accounts a')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'acc-1',
              keycloak_subject: 'keycloak-sub-1',
              email_ciphertext: null,
              display_name_ciphertext: null,
              is_blocked: false,
              soft_deleted_at: null,
              delete_after: null,
              permanently_deleted_at: null,
              processing_restricted_at: null,
              processing_restriction_reason: null,
              non_essential_processing_opt_out_at: null,
              created_at: '2026-02-28T10:00:00.000Z',
              updated_at: '2026-02-28T10:00:00.000Z',
            },
          ],
        };
      }
      if (text.includes('INSERT INTO iam.data_subject_requests')) {
        return { rowCount: 1, rows: [{ id: 'req-restriction-1' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'restriction',
          instanceId: '11111111-1111-1111-8111-111111111111',
          payload: { reason: 'verification_pending' },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(executedStatements.some((entry) => entry.includes('INSERT INTO iam.data_subject_recipient_notifications'))).toBe(true);
  });

  it('processes maintenance run and reports SLA escalations', async () => {
    state.user = {
      ...state.user,
      roles: ['iam_admin'],
    };

    state.queryHandler = (text) => {
      if (text.includes('FROM iam.data_subject_export_jobs') && text.includes("status = 'queued'")) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('FROM iam.data_subject_requests') && text.includes("request_type = 'deletion'")) {
        return { rowCount: 1, rows: [{ id: 'req-overdue-1', target_account_id: 'acc-1' }] };
      }
      if (text.includes('FROM iam.accounts') && text.includes('delete_after <= NOW()')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('FROM iam.data_subject_recipient_notifications')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await dataSubjectMaintenanceHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/maintenance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instanceId: '11111111-1111-1111-8111-111111111111',
          dryRun: false,
        }),
      })
    );

    const payload = (await response.json()) as { queuedExports: number; escalated: number; finalizedDeletions: number };
    expect(response.status).toBe(200);
    expect(payload.queuedExports).toBe(0);
    expect(payload.escalated).toBe(1);
    expect(payload.finalizedDeletions).toBe(0);
  });

  it('finalizes eligible deletions and pseudonymizes audit log references', async () => {
    state.user = {
      ...state.user,
      roles: ['iam_admin'],
    };

    const executedStatements: string[] = [];
    state.queryHandler = (text) => {
      executedStatements.push(text);
      if (text.includes('FROM iam.data_subject_export_jobs') && text.includes("status = 'queued'")) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('FROM iam.data_subject_requests') && text.includes("request_type = 'deletion'")) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('FROM iam.accounts') && text.includes('delete_after <= NOW()')) {
        return { rowCount: 1, rows: [{ id: 'acc-1', keycloak_subject: 'keycloak-sub-1' }] };
      }
      if (text.includes('FROM iam.legal_holds')) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes('FROM iam.data_subject_recipient_notifications')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await dataSubjectMaintenanceHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/maintenance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instanceId: '11111111-1111-1111-8111-111111111111',
          dryRun: false,
        }),
      })
    );
    const payload = (await response.json()) as { finalizedDeletions: number };

    expect(response.status).toBe(200);
    expect(payload.finalizedDeletions).toBe(1);
    expect(executedStatements.some((entry) => entry.includes('UPDATE iam.activity_logs'))).toBe(true);
    expect(executedStatements.some((entry) => entry.includes('DELETE FROM iam.account_roles'))).toBe(true);
    expect(executedStatements.some((entry) => entry.includes('DELETE FROM iam.account_organizations'))).toBe(true);
    expect(
      executedStatements.some(
        (entry) =>
          entry.includes('FROM iam.accounts') &&
          entry.includes('WHERE instance_id = $1') &&
          entry.includes('delete_after <= NOW()')
      )
    ).toBe(true);
    expect(
      executedStatements.some(
        (entry) => entry.includes('UPDATE iam.accounts') && entry.includes('WHERE instance_id = $1')
      )
    ).toBe(true);
  });

  it('rejects admin export endpoint for non-admin role', async () => {
    const response = await adminDataExportHandler(
      new Request(
        'http://localhost/iam/admin/data-subject-rights/export?instanceId=11111111-1111-1111-8111-111111111111&targetKeycloakSubject=user-2&format=json',
        { method: 'GET' }
      )
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
  });

  it('rejects admin export status endpoint for non-admin role', async () => {
    const response = await adminDataExportStatusHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/export/status?jobId=aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa', {
        method: 'GET',
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'forbidden' });
  });

  it('rejects legal hold apply with invalid holdUntil', async () => {
    state.user = {
      ...state.user,
      roles: ['iam_admin'],
    };

    const response = await legalHoldApplyHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/legal-holds/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instanceId: '11111111-1111-1111-8111-111111111111',
          targetKeycloakSubject: 'keycloak-sub-2',
          holdUntil: 'not-a-date',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_hold_until' });
  });

  it('rejects legal hold release when target subject is missing', async () => {
    state.user = {
      ...state.user,
      roles: ['iam_admin'],
    };

    const response = await legalHoldReleaseHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/legal-holds/release', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instanceId: '11111111-1111-1111-8111-111111111111',
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'missing_target_keycloak_subject' });
  });

  it('downloads completed self export jobs as csv', async () => {
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ id: 'acc-1' }] };
      }
      if (text.includes('FROM iam.data_subject_export_jobs')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa',
              format: 'csv',
              status: 'completed',
              error_message: null,
              payload_json: null,
              payload_csv: 'field,value\naccount.id,acc-1',
              payload_xml: null,
              created_at: '2026-03-01T10:00:00.000Z',
              completed_at: '2026-03-01T10:05:00.000Z',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await dataExportStatusHandler(
      new Request(
        'http://localhost/iam/me/data-export/status?jobId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&download=csv',
        { method: 'GET' }
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(await response.text()).toContain('account.id,acc-1');
  });

  it('returns export_job_not_found when self export job does not exist', async () => {
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.accounts a')) {
        return { rowCount: 1, rows: [{ id: 'acc-1' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await dataExportStatusHandler(
      new Request(
        'http://localhost/iam/me/data-export/status?jobId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        { method: 'GET' }
      )
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'export_job_not_found' });
  });

  it('returns account_not_found for self export status without requester account', async () => {
    const response = await dataExportStatusHandler(
      new Request(
        'http://localhost/iam/me/data-export/status?jobId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        { method: 'GET' }
      )
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'account_not_found' });
  });

  it('rejects data subject rectification requests on the generic endpoint', async () => {
    const response = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'rectification',
          instanceId: '11111111-1111-1111-8111-111111111111',
          payload: { displayName: 'Updated User' },
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'use_profile_correction_endpoint' });
  });

  it('processes objection requests and blocks optional processing by objection', async () => {
    let accountLookupCount = 0;
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.accounts a')) {
        accountLookupCount += 1;
        if (accountLookupCount === 1) {
          return {
            rowCount: 1,
            rows: [
              {
                id: 'acc-1',
                keycloak_subject: 'keycloak-sub-1',
                email_ciphertext: null,
                display_name_ciphertext: null,
                is_blocked: false,
                soft_deleted_at: null,
                delete_after: null,
                permanently_deleted_at: null,
                processing_restricted_at: null,
                processing_restriction_reason: null,
                non_essential_processing_opt_out_at: null,
                created_at: '2026-02-28T10:00:00.000Z',
                updated_at: '2026-02-28T10:00:00.000Z',
              },
            ],
          };
        }
        return {
          rowCount: 1,
          rows: [
            {
              id: 'acc-1',
              keycloak_subject: 'keycloak-sub-1',
              email_ciphertext: null,
              display_name_ciphertext: null,
              is_blocked: false,
              soft_deleted_at: null,
              delete_after: null,
              permanently_deleted_at: null,
              processing_restricted_at: null,
              processing_restriction_reason: null,
              non_essential_processing_opt_out_at: '2026-03-02T10:00:00.000Z',
              created_at: '2026-02-28T10:00:00.000Z',
              updated_at: '2026-03-02T10:00:00.000Z',
            },
          ],
        };
      }
      if (text.includes('INSERT INTO iam.data_subject_requests')) {
        return { rowCount: 1, rows: [{ id: 'req-objection-1' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const requestResponse = await dataSubjectRequestHandler(
      new Request('http://localhost/iam/me/data-subject-rights/requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'objection',
          instanceId: '11111111-1111-1111-8111-111111111111',
          payload: { reason: 'marketing_opt_out' },
        }),
      })
    );

    expect(requestResponse.status).toBe(200);
    expect(await requestResponse.json()).toEqual({
      requestId: 'req-objection-1',
      status: 'completed',
    });

    const processingResponse = await optionalProcessingExecuteHandler(
      new Request('http://localhost/iam/me/optional-processing/execute', { method: 'POST' })
    );
    const processingPayload = (await processingResponse.json()) as {
      error: string;
      blockedByRestriction: boolean;
      blockedByObjection: boolean;
    };

    expect(processingResponse.status).toBe(423);
    expect(processingPayload).toEqual({
      error: 'processing_restricted',
      blockedByRestriction: false,
      blockedByObjection: true,
    });
  });

  it('rejects profile correction when encryption is not configured', async () => {
    state.encryptionConfig = null;

    const response = await profileCorrectionHandler(
      new Request('http://localhost/iam/me/profile-correction', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instanceId: '11111111-1111-1111-8111-111111111111',
          email: 'user@example.com',
        }),
      })
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'encryption_not_configured' });
  });

  it('rejects profile correction when encryption fails', async () => {
    state.encryptFieldValueImpl = () => {
      throw new Error('boom');
    };
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.accounts a')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'acc-1',
              keycloak_subject: 'keycloak-sub-1',
              email_ciphertext: 'enc:old-email',
              display_name_ciphertext: 'enc:old-name',
              is_blocked: false,
              soft_deleted_at: null,
              delete_after: null,
              permanently_deleted_at: null,
              processing_restricted_at: null,
              processing_restriction_reason: null,
              non_essential_processing_opt_out_at: null,
              created_at: '2026-02-28T10:00:00.000Z',
              updated_at: '2026-02-28T10:00:00.000Z',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await profileCorrectionHandler(
      new Request('http://localhost/iam/me/profile-correction', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instanceId: '11111111-1111-1111-8111-111111111111',
          email: 'user@example.com',
        }),
      })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'encryption_failed' });
  });

  it('returns target_account_not_found when applying a legal hold for an unknown subject', async () => {
    state.user = {
      ...state.user,
      roles: ['iam_admin'],
    };

    const response = await legalHoldApplyHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/legal-holds/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instanceId: '11111111-1111-1111-8111-111111111111',
          targetKeycloakSubject: 'missing-subject',
        }),
      })
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'target_account_not_found' });
  });

  it('releases active legal holds for a target account', async () => {
    state.user = {
      ...state.user,
      roles: ['iam_admin'],
    };

    state.queryHandler = (text, values) => {
      if (text.includes('FROM iam.accounts a')) {
        const keycloakSubject = values?.[1];
        if (keycloakSubject === 'keycloak-sub-2') {
          return {
            rowCount: 1,
            rows: [
              {
                id: 'acc-2',
                keycloak_subject: 'keycloak-sub-2',
                email_ciphertext: null,
                display_name_ciphertext: null,
                is_blocked: false,
                soft_deleted_at: null,
                delete_after: null,
                permanently_deleted_at: null,
                processing_restricted_at: null,
                processing_restriction_reason: null,
                non_essential_processing_opt_out_at: null,
                created_at: '2026-02-28T10:00:00.000Z',
                updated_at: '2026-02-28T10:00:00.000Z',
              },
            ],
          };
        }
        if (keycloakSubject === 'keycloak-sub-1') {
          return { rowCount: 1, rows: [{ id: 'acc-1' }] };
        }
      }
      if (text.includes('UPDATE iam.legal_holds')) {
        return { rowCount: 1, rows: [{ id: 'hold-1' }] };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await legalHoldReleaseHandler(
      new Request('http://localhost/iam/admin/data-subject-rights/legal-holds/release', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          instanceId: '11111111-1111-1111-8111-111111111111',
          targetKeycloakSubject: 'keycloak-sub-2',
          releaseReason: 'case_closed',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ releasedCount: 1 });
  });

  it('downloads completed admin export jobs as json', async () => {
    state.user = {
      ...state.user,
      roles: ['iam_admin'],
    };
    state.queryHandler = (text) => {
      if (text.includes('FROM iam.data_subject_export_jobs')) {
        return {
          rowCount: 1,
          rows: [
            {
              id: 'aaaaaaaa-aaaa-aaaa-8aaa-aaaaaaaaaaaa',
              format: 'json',
              status: 'completed',
              error_message: null,
              payload_json: { account: { id: 'acc-2' } },
              payload_csv: null,
              payload_xml: null,
              created_at: '2026-03-01T10:00:00.000Z',
              completed_at: '2026-03-01T10:05:00.000Z',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    };

    const response = await adminDataExportStatusHandler(
      new Request(
        'http://localhost/iam/admin/data-subject-rights/export/status?jobId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&download=json',
        { method: 'GET' }
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.text()).toContain('"id": "acc-2"');
  });

  it('returns export_job_not_found for unknown admin export jobs', async () => {
    state.user = {
      ...state.user,
      roles: ['iam_admin'],
    };

    const response = await adminDataExportStatusHandler(
      new Request(
        'http://localhost/iam/admin/data-subject-rights/export/status?jobId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        { method: 'GET' }
      )
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'export_job_not_found' });
  });
});
