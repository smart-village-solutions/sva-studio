import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  query: vi.fn(),
  withInstanceScopedDb: vi.fn(),
}));

vi.mock('../iam-account-management/shared.js', () => ({
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

const bindingRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'binding-1',
  instance_id: 'de-musterhausen',
  principal_type: 'user',
  principal_id: '11111111-1111-1111-8111-111111111111',
  credential_fingerprint: 'a'.repeat(64),
  data_provider_id: 'dp-user-1',
  data_provider_name: 'Redaktion',
  status: 'verified',
  evidence_kind: 'create_response',
  first_observed_at: '2026-08-06T20:00:00.000Z',
  last_observed_at: '2026-08-06T20:00:00.000Z',
  superseded_at: null,
  ...overrides,
});

describe('mainserver data provider bindings', () => {
  let recordMainserverDataProviderObservation: typeof import('./mainserver-data-provider-bindings.js').recordMainserverDataProviderObservation;
  let loadCurrentMainserverDataProviderBinding: typeof import('./mainserver-data-provider-bindings.js').loadCurrentMainserverDataProviderBinding;

  beforeAll(async () => {
    ({ recordMainserverDataProviderObservation, loadCurrentMainserverDataProviderBinding } =
      await import('./mainserver-data-provider-bindings.js'));
  });

  beforeEach(() => {
    vi.resetAllMocks();
    state.withInstanceScopedDb.mockImplementation(async (_instanceId, work) =>
      work({ query: state.query })
    );
  });

  it('creates the first verified binding from create evidence', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [bindingRow()] });

    await expect(
      recordMainserverDataProviderObservation({
        instanceId: 'de-musterhausen',
        principalType: 'user',
        principalId: '11111111-1111-1111-8111-111111111111',
        credentialFingerprint: 'a'.repeat(64),
        dataProviderId: ' dp-user-1 ',
        dataProviderName: ' Redaktion ',
        evidenceKind: 'create_response',
      })
    ).resolves.toMatchObject({
      outcome: 'created',
      binding: {
        status: 'verified',
        dataProviderId: 'dp-user-1',
        dataProviderName: 'Redaktion',
      },
    });
    expect(state.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('pg_advisory_xact_lock'),
      ['de-musterhausen', 'mainserver-data-provider:dp-user-1']
    );
    expect(state.query).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO iam.mainserver_data_provider_bindings'),
      expect.arrayContaining(['dp-user-1', 'Redaktion', 'verified', 'create_response'])
    );
  });

  it('confirms an idempotent repeated create observation', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [bindingRow()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [bindingRow()] });

    await expect(
      recordMainserverDataProviderObservation({
        instanceId: 'de-musterhausen',
        principalType: 'user',
        principalId: '11111111-1111-1111-8111-111111111111',
        credentialFingerprint: 'a'.repeat(64),
        dataProviderId: 'dp-user-1',
        evidenceKind: 'create_reread',
      })
    ).resolves.toMatchObject({ outcome: 'confirmed' });
  });

  it('persists a provider mismatch as conflict without overwriting the old observation', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [bindingRow()] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [bindingRow({ id: 'binding-2', data_provider_id: 'dp-user-2', status: 'conflict' })],
      });

    await expect(
      recordMainserverDataProviderObservation({
        instanceId: 'de-musterhausen',
        principalType: 'user',
        principalId: '11111111-1111-1111-8111-111111111111',
        credentialFingerprint: 'a'.repeat(64),
        dataProviderId: 'dp-user-2',
        evidenceKind: 'create_response',
      })
    ).resolves.toMatchObject({ outcome: 'conflict', binding: { status: 'conflict' } });
    expect(state.query.mock.calls[2]?.[0]).toContain("SET status = 'conflict'");
    expect(state.query).toHaveBeenLastCalledWith(
      expect.stringContaining('ON CONFLICT ON CONSTRAINT'),
      expect.arrayContaining(['dp-user-2', 'conflict'])
    );
  });

  it('treats a shared provider claim by another principal as conflict', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          bindingRow({
            principal_type: 'organization',
            principal_id: '22222222-2222-2222-8222-222222222222',
          }),
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [bindingRow({ status: 'conflict' })] });

    const result = await recordMainserverDataProviderObservation({
      instanceId: 'de-musterhausen',
      principalType: 'user',
      principalId: '11111111-1111-1111-8111-111111111111',
      credentialFingerprint: 'a'.repeat(64),
      dataProviderId: 'dp-user-1',
      evidenceKind: 'identity_endpoint',
    });

    expect(result.outcome).toBe('conflict');
  });

  it('isolates credential rotation and marks the previous verified version historical', async () => {
    state.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [bindingRow({ credential_fingerprint: 'b'.repeat(64) })],
      });

    await expect(
      recordMainserverDataProviderObservation({
        instanceId: 'de-musterhausen',
        principalType: 'user',
        principalId: '11111111-1111-1111-8111-111111111111',
        credentialFingerprint: 'b'.repeat(64),
        dataProviderId: 'dp-user-1',
        evidenceKind: 'create_response',
      })
    ).resolves.toMatchObject({
      outcome: 'created',
      binding: { credentialFingerprint: 'b'.repeat(64), status: 'verified' },
    });
    expect(state.query.mock.calls[2]?.[0]).toContain("SET status = 'historical'");
    expect(state.query.mock.calls[2]?.[1]).toEqual([
      'de-musterhausen',
      'user',
      '11111111-1111-1111-8111-111111111111',
      'b'.repeat(64),
    ]);
  });

  it('returns only one unambiguous current verified binding', async () => {
    state.query.mockResolvedValueOnce({ rows: [bindingRow()] });
    await expect(
      loadCurrentMainserverDataProviderBinding({
        instanceId: 'de-musterhausen',
        principalType: 'user',
        principalId: '11111111-1111-1111-8111-111111111111',
        credentialFingerprint: 'a'.repeat(64),
      })
    ).resolves.toMatchObject({ dataProviderId: 'dp-user-1', status: 'verified' });

    state.query.mockResolvedValueOnce({ rows: [bindingRow(), bindingRow({ id: 'binding-2' })] });
    await expect(
      loadCurrentMainserverDataProviderBinding({
        instanceId: 'de-musterhausen',
        principalType: 'user',
        principalId: '11111111-1111-1111-8111-111111111111',
        credentialFingerprint: 'a'.repeat(64),
      })
    ).resolves.toBeUndefined();
  });

  it('excludes deleted, pseudonymized, blocked, and inactive principals from current readiness', async () => {
    state.query.mockResolvedValueOnce({ rows: [] });

    await expect(
      loadCurrentMainserverDataProviderBinding({
        instanceId: 'de-musterhausen',
        principalType: 'organization',
        principalId: '22222222-2222-2222-8222-222222222222',
        credentialFingerprint: 'b'.repeat(64),
      })
    ).resolves.toBeUndefined();

    const query = String(state.query.mock.calls[0]?.[0]);
    expect(query).toContain("account.deletion_lifecycle_state = 'active'");
    expect(query).toContain('account.is_blocked = FALSE');
    expect(query).toContain('account.soft_deleted_at IS NULL');
    expect(query).toContain('account.permanently_deleted_at IS NULL');
    expect(query).toContain('organization.is_active = TRUE');
  });

  it('rejects blank provider identifiers before opening a database transaction', async () => {
    await expect(
      recordMainserverDataProviderObservation({
        instanceId: 'de-musterhausen',
        principalType: 'user',
        principalId: '11111111-1111-1111-8111-111111111111',
        credentialFingerprint: 'a'.repeat(64),
        dataProviderId: ' ',
        evidenceKind: 'create_response',
      })
    ).rejects.toThrow('mainserver_data_provider_id_required');
    expect(state.withInstanceScopedDb).not.toHaveBeenCalled();
  });
});
