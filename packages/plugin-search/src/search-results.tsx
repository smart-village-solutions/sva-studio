import { Link } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioDataTable, type StudioColumnDef } from '@sva/studio-ui-react';
import {
  parseSearchQuery,
  type SearchDocument,
  type SearchQuery,
  type SearchResults,
} from './search-contract.js';
import { SearchFilters } from './search-filters.js';
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
  const pt = usePluginTranslation('search');
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
          ? pt('loading')
          : result
            ? result.complete
              ? pt('count', { allowed: result.allowed, denied: result.denied })
              : pt('available', { allowed: result.allowed })
            : !query.q
              ? pt('initial')
              : null}
      </div>
      {error ? (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4"
        >
          <p>{pt(errorKey)}</p>
          <Button variant="secondary" onClick={retry}>
            {pt('retry')}
          </Button>
        </div>
      ) : null}
      {result && !result.complete ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
          <p>{pt('incomplete')}</p>
          <Button variant="secondary" onClick={retry}>
            {pt('retry')}
          </Button>
        </div>
      ) : null}
    </>
  );
};
const resultColumns = (
  pt: ReturnType<typeof usePluginTranslation>
): readonly StudioColumnDef<SearchDocument>[] => [
  {
    id: 'title',
    header: pt('table.title'),
    sortable: true,
    sortLabel: pt('table.title'),
    sortValue: (item) => item.title,
    cell: (item) => (
      <div className="space-y-1">
        <Link to={item.href as never} className="text-primary underline-offset-4 hover:underline">
          {item.title}
        </Link>
        {item.excerpt ? (
          <p className="max-w-prose text-sm text-muted-foreground">{item.excerpt}</p>
        ) : null}
      </div>
    ),
  },
  {
    id: 'contentType',
    header: pt('type'),
    sortable: true,
    sortLabel: pt('type'),
    sortValue: (item) => item.contentType,
    cell: (item) => pt(`types.${item.contentType.split('.')[0]}`),
  },
  {
    id: 'providerName',
    header: pt('provider'),
    sortable: true,
    sortLabel: pt('provider'),
    sortValue: (item) => item.providerName,
    cell: (item) => item.providerName,
  },
  { id: 'categories', header: pt('category'), cell: (item) => item.categories.join(', ') },
];
export const SearchResultTable = ({
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
  const pt = usePluginTranslation('search');

  return (
    <div aria-busy={loading}>
      <StudioDataTable
        ariaLabel={pt('table.caption')}
        caption={pt('table.caption')}
        data={result?.items ?? []}
        columns={resultColumns(pt)}
        getRowId={(item) => `${item.contentType}:${item.id}`}
        selectionMode="none"
        emptyState={!query.q ? null : result?.complete ? pt('empty') : null}
        labels={{
          selectionColumn: pt('table.selection'),
          actionsColumn: pt('table.actions'),
          loading: pt('loading'),
          selectAllRows: (label) => label,
          selectRow: ({ label }) => label,
        }}
        sorting={{
          mode: 'external',
          labels: {
            field: pt('table.sortField'),
            direction: pt('table.sortDirection'),
            none: pt('table.sortNone'),
            ascending: pt('table.ascending'),
            descending: pt('table.descending'),
          },
          state: [{ id: query.sortBy ?? 'title', desc: query.sortDirection === 'desc' }],
          onChange: ([sort]) => {
            if (sort)
              update(
                parseSearchQuery({
                  ...query,
                  sortBy: sort.id,
                  sortDirection: sort.desc ? 'desc' : 'asc',
                  page: 1,
                })
              );
          },
        }}
        toolbarCenter={
          <SearchFilters
            query={query}
            options={result?.options ?? { types: [], categories: [], providers: [] }}
            loading={loading}
            onChange={update}
          />
        }
        footer={<SearchPaging result={result} query={query} loading={loading} update={update} />}
      />
    </div>
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
  const pt = usePluginTranslation('search');
  return (
    <>
      {result && (query.page > 1 || result.hasNextPage) ? (
        <nav
          aria-label={pt('page', { page: query.page })}
          className="flex items-center justify-between gap-3"
        >
          <Button
            variant="secondary"
            disabled={query.page <= 1 || loading}
            onClick={() => update({ ...query, page: query.page - 1 })}
          >
            {pt('previous')}
          </Button>
          <span className="text-sm">{pt('page', { page: query.page })}</span>
          <Button
            variant="secondary"
            disabled={!result.hasNextPage || loading}
            onClick={() => update({ ...query, page: query.page + 1 })}
          >
            {pt('next')}
          </Button>
        </nav>
      ) : null}
    </>
  );
};
