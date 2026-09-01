import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authorizeProvider: vi.fn(),
  beginJournal: vi.fn(),
  emitAudit: vi.fn(),
  readResolverMode: vi.fn(),
  resolvePermissions: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  authorizeMainserverCreatePrincipal: vi.fn(),
  authorizeMainserverDataProviderAccess: state.authorizeProvider,
  beginMainserverMutationJournal: state.beginJournal,
  emitAuthAuditEvent: state.emitAudit,
  readMainserverScopeResolverMode: state.readResolverMode,
  resolveEffectivePermissions: state.resolvePermissions,
}));

import { authorizeMainserverExistingContent } from './mutation-principal-authorization.js';
import { resolveMainserverResourceAccess } from './mutation-principal-resource-access.js';

const actor = {
  instanceId: 'instance-1',
  keycloakSubject: 'kc-actor',
  actorAccountId: '11111111-1111-4111-8111-111111111111',
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

const item = { id: 'news-1', dataProvider: { id: 'provider-source' } };
const permission = (accessScope?: 'all' | 'organization' | 'own') => ({
  action: 'content.transferOwnership',
  resourceType: 'content',
  ...(accessScope ? { accessScope } : {}),
});

describe('Mainserver orphaned ownership transfer scope', () => {
  beforeEach(() => {
    for (const mock of Object.values(state)) mock.mockReset();
    state.authorizeProvider.mockResolvedValue({
      allowed: true,
      authorizationMode: 'credential_visible_compatibility',
      resolverMode: 'compatibility',
      shadowDifference: false,
    });
    state.beginJournal.mockResolvedValue(undefined);
    state.emitAudit.mockResolvedValue(undefined);
    state.readResolverMode.mockReturnValue('shadow');
  });

  it.each(['own', 'organization'] as const)(
    'rejects a compatibility-mode %s grant when an all grant is required',
    async (accessScope) => {
      state.resolvePermissions.mockResolvedValue({
        ok: true,
        permissions: [permission(accessScope)],
      });

      const result = await authorizeMainserverExistingContent({
        actor,
        action: 'content.transferOwnership',
        contentType: 'news.article',
        contentId: 'news-1',
        item,
        requiredAccessScope: 'all',
      });

      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(403);
      expect(state.authorizeProvider).not.toHaveBeenCalled();
      expect(state.emitAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginAction: expect.objectContaining({
            reasonCode: 'access_scope_mismatch',
            mainserverMutation: expect.objectContaining({ resolverMode: 'shadow' }),
          }),
        })
      );
    }
  );

  it('allows an exact all grant even when the provider resolver is in compatibility mode', async () => {
    state.resolvePermissions.mockResolvedValue({
      ok: true,
      permissions: [permission('all')],
    });

    const result = await authorizeMainserverExistingContent({
      actor,
      action: 'content.transferOwnership',
      contentType: 'news.article',
      contentId: 'news-1',
      item,
      requiredAccessScope: 'all',
    });

    expect(result).not.toBeInstanceOf(Response);
    expect(state.authorizeProvider).toHaveBeenCalledOnce();
  });

  it('treats a canonical unscoped grant as global', async () => {
    state.resolvePermissions.mockResolvedValue({
      ok: true,
      permissions: [permission()],
    });

    const result = await authorizeMainserverExistingContent({
      actor,
      action: 'content.transferOwnership',
      contentType: 'news.article',
      contentId: 'news-1',
      item,
      requiredAccessScope: 'all',
      forceExactScopeAuthorization: true,
    });

    expect(result).not.toBeInstanceOf(Response);
    expect(state.authorizeProvider).toHaveBeenCalledWith(
      expect.objectContaining({ forceExactScopeAuthorization: true })
    );
  });

  it('reports no UI access for a scoped grant when an all grant is required', async () => {
    state.resolvePermissions.mockResolvedValue({
      ok: true,
      permissions: [permission('own')],
    });

    await expect(
      resolveMainserverResourceAccess({
        actor,
        actions: ['content.transferOwnership'],
        contentType: 'news.article',
        contentId: 'news-1',
        item,
        requireAllScopeActions: ['content.transferOwnership'],
      })
    ).resolves.toEqual({ 'content.transferOwnership': false });
    expect(state.authorizeProvider).not.toHaveBeenCalled();
  });

  it('evaluates the same constrained global candidate that satisfied the scope precondition', async () => {
    const constrainedAll = { ...permission('all'), resourceId: 'news-other' };
    state.resolvePermissions.mockResolvedValue({
      ok: true,
      permissions: [constrainedAll, permission('own')],
    });
    state.authorizeProvider.mockResolvedValueOnce({
      allowed: false,
      authorizationMode: 'exact',
      resolverMode: 'automatic',
      reason: 'forbidden',
      shadowDifference: false,
    });

    const result = await authorizeMainserverExistingContent({
      actor,
      action: 'content.transferOwnership',
      contentType: 'news.article',
      contentId: 'news-1',
      item,
      requiredAccessScope: 'all',
      forceExactScopeAuthorization: true,
    });

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect(state.authorizeProvider).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: [constrainedAll] })
    );
  });

  it('does not combine a constrained global candidate with a narrower UI grant', async () => {
    const constrainedAll = { ...permission('all'), organizationId: 'org-other' };
    state.resolvePermissions.mockResolvedValue({
      ok: true,
      permissions: [constrainedAll, permission('organization')],
    });
    state.authorizeProvider.mockResolvedValueOnce({
      allowed: false,
      authorizationMode: 'exact',
      resolverMode: 'automatic',
      reason: 'forbidden',
      shadowDifference: false,
    });

    await expect(
      resolveMainserverResourceAccess({
        actor,
        actions: ['content.transferOwnership'],
        contentType: 'news.article',
        contentId: 'news-1',
        item,
        requireAllScopeActions: ['content.transferOwnership'],
        forceExactScopeActions: ['content.transferOwnership'],
      })
    ).resolves.toEqual({ 'content.transferOwnership': false });
    expect(state.authorizeProvider).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: [constrainedAll] })
    );
  });
});
