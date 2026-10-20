import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  restore: vi.fn(),
  db: vi.fn(),
  claim: vi.fn(),
  finish: vi.fn(),
  states: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@sva/auth-runtime/server', () => ({
  readEffectiveSvaMainserverCredentialsWithStatus: mocks.read,
  restoreOrganizationMainserverCredentials: mocks.restore,
  withInstanceScopedDb: mocks.db,
}));
vi.mock('@sva/server-runtime', () => ({
  getWorkspaceContext: () => ({ requestId: 'recovery-request' }),
  createSdkLogger: () => ({ info: vi.fn() }),
}));
vi.mock('./iam-content-list-projection-repository-sync-state.server.js', () => ({
  claimProjectionCredentialRecovery: mocks.claim,
  finishProjectionCredentialRecovery: mocks.finish,
}));
vi.mock('./iam-content-list-projection-sync.server.js', () => ({
  computeProjectionSyncStates: mocks.states,
  triggerMainserverProjectionRefreshBatch: mocks.refresh,
}));
import { recoverProjectionCredentials } from './iam-content-list-projection-credential-recovery.server';
const target = {
  instanceId: 'tenant',
  keycloakSubject: 'actor-subject',
  actorAccountId: 'actor',
  organizationId: 'org',
  contentType: 'news.article' as const,
};
const state = {
  lastFailedAt: '2026-10-20T10:00:00Z',
  lastErrorCode: 'mainserver_credentials_missing',
  isSyncRunning: false,
  hasSnapshot: false,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.claim.mockResolvedValue(true);
  mocks.states.mockResolvedValue([state]);
  mocks.read.mockResolvedValue({ status: 'missing_credentials' });
  mocks.restore.mockResolvedValue('restored');
});

describe('POST-only projection credential recovery', () => {
  it('does not provision personal credentials when they are missing', async () => {
    const result = await recoverProjectionCredentials([target], false, 'original-request');
    expect(result.credentialRecovery[0]).toMatchObject({
      source: 'user',
      outcome: 'not_possible',
      reasonCode: 'personal_credentials_missing',
      originalRequestId: 'original-request',
      requestId: 'recovery-request',
    });
    expect(mocks.restore).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('refreshes at most once after a successful personal reread', async () => {
    mocks.read.mockResolvedValue({ status: 'ok', source: 'user' });
    const result = await recoverProjectionCredentials([target], false);
    expect(result.credentialRecovery[0]).toMatchObject({ outcome: 'reloaded', source: 'user' });
    expect(mocks.refresh).toHaveBeenCalledExactlyOnceWith([target], {
      force: true,
      awaitCompletion: true,
      trigger: 'manual',
    });
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it('restores organization credentials and requires canonical effective readback', async () => {
    mocks.read
      .mockResolvedValueOnce({ status: 'organization_mainserver_credentials_missing' })
      .mockResolvedValueOnce({ status: 'ok', source: 'organization' });
    const result = await recoverProjectionCredentials([target], false);
    expect(mocks.restore).toHaveBeenCalledExactlyOnceWith({
      instanceId: 'tenant',
      organizationId: 'org',
      actorAccountId: 'actor',
      actorSubject: 'actor-subject',
      requestId: 'recovery-request',
    });
    expect(result.credentialRecovery[0]).toMatchObject({
      outcome: 'restored',
      source: 'organization',
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh after failed organization readback', async () => {
    mocks.read.mockResolvedValue({ status: 'organization_mainserver_credentials_missing' });
    const result = await recoverProjectionCredentials([target], false);
    expect(result.credentialRecovery[0]).toMatchObject({
      outcome: 'failed',
      reasonCode: 'credential_readback_failed',
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('does not retry a claimed persisted failure after process-local state is lost', async () => {
    mocks.claim.mockResolvedValue(false);
    await recoverProjectionCredentials([target], false);
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.restore).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('reuses a running refresh without a recovery attempt', async () => {
    mocks.states.mockResolvedValue([{ ...state, isSyncRunning: true }]);
    expect((await recoverProjectionCredentials([target], false)).status).toBe('already_running');
    expect(mocks.claim).not.toHaveBeenCalled();
  });

  it('does not interpret unavailable Keycloak as missing credentials', async () => {
    mocks.read.mockResolvedValue({ status: 'identity_provider_unavailable' });
    expect(
      (await recoverProjectionCredentials([target], false)).credentialRecovery[0]
    ).toMatchObject({ outcome: 'failed', reasonCode: 'keycloak_unavailable' });
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it('keeps successful restoration separate from a failed content refresh without another write', async () => {
    mocks.read
      .mockResolvedValueOnce({ status: 'organization_mainserver_credentials_missing' })
      .mockResolvedValueOnce({ status: 'ok', source: 'organization' });
    mocks.refresh.mockResolvedValue({ status: 'failed' });
    const result = await recoverProjectionCredentials([target], false);
    expect(result.status).toBe('failed');
    expect(result.credentialRecovery[0]).toMatchObject({
      outcome: 'restored',
      reasonCode: 'content_refresh_failed',
    });
    expect(mocks.restore).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('preserves a successful local restoration when the content retry throws', async () => {
    mocks.read
      .mockResolvedValueOnce({ status: 'organization_mainserver_credentials_missing' })
      .mockResolvedValueOnce({ status: 'ok', source: 'organization' });
    mocks.refresh.mockRejectedValue(new Error('sensitive provider response'));
    const result = await recoverProjectionCredentials([target], false);
    expect(result.credentialRecovery[0]).toMatchObject({
      outcome: 'restored',
      reasonCode: 'content_refresh_failed',
    });
    expect(mocks.restore).toHaveBeenCalledTimes(1);
  });

  it('does not start recovery without a persisted matching credential failure', async () => {
    mocks.states.mockResolvedValue([{ ...state, lastErrorCode: 'database_unavailable' }]);
    await recoverProjectionCredentials([target], false);
    expect(mocks.claim).not.toHaveBeenCalled();
  });
});
