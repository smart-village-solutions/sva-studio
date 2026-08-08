import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('../iam-account-management/shared.js', () => ({
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

describe('mainserver authoring diagnostics', () => {
  let loadMainserverAuthoringDiagnostics: typeof import('./mainserver-authoring-diagnostics.js').loadMainserverAuthoringDiagnostics;

  beforeAll(async () => {
    ({ loadMainserverAuthoringDiagnostics } =
      await import('./mainserver-authoring-diagnostics.js'));
  });

  beforeEach(() => {
    vi.resetAllMocks();
    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) =>
      work({ query: state.query })
    );
  });

  it('returns instance-scoped aggregate and recent diagnostic data without raw credentials', async () => {
    state.query
      .mockResolvedValueOnce({
        rows: [
          { key: 'verified', count: '3' },
          { key: 'conflict', count: '1' },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ key: 'user', count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            principal_type: 'user',
            principal_id: 'user-1',
            credential_fingerprint_prefix: 'abcdef123456',
            data_provider_id: 'provider-1',
            status: 'verified',
            evidence_kind: 'create_response',
            last_observed_at: '2026-08-07T09:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { key: 'exact', count: '2' },
          { key: 'credential_visible_compatibility', count: '4' },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ key: 'shadow', count: '6' }] })
      .mockResolvedValueOnce({ rows: [{ key: 'required', count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ count: '3' }] })
      .mockResolvedValueOnce({
        rows: [
          {
            operation_external_id: 'operation-1',
            action_id: 'news.update',
            content_type: 'news.article',
            content_id: 'news-1',
            acting_principal_type: 'user',
            credential_fingerprint_prefix: 'abcdef123456',
            authorization_mode: 'exact',
            resolver_mode: 'shadow',
            candidate_authorization_mode: 'exact',
            candidate_allowed: false,
            shadow_difference: true,
            provider_outcome: 'succeeded',
            reconciliation_status: 'not_required',
            attempt_count: 1,
            last_error_code: null,
            updated_at: '2026-08-07T09:01:00.000Z',
          },
        ],
      });

    const result = await loadMainserverAuthoringDiagnostics('de-musterhausen');

    expect(state.withInstanceScopedDb).toHaveBeenCalledWith(
      'de-musterhausen',
      expect.any(Function)
    );
    expect(state.query).toHaveBeenCalledTimes(10);
    for (const [, parameters] of state.query.mock.calls) {
      expect(parameters).toEqual(['de-musterhausen']);
    }
    expect(result).toEqual({
      bindings: {
        byStatus: { verified: 3, conflict: 1 },
        byPrincipalType: { user: 2 },
        rotationPrincipalCount: 1,
        recent: [
          {
            principalType: 'user',
            principalId: 'user-1',
            credentialFingerprintPrefix: 'abcdef123456',
            dataProviderId: 'provider-1',
            status: 'verified',
            evidenceKind: 'create_response',
            lastObservedAt: '2026-08-07T09:00:00.000Z',
          },
        ],
      },
      mutations: {
        byAuthorizationMode: { exact: 2, credential_visible_compatibility: 4 },
        byResolverMode: { shadow: 6 },
        byReconciliationStatus: { required: 1 },
        automaticModeSwitchCount: 2,
        shadowDifferenceCount: 3,
        recent: [
          {
            operationExternalId: 'operation-1',
            actionId: 'news.update',
            contentType: 'news.article',
            contentId: 'news-1',
            actingPrincipalType: 'user',
            credentialFingerprintPrefix: 'abcdef123456',
            authorizationMode: 'exact',
            resolverMode: 'shadow',
            candidateAuthorizationMode: 'exact',
            candidateAllowed: false,
            shadowDifference: true,
            providerOutcome: 'succeeded',
            reconciliationStatus: 'not_required',
            attemptCount: 1,
            updatedAt: '2026-08-07T09:01:00.000Z',
          },
        ],
      },
    });
    expect(JSON.stringify(result)).not.toContain('credential_fingerprint');
    expect(JSON.stringify(result)).not.toContain('access_token');
  });
});
