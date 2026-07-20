import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  ensurePlatformAccess: vi.fn(() => null),
  withScopedRegistryService: vi.fn(),
  createApiError: vi.fn((status: number, code: string, message: string, requestId: string) =>
    Response.json({ error: { code, message }, requestId }, { status })
  ),
  jsonResponse: vi.fn((status: number, body: unknown) => Response.json(body, { status })),
}));

vi.mock('@sva/server-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/server-runtime')>()),
  getWorkspaceContext: () => ({ requestId: 'req-confirm' }),
}));

vi.mock('../iam-account-management/api-helpers.js', () => ({ createApiError: state.createApiError }));
vi.mock('../db.js', () => ({ jsonResponse: state.jsonResponse }));
vi.mock('./http.js', () => ({ ensurePlatformAccess: state.ensurePlatformAccess }));
vi.mock('./repository.js', () => ({ withScopedRegistryService: state.withScopedRegistryService }));

describe('critical registry confirmation', () => {
  const detail = {
    instanceId: 'demo', updatedAt: '2026-07-13T00:00:00.000Z', status: 'active', assignedModules: ['news'],
    featureFlags: { beta: true }, realmMode: 'existing', authRealm: 'demo', authClientId: 'studio',
    authClientSecretConfigured: true,
  } as const;

  beforeEach(() => {
    vi.clearAllMocks();
    state.ensurePlatformAccess.mockReturnValue(null);
  });

  it('fingerprints stable registry state and ignores volatile diagnostic evidence', async () => {
    const { fingerprintInstanceConfirmationState } = await import('./confirmation.js');
    const first = fingerprintInstanceConfirmationState({ ...detail, auditEvents: [{ id: 'a' }] } as never);
    const second = fingerprintInstanceConfirmationState({ ...detail, auditEvents: [{ id: 'b' }], keycloakStatus: { realmExists: false } } as never);
    const changed = fingerprintInstanceConfirmationState({ ...detail, status: 'suspended' } as never);
    expect(first).toBe(second);
    expect(changed).not.toBe(first);
  });

  it('keeps all five critical actions static and requires a module for revoke prepare', async () => {
    const { CRITICAL_REGISTRY_ACTIONS, validateConfirmationModuleId } = await import('./confirmation.js');
    expect(CRITICAL_REGISTRY_ACTIONS).toEqual([
      'instance.status.activate', 'instance.status.suspend', 'instance.status.archive',
      'instance.module.revoke', 'instance.secret.rotate',
    ]);
    expect(validateConfirmationModuleId('instance.module.revoke')).toBe(false);
    expect(validateConfirmationModuleId('instance.module.revoke', '  ')).toBe(false);
    expect(validateConfirmationModuleId('instance.module.revoke', 'news')).toBe(true);
    expect(validateConfirmationModuleId('instance.status.archive', 'news')).toBe(false);
    expect(validateConfirmationModuleId('instance.status.archive')).toBe(true);
  });
  it('leaves browser session mutations unchanged', async () => {
    const { confirmCriticalRegistryMutation } = await import('./confirmation.js');
    const service = { consumeConfirmationChallenge: vi.fn() };
    const response = await confirmCriticalRegistryMutation({
      service: service as never,
      request: new Request('https://studio.example/api'),
      context: { authKind: 'session', sessionId: 's1', user: { id: 'u1', roles: [] } },
      instanceId: 'demo', actorId: 'u1', actionId: 'instance.status.archive',
    });
    expect(response).toBeNull();
    expect(service.consumeConfirmationChallenge).not.toHaveBeenCalled();
  });

  it('binds service confirmation to actor, static action and current state', async () => {
    const { confirmCriticalRegistryMutation } = await import('./confirmation.js');
    const service = {
      getInstanceDetail: vi.fn(async () => detail),
      consumeConfirmationChallenge: vi.fn(async () => true),
      recordConfirmationAttempt: vi.fn(async () => undefined),
    };
    const response = await confirmCriticalRegistryMutation({
      service: service as never,
      request: new Request('https://studio.example/api', { headers: {
        'x-confirmation-challenge-id': 'challenge-1',
        'x-confirmation-phrase': 'ARCHIVE demo',
      } }),
      context: { authKind: 'keycloak_service', actionId: 'instance.status.archive', user: { id: 'keycloak-service:mcp', roles: ['instance_registry_admin'] } },
      instanceId: 'demo', actorId: 'keycloak-service:mcp', actionId: 'instance.status.archive',
    });
    expect(response).toBeNull();
    expect(service.consumeConfirmationChallenge).toHaveBeenCalledWith(expect.objectContaining({
      challengeId: 'challenge-1', instanceId: 'demo', actorId: 'keycloak-service:mcp',
      actionId: 'instance.status.archive', confirmationPhrase: 'ARCHIVE demo',
    }));
    expect(service.recordConfirmationAttempt).toHaveBeenCalledWith({
      instanceId: 'demo', actorId: 'keycloak-service:mcp', actionId: 'instance.status.archive',
      outcome: 'accepted', requestId: 'req-confirm',
    });
  });

  it('rejects a challenge bound to a different validated module', async () => {
    const { confirmCriticalRegistryMutation } = await import('./confirmation.js');
    const service = {
      getInstanceDetail: vi.fn(async () => detail),
      consumeConfirmationChallenge: vi.fn(async (input: { moduleId?: string }) => input.moduleId === 'news'),
      recordConfirmationAttempt: vi.fn(async () => undefined),
    };
    const response = await confirmCriticalRegistryMutation({
      service: service as never,
      request: new Request('https://studio.example/api', { headers: {
        'x-confirmation-challenge-id': 'challenge-1', 'x-confirmation-phrase': 'REVOKE events FROM demo',
      } }),
      context: { authKind: 'keycloak_service', actionId: 'instance.module.revoke', user: { id: 'keycloak-service:mcp', roles: ['instance_registry_admin'] } },
      instanceId: 'demo', actorId: 'keycloak-service:mcp', actionId: 'instance.module.revoke', moduleId: 'events',
    });
    expect(response?.status).toBe(409);
    expect(service.consumeConfirmationChallenge).toHaveBeenCalledWith(expect.objectContaining({ moduleId: 'events' }));
    expect(service.recordConfirmationAttempt).toHaveBeenCalledWith(expect.objectContaining({
      actionId: 'instance.module.revoke', moduleId: 'events', outcome: 'rejected', reason: 'invalid_confirmation',
    }));
  });

  it.each([
    ['missing confirmation headers', {}, 403, 'confirmation_required'],
    ['missing instance state', { 'x-confirmation-challenge-id': 'challenge', 'x-confirmation-phrase': 'ARCHIVE demo' }, 404, 'not_found'],
    ['expired confirmation challenge', { 'x-confirmation-challenge-id': 'challenge', 'x-confirmation-phrase': 'ARCHIVE demo' }, 409, 'invalid_confirmation'],
  ])('returns a structured error for %s', async (_label, headers, status, code) => {
    const { confirmCriticalRegistryMutation } = await import('./confirmation.js');
    const service = {
      getInstanceDetail: vi.fn(async () => code === 'not_found' ? null : detail),
      consumeConfirmationChallenge: vi.fn(async () => false),
      recordConfirmationAttempt: vi.fn(async () => undefined),
    };
    const response = await confirmCriticalRegistryMutation({
      service: service as never,
      request: new Request('https://studio.example/api', { headers }),
      context: { authKind: 'keycloak_service', user: { id: 'service', roles: [] } },
      instanceId: 'demo', actorId: 'service', actionId: 'instance.status.archive',
    });
    expect(response?.status).toBe(status);
    expect(await response?.json()).toMatchObject({ error: { code } });
    if (code === 'not_found') {
      expect(service.recordConfirmationAttempt).not.toHaveBeenCalled();
    } else {
      expect(service.recordConfirmationAttempt).toHaveBeenCalledWith(expect.objectContaining({
        outcome: 'rejected', reason: code === 'confirmation_required' ? 'confirmation_required' : 'invalid_confirmation',
      }));
    }
  });

  it('does not write an audit event for a missing instance without confirmation headers', async () => {
    const { confirmCriticalRegistryMutation } = await import('./confirmation.js');
    const service = {
      getInstanceDetail: vi.fn(async () => null),
      recordConfirmationAttempt: vi.fn(async () => undefined),
    };

    const response = await confirmCriticalRegistryMutation({
      service: service as never,
      request: new Request('https://studio.example/api'),
      context: { authKind: 'keycloak_service', user: { id: 'service', roles: [] } },
      instanceId: 'missing', actorId: 'service', actionId: 'instance.status.archive',
    });

    expect(response?.status).toBe(403);
    expect(service.recordConfirmationAttempt).not.toHaveBeenCalled();
  });

  it('audits a confirmation request with a missing phrase', async () => {
    const { confirmCriticalRegistryMutation } = await import('./confirmation.js');
    const service = {
      getInstanceDetail: vi.fn(async () => detail),
      recordConfirmationAttempt: vi.fn(async () => undefined),
    };

    const response = await confirmCriticalRegistryMutation({
      service: service as never,
      request: new Request('https://studio.example/api', { headers: { 'x-confirmation-challenge-id': 'challenge-1' } }),
      context: { authKind: 'keycloak_service', user: { id: 'service', roles: [] } },
      instanceId: 'demo', actorId: 'service', actionId: 'instance.status.archive',
    });

    expect(response?.status).toBe(403);
    expect(service.recordConfirmationAttempt).toHaveBeenCalledWith(expect.objectContaining({ reason: 'confirmation_required' }));
  });

  it('prepares a state-bound module revoke challenge for service callers', async () => {
    const service = {
      getInstanceDetail: vi.fn(async () => detail),
      prepareConfirmationChallenge: vi.fn(async () => ({ challengeId: 'challenge-1' })),
    };
    state.withScopedRegistryService.mockImplementation(async (_instanceId, callback) => callback(service));
    const { prepareInstanceConfirmationInternal } = await import('./confirmation.js');
    const response = await prepareInstanceConfirmationInternal(
      new Request('https://studio.example/api/v1/iam/instances/demo/actions/instance.module.revoke/confirmation?moduleId=news'),
      { authKind: 'keycloak_service', user: { id: 'service', roles: [] } } as never
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: {
      challengeId: 'challenge-1', actionId: 'instance.module.revoke', instanceId: 'demo',
      moduleId: 'news', confirmationPhrase: 'REVOKE news FROM demo',
    } });
    expect(service.prepareConfirmationChallenge).toHaveBeenCalledWith(expect.objectContaining({
      instanceId: 'demo', actorId: 'service', moduleId: 'news',
    }));
  });

  it.each([
    ['instance.status.archive', 'ARCHIVE demo'],
    ['instance.status.suspend', 'SUSPEND demo'],
    ['instance.secret.rotate', 'ROTATE SECRET FOR demo'],
  ])('prepares the required confirmation phrase for %s', async (actionId, confirmationPhrase) => {
    const service = {
      getInstanceDetail: vi.fn(async () => detail),
      prepareConfirmationChallenge: vi.fn(async () => ({ challengeId: 'challenge-1' })),
    };
    state.withScopedRegistryService.mockImplementation(async (_instanceId, callback) => callback(service));
    const { prepareInstanceConfirmationInternal } = await import('./confirmation.js');
    const response = await prepareInstanceConfirmationInternal(
      new Request(`https://studio.example/api/v1/iam/instances/demo/actions/${actionId}/confirmation`),
      { authKind: 'keycloak_service', user: { id: 'service', roles: [] } } as never
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { actionId, confirmationPhrase } });
    expect(service.prepareConfirmationChallenge).toHaveBeenCalledWith(expect.objectContaining({ actionId, confirmationPhrase }));
  });

  it('rejects invalid preparation requests before accessing the registry', async () => {
    const { prepareInstanceConfirmationInternal } = await import('./confirmation.js');
    const response = await prepareInstanceConfirmationInternal(
      new Request('https://studio.example/api/v1/iam/instances/demo/actions/instance.module.revoke/confirmation'),
      { authKind: 'keycloak_service', user: { id: 'service', roles: [] } } as never
    );
    expect(response.status).toBe(400);
    expect(state.withScopedRegistryService).not.toHaveBeenCalled();
  });

  it('rejects confirmation preparation without machine authentication or platform access', async () => {
    const { prepareInstanceConfirmationInternal } = await import('./confirmation.js');
    const sessionResponse = await prepareInstanceConfirmationInternal(
      new Request('https://studio.example/api/v1/iam/instances/demo/actions/instance.status.archive/confirmation'),
      { authKind: 'session', user: { id: 'admin', roles: [] } } as never
    );
    state.ensurePlatformAccess.mockReturnValueOnce(new Response('forbidden', { status: 403 }));
    const accessResponse = await prepareInstanceConfirmationInternal(
      new Request('https://studio.example/api/v1/iam/instances/demo/actions/instance.status.archive/confirmation'),
      { authKind: 'keycloak_service', user: { id: 'service', roles: [] } } as never
    );
    expect(sessionResponse.status).toBe(403);
    expect(accessResponse.status).toBe(403);
    expect(state.withScopedRegistryService).not.toHaveBeenCalled();
  });

  it('rejects unknown actions and missing instances during confirmation preparation', async () => {
    const { prepareInstanceConfirmationInternal } = await import('./confirmation.js');
    const invalidResponse = await prepareInstanceConfirmationInternal(
      new Request('https://studio.example/api/v1/iam/instances/demo/actions/instance.unknown/confirmation'),
      { authKind: 'keycloak_service', user: { id: 'service', roles: [] } } as never
    );
    state.withScopedRegistryService.mockImplementationOnce(async (_instanceId, callback) => callback({
      getInstanceDetail: vi.fn(async () => null),
    }));
    const missingResponse = await prepareInstanceConfirmationInternal(
      new Request('https://studio.example/api/v1/iam/instances/demo/actions/instance.status.archive/confirmation'),
      { authKind: 'keycloak_service', user: { id: 'service', roles: [] } } as never
    );
    expect(invalidResponse.status).toBe(400);
    expect(missingResponse.status).toBe(404);
  });
});
