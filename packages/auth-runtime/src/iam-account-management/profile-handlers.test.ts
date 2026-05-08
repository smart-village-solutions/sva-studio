import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KeycloakAdminUnavailableError } from '../keycloak-admin-client.js';

const state = vi.hoisted(() => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return {
    getWorkspaceContext: vi.fn(() => ({ requestId: 'req-1', traceId: 'trace-1' })),
    createSdkLogger: vi.fn(() => logger),
    jsonResponse: vi.fn((status: number, payload: unknown) =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    ),
    ensureFeature: vi.fn(),
    getFeatureFlags: vi.fn(() => ({})),
    loadMyProfileDetail: vi.fn(),
    updateMyProfileDetail: vi.fn(),
    consumeRateLimit: vi.fn(),
    resolveActorInfo: vi.fn(),
    resolveIdentityProviderForInstance: vi.fn(),
    trackKeycloakCall: vi.fn(async (_operation: string, execute: () => Promise<unknown>) => execute()),
    withInstanceScopedDb: vi.fn(async (_instanceId: string, work: (client: object) => Promise<unknown>) => work({})),
    runCriticalIamSchemaGuard: vi.fn(),
    validateCsrf: vi.fn(),
    parseRequestBody: vi.fn(),
    createApiError: vi.fn(
      (
        status: number,
        code: string,
        message: string,
        requestId?: string,
        details?: Readonly<Record<string, unknown>>
      ) =>
        new Response(
          JSON.stringify({
            error: {
              code,
              message,
              ...(details ? { details } : {}),
            },
            ...(requestId ? { requestId } : {}),
          }),
          {
            status,
            headers: { 'Content-Type': 'application/json' },
          }
        )
    ),
    asApiItem: vi.fn((data: unknown, requestId?: string) => ({
      data,
      ...(requestId ? { requestId } : {}),
    })),
    classifyIamDiagnosticError: vi.fn(),
    applyCanonicalUserDetailProjection: vi.fn(async ({ user }: { user: unknown }) => user),
    resolveKeycloakRoleNames: vi.fn(async () => []),
    resolveProjectedMainserverCredentialState: vi.fn(async () => ({
      mainserverUserApplicationId: undefined,
      mainserverUserApplicationSecretSet: false,
    })),
    logger,
    iamUserOperationsCounter: {
      add: vi.fn(),
    },
  };
});

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: state.createSdkLogger,
  getWorkspaceContext: state.getWorkspaceContext,
}));

vi.mock('../db.js', () => ({
  jsonResponse: state.jsonResponse,
}));

vi.mock('./feature-flags.js', () => ({
  ensureFeature: state.ensureFeature,
  getFeatureFlags: state.getFeatureFlags,
}));

vi.mock('./profile-commands.js', () => ({
  loadMyProfileDetail: state.loadMyProfileDetail,
  updateMyProfileDetail: state.updateMyProfileDetail,
}));

vi.mock('./rate-limit.js', () => ({
  consumeRateLimit: state.consumeRateLimit,
}));

vi.mock('./shared.js', () => ({
  iamUserOperationsCounter: state.iamUserOperationsCounter,
  logger: state.logger,
  resolveActorInfo: state.resolveActorInfo,
  resolveIdentityProviderForInstance: state.resolveIdentityProviderForInstance,
  trackKeycloakCall: state.trackKeycloakCall,
  withInstanceScopedDb: state.withInstanceScopedDb,
}));

vi.mock('./schema-guard.js', () => ({
  runCriticalIamSchemaGuard: state.runCriticalIamSchemaGuard,
}));

vi.mock('./csrf.js', () => ({
  validateCsrf: state.validateCsrf,
}));

vi.mock('./api-helpers.js', () => ({
  asApiItem: state.asApiItem,
  createApiError: state.createApiError,
  parseRequestBody: state.parseRequestBody,
}));

vi.mock('./diagnostics.js', () => ({
  classifyIamDiagnosticError: state.classifyIamDiagnosticError,
}));

vi.mock('./user-projection.js', () => ({
  applyCanonicalUserDetailProjection: state.applyCanonicalUserDetailProjection,
  resolveKeycloakRoleNames: state.resolveKeycloakRoleNames,
  resolveProjectedMainserverCredentialState: state.resolveProjectedMainserverCredentialState,
}));

const importSubject = async () => import('./profile-handlers.js');

const createAuthenticatedContext = () =>
  ({
    user: {
      id: 'kc-session-user',
      username: 'jane.doe',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      displayName: 'Jane Doe',
      instanceId: 'de-studio-sandbox',
      roles: ['studioadmin'],
    },
  }) as const;

