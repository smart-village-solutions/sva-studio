import { Link } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button } from '@sva/studio-ui-react';
import type { SearchQuery, SearchResults } from './search-contract.js';
export const SearchFeedback = ({
  result,
  loading,
  error,
  query,
  retry,
}: {
  result: SearchResults | null;
  loading: boolean;
  error: string;
  query: SearchQuery;
  retry: () => void;
}) => {
  const t = usePluginTranslation('search');
  const errorKey =
    error === 'search_not_configured'
      ? 'notConfigured'
      : error === 'search_context_changed'
        ? 'contextChanged'
        : 'error';
  return (
    <>
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
          <Button variant="secondary" onClick={retry}>
            {t('retry')}
          </Button>
        </div>
      ) : null}
      {result && !result.complete ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <p>{t('incomplete')}</p>
          <Button variant="secondary" onClick={retry}>
            {t('retry')}
          </Button>
        </div>
      ) : null}
      {result && result.complete && result.items.length === 0 ? (
        <p className="py-8 text-muted-foreground">{t('empty')}</p>
      ) : null}
    </>
  );
};
export const SearchResultList = ({ result }: { result: SearchResults | null }) => {
  const t = usePluginTranslation('search');
  return (
    <>
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
    </>
  );
};
export const SearchPaging = ({
  result,
  query,
  loading,
  update,
}: {
  result: SearchResults | null;
  query: SearchQuery;
  loading: boolean;
  update: (query: SearchQuery) => void;
}) => {
  const t = usePluginTranslation('search');
  return (
    <>
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
    </>
  );
};
