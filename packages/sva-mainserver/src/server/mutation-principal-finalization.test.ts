import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  emitAudit: vi.fn(),
  finalizeJournal: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  emitAuthAuditEvent: state.emitAudit,
  finalizeMainserverMutationJournal: state.finalizeJournal,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({ warn: vi.fn() }),
  getWorkspaceContext: () => ({ requestId: 'request-1', traceId: 'trace-1' }),
}));

import { finalizeMainserverMutation } from './mutation-principal-finalization.js';

const actor = {
  instanceId: 'instance-1',
  keycloakSubject: 'kc-actor',
  actorAccountId: '11111111-1111-4111-8111-111111111111',
  actingPrincipalType: 'user' as const,
  credentialFingerprint: 'a'.repeat(64),
  operationExternalId: 'operation-1',
  mutationPrincipalContext: {
    version: 1 as const,
    instanceId: 'instance-1',
    actorAccountId: '11111111-1111-4111-8111-111111111111',
    keycloakSubject: 'kc-actor',
    actingPrincipalType: 'user' as const,
    actingPrincipalId: '11111111-1111-4111-8111-111111111111',
    credentialSource: 'user' as const,
    credentialFingerprint: 'a'.repeat(64),
  },
};

describe('finalizeMainserverMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.finalizeJournal.mockResolvedValue({
      actionId: 'content.transferOwnership',
      contentType: 'news.article',
      contentId: 'news-1',
      authorizationMode: 'exact',
      resolverMode: 'automatic',
      providerOutcome: 'succeeded',
      reconciliationStatus: 'complete',
      attemptCount: 1,
      completedSteps: ['provider_write'],
    });
  });

  it('writes the PII-free ownership transition into the append-only audit event', async () => {
    const ownershipTransfer = {
      coverage: 'studio_mutations' as const,
      sourcePrincipalType: 'account' as const,
      sourcePrincipalId: '11111111-1111-4111-8111-111111111111',
      targetPrincipalType: 'organization' as const,
      targetPrincipalId: '22222222-2222-4222-8222-222222222222',
      sourceDataProviderId: 'provider-source',
      targetDataProviderId: 'provider-target',
      targetBindingVersion: 'binding-1:2026-08-27T09:00:00.000Z',
    };

    await finalizeMainserverMutation({
      actor,
      providerOutcome: 'succeeded',
      reconciliationStatus: 'complete',
      completedSteps: ['provider_write', 'target_provider_confirmed'],
      contentId: 'news-1',
      observedDataProviderId: 'provider-target',
      ownershipTransfer,
    });

    expect(state.emitAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'plugin_action_authorized',
        actorUserId: 'kc-actor',
        pluginAction: expect.objectContaining({
          actionId: 'content.transferOwnership',
          resourceType: 'news.article',
          resourceId: 'news-1',
          mainserverMutation: expect.objectContaining({
            operationExternalId: 'operation-1',
            providerOutcome: 'succeeded',
            reconciliationStatus: 'complete',
            ownershipTransfer,
          }),
        }),
      })
    );
    expect(JSON.stringify(state.emitAudit.mock.calls[0]?.[0])).not.toMatch(/email|secret|apiKey/iu);
  });
});
