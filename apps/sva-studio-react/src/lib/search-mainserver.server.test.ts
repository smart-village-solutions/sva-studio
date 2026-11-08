import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  dispatch: vi.fn(),
  generic: vi.fn(),
  config: vi.fn(),
  current: {
    user: { id: 'user', instanceId: 'town' },
    activeOrganizationId: 'org',
    sessionId: 'session',
  },
  permissions: vi.fn(),
  credentials: vi.fn(),
}));
vi.mock('@sva/auth-runtime/server', () => ({
  resolveEffectivePermissions: state.permissions,
  readEffectiveSvaMainserverCredentialsWithStatus: state.credentials,
  withAuthenticatedUser: async (_request: Request, callback: (ctx: unknown) => Promise<Response>) =>
    callback(state.current),
}));
vi.mock('@sva/sva-mainserver/server', () => ({
  dispatchSvaMainserverNewsRequest: state.dispatch,
  dispatchSvaMainserverEventsRequest: state.dispatch,
  dispatchSvaMainserverPoiRequest: state.dispatch,
  dispatchSvaMainserverGenericItemsRequest: state.dispatch,
  dispatchSvaMainserverVouchersRequest: state.dispatch,
  dispatchSvaMainserverJobsRequest: state.dispatch,
  dispatchSvaMainserverConstructionSitesRequest: state.dispatch,
  getSvaMainserverGenericItem: state.generic,
  loadSvaMainserverSettings: state.config,
}));
vi.mock('./plugin-catalog.server.js', () => ({
  studioServerPluginSnapshot: {
    registry: {
      studioContentTypes: [
        { contentType: 'news.article', detailPath: '/admin/news/$id' },
        { contentType: 'faq.faq', detailPath: '/admin/faq/$id' },
        { contentType: 'generic-items.generic-item', detailPath: '/admin/generic-items/$id' },
        { contentType: 'projects.project', detailPath: '/admin/projects/$id' },
        { contentType: 'jobs.job', detailPath: '/admin/jobs/$id' },
        {
          contentType: 'construction-sites.construction-site',
          detailPath: '/admin/construction-sites/$id',
        },
      ],
    },
  },
}));
vi.mock('./mainserver-generic-type-registry.server.js', () => ({
  studioMainserverGenericTypeRegistry: new Map([
    ['FAQ', 'faq.faq'],
    ['FeaturedProject', 'projects.project'],
    ['Job', 'jobs.job'],
    ['ConstructionSite', 'construction-sites.construction-site'],
  ]),
}));
import { resolveSearchCandidate, searchMainserverHost } from './search-mainserver.server.js';
import type { SearchUserContext } from '@sva/plugin-search/server';
const context: SearchUserContext = {
  scope: 'tenant',
  request: new Request('https://studio.example/api/v1/plugins/search/query', {
    headers: { Cookie: 'session=private' },
  }),
  actor: { id: 'user', roles: [], instanceId: 'town' },
  sessionId: 'session',
  activeOrganizationId: 'org',
  pluginId: 'search',
  handlerId: 'search.query',
  pathParams: {},
};
const query = { q: 'city', types: [], categories: [], provider: '', page: 1 };
beforeEach(() => {
  vi.clearAllMocks();
  state.current.activeOrganizationId = 'org';
  state.credentials.mockResolvedValue({
    status: 'ok',
    source: 'organization',
    organizationId: 'org',
    credentialFingerprint: 'fingerprint-a',
  });
  state.permissions.mockResolvedValue({ ok: true, permissions: [{ action: 'news.read' }] });
  state.dispatch.mockImplementation(async () =>
    Response.json({
      data: {
        id: '42',
        title: '<b>City</b>',
        visible: true,
        description: '<p>Safe text</p>',
        dataProvider: { id: '1', name: 'Provider' },
        categories: [{ name: 'Culture' }],
      },
    })
  );
});
describe('search uses existing resource reads', () => {
  it('only returns presentation data after the existing detail route allows it', async () => {
    const result = await resolveSearchCandidate(context, query, { model: 'NewsItem', id: '42' });
    expect(result).toMatchObject({
      kind: 'allowed',
      document: { title: 'City', excerpt: 'Safe text', href: '/admin/news/42' },
    });
    const request = state.dispatch.mock.calls[0]?.[0] as Request;
    expect(new URL(request.url).pathname).toBe('/api/v1/mainserver/news/42');
    expect(request.headers.get('X-SVA-Acting-Principal-Type')).toBe('organization');
  });
  it('counts actual 403 decisions but treats not-found and technical failures as unresolved', async () => {
    for (const status of [403, 404, 503]) {
      state.dispatch.mockResolvedValueOnce(new Response(null, { status }));
      expect(await resolveSearchCandidate(context, query, { model: 'NewsItem', id: '42' })).toEqual(
        { kind: status === 403 ? 'denied' : 'unresolved' }
      );
    }
  });
  it('never exposes stale invisible candidates', async () => {
    state.dispatch.mockResolvedValueOnce(
      Response.json({ data: { id: '42', visible: false, title: 'Secret' } })
    );
    expect(await resolveSearchCandidate(context, query, { model: 'NewsItem', id: '42' })).toEqual({
      kind: 'unresolved',
    });
  });
  it('classifies GenericItems before using their own Fach permission route', async () => {
    state.generic.mockResolvedValue({ id: '42', genericType: 'FAQ', visible: true });
    state.dispatch.mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect(
      await resolveSearchCandidate(context, query, { model: 'GenericItem', id: '42' })
    ).toEqual({ kind: 'denied' });
    expect(new URL((state.dispatch.mock.calls[0]?.[0] as Request).url).pathname).toBe(
      '/api/v1/mainserver/faqs/42'
    );
  });
  it('does not count a different requested type as a permission denial', async () => {
    state.dispatch.mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect(
      await resolveSearchCandidate(
        context,
        { ...query, types: ['poi.point-of-interest'] },
        { model: 'NewsItem', id: '42' }
      )
    ).toEqual({ kind: 'excluded' });
    expect(state.dispatch).toHaveBeenCalledTimes(1);
  });
  it('rejects stale hidden GenericItems before their detail data can escape', async () => {
    state.generic.mockResolvedValue({ id: '42', genericType: 'FAQ', visible: false });
    expect(
      await resolveSearchCandidate(context, query, { model: 'GenericItem', id: '42' })
    ).toEqual({ kind: 'unresolved' });
    expect(state.dispatch).not.toHaveBeenCalled();
  });
  it('binds the result set to the current Mainserver credential fingerprint', async () => {
    const first = await searchMainserverHost.contextStamp(context);
    state.credentials.mockResolvedValue({
      status: 'ok',
      source: 'organization',
      organizationId: 'org',
      credentialFingerprint: 'fingerprint-b',
    });
    expect(await searchMainserverHost.contextStamp(context)).not.toBe(first);
    state.credentials.mockResolvedValue({ status: 'missing_credentials' });
    expect(await searchMainserverHost.contextStamp(context)).toBeNull();
  });
  it('counts denials only within the selected category/provider scope', async () => {
    state.dispatch.mockImplementation(async () => new Response(null, { status: 403 }));
    const filtered = { ...query, provider: '1', categories: ['Culture'] };
    expect(
      await resolveSearchCandidate(context, filtered, {
        model: 'NewsItem',
        id: '42',
        providerId: '2',
        categories: ['Culture'],
      })
    ).toEqual({ kind: 'excluded' });
    expect(
      await resolveSearchCandidate(context, filtered, {
        model: 'NewsItem',
        id: '42',
        providerId: '1',
        categories: ['Culture'],
      })
    ).toEqual({ kind: 'denied' });
    expect(
      await resolveSearchCandidate(context, filtered, { model: 'NewsItem', id: '42' })
    ).toEqual({ kind: 'unresolved' });
  });
  it('invalidates old organization and changed permission contexts', async () => {
    const stamp = await searchMainserverHost.contextStamp(context);
    state.permissions.mockResolvedValue({ ok: true, permissions: [] });
    expect(await searchMainserverHost.contextStamp(context)).not.toBe(stamp);
    state.current.activeOrganizationId = 'other';
    expect(await searchMainserverHost.contextStamp(context)).toBeNull();
  });
});

