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

import { listGovernanceCases } from './iam-governance/read-models';

type QueryResult = {
  rowCount: number;
  rows: unknown[];
};

const buildClient = (...results: QueryResult[]) => {
  const query = vi.fn(async () => results.shift() ?? { rowCount: 0, rows: [] });
  return { query };
};

describe('iam-governance/read-models', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps all governance row types, sorts by createdAt and paginates the result', async () => {
    const client = buildClient(
      {
        rowCount: 1,
        rows: [
          {
            id: 'perm-1',
            status: 'submitted',
            ticket_id: 'TICKET-1',
            ticket_system: 'jira',
            ticket_state: 'open',
            reason_code: 'role_request',
            rejection_reason: null,
            requested_at: '2026-03-14T10:00:00.000Z',
            approved_at: null,
            applied_at: null,
            updated_at: '2026-03-14T10:15:00.000Z',
            role_id: 'role-1',
            role_name: 'role_internal',
            role_display_name: null,
            requester_account_id: 'user-actor',
            target_account_id: 'user-target',
            requester_display_name_ciphertext: 'Requester',
            requester_first_name_ciphertext: 'Req',
            requester_last_name_ciphertext: 'User',
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
            id: 'delegation-1',
            status: 'active',
            ticket_id: 'TICKET-2',
            ticket_system: 'servicenow',
            ticket_state: 'approved',
            starts_at: '2026-03-15T08:00:00.000Z',
            ends_at: '2026-03-20T08:00:00.000Z',
            created_at: '2026-03-15T08:00:00.000Z',
            updated_at: '2026-03-15T08:30:00.000Z',
            revoked_at: null,
            role_id: 'role-2',
            role_name: 'support',
            role_display_name: 'Support Delegate',
            delegator_account_id: 'delegator-1',
            delegatee_account_id: 'delegatee-1',
            delegator_display_name_ciphertext: 'Delegator',
            delegator_first_name_ciphertext: 'Dele',
            delegator_last_name_ciphertext: 'Gator',
            delegator_keycloak_subject: 'kc-delegator',
            delegatee_display_name_ciphertext: 'Delegatee',
            delegatee_first_name_ciphertext: 'Dele',
            delegatee_last_name_ciphertext: 'Gatee',
            delegatee_keycloak_subject: 'kc-delegatee',
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: 'imp-1',
            status: 'active',
            ticket_id: 'TICKET-3',
            ticket_system: 'jira',
            ticket_state: 'approved',
            reason_code: 'support_session',
            termination_reason: null,
            requested_at: '2026-03-16T09:00:00.000Z',
            approved_at: '2026-03-16T09:05:00.000Z',
            started_at: '2026-03-16T09:10:00.000Z',
            ended_at: null,
            expires_at: '2026-03-16T12:00:00.000Z',
            updated_at: '2026-03-16T09:10:00.000Z',
            actor_account_id: 'actor-1',
            target_account_id: 'target-1',
            actor_display_name_ciphertext: 'Actor',
            actor_first_name_ciphertext: 'Ac',
            actor_last_name_ciphertext: 'Tor',
            actor_keycloak_subject: 'kc-actor',
            target_display_name_ciphertext: 'Target Person',
            target_first_name_ciphertext: 'Target',
            target_last_name_ciphertext: 'Person',
            target_keycloak_subject: 'kc-target-person',
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: 'legal-1',
            legal_text_id: 'privacy_policy',
            legal_text_version: '2026-03',
            locale: 'de-DE',
            accepted_at: '2026-03-17T08:00:00.000Z',
            revoked_at: null,
            request_id: 'req-1',
            trace_id: 'trace-1',
            account_id: 'account-1',
            display_name_ciphertext: 'Legal Person',
            first_name_ciphertext: 'Legal',
            last_name_ciphertext: 'Person',
            keycloak_subject: 'kc-legal',
          },
        ],
      }
    );

    const result = await listGovernanceCases(client as never, {
      instanceId: 'de-musterhausen',
      page: 1,
      pageSize: 2,
    });

    expect(result.total).toBe(4);
    expect(result.items.map((item) => item.id)).toEqual(['legal-1', 'imp-1']);
    expect(result.items[0]).toMatchObject({
      type: 'legal_acceptance',
      status: 'accepted',
      title: 'privacy_policy',
      actorDisplayName: 'Legal Person',
    });
    expect(result.items[1]).toMatchObject({
      type: 'impersonation',
      ticketId: 'TICKET-3',
      summary: 'Actor -> Target Person',
    });
  });

  it('filters governance cases by type, status and search and forwards the related account id', async () => {
    const relatedAccountId = '11111111-1111-4111-8111-111111111111';
    const client = buildClient(
      { rowCount: 0, rows: [] },
      { rowCount: 0, rows: [] },
      { rowCount: 0, rows: [] },
      {
        rowCount: 1,
        rows: [
          {
            id: 'legal-2',
            legal_text_id: 'privacy_policy',
            legal_text_version: '2026-04',
            locale: 'en-GB',
            accepted_at: '2026-03-18T08:00:00.000Z',
            revoked_at: '2026-03-19T08:00:00.000Z',
            request_id: 'req-2',
            trace_id: 'trace-2',
            account_id: relatedAccountId,
            display_name_ciphertext: 'Privacy Person',
            first_name_ciphertext: 'Privacy',
            last_name_ciphertext: 'Person',
            keycloak_subject: 'kc-privacy',
          },
        ],
      }
    );

    const result = await listGovernanceCases(client as never, {
      instanceId: 'de-musterhausen',
      relatedAccountId,
      type: 'legal_acceptance',
      status: 'revoked',
      search: 'privacy',
      page: 1,
      pageSize: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 'legal-2',
      status: 'revoked',
      metadata: {
        legalTextVersion: '2026-04',
        locale: 'en-GB',
      },
    });
    expect(client.query).toHaveBeenNthCalledWith(1, expect.any(String), ['de-musterhausen', relatedAccountId]);
    expect(client.query).toHaveBeenNthCalledWith(4, expect.any(String), ['de-musterhausen', relatedAccountId]);
  });
});
