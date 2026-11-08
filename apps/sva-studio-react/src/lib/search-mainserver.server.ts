import {
  readEffectiveSvaMainserverCredentialsWithStatus,
  resolveEffectivePermissions,
  withAuthenticatedUser,
} from '@sva/auth-runtime/server';
import { convertRichTextHtmlToPlainText } from '@sva/core';
import type { SearchHost, SearchUserContext } from '@sva/plugin-search/server';
import type {
  SearchCandidate,
  SearchDocument,
  SearchQuery,
  SearchResolution,
} from '@sva/plugin-search/search-contract';
import { studioServerPluginSnapshot } from './plugin-catalog.server.js';
import { studioMainserverGenericTypeRegistry } from './mainserver-generic-type-registry.server.js';

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const string = (value: unknown): string => (typeof value === 'string' ? value : '');
const routes = {
  'news.article': { path: 'news', handler: 'dispatchSvaMainserverNewsRequest' },
  'events.event-record': { path: 'events', handler: 'dispatchSvaMainserverEventsRequest' },
  'poi.point-of-interest': { path: 'poi', handler: 'dispatchSvaMainserverPoiRequest' },
  'generic-items.generic-item': {
    path: 'generic-items',
    handler: 'dispatchSvaMainserverGenericItemsRequest',
  },
  'faq.faq': { path: 'faqs', handler: 'dispatchSvaMainserverGenericItemsRequest' },
  'cockpit-cards.cockpit-card': {
    path: 'cockpit-cards',
    handler: 'dispatchSvaMainserverGenericItemsRequest',
  },
  'projects.project': { path: 'projects', handler: 'dispatchSvaMainserverGenericItemsRequest' },
  'vouchers.voucher': { path: 'vouchers', handler: 'dispatchSvaMainserverVouchersRequest' },
  'jobs.job': { path: 'jobs', handler: 'dispatchSvaMainserverJobsRequest' },
  'construction-sites.construction-site': {
    path: 'construction-sites',
    handler: 'dispatchSvaMainserverConstructionSitesRequest',
  },
} as const;
type RoutedType = keyof typeof routes;
// Keep only the automatically selected principal for this request, never its credentials.
const principalByRequest = new WeakMap<Request, 'organization' | 'user'>();
const typeFor = async (
  context: SearchUserContext,
  candidate: SearchCandidate,
  principal: 'organization' | 'user'
): Promise<{ contentType: string; visible: boolean; source?: Record<string, unknown> }> => {
  if (candidate.model === 'NewsItem') return { contentType: 'news.article', visible: true };
  if (candidate.model === 'EventRecord')
    return { contentType: 'events.event-record', visible: true };
  if (candidate.model === 'PointOfInterest')
    return { contentType: 'poi.point-of-interest', visible: true };
  const instanceId = context.actor.instanceId;
  if (!instanceId) throw new Error('missing_instance');
  const { getSvaMainserverGenericItem } = await import('@sva/sva-mainserver/server');
  const item = await getSvaMainserverGenericItem({
    instanceId,
    keycloakSubject: context.actor.id,
    activeOrganizationId: context.activeOrganizationId,
    actingPrincipalType: principal,
    genericItemId: candidate.id,
  });
  return {
    contentType:
      studioMainserverGenericTypeRegistry.get(item.genericType) ?? 'generic-items.generic-item',
    visible: item.visible === true,
    source: { ...item },
  };
};
const plainText = (value: unknown): string =>
  convertRichTextHtmlToPlainText(string(value), { includeLinkUrls: false })
    .replace(/\s+/gu, ' ')
    .trim();
const mapDocument = (
  data: Record<string, unknown>,
  contentType: string,
  href: string
): SearchDocument => {
  const provider = record(data.dataProvider);
  const blocks = Array.isArray(data.contentBlocks)
    ? data.contentBlocks.flatMap((block) => {
        const item = record(block);
        return item ? [item] : [];
      })
    : [];
  const categories = Array.isArray(data.categories)
    ? data.categories.flatMap((category) => {
        const item = record(category);
        return typeof category === 'string'
          ? [category]
          : item && typeof item.name === 'string'
            ? [item.name]
            : [];
      })
    : [];
  const title = plainText(data.title || data.name || blocks[0]?.title);
  const excerpt = plainText(
    data.description ||
      data.shortDescription ||
      blocks.map((block) => string(block.intro) + ' ' + string(block.body)).join(' ')
  ).slice(0, 280);
  return {
    id: string(data.id),
    contentType,
    title,
    excerpt,
    href,
    providerId: string(provider?.id),
    providerName: string(provider?.name),
    categories,
  };
};

