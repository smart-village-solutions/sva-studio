import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button, Input, StudioOverviewPageTemplate } from '@sva/studio-ui-react';
import {
  parseSearchQuery,
  searchQueryParams,
  type SearchQuery,
  type SearchResults,
} from './search-contract.js';
import { SearchFilters } from './search-filters.js';
const emptyOptions: SearchResults['options'] = { types: [], categories: [], providers: [] };
export const SearchResultsPage = ({ contextKey = '' }: { readonly contextKey?: string }) => {
  const t = usePluginTranslation('search');
  const search = useSearch({ strict: false });
  const query = useMemo(() => parseSearchQuery(search), [search]);
  const navigate = useNavigate();
  const [input, setInput] = useState(query.q);
  const [result, setResult] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const queryKey = searchQueryParams(query).toString();
  const update = (next: SearchQuery) => {
    void navigate({ to: '/plugins/search' as never, search: next as never });
  };
  useEffect(() => {
    setInput(query.q);
  }, [query.q]);
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
  const errorKey =
    error === 'search_not_configured'
      ? 'notConfigured'
      : error === 'search_context_changed'
        ? 'contextChanged'
        : 'error';
  return (
    <StudioOverviewPageTemplate title={t('title')} description={t('description')}>
      <form
        role="search"
        aria-label={t('title')}
        className="flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          update({ ...query, q: input.trim(), page: 1 });
        }}
      >
        <Input
          autoFocus
          type="search"
          aria-label={t('prompt')}
          placeholder={t('prompt')}
          value={input}
          maxLength={250}
          onChange={(event) => setInput(event.target.value)}
          className="min-w-0 flex-1"
        />
        <Button type="submit">{t('submit')}</Button>
      </form>
      <SearchFilters
        query={query}
        options={result?.options ?? emptyOptions}
        loading={loading}
        onChange={update}
      />
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="text-sm text-muted-foreground"
      >
        {loading
          ? t('loading')
          : result
            ? result.complete
              ? t('count', { allowed: result.allowed, denied: result.denied })
              : t('available', { allowed: result.allowed })
            : !query.q
              ? t('initial')
              : null}
      </div>
      {error ? (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4"
        >
          <p>{t(errorKey)}</p>
          <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>
            {t('retry')}
          </Button>
        </div>
      ) : null}
      {result && !result.complete ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <p>{t('incomplete')}</p>
          <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>
            {t('retry')}
          </Button>
        </div>
      ) : null}
      {result && result.complete && result.items.length === 0 ? (
        <p className="py-8 text-muted-foreground">{t('empty')}</p>
      ) : null}
      {result ? (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {result.items.map((item) => (
            <li key={`${item.contentType}:${item.id}`} className="space-y-2 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{t(`types.${item.contentType.split('.')[0]}`)}</Badge>
                <span className="text-sm text-muted-foreground">{item.providerName}</span>
              </div>
              <h2 className="text-lg font-semibold">
                <Link
                  to={item.href as never}
                  className="text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {item.title}
                </Link>
              </h2>
              {item.excerpt ? (
                <p className="max-w-prose text-sm text-muted-foreground">{item.excerpt}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {result && (query.page > 1 || result.hasNextPage) ? (
        <nav
          aria-label={t('page', { page: query.page })}
          className="flex items-center justify-between gap-3"
        >
          <Button
            variant="secondary"
            disabled={query.page <= 1 || loading}
            onClick={() => update({ ...query, page: query.page - 1 })}
          >
            {t('previous')}
          </Button>
          <span className="text-sm">{t('page', { page: query.page })}</span>
          <Button
            variant="secondary"
            disabled={!result.hasNextPage || loading}
            onClick={() => update({ ...query, page: query.page + 1 })}
          >
            {t('next')}
          </Button>
        </nav>
      ) : null}
    </StudioOverviewPageTemplate>
  );
};
