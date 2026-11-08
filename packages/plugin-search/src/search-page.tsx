import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioListPageTemplate } from '@sva/studio-ui-react';
import {
  parseSearchQuery,
  searchQueryParams,
  type SearchQuery,
  type SearchResults,
} from './search-contract.js';
import { SearchFeedback, SearchResultTable } from './search-results.js';
const useSearchResults = (query: SearchQuery, contextKey: string, locale: 'de' | 'en') => {
  const [result, setResult] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const queryKey = searchQueryParams(query).toString();
  useEffect(() => setResult(null), [contextKey]);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setError('');
    if (!query.q) {
      setResult(null);
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    void fetch(`/api/v1/plugins/search/query?${queryKey}`, {
      credentials: 'same-origin',
      headers: { 'Accept-Language': locale },
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as { data?: SearchResults; error?: string };
        if (!response.ok || !payload.data) throw new Error(payload.error ?? 'search_unavailable');
        if (current) setResult(payload.data);
      })
      .catch((failure: unknown) => {
        if (current) {
          setResult(null);
          setError(failure instanceof Error ? failure.message : 'search_unavailable');
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      controller.abort();
    };
  }, [queryKey, contextKey, locale, retry]);
  return { result, loading, error, retry: () => setRetry((value) => value + 1) };
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
