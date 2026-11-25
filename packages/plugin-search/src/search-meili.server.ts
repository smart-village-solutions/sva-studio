import type { SearchModel, SearchQuery } from './search-contract.js';
import type { CandidatePage, SearchSource } from './search-engine.js';
export type SearchConnection = SearchSource & Readonly<{ url: string; key: string }>;
export type SearchFetcher = (url: URL, init: RequestInit) => Promise<Response>;

const readSearchResponse = async (response: Response): Promise<unknown> => {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('invalid_search_response');
  const decoder = new TextDecoder();
  let content = '';
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024 * 1024) {
        await reader.cancel();
        throw new Error('invalid_search_response');
      }
      content += decoder.decode(value, { stream: true });
    }
    return JSON.parse(content + decoder.decode()) as unknown;
  } finally {
    reader.releaseLock();
  }
};
const parseCandidate = (hit: unknown, model: SearchModel) => {
  if (
    !hit ||
    typeof hit !== 'object' ||
    !('id' in hit) ||
    !['string', 'number'].includes(typeof hit.id) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(String(hit.id))
  )
    throw new Error('invalid_search_response');
  const fields = hit as Record<string, unknown>;
  const providerId =
    typeof fields.data_provider_id === 'string' || typeof fields.data_provider_id === 'number'
      ? String(fields.data_provider_id)
      : undefined;
  const categories =
    Array.isArray(fields.categories) &&
    fields.categories.every((value: unknown) => typeof value === 'string')
      ? (fields.categories as string[])
      : undefined;
  return {
    model,
    id: String(hit.id),
    ...(providerId ? { providerId } : {}),
    ...(categories ? { categories } : {}),
  };
};
const batchSize = 100;
export const readCandidatePage = async (
  connection: SearchConnection,
  query: SearchQuery,
  model: SearchModel,
  offset: number,
  fetcher: SearchFetcher = fetch,
  limit: 0 | typeof batchSize = batchSize
): Promise<CandidatePage> => {
  const filter = [
    `(${connection.municipalityIds.map((id) => `municipality_id = ${id}`).join(' OR ')})`,
  ];
  const response = await fetcher(
    new URL(`/indexes/${model}_${connection.environment}/search`, connection.url),
    {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(5_000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.key}` },
      body: JSON.stringify({
        q: query.q,
        filter,
        attributesToRetrieve: ['id', 'data_provider_id', 'categories'],
        limit,
        offset,
      }),
    }
  );
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('search_upstream_unavailable');
  }
  const raw = await readSearchResponse(response);
  if (
    !raw ||
    typeof raw !== 'object' ||
    !('hits' in raw) ||
    !Array.isArray(raw.hits) ||
    raw.hits.length > batchSize
  )
    throw new Error('invalid_search_response');
  const candidates = raw.hits.map((hit: unknown) => parseCandidate(hit, model));
  return {
    candidates,
    exhausted: candidates.length < batchSize && offset + candidates.length < 100_000,
  };
};