it.each([
  [
    'FeaturedProject',
    'projects.project',
    {
      id: 'local-project',
      status: 'published',
      published: true,
      description: 'Intro',
      fullText: 'Body',
    },
  ],
  [
    'Job',
    'jobs.job',
    {
      id: '42',
      genericType: 'Job',
      visible: true,
      input: { categories: [{ name: 'Culture' }], description: 'Body' },
    },
  ],
  [
    'ConstructionSite',
    'construction-sites.construction-site',
    {
      id: '42',
      genericType: 'ConstructionSite',
      visible: true,
      input: { categories: [{ name: 'Culture' }], description: 'Body' },
    },
  ],
])(
  'preserves authorized source metadata for mapped %s details',
  async (genericType, contentType, detail) => {
    state.generic.mockResolvedValue({
      id: '42',
      genericType,
      visible: true,
      title: 'Source title',
      categories: [{ name: 'Culture' }],
      dataProvider: { id: '1', name: 'Provider' },
      contentBlocks: [{ body: '<p>Current source text</p>' }],
    });
    state.dispatch.mockResolvedValueOnce(Response.json({ data: detail }));
    const result = await resolveSearchCandidate(
      context,
      { ...query, categories: ['Culture'] },
      { model: 'GenericItem', id: '42' }
    );
    expect(result).toMatchObject({
      kind: 'allowed',
      document: {
        id: detail.id,
        contentType,
        categories: ['Culture'],
        excerpt: 'Current source text',
        providerName: 'Provider',
      },
    });
  }
);
it('discards a project that becomes a draft between source and typed reads', async () => {
  state.generic.mockResolvedValue({ id: '42', genericType: 'FeaturedProject', visible: true });
  state.dispatch.mockResolvedValueOnce(
    Response.json({ data: { id: '42', status: 'draft', published: false } })
  );
  expect(await resolveSearchCandidate(context, query, { model: 'GenericItem', id: '42' })).toEqual({
    kind: 'unresolved',
  });
});