describe('profile handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    state.ensureFeature.mockReturnValue(undefined);
    state.consumeRateLimit.mockReturnValue(undefined);
    state.validateCsrf.mockReturnValue(undefined);
    state.parseRequestBody.mockResolvedValue({
      ok: true,
      data: {
        displayName: 'Jane Example',
      },
    });
    state.resolveActorInfo.mockResolvedValue({
      actor: {
        instanceId: 'de-studio-sandbox',
        actorAccountId: 'account-1',
        requestId: 'req-profile',
        traceId: 'trace-profile',
      },
    });
    state.loadMyProfileDetail.mockResolvedValue({
      id: 'account-1',
      keycloakSubject: 'kc-user-1',
      username: 'jane.doe',
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      displayName: 'Jane Doe',
      status: 'active',
      roles: [],
      mainserverUserApplicationSecretSet: false,
    });
    state.classifyIamDiagnosticError.mockReturnValue({
      status: 500,
      code: 'internal_error',
      message: 'Profil konnte nicht aktualisiert werden.',
      details: { reason_code: 'unexpected_internal_error' },
    });
  });

  it('logs tenant identity metadata and skips the local profile write when keycloak sync fails', async () => {
    const updateUser = vi.fn(async () => {
      throw new KeycloakAdminUnavailableError('keycloak unavailable');
    });
    state.resolveIdentityProviderForInstance.mockResolvedValue({
      provider: { updateUser },
      realm: 'de-studio-sandbox',
      source: 'instance',
      clientId: 'tenant-admin-client',
      adminRealm: 'de-studio-sandbox',
      executionMode: 'tenant_admin',
    });

    const { updateMyProfileInternal } = await importSubject();

    const response = await updateMyProfileInternal(
      new Request('https://de-studio-sandbox.studio.smart-village.app/api/v1/iam/users/me/profile', {
        method: 'PATCH',
      }),
      createAuthenticatedContext()
    );
    const payload = (await response.json()) as {
      error: {
        code: string;
      };
      requestId?: string;
    };

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe('keycloak_unavailable');
    expect(payload.requestId).toBe('req-profile');
    expect(state.updateMyProfileDetail).not.toHaveBeenCalled();
    expect(state.logger.info).toHaveBeenCalledWith(
      'IAM profile tenant identity provider resolved',
      expect.objectContaining({
        request_id: 'req-profile',
        instance_id: 'de-studio-sandbox',
        realm: 'de-studio-sandbox',
        admin_realm: 'de-studio-sandbox',
        client_id: 'tenant-admin-client',
        source: 'instance',
        execution_mode: 'tenant_admin',
      })
    );
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM profile update failed',
      expect.objectContaining({
        failure_stage: 'identity_sync',
        local_db_write_attempted: false,
        local_db_write_succeeded: false,
        identity_sync_attempted: true,
        identity_sync_succeeded: false,
        provider_realm: 'de-studio-sandbox',
        provider_client_id: 'tenant-admin-client',
        keycloak_subject: 'kc-user-1',
      })
    );
  });

  it('marks the local persistence phase when the database write fails after a successful keycloak sync', async () => {
    const updateUser = vi.fn(async () => undefined);
    state.resolveIdentityProviderForInstance.mockResolvedValue({
      provider: { updateUser },
      realm: 'de-studio-sandbox',
      source: 'instance',
      clientId: 'tenant-admin-client',
      adminRealm: 'de-studio-sandbox',
      executionMode: 'tenant_admin',
    });
    state.updateMyProfileDetail.mockRejectedValue(new Error('db write failed'));

    const { updateMyProfileInternal } = await importSubject();

    const response = await updateMyProfileInternal(
      new Request('https://de-studio-sandbox.studio.smart-village.app/api/v1/iam/users/me/profile', {
        method: 'PATCH',
      }),
      createAuthenticatedContext()
    );
    const payload = (await response.json()) as {
      error: {
        code: string;
      };
      requestId?: string;
    };

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe('internal_error');
    expect(payload.requestId).toBe('req-profile');
    expect(updateUser).toHaveBeenCalledTimes(2);
    expect(state.logger.error).toHaveBeenCalledWith(
      'IAM profile update failed',
      expect.objectContaining({
        failure_stage: 'local_persistence',
        local_db_write_attempted: true,
        local_db_write_succeeded: false,
        identity_sync_attempted: true,
        identity_sync_succeeded: true,
        compensation_attempted: true,
        compensation_succeeded: true,
        provider_realm: 'de-studio-sandbox',
      })
    );
  });
});
