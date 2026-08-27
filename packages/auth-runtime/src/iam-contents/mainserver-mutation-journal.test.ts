import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  annotateMainserverMutationJournal,
  beginMainserverMutationJournal,
  finalizeMainserverMutationJournal,
  hasUnresolvedMainserverOwnershipTransfer,
  loadMainserverMutationJournal,
  markMainserverMutationReconciliationRequired,
} from './mainserver-mutation-journal.js';

const state = vi.hoisted(() => ({ query: vi.fn(), withInstanceScopedDb: vi.fn() }));

vi.mock('../iam-account-management/shared.js', () => ({
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'journal-1',
  operation_external_id: 'operation-1',
  provider_outcome: 'pending',
  reconciliation_status: 'pending',
  attempt_count: 1,
  completed_steps: ['authorized'],
  completed_at: null,
  resolver_mode: 'shadow',
  candidate_authorization_mode: null,
  candidate_allowed: null,
  shadow_difference: false,
  ...overrides,
});

describe('Mainserver mutation journal', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) =>
      work({ query: state.query })
    );
  });

  it('creates a principal-bound operation with a redacted preimage', async () => {
    state.query.mockResolvedValueOnce({ rows: [row()] });
    await expect(
      beginMainserverMutationJournal({
        instanceId: 'de-musterhausen',
        operationExternalId: 'operation-1',
        actorAccountId: '11111111-1111-4111-8111-111111111111',
        actingPrincipalType: 'organization',
        actingPrincipalId: '22222222-2222-4222-8222-222222222222',
        activeOrganizationId: '22222222-2222-4222-8222-222222222222',
        credentialSource: 'organization',
        credentialFingerprint: 'a'.repeat(64),
        actionId: 'news.delete',
        contentType: 'news.article',
        contentId: 'news-1',
        observedDataProviderId: 'provider-1',
        authorizationMode: 'credential_visible_compatibility',
        resolverMode: 'shadow',
        candidateAuthorizationMode: 'exact',
        candidateAllowed: false,
        shadowDifference: true,
        preimage: { id: 'news-1', dataProviderId: 'provider-1' },
      })
    ).resolves.toMatchObject({ operationExternalId: 'operation-1', attemptCount: 1 });
    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining('mainserver_mutation_journal_operation_key'),
      expect.arrayContaining([
        'news.delete',
        'news.article',
        'news-1',
        'provider-1',
        'credential_visible_compatibility',
        'shadow',
        'exact',
        false,
        true,
      ])
    );
  });

  it('increments retries through the idempotent operation key', async () => {
    state.query.mockResolvedValueOnce({
      rows: [
        row({
          attempt_count: 2,
          provider_outcome: 'unknown',
          reconciliation_status: 'reconciliation_required',
        }),
      ],
    });
    const result = await beginMainserverMutationJournal({
      instanceId: 'de-musterhausen',
      operationExternalId: 'operation-1',
      actingPrincipalType: 'user',
      actingPrincipalId: '11111111-1111-4111-8111-111111111111',
      credentialSource: 'user',
      credentialFingerprint: 'a'.repeat(64),
      actionId: 'news.update',
      contentType: 'news.article',
      authorizationMode: 'exact',
      resolverMode: 'automatic',
    });
    expect(result.attemptCount).toBe(2);
    expect(result).toMatchObject({
      providerOutcome: 'unknown',
      reconciliationStatus: 'reconciliation_required',
    });
    expect(state.query.mock.calls[0]?.[0]).toContain('attempt_count + 1');
    expect(state.query.mock.calls[0]?.[0]).toContain("THEN 'unknown'");
  });

  it('finalizes success idempotently and merges completed steps', async () => {
    state.query.mockResolvedValueOnce({
      rows: [
        row({
          provider_outcome: 'succeeded',
          reconciliation_status: 'complete',
          completed_steps: ['authorized', 'provider_write', 'tombstone'],
          completed_at: '2026-08-07T10:00:00.000Z',
        }),
      ],
    });
    await expect(
      finalizeMainserverMutationJournal({
        instanceId: 'de-musterhausen',
        operationExternalId: 'operation-1',
        providerOutcome: 'succeeded',
        reconciliationStatus: 'complete',
        completedSteps: ['provider_write', 'tombstone'],
      })
    ).resolves.toMatchObject({ providerOutcome: 'succeeded', reconciliationStatus: 'complete' });
  });

  it('loads an operation without exposing the preimage', async () => {
    state.query.mockResolvedValueOnce({ rows: [row()] });
    await expect(
      loadMainserverMutationJournal({
        instanceId: 'de-musterhausen',
        operationExternalId: 'operation-1',
      })
    ).resolves.toEqual({
      id: 'journal-1',
      operationExternalId: 'operation-1',
      providerOutcome: 'pending',
      reconciliationStatus: 'pending',
      attemptCount: 1,
      completedSteps: ['authorized'],
      resolverMode: 'shadow',
      shadowDifference: false,
    });
  });

  it('annotates the reserved operation with target provider and redacted transfer metadata', async () => {
    state.query.mockResolvedValueOnce({ rows: [] });
    const metadata = {
      coverage: 'studio_mutations',
      sourcePrincipalId: '11111111-1111-4111-8111-111111111111',
      targetPrincipalId: '22222222-2222-4222-8222-222222222222',
      targetBindingVersion: 'binding-1:2026-08-27T09:00:00.000Z',
    };

    await annotateMainserverMutationJournal({
      instanceId: 'de-musterhausen',
      operationExternalId: 'operation-1',
      expectedDataProviderId: 'provider-target',
      metadata,
    });

    expect(state.query).toHaveBeenCalledWith(expect.stringContaining('preimage = COALESCE'), [
      'de-musterhausen',
      'operation-1',
      'provider-target',
      JSON.stringify(metadata),
    ]);
  });

  it('detects unresolved ownership transfers for the exact content', async () => {
    state.query.mockResolvedValueOnce({ rows: [{ unresolved: true }] });

    await expect(
      hasUnresolvedMainserverOwnershipTransfer({
        instanceId: 'de-musterhausen',
        contentType: 'news.article',
        contentId: 'news-1',
      })
    ).resolves.toBe(true);

    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining("action_id = 'content.transferOwnership'"),
      ['de-musterhausen', 'news.article', 'news-1']
    );
    expect(state.query.mock.calls[0]?.[0]).toContain(
      "reconciliation_status IN ('pending', 'reconciliation_required')"
    );
  });

  it('marks a confirmed provider result for local reconciliation', async () => {
    state.query.mockResolvedValueOnce({ rows: [] });

    await markMainserverMutationReconciliationRequired({
      instanceId: 'de-musterhausen',
      operationExternalId: 'operation-1',
      completedStep: 'target_projection_refresh_failed',
      lastErrorCode: 'content_transfer_projection_refresh_failed',
    });

    expect(state.query).toHaveBeenCalledWith(
      expect.stringContaining("reconciliation_status = 'reconciliation_required'"),
      [
        'de-musterhausen',
        'operation-1',
        'target_projection_refresh_failed',
        'content_transfer_projection_refresh_failed',
      ]
    );
  });
});
