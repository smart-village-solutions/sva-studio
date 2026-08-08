import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  loadMainserverMutationJournal: vi.fn(),
  readMainserverMutationFollowUpContext: vi.fn(),
  refreshProjectedContentsForMainserverMutation: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('@sva/auth-runtime/server', () => ({
  loadMainserverMutationJournal: state.loadMainserverMutationJournal,
}));

vi.mock('@sva/sva-mainserver/server', () => ({
  readMainserverMutationFollowUpContext: state.readMainserverMutationFollowUpContext,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => ({
    warn: state.loggerWarn,
  }),
}));

vi.mock('./iam-content-list-projection.server', () => ({
  refreshProjectedContentsForMainserverMutation:
    state.refreshProjectedContentsForMainserverMutation,
}));

import { refreshProjectionAfterMainserverMutation } from './mainserver-projection-refresh.server';

describe('mainserver projection refresh', () => {
  beforeEach(() => {
    state.loadMainserverMutationJournal.mockReset();
    state.readMainserverMutationFollowUpContext.mockReset();
    state.refreshProjectedContentsForMainserverMutation.mockReset();
    state.loggerWarn.mockReset();
    state.readMainserverMutationFollowUpContext.mockReturnValue({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      activeOrganizationId: 'org-1',
      actingPrincipalType: 'organization',
      credentialSource: 'organization',
      credentialFingerprint: 'a'.repeat(64),
      operationExternalId: 'operation-1',
    });
    state.loadMainserverMutationJournal.mockResolvedValue({
      authorizationMode: 'exact',
    });
  });

  it('refreshes the projection after successful mutating mainserver responses', async () => {
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/news', { method: 'POST' }),
      new Response(JSON.stringify({ data: { id: 'news-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      'news.article'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'operation-1',
      contentType: 'news.article',
      organizationId: 'org-1',
      actingPrincipalType: 'organization',
      credentialFingerprint: 'a'.repeat(64),
      authorizationMode: 'exact',
      operation: 'create',
      entityId: 'news-1',
    });
  });

  it('uses the immutable mainserver operation id as the history correlation reference', async () => {
    state.readMainserverMutationFollowUpContext.mockReturnValueOnce({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      activeOrganizationId: 'org-1',
      actingPrincipalType: 'organization',
      credentialSource: 'organization',
      credentialFingerprint: 'a'.repeat(64),
      operationExternalId: 'operation-immutable-1',
    });
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/news/news-1', {
        method: 'PATCH',
        headers: { 'x-sva-operation-id': 'operation-immutable-1' },
      }),
      new Response(JSON.stringify({ data: { id: 'news-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      'news.article'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenCalledWith(
      expect.objectContaining({ mutationRef: 'operation-immutable-1' })
    );
  });

  it('accepts generic item projection refreshes', async () => {
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/generic-items', { method: 'POST' }),
      new Response(JSON.stringify({ data: { id: 'generic-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      'generic-items.generic-item'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'operation-1',
      contentType: 'generic-items.generic-item',
      organizationId: 'org-1',
      actingPrincipalType: 'organization',
      credentialFingerprint: 'a'.repeat(64),
      authorizationMode: 'exact',
      operation: 'create',
      entityId: 'generic-1',
    });
  });

  it('refreshes bound project updates using the provider id from the response header', async () => {
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/projects/project-1', { method: 'PATCH' }),
      new Response(JSON.stringify({ data: { id: 'project-1' } }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-sva-mainserver-entity-id': 'provider-project-1',
        },
      }),
      'projects.project'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'projects.project',
        operation: 'update',
        entityId: 'provider-project-1',
      })
    );
  });

  it('derives mutation identity from root response ids and Location headers', async () => {
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/news', { method: 'POST' }),
      new Response(JSON.stringify({ id: 'news-root-1' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
      'news.article'
    );
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/events', { method: 'POST' }),
      new Response(null, {
        status: 201,
        headers: { location: '/api/v1/mainserver/events/event-location-1' },
      }),
      'events.event-record'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ entityId: 'news-root-1' })
    );
    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ entityId: 'event-location-1' })
    );
  });

  it('preserves a successful create response when no item identity can be resolved', async () => {
    await expect(
      refreshProjectionAfterMainserverMutation(
        new Request('https://studio.test/api/v1/mainserver/generic-items', { method: 'POST' }),
        new Response('created', { status: 200, headers: { 'content-type': 'text/plain' } }),
        'generic-items.generic-item'
      )
    ).resolves.toBeUndefined();

    expect(state.refreshProjectedContentsForMainserverMutation).not.toHaveBeenCalled();
    expect(state.loggerWarn).toHaveBeenCalledWith(
      'Mainserver mutation succeeded without a resolvable entity identity',
      expect.objectContaining({ contentType: 'generic-items.generic-item', method: 'POST' })
    );
  });

  it('derives delete refresh identity from the request path', async () => {
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/events/event-9', { method: 'DELETE' }),
      new Response(JSON.stringify({ data: { id: 'event-9' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      'events.event-record'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'operation-1',
      contentType: 'events.event-record',
      organizationId: 'org-1',
      actingPrincipalType: 'organization',
      credentialFingerprint: 'a'.repeat(64),
      authorizationMode: 'exact',
      operation: 'delete',
      entityId: 'event-9',
    });
  });

  it('derives the entity id from nested mutation paths like visibility updates', async () => {
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/news/news-42/visibility', {
        method: 'PATCH',
      }),
      new Response(null, { status: 204 }),
      'news.article'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenCalledWith({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Redaktion',
      mutationRef: 'operation-1',
      contentType: 'news.article',
      organizationId: 'org-1',
      actingPrincipalType: 'organization',
      credentialFingerprint: 'a'.repeat(64),
      authorizationMode: 'exact',
      operation: 'update',
      entityId: 'news-42',
    });
  });

  it('keeps nested survey response ids from replacing the survey path identity', async () => {
    await refreshProjectionAfterMainserverMutation(
      new Request(
        'https://studio.test/api/v1/mainserver/surveys/survey-42/free-text-responses/response-1',
        { method: 'PATCH' }
      ),
      new Response(JSON.stringify({ data: { id: 'response-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      'surveys.survey'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: 'surveys.survey', entityId: 'survey-42' })
    );
  });

  it('skips targeted entity id derivation when the request path is outside known mainserver collections', async () => {
    await expect(
      refreshProjectionAfterMainserverMutation(
        new Request('https://studio.test/api/v1/other/news/news-42', {
          method: 'PATCH',
        }),
        new Response(null, { status: 204 }),
        'news.article'
      )
    ).resolves.toBeUndefined();
    await expect(
      refreshProjectionAfterMainserverMutation(
        new Request('https://studio.test/api/v1/mainserver/unknown/news-42', {
          method: 'PATCH',
        }),
        new Response(null, { status: 204 }),
        'news.article'
      )
    ).resolves.toBeUndefined();

    expect(state.refreshProjectedContentsForMainserverMutation).not.toHaveBeenCalled();
  });

  it('preserves a successful provider write when the projection follow-up fails', async () => {
    state.refreshProjectedContentsForMainserverMutation.mockRejectedValueOnce(
      new Error('projection down')
    );

    await expect(
      refreshProjectionAfterMainserverMutation(
        new Request('https://studio.test/api/v1/mainserver/news/news-1', { method: 'PATCH' }),
        new Response(null, { status: 204 }),
        'news.article'
      )
    ).resolves.toBeUndefined();

    expect(state.loggerWarn).toHaveBeenCalledWith(
      'Mainserver mutation projection refresh failed after a successful provider write',
      expect.objectContaining({
        contentType: 'news.article',
        entityId: 'news-1',
        error: 'projection down',
      })
    );
  });

  it('skips projection refresh for read-only requests and failed responses', async () => {
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/news', { method: 'GET' }),
      new Response('{}', { status: 200 }),
      'news.article'
    );
    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/news', { method: 'POST' }),
      new Response('{}', { status: 503 }),
      'news.article'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).not.toHaveBeenCalled();
  });

  it('skips projection refresh when no mutation principal context was bound', async () => {
    state.readMainserverMutationFollowUpContext.mockReturnValueOnce(undefined);

    await refreshProjectionAfterMainserverMutation(
      new Request('https://studio.test/api/v1/mainserver/news/news-1', { method: 'PATCH' }),
      new Response(JSON.stringify({ data: { id: 'news-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      'news.article'
    );

    expect(state.refreshProjectedContentsForMainserverMutation).not.toHaveBeenCalled();
    expect(state.loggerWarn).toHaveBeenCalledWith(
      'Skipped Mainserver mutation projection refresh without a bound principal context',
      expect.objectContaining({ contentType: 'news.article', method: 'PATCH' })
    );
  });

  it('keeps the mutation fachlich successful when journal loading fails', async () => {
    state.loadMainserverMutationJournal.mockRejectedValueOnce(new Error('db down'));

    await expect(
      refreshProjectionAfterMainserverMutation(
        new Request('https://studio.test/api/v1/mainserver/poi', { method: 'POST' }),
        new Response(JSON.stringify({ data: { id: 'poi-1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
        'poi.point-of-interest'
      )
    ).resolves.toBeUndefined();

    expect(state.refreshProjectedContentsForMainserverMutation).not.toHaveBeenCalled();
    expect(state.loggerWarn).toHaveBeenCalledTimes(1);
  });

  it('keeps a personal principal with an active organization bound to personal credentials', async () => {
    state.readMainserverMutationFollowUpContext.mockReturnValueOnce({
      instanceId: 'de-musterhausen',
      keycloakSubject: 'kc-user-1',
      actorAccountId: 'account-1',
      actorDisplayName: 'Persönliche Redaktion',
      activeOrganizationId: 'org-1',
      actingPrincipalType: 'user',
      credentialSource: 'user',
      credentialFingerprint: 'b'.repeat(64),
      operationExternalId: 'operation-user-1',
    });

    await expect(
      refreshProjectionAfterMainserverMutation(
        new Request('https://studio.test/api/v1/mainserver/poi', { method: 'POST' }),
        new Response(JSON.stringify({ data: { id: 'poi-1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
        'poi.point-of-interest'
      )
    ).resolves.toBeUndefined();

    expect(state.refreshProjectedContentsForMainserverMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        actingPrincipalType: 'user',
        credentialFingerprint: 'b'.repeat(64),
        mutationRef: 'operation-user-1',
      })
    );
  });
});
