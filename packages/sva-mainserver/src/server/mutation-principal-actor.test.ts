import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  loadBinding: vi.fn(),
  loadIdentity: vi.fn(),
  reconcileConflict: vi.fn(),
  recordObservation: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  loadCurrentMainserverDataProviderBinding: state.loadBinding,
  reconcileDeletedUserDataProviderConflict: state.reconcileConflict,
  recordMainserverDataProviderObservation: state.recordObservation,
  resolveActorInfo: vi.fn(),
  resolveMutationPrincipalContext: vi.fn(),
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: vi.fn(() => ({ info: state.loggerInfo, warn: state.loggerWarn })),
  getWorkspaceContext: vi.fn(() => ({ requestId: 'request-1', traceId: 'trace-1' })),
}));

vi.mock('./service.js', () => ({
  loadSvaMainserverDataProviderIdentity: state.loadIdentity,
}));

import { SvaMainserverError } from './errors.js';
import { ensureStableDataProviderIdentity } from './mutation-principal-actor.js';

const actor = {
  instanceId: 'de-musterhausen',
  keycloakSubject: 'subject-1',
  actingPrincipalType: 'user' as const,
  credentialFingerprint: 'a'.repeat(64),
  actorAccountId: '11111111-1111-4111-8111-111111111111',
  operationExternalId: 'operation-1',
  mutationPrincipalContext: {
    version: 1 as const,
    instanceId: 'de-musterhausen',
    actorAccountId: '11111111-1111-4111-8111-111111111111',
    keycloakSubject: 'subject-1',
    actingPrincipalType: 'user' as const,
    actingPrincipalId: '11111111-1111-4111-8111-111111111111',
    credentialSource: 'user' as const,
    credentialFingerprint: 'a'.repeat(64),
  },
};

describe('stable DataProvider identity verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.loadBinding.mockResolvedValue(undefined);
    state.loadIdentity.mockResolvedValue({ dataProvider: { id: '832', name: 'SVS' } });
    state.recordObservation.mockResolvedValue({
      outcome: 'created',
      binding: { status: 'verified', dataProviderId: '832' },
    });
    state.reconcileConflict.mockResolvedValue({
      outcome: 'not_resolved',
      reason: 'competing_user_not_permanently_deleted',
    });
  });

  it('uses a verified binding for the current credential fingerprint without another request', async () => {
    state.loadBinding.mockResolvedValue({ status: 'verified', dataProviderId: '832' });

    await expect(ensureStableDataProviderIdentity(actor)).resolves.toBeNull();

    expect(state.loadIdentity).not.toHaveBeenCalled();
    expect(state.recordObservation).not.toHaveBeenCalled();
  });

  it('creates the current binding from the authenticated identity endpoint', async () => {
    await expect(ensureStableDataProviderIdentity(actor)).resolves.toBeNull();

    expect(state.recordObservation).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      principalType: 'user',
      principalId: '11111111-1111-4111-8111-111111111111',
      credentialFingerprint: 'a'.repeat(64),
      dataProviderId: '832',
      dataProviderName: 'SVS',
      evidenceKind: 'identity_endpoint',
    });
  });

  it('fails closed when a new credential cannot provide a valid identity', async () => {
    state.loadIdentity.mockRejectedValue(
      new SvaMainserverError({
        code: 'invalid_response',
        message: 'Ungültige DataProvider-Identity-Antwort des SVA-Mainservers.',
        statusCode: 502,
      })
    );

    const response = await ensureStableDataProviderIdentity(actor);

    expect(response?.status).toBe(502);
    await expect(response?.json()).resolves.toMatchObject({ error: 'invalid_response' });
    expect(state.recordObservation).not.toHaveBeenCalled();
  });

  it('blocks a conflicting identity instead of broadening authorization', async () => {
    state.recordObservation.mockResolvedValue({
      outcome: 'conflict',
      binding: { status: 'conflict', dataProviderId: '832' },
    });

    const response = await ensureStableDataProviderIdentity(actor);

    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toMatchObject({
      error: 'mainserver_data_provider_identity_conflict',
    });
    expect(state.reconcileConflict).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      principalType: 'user',
      principalId: '11111111-1111-4111-8111-111111111111',
      credentialFingerprint: 'a'.repeat(64),
      dataProviderId: '832',
    });
    expect(state.loggerWarn).toHaveBeenCalledWith(
      'Mainserver DataProvider identity conflict remained fail-closed',
      expect.objectContaining({
        operation: 'mainserver_data_provider_identity_conflict_reconciliation',
        result: 'not_resolved',
        reason_code: 'competing_user_not_permanently_deleted',
      })
    );
  });

  it('continues the original request after reconciling a deleted-user conflict', async () => {
    state.recordObservation.mockResolvedValue({
      outcome: 'conflict',
      binding: { status: 'conflict', dataProviderId: '832' },
    });
    state.reconcileConflict.mockResolvedValue({
      outcome: 'resolved',
      binding: { status: 'verified', dataProviderId: '832' },
      historicalBindingCount: 1,
    });

    await expect(ensureStableDataProviderIdentity(actor)).resolves.toBeNull();

    expect(state.loggerInfo).toHaveBeenCalledWith(
      'Mainserver DataProvider identity conflict reconciled',
      expect.objectContaining({
        operation: 'mainserver_data_provider_identity_conflict_reconciliation',
        result: 'resolved',
        historical_binding_count: 1,
      })
    );
  });
});
