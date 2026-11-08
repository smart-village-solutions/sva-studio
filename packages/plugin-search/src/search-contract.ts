export const searchModels = ['NewsItem', 'EventRecord', 'PointOfInterest', 'GenericItem'] as const;
export type SearchModel = (typeof searchModels)[number];
const searchSortFields = ['title', 'contentType', 'providerName'] as const;
type SearchSortField = (typeof searchSortFields)[number];
export type SearchQuery = Readonly<{
  q: string;
  types: readonly string[];
  categories: readonly string[];
  provider: string;
  page: number;
  sortBy?: SearchSortField;
  sortDirection?: 'asc' | 'desc';
}>;
export type SearchCandidate = Readonly<{
  model: SearchModel;
  id: string;
  providerId?: string;
  categories?: readonly string[];
}>;
export type SearchDocument = Readonly<{
  id: string;
  contentType: string;
  title: string;
  excerpt: string;
  href: string;
  providerId: string;
  providerName: string;
  categories: readonly string[];
}>;
export type SearchResolution =
  | Readonly<{ kind: 'allowed'; document: SearchDocument }>
  | Readonly<{ kind: 'denied' | 'unresolved' | 'excluded' }>;
export type SearchResults = Readonly<{
  items: readonly SearchDocument[];
  allowed: number;
  denied: number;
  complete: boolean;
  hasNextPage: boolean;
  options: Readonly<{
    types: readonly string[];
    categories: readonly string[];
    providers: readonly Readonly<{ id: string; name: string }>[];
  }>;
}>;
const hasControlCharacter = (value: string): boolean =>
  [...value].some((character) => character.charCodeAt(0) < 32);
const strings = (value: unknown): readonly string[] => {
  const values = typeof value === 'string' ? [value] : Array.isArray(value) ? value : [];
  if (
    values.length > 30 ||
    values.some(
      (entry) => typeof entry !== 'string' || entry.length > 128 || hasControlCharacter(entry)
    )
  )
    throw new Error('invalid_search');
  return [
    ...new Set(
      values
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
    ),
  ].sort();
};
const readSearchSort = (
  input: Record<string, unknown>
): Pick<SearchQuery, 'sortBy' | 'sortDirection'> => {
  const sortBy = input.sortBy;
  const sortDirection = input.sortDirection;
  if (
    (sortBy !== undefined && !searchSortFields.includes(sortBy as SearchSortField)) ||
    (sortDirection !== undefined && sortDirection !== 'asc' && sortDirection !== 'desc')
  )
    throw new Error('invalid_search');
  return {
    ...(sortBy ? { sortBy: sortBy as SearchSortField } : {}),
    ...(sortDirection ? { sortDirection: sortDirection as 'asc' | 'desc' } : {}),
  };
};
export const parseSearchQuery = (input: Record<string, unknown>): SearchQuery => {
  const q = typeof input.q === 'string' ? input.q.trim() : '';
  const provider = typeof input.provider === 'string' ? input.provider.trim() : '';
  const page = input.page === undefined ? 1 : Number(input.page);
  if (
    q.length > 250 ||
    provider.length > 128 ||
    hasControlCharacter(q + provider) ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1000
  )
    throw new Error('invalid_search');
  return {
    q,
    provider,
    page,
    types: strings(input.types),
    categories: strings(input.categories),
    ...readSearchSort(input),
  };
};
export const readSearchQuery = (url: URL): SearchQuery =>
  parseSearchQuery({
    q: url.searchParams.get('q') ?? '',
    provider: url.searchParams.get('provider') ?? '',
    types: url.searchParams.getAll('types'),
    categories: url.searchParams.getAll('categories'),
    page: url.searchParams.get('page') ?? 1,
    sortBy: url.searchParams.get('sortBy') ?? undefined,
    sortDirection: url.searchParams.get('sortDirection') ?? undefined,
  });
export const searchQueryParams = (query: SearchQuery): URLSearchParams => {
  const result = new URLSearchParams({ q: query.q, page: String(query.page) });
  if (query.sortBy) result.set('sortBy', query.sortBy);
  if (query.sortDirection) result.set('sortDirection', query.sortDirection);
  for (const type of query.types) result.append('types', type);
  for (const category of query.categories) result.append('categories', category);
  if (query.provider) result.set('provider', query.provider);
  return result;
};
export const candidateKey = (candidate: SearchCandidate): string =>
  `${candidate.model}:${candidate.id}`;