const resolveDeniedCandidate = (
  query: SearchQuery,
  candidate: SearchCandidate,
  contentType: string
): SearchResolution => {
  if (query.types.length && !query.types.includes(contentType)) return { kind: 'excluded' };
  if (
    (query.provider && candidate.providerId === undefined) ||
    (query.categories.length && candidate.categories === undefined)
  )
    return { kind: 'unresolved' };
  if (query.provider && query.provider !== candidate.providerId) return { kind: 'excluded' };
  if (
    query.categories.length &&
    !query.categories.some((category) =>
      candidate.categories?.some((value) => plainText(value) === category)
    )
  )
    return { kind: 'excluded' };
  return { kind: 'denied' };
};

export const resolveSearchCandidate = async (
  context: SearchUserContext,
  query: SearchQuery,
  candidate: SearchCandidate
): Promise<SearchResolution> => {
  try {
    if (!principalByRequest.has(context.request)) await contextStamp(context);
    const principal = principalByRequest.get(context.request);
    if (!principal) return { kind: 'unresolved' };
    const { contentType, visible, source } = await typeFor(context, candidate, principal);
    if (!visible) return { kind: 'unresolved' };
    if (!Object.hasOwn(routes, contentType)) return { kind: 'unresolved' };
    const definition = studioServerPluginSnapshot.registry.studioContentTypes.find(
      (entry) => entry.contentType === contentType
    );
    if (!definition?.detailPath) return { kind: 'unresolved' };
    const route = routes[contentType as RoutedType];
    const url = new URL(context.request.url);
    url.pathname = `/api/v1/mainserver/${route.path}/${encodeURIComponent(candidate.id)}`;
    url.search = '';
    const headers = new Headers(context.request.headers);
    headers.delete('content-length');
    headers.delete('content-type');
    headers.set('X-SVA-Acting-Principal-Type', principal);
    const mainserver = await import('@sva/sva-mainserver/server');
    const response = await mainserver[route.handler](
      new Request(url, { method: 'GET', headers, signal: context.request.signal })
    );
    if (response?.status === 403) {
      return resolveDeniedCandidate(query, candidate, contentType);
    }
    if (!response?.ok) return { kind: 'unresolved' };
    const payload: unknown = await response.json();
    const data = record(record(payload)?.data);
    if (!data || data.visible === false || data.status === 'draft' || data.status === 'archived')
      return { kind: 'unresolved' };
    // GenericItem classification must still match the actual read, even after an upstream update.
    if (
      candidate.model === 'GenericItem' &&
      typeof data.genericType === 'string' &&
      (studioMainserverGenericTypeRegistry.get(data.genericType) ??
        'generic-items.generic-item') !== contentType
    )
      return { kind: 'unresolved' };
    const id = string(data.id);
    if (!id) return { kind: 'unresolved' };
    const document = mapDocument(
      { ...(source ?? data), id },
      contentType,
      definition.detailPath.replace('$id', encodeURIComponent(id))
    );
    return { kind: 'allowed', document };
  } catch {
    return { kind: 'unresolved' };
  }
};

/** Re-authenticate after the scan, including current effective permissions and organization. */
const contextStamp = async (context: SearchUserContext): Promise<string | null> => {
  const instanceId = context.actor.instanceId;
  if (!instanceId) return null;
  let stamp: string | null = null;
  await withAuthenticatedUser(context.request, async (current) => {
    if (
      current.user.id !== context.actor.id ||
      current.user.instanceId !== context.actor.instanceId ||
      current.activeOrganizationId !== context.activeOrganizationId ||
      current.sessionId !== context.sessionId
    )
      return new Response(null, { status: 409 });
    const permissions = await resolveEffectivePermissions({
      instanceId,
      keycloakSubject: current.user.id,
      organizationId: current.activeOrganizationId,
    });
    const credentials = await readEffectiveSvaMainserverCredentialsWithStatus({
      instanceId,
      keycloakSubject: current.user.id,
      activeOrganizationId: current.activeOrganizationId,
    });
    if (permissions.ok && credentials.status === 'ok') {
      if (!principalByRequest.has(context.request))
        principalByRequest.set(context.request, credentials.source);
      stamp = JSON.stringify([
        permissions.permissions,
        credentials.source,
        credentials.organizationId,
        credentials.credentialFingerprint,
      ]);
    }
    return new Response(null, { status: permissions.ok ? 204 : 503 });
  });
  return stamp;
};
export const searchMainserverHost: SearchHost = {
  loadGraphqlUrl: async (instanceId) => {
    const { loadSvaMainserverSettings } = await import('@sva/sva-mainserver/server');
    const config = await loadSvaMainserverSettings(instanceId);
    return config?.enabled ? config.graphqlBaseUrl : null;
  },
  resolve: resolveSearchCandidate,
  contextStamp,
};
