import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Input, StudioOverviewPageTemplate } from '@sva/studio-ui-react';
import {
  parseSearchQuery,
  searchQueryParams,
  type SearchQuery,
  type SearchResults,
} from './search-contract.js';
import { SearchFilters } from './search-filters.js';
import { SearchFeedback, SearchPaging, SearchResultList } from './search-results.js';
const emptyOptions: SearchResults['options'] = { types: [], categories: [], providers: [] };
const useSearchResults = (query: SearchQuery, contextKey: string) => {
  const [result, setResult] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const queryKey = searchQueryParams(query).toString();
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setResult(null);
    setError('');
    if (!query.q) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    void fetch(`/api/v1/plugins/search/query?${queryKey}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { data?: SearchResults; error?: string };
        if (!response.ok || !payload.data) throw new Error(payload.error ?? 'search_unavailable');
        if (current) setResult(payload.data);
      })
      .catch((failure: unknown) => {
        if (current) setError(failure instanceof Error ? failure.message : 'search_unavailable');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [queryKey, contextKey, retry]);
  return { result, loading, error, retry: () => setRetry((value) => value + 1) };
};
export const SearchResultsPage = ({ contextKey = '' }: { readonly contextKey?: string }) => {
  const pt = usePluginTranslation('search');
  const search = useSearch({ strict: false });
  const query = useMemo(() => parseSearchQuery(search), [search]);
  const navigate = useNavigate();
  const [input, setInput] = useState(query.q);
  const { result, loading, error, retry } = useSearchResults(query, contextKey);
  const update = (next: SearchQuery) => {
    void navigate({ to: '/plugins/search' as never, search: next as never });
  };
  useEffect(() => {
    setInput(query.q);
  }, [query.q]);
  return (
    <StudioOverviewPageTemplate title={pt('title')} description={pt('description')}>
      <form
        role="search"
        aria-label={pt('resultsLandmark')}
        className="flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          update({ ...query, q: input.trim(), page: 1 });
        }}
      >
        <Input
          autoFocus
          type="search"
          aria-label={pt('prompt')}
          placeholder={pt('prompt')}
          value={input}
          maxLength={250}
          onChange={(event) => setInput(event.target.value)}
          className="min-w-0 flex-1"
        />
        <Button type="submit">{pt('submit')}</Button>
      </form>
      <SearchFilters
        query={query}
        options={result?.options ?? emptyOptions}
        loading={loading}
        onChange={update}
      />
      <SearchFeedback result={result} loading={loading} error={error} query={query} retry={retry} />
      <SearchResultList result={result} />
      <SearchPaging result={result} query={query} loading={loading} update={update} />
    </StudioOverviewPageTemplate>
  );
};
