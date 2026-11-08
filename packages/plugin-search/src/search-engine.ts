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

/** Candidates are resolved before any presentation data, options or paging leaves the server. */
export const executeSearch = async (
  query: SearchQuery,
  host: SearchEngineHost
): Promise<SearchResults> => {
  const now = host.now ?? Date.now;
  const deadline = now() + 15_000;
  const permitted: SearchDocument[] = [];
  const optionDocuments: SearchDocument[] = [];
  const seen = new Set<string>();
  let denied = 0;
  let unresolved = 0;
  let exhausted = query.q.length === 0;
  if (query.q) {
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
        const candidates = page.candidates.filter((candidate) => {
          const key = candidateKey(candidate);
          if (candidate.model !== model || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        for (let index = 0; index < candidates.length; index += 4) {
          if (now() >= deadline) {
            unresolved += candidates.length - index;
            break;
          }
          const resolutions = await Promise.all(
            candidates.slice(index, index + 4).map(host.resolve)
          );
          for (const result of resolutions) {
            if (result.kind === 'allowed') {
              optionDocuments.push(result.document);
              if (matches(result.document, query)) permitted.push(result.document);
            } else if (result.kind === 'denied') {
              // Host only denies candidates after applying the same selected filter scope.
              denied += 1;
            } else if (result.kind === 'unresolved') unresolved += 1;
          }
        }
      }
    }
    exhausted = done.size === searchModels.length;
  }
  if (!(await host.isCurrent())) throw new Error('search_context_changed');
  const start = (query.page - 1) * pageSize;
  const providers = new Map<string, string>();
  for (const document of optionDocuments)
    if (document.providerId) providers.set(document.providerId, document.providerName);
  return {
    items: permitted.slice(start, start + pageSize),
    allowed: permitted.length,
    denied,
    complete: exhausted && unresolved === 0,
    hasNextPage: permitted.length > start + pageSize,
    options: {
      types: [...new Set(optionDocuments.map((document) => document.contentType))].sort(),
      categories: [...new Set(optionDocuments.flatMap((document) => document.categories))].sort(),
      providers: [...providers]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
};
