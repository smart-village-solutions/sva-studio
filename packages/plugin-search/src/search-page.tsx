import { useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioListPageTemplate, useStudioTableQuery } from '@sva/studio-ui-react';
import {
  parseSearchQuery,
  searchQueryParams,
  type SearchQuery,
  type SearchResults,
} from './search-contract.js';
import { SearchFeedback, SearchResultTable } from './search-results.js';
const useSearchResults = (query: SearchQuery, contextKey: string, locale: 'de' | 'en') => {
  const queryKey = searchQueryParams(query).toString();
  const list = useStudioTableQuery(
    ['search', contextKey, locale, queryKey],
    async (signal) => {
      const response = await fetch(`/api/v1/plugins/search/query?${queryKey}`, {
        credentials: 'same-origin',
        headers: { 'Accept-Language': locale },
        cache: 'no-store',
        signal,
      });
      const payload = (await response.json()) as { data?: SearchResults; error?: string };
      if (!response.ok || !payload.data) {
        throw Object.assign(new Error(payload.error ?? 'search_unavailable'), {
          status: response.status,
        });
      }
      return payload.data;
    },
    Boolean(query.q)
  );
  return {
    result: list.data ?? null,
    loading: Boolean(query.q) && list.state === 'loading',
    error:
      list.error instanceof Error ? list.error.message : list.error ? 'search_unavailable' : '',
    retry: list.refetch,
  };
};
export const SearchResultsPage = ({
  contextKey = '',
  locale = 'de',
}: {
  readonly contextKey?: string;
  readonly locale?: 'de' | 'en';
}) => {
  const pt = usePluginTranslation('search');
  const search = useSearch({ strict: false });
  const query = useMemo(() => parseSearchQuery(search), [search]);
  const navigate = useNavigate();
  const { result, loading, error, retry } = useSearchResults(query, contextKey, locale);
  const update = (next: SearchQuery) => {
    void navigate({ to: '/plugins/search' as never, search: next as never });
  };
  return (
    <section className="space-y-5">
      <StudioListPageTemplate title={pt('title')} description={pt('description')} />
      <SearchFeedback result={result} loading={loading} error={error} query={query} retry={retry} />
      <SearchResultTable result={result} query={query} loading={loading} update={update} />
    </section>
  );
};
