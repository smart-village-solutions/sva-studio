import { describe, expect, it, vi } from 'vitest';

vi.mock('@sva/server-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@sva/server-runtime')>()),
  getWorkspaceContext: () => ({ requestId: 'req-confirm' }),
}));

describe('critical registry confirmation', () => {
  const detail = {
    instanceId: 'demo', updatedAt: '2026-07-13T00:00:00.000Z', status: 'active', assignedModules: ['news'],
    featureFlags: { beta: true }, realmMode: 'existing', authRealm: 'demo', authClientId: 'studio',
    authClientSecretConfigured: true,
  } as const;

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
  });

  it('rejects a challenge bound to a different validated module', async () => {
    const { confirmCriticalRegistryMutation } = await import('./confirmation.js');
    const service = {
      getInstanceDetail: vi.fn(async () => detail),
      consumeConfirmationChallenge: vi.fn(async (input: { moduleId?: string }) => input.moduleId === 'news'),
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
  });
});
