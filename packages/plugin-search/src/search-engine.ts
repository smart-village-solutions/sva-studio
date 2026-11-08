import {
  candidateKey,
  searchModels,
  type SearchCandidate,
  type SearchDocument,
  type SearchModel,
  type SearchQuery,
  type SearchResolution,
  type SearchResults,
} from './search-contract.js';

export type SearchSource = Readonly<{
  environment: 'production' | 'staging' | 'development' | 'test';
  municipalityIds: readonly number[];
}>;
export type CandidatePage = Readonly<{
  candidates: readonly SearchCandidate[];
  exhausted: boolean;
}>;
export type SearchEngineHost = Readonly<{
  readPage: (model: SearchModel, offset: number) => Promise<CandidatePage>;
  resolve: (candidate: SearchCandidate) => Promise<SearchResolution>;
  isCurrent: () => Promise<boolean>;
  now?: () => number;
}>;
const pageSize = 20;
const matches = (document: SearchDocument, query: SearchQuery): boolean =>
  (query.types.length === 0 || query.types.includes(document.contentType)) &&
  (query.categories.length === 0 ||
    query.categories.some((category) => document.categories.includes(category))) &&
  (!query.provider || document.providerId === query.provider);

const resolveCandidates = async (
  candidates: readonly SearchCandidate[],
  host: SearchEngineHost,
  deadline: number,
  now: () => number
) => {
  const documents: SearchDocument[] = [];
  let denied = 0;
  let unresolved = 0;
  for (let index = 0; index < candidates.length; index += 4) {
    if (now() >= deadline) {
      unresolved += candidates.length - index;
      break;
    }
    const resolutions = await Promise.all(candidates.slice(index, index + 4).map(host.resolve));
    for (const result of resolutions) {
      if (result.kind === 'allowed') documents.push(result.document);
      else if (result.kind === 'denied') denied += 1;
      else if (result.kind === 'unresolved') unresolved += 1;
    }
  }
  return { documents, denied, unresolved };
};
const uniqueCandidates = (page: CandidatePage, model: SearchModel, seen: Set<string>) =>
  page.candidates.filter((candidate) => {
    const key = candidateKey(candidate);
    if (candidate.model !== model || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
const scanCandidates = async (host: SearchEngineHost, now: () => number) => {
  const deadline = now() + 15_000;
  const documents: SearchDocument[] = [];
  const seen = new Set<string>();
  let denied = 0;
  let unresolved = 0;
  const offsets = new Map<SearchModel, number>(searchModels.map((model) => [model, 0]));
  const done = new Set<SearchModel>();
  while (done.size < searchModels.length && now() < deadline && seen.size < 10_000) {
    for (const model of searchModels) {
      if (done.has(model) || now() >= deadline || seen.size >= 10_000) continue;
      const offset = offsets.get(model) ?? 0;
      const page = await host.readPage(model, offset);
      if (page.exhausted) done.add(model);
      if (page.candidates.length === 0 && !page.exhausted) throw new Error('invalid_search_page');
      offsets.set(model, offset + page.candidates.length);
      const resolved = await resolveCandidates(
        uniqueCandidates(page, model, seen),
        host,
        deadline,
        now
      );
      documents.push(...resolved.documents);
      denied += resolved.denied;
      unresolved += resolved.unresolved;
    }
  }
  return { documents, denied, complete: done.size === searchModels.length && unresolved === 0 };
};
const sortDocuments = (documents: SearchDocument[], query: SearchQuery): SearchDocument[] => {
  const field = query.sortBy ?? 'title';
  const direction = query.sortDirection === 'desc' ? -1 : 1;
  return documents.sort(
    (left, right) =>
      direction *
        left[field].localeCompare(right[field], 'de', { sensitivity: 'base', numeric: true }) ||
      left.contentType.localeCompare(right.contentType) ||
      left.id.localeCompare(right.id, 'de', { numeric: true })
  );
};
const optionsFor = (documents: readonly SearchDocument[]): SearchResults['options'] => {
  const providers = new Map<string, string>();
  for (const document of documents)
    if (document.providerId) providers.set(document.providerId, document.providerName);
  return {
    types: [...new Set(documents.map((document) => document.contentType))].sort(),
    categories: [...new Set(documents.flatMap((document) => document.categories))].sort(),
    providers: [...providers]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
};
/** Candidates are resolved before any presentation data, options or paging leaves the server. */
export const executeSearch = async (
  query: SearchQuery,
  host: SearchEngineHost
): Promise<SearchResults> => {
  const scan = query.q
    ? await scanCandidates(host, host.now ?? Date.now)
    : { documents: [], denied: 0, complete: true };
  if (!(await host.isCurrent())) throw new Error('search_context_changed');
  const permitted = sortDocuments(
    scan.documents.filter((document) => matches(document, query)),
    query
  );
  const start = (query.page - 1) * pageSize;
  return {
    items: permitted.slice(start, start + pageSize),
    allowed: permitted.length,
    denied: scan.denied,
    complete: scan.complete,
    hasNextPage: permitted.length > start + pageSize,
    options: optionsFor(scan.documents),
  };
};
