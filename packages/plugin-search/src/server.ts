import type {
  PluginServerExecutionHandler,
  PluginServerHandlerExecutionContext,
} from '@sva/plugin-sdk';
import { executeSearch } from './search-engine.js';
import {
  readSearchQuery,
  type SearchCandidate,
  type SearchQuery,
  type SearchResolution,
} from './search-contract.js';
import { readCandidatePage, type SearchConnection } from './search-meili.server.js';

export type SearchUserContext = Extract<
  PluginServerHandlerExecutionContext,
  { scope: 'platform' | 'tenant' }
>;
export type SearchHost = Readonly<{
  loadGraphqlUrl: (instanceId: string) => Promise<string | null>;
  resolve: (
    context: SearchUserContext,
    query: SearchQuery,
    candidate: SearchCandidate
  ) => Promise<SearchResolution>;
  contextStamp: (context: SearchUserContext) => Promise<string | null>;
}>;
export const readSearchConnection = (
  instanceId: string,
  graphqlUrl: string,
  env: Readonly<Record<string, string | undefined>>
): SearchConnection => {
  let source: unknown;
  try {
    const sources: unknown = JSON.parse(env.MEILI_SOURCES ?? '{}');
    source =
      sources &&
      typeof sources === 'object' &&
      Object.prototype.hasOwnProperty.call(sources, instanceId)
        ? (sources as Record<string, unknown>)[instanceId]
        : undefined;
  } catch {
    throw new Error('search_not_configured');
  }
  if (!source || typeof source !== 'object') throw new Error('search_not_configured');
  const config = source as Record<string, unknown>;
  if (
    config.graphqlBaseUrl !== graphqlUrl ||
    !['production', 'staging', 'development', 'test'].includes(String(config.environment)) ||
    !Array.isArray(config.municipalityIds) ||
    config.municipalityIds.length === 0 ||
    config.municipalityIds.length > 50 ||
    !config.municipalityIds.every(
      (id: unknown) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0
    )
  )
    throw new Error('search_not_configured');
  const url = new URL(env.MEILI_URL ?? 'https://invalid.invalid');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !env.MEILI_URL ||
    !env.MEILI_SEARCH_KEY?.trim()
  )
    throw new Error('search_not_configured');
  return {
    url: url.origin,
    key: env.MEILI_SEARCH_KEY,
    environment: config.environment as SearchConnection['environment'],
    municipalityIds: config.municipalityIds as number[],
  };
};
const json = (body: unknown, status = 200): Response =>
  Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie',
      'Referrer-Policy': 'no-referrer',
    },
  });
export const createPluginServerHandlers = (
  host: SearchHost
): Readonly<Record<string, PluginServerExecutionHandler>> => ({
  'search.query': async (context) => {
    if (context.scope !== 'tenant' || !context.actor.instanceId)
      return json({ error: 'forbidden' }, 403);
    const instanceId = context.actor.instanceId;
    let query: SearchQuery;
    try {
      query = readSearchQuery(new URL(context.request.url));
    } catch {
      return json({ error: 'invalid_search' }, 400);
    }
    try {
      const graphqlUrl = await host.loadGraphqlUrl(context.actor.instanceId);
      if (!graphqlUrl) return json({ error: 'search_not_configured' }, 503);
      const connection = readSearchConnection(context.actor.instanceId, graphqlUrl, process.env);
      const stamp = await host.contextStamp(context);
      if (!stamp) return json({ error: 'search_context_changed' }, 409);
      const data = await executeSearch(query, {
        readPage: (model, offset) => readCandidatePage(connection, query, model, offset),
        resolve: (candidate) => host.resolve(context, query, candidate),
        isCurrent: async () =>
          (await host.contextStamp(context)) === stamp &&
          (await host.loadGraphqlUrl(instanceId)) === graphqlUrl,
      });
      return json({ data });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'search_context_changed') return json({ error: code }, 409);
      return json({ error: code === 'search_not_configured' ? code : 'search_unavailable' }, 503);
    }
  },
});
