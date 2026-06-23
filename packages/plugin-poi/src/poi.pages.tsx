import React from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioDataTable,
  StudioEmptyState,
  StudioErrorState,
  StudioLoadingState,
  StudioOverviewPageTemplate,
} from '@sva/studio-ui-react';

import { listPoi } from './poi.api.js';
import { PoiDetailPage } from './poi.detail-page.js';
import { normalizeListSearch } from './list-pagination.js';
import type { PoiContentItem, PoiListResult } from './poi.types.js';

type ListSearchState = Record<string, unknown>;

const errorMessage = (pt: ReturnType<typeof usePluginTranslation>, fallbackKey: string) => pt(fallbackKey);

const createPoiListColumns = (pt: ReturnType<typeof usePluginTranslation>) => [
  { id: 'name', header: pt('fields.name'), cell: (item: PoiContentItem) => item.name },
  {
    id: 'categoryName',
    header: pt('fields.categoryName'),
    cell: (item: PoiContentItem) => item.categoryName ?? pt('values.notAvailable'),
  },
  {
    id: 'active',
    header: pt('fields.active'),
    cell: (item: PoiContentItem) => (item.active === false ? pt('values.notAvailable') : pt('values.active')),
  },
];

const PoiPaginationNav = ({
  page,
  hasNextPage,
  onPageChange,
  pt,
}: Readonly<{
  page: number;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
  pt: ReturnType<typeof usePluginTranslation>;
}>) => (
  <nav aria-label={pt('pagination.ariaLabel')} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
    <p key={page} aria-live="polite" className="animate-pagination-active">
      {pt('pagination.pageLabel', { page })}
    </p>
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}>
        {pt('pagination.previous')}
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={!hasNextPage} onClick={() => onPageChange(page + 1)}>
        {pt('pagination.next')}
      </Button>
    </div>
  </nav>
);

export function PoiListPage() {
  const pt = usePluginTranslation('poi');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as ListSearchState;
  const normalizedSearch = normalizeListSearch(search);
  const page = normalizedSearch.page;
  const pageSize = normalizedSearch.pageSize;
  const [result, setResult] = React.useState<PoiListResult>({
    data: [],
    pagination: { page, pageSize, hasNextPage: false },
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const handlePageChange = React.useCallback(
    (nextPage: number) => {
      void navigate({
        to: '/admin/poi',
        search: (current: Record<string, unknown>) => ({
          ...current,
          page: nextPage,
          pageSize: result.pagination.pageSize,
        }),
      });
    },
    [navigate, result.pagination.pageSize]
  );

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    listPoi({ page, pageSize })
      .then((data) => {
        if (active) {
          setResult(data);
          setError(null);
        }
      })
      .catch(() => {
        if (active) {
          setError(errorMessage(pt, 'messages.loadError'));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [page, pageSize, pt]);

  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      primaryAction={
        <Button asChild>
          <Link to="/admin/poi/new">{pt('actions.create')}</Link>
        </Button>
      }
    >
      {loading ? <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState> : null}
      {error ? <StudioErrorState>{error}</StudioErrorState> : null}
      {!loading && !error && result.data.length === 0 ? <StudioEmptyState>{pt('empty.title')}</StudioEmptyState> : null}
      {!loading && !error && result.data.length > 0 ? (
        <div className="space-y-4">
          <StudioDataTable
            ariaLabel={pt('list.title')}
            labels={{
              selectionColumn: pt('fields.actions'),
              actionsColumn: pt('fields.actions'),
              loading: pt('messages.loading'),
              selectAllRows: (label) => label,
              selectRow: ({ label }) => label,
            }}
            data={result.data}
            columns={createPoiListColumns(pt)}
            rowActions={(item) => (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/poi/$id" params={{ id: item.id }}>
                  {pt('actions.edit')}
                </Link>
              </Button>
            )}
            emptyState={null}
            getRowId={(item) => item.id}
            selectionMode="none"
          />
          <PoiPaginationNav
            page={result.pagination.page}
            hasNextPage={result.pagination.hasNextPage}
            onPageChange={handlePageChange}
            pt={pt}
          />
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}

export function PoiCreatePage({ instanceId }: Readonly<{ instanceId?: string }> = {}) {
  return <PoiDetailPage mode="create" instanceId={instanceId} />;
}

export function PoiEditPage({ instanceId }: Readonly<{ instanceId?: string }> = {}) {
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  return <PoiDetailPage mode="edit" contentId={params.contentId ?? params.id} instanceId={instanceId} />;
}
