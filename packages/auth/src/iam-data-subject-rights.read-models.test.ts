import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./iam-account-management/encryption', () => ({
  revealField: vi.fn((value: string | null) => value),
}));

vi.mock('./iam-account-management/user-mapping', () => ({
  resolveUserDisplayName: vi.fn(
    (input: {
      decryptedDisplayName?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      keycloakSubject: string;
    }) =>
      input.decryptedDisplayName ??
      ([input.firstName, input.lastName].filter((value): value is string => Boolean(value)).join(' ') ||
        input.keycloakSubject)
  ),
}));

import {
  listAdminDsrCases,
  loadDsrSelfServiceOverview,
  toCanonicalDsrStatus,
} from './iam-data-subject-rights/read-models';

type QueryResult = {
  rowCount: number;
  rows: unknown[];
};

const buildClient = (...results: QueryResult[]) => {
  const query = vi.fn(async () => results.shift() ?? { rowCount: 0, rows: [] });
  return { query };
};

describe('iam-data-subject-rights/read-models', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps raw DSR statuses into the canonical UI states', () => {
    expect(toCanonicalDsrStatus('accepted')).toBe('queued');
    expect(toCanonicalDsrStatus('processing')).toBe('in_progress');
    expect(toCanonicalDsrStatus('sent')).toBe('completed');
    expect(toCanonicalDsrStatus('blocked_legal_hold')).toBe('blocked');
    expect(toCanonicalDsrStatus('failed_export')).toBe('failed');
  });

  it('loads the self-service overview with requests, exports and legal holds', async () => {
    const client = buildClient(
      {
        rowCount: 1,
        rows: [
          {
            id: 'account-1',
            processing_restricted_at: '2026-03-15T10:00:00.000Z',
            processing_restriction_reason: 'legal_hold',
            non_essential_processing_opt_out_at: '2026-03-14T10:00:00.000Z',
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: 'req-1',
            request_type: 'access',
            status: 'processing',
            requester_account_id: 'requester-1',
            target_account_id: 'account-1',
            legal_hold_blocked: false,
            request_accepted_at: '2026-03-15T10:00:00.000Z',
            completed_at: null,
            updated_at: '2026-03-15T10:10:00.000Z',
            requester_display_name_ciphertext: 'Requester',
            requester_first_name_ciphertext: 'Req',
            requester_last_name_ciphertext: 'Uester',
            requester_keycloak_subject: 'kc-requester',
            target_display_name_ciphertext: 'Target User',
            target_first_name_ciphertext: 'Target',
            target_last_name_ciphertext: 'User',
            target_keycloak_subject: 'kc-target',
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: 'exp-1',
            format: 'csv',
            status: 'failed_export',
            error_message: 'upstream_timeout',
            target_account_id: 'account-1',
            requested_by_account_id: 'requester-1',
            created_at: '2026-03-16T09:00:00.000Z',
            completed_at: null,
            target_display_name_ciphertext: 'Target User',
            target_first_name_ciphertext: 'Target',
            target_last_name_ciphertext: 'User',
            target_keycloak_subject: 'kc-target',
            requester_display_name_ciphertext: 'Requester',
            requester_first_name_ciphertext: 'Req',
            requester_last_name_ciphertext: 'Uester',
            requester_keycloak_subject: 'kc-requester',
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: 'hold-1',
            active: true,
            hold_reason: 'court_order',
            hold_until: '2026-04-01T12:00:00.000Z',
            account_id: 'account-1',
            created_by_account_id: 'admin-1',
            lifted_by_account_id: null,
            created_at: '2026-03-13T08:00:00.000Z',
            lifted_at: null,
            target_display_name_ciphertext: 'Target User',
            target_first_name_ciphertext: 'Target',
            target_last_name_ciphertext: 'User',
            target_keycloak_subject: 'kc-target',
            created_by_display_name_ciphertext: 'Admin Person',
            created_by_first_name_ciphertext: 'Admin',
            created_by_last_name_ciphertext: 'Person',
            created_by_keycloak_subject: 'kc-admin',
          },
        ],
      }
    );

    const overview = await loadDsrSelfServiceOverview(client as never, {
      instanceId: 'de-musterhausen',
      accountId: 'account-1',
    });

    expect(overview.nonEssentialProcessingAllowed).toBe(false);
    expect(overview.processingRestrictionReason).toBe('legal_hold');
    expect(overview.requests[0]).toMatchObject({
      id: 'req-1',
      canonicalStatus: 'in_progress',
      requesterDisplayName: 'Requester',
    });
    expect(overview.exportJobs[0]).toMatchObject({
      id: 'exp-1',
      canonicalStatus: 'failed',
      format: 'csv',
      metadata: {
        errorMessage: 'upstream_timeout',
      },
    });
    expect(overview.legalHolds[0]).toMatchObject({
      id: 'hold-1',
      canonicalStatus: 'blocked',
      blockedReason: 'court_order',
    });
  });

  it('lists admin DSR cases with filters, search and pagination', async () => {
    const relatedAccountId = '22222222-2222-4222-8222-222222222222';
    const client = buildClient(
      {
        rowCount: 1,
        rows: [
          {
            id: 'req-2',
            request_type: 'deletion',
            status: 'accepted',
            requester_account_id: relatedAccountId,
            target_account_id: 'target-1',
            legal_hold_blocked: true,
            request_accepted_at: '2026-03-10T09:00:00.000Z',
            completed_at: null,
            updated_at: '2026-03-10T09:05:00.000Z',
            requester_display_name_ciphertext: 'Requester',
            requester_first_name_ciphertext: 'Req',
            requester_last_name_ciphertext: 'Uester',
            requester_keycloak_subject: 'kc-requester',
            target_display_name_ciphertext: 'Target',
            target_first_name_ciphertext: 'Tar',
            target_last_name_ciphertext: 'Get',
            target_keycloak_subject: 'kc-target',
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: 'exp-2',
            format: 'csv',
            status: 'failed_export',
            error_message: 'upstream_timeout',
            target_account_id: 'target-1',
            requested_by_account_id: relatedAccountId,
            created_at: '2026-03-18T09:00:00.000Z',
            completed_at: null,
            target_display_name_ciphertext: 'Target',
            target_first_name_ciphertext: 'Tar',
            target_last_name_ciphertext: 'Get',
            target_keycloak_subject: 'kc-target',
            requester_display_name_ciphertext: 'Requester',
            requester_first_name_ciphertext: 'Req',
            requester_last_name_ciphertext: 'Uester',
            requester_keycloak_subject: 'kc-requester',
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: 'hold-2',
            active: false,
            hold_reason: 'resolved',
            hold_until: null,
            account_id: 'target-1',
            created_by_account_id: relatedAccountId,
            lifted_by_account_id: 'admin-2',
            created_at: '2026-03-11T09:00:00.000Z',
            lifted_at: '2026-03-12T09:00:00.000Z',
            target_display_name_ciphertext: 'Target',
            target_first_name_ciphertext: 'Tar',
            target_last_name_ciphertext: 'Get',
            target_keycloak_subject: 'kc-target',
            created_by_display_name_ciphertext: 'Requester',
            created_by_first_name_ciphertext: 'Req',
            created_by_last_name_ciphertext: 'Uester',
            created_by_keycloak_subject: 'kc-requester',
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: 'profile-1',
            account_id: 'target-1',
            actor_account_id: relatedAccountId,
            correction_reason: 'typo',
            created_at: '2026-03-13T09:00:00.000Z',
            target_display_name_ciphertext: 'Target',
            target_first_name_ciphertext: 'Tar',
            target_last_name_ciphertext: 'Get',
            target_keycloak_subject: 'kc-target',
            actor_display_name_ciphertext: 'Requester',
            actor_first_name_ciphertext: 'Req',
            actor_last_name_ciphertext: 'Uester',
            actor_keycloak_subject: 'kc-requester',
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: 'notify-1',
            request_id: 'req-2',
            recipient_class: 'processor',
            notification_status: 'sent',
            notification_result: 'delivered',
            created_at: '2026-03-14T09:00:00.000Z',
            notified_at: '2026-03-14T09:05:00.000Z',
            target_account_id: 'target-1',
            target_display_name_ciphertext: 'Target',
            target_first_name_ciphertext: 'Tar',
            target_last_name_ciphertext: 'Get',
            target_keycloak_subject: 'kc-target',
          },
        ],
      }
    );

    const result = await listAdminDsrCases(client as never, {
      instanceId: 'de-musterhausen',
      relatedAccountId,
      type: 'export_job',
      status: 'failed',
      search: 'csv',
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'exp-2',
      type: 'export_job',
      canonicalStatus: 'failed',
      format: 'csv',
    });
    expect(client.query).toHaveBeenNthCalledWith(1, expect.any(String), ['de-musterhausen', relatedAccountId]);
    expect(client.query).toHaveBeenNthCalledWith(5, expect.any(String), ['de-musterhausen', relatedAccountId]);
  });
});
