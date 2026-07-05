import React from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioDataTable,
  type StudioDataTableLabels,
  StudioEmptyState,
  StudioErrorState,
  StudioLoadingState,
  StudioOverviewPageTemplate,
} from '@sva/studio-ui-react';

import { listGenericItems } from './generic-items.api.js';
import { GenericItemsDetailPage } from './generic-items.detail-page.js';
import { normalizeListSearch } from './list-pagination.js';
import type { GenericItemContentItem, GenericItemListResult } from './generic-items.types.js';

const createDataTableLabels = (
  pt: ReturnType<typeof usePluginTranslation>
): Readonly<StudioDataTableLabels> => ({
  selectionColumn: pt('fields.actions'),
  actionsColumn: pt('fields.actions'),
  loading: pt('messages.loading'),
  selectAllRows: (label: string) => label,
  selectRow: ({ label }: { label: string }) => label,
});

export function GenericItemsListPage() {
  const pt = usePluginTranslation('genericItems');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { readonly page?: number; readonly pageSize?: number };
  const { page, pageSize } = normalizeListSearch(search);
  const [result, setResult] = React.useState<GenericItemListResult>({
    data: [],
    pagination: { page, pageSize, hasNextPage: false },
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    listGenericItems({ page, pageSize })
      .then((data) => {
        if (active) {
          setResult(data);
          setError(null);
        }
      })
      .catch(() => {
        if (active) {
          setError(pt('messages.loadError'));
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
          <Link to="/admin/generic-items/new">{pt('actions.create')}</Link>
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
            labels={createDataTableLabels(pt)}
            data={result.data}
            columns={[
              { id: 'title', header: pt('fields.title'), cell: (item: GenericItemContentItem) => item.title },
              { id: 'genericType', header: pt('fields.genericType'), cell: (item: GenericItemContentItem) => item.genericType },
              { id: 'updatedAt', header: pt('fields.updatedAt'), cell: (item: GenericItemContentItem) => item.updatedAt },
            ]}
            rowActions={(item: GenericItemContentItem) => (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/generic-items/$id" params={{ id: item.id }}>
                  {pt('actions.edit')}
                </Link>
              </Button>
            )}
            emptyState={null}
            getRowId={(item: GenericItemContentItem) => item.id}
            selectionMode="none"
          />
          <nav aria-label={pt('pagination.ariaLabel')} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <p key={result.pagination.page}>{pt('pagination.pageLabel', { page: result.pagination.page })}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={result.pagination.page <= 1}
                onClick={() =>
                  void navigate({
                    to: '/admin/generic-items',
                    search: (current: Record<string, unknown>) => ({
                      ...current,
                      page: Math.max(1, result.pagination.page - 1),
                      pageSize: result.pagination.pageSize,
                    }),
                  })
                }
              >
                {pt('pagination.previous')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!result.pagination.hasNextPage}
                onClick={() =>
                  void navigate({
                    to: '/admin/generic-items',
                    search: (current: Record<string, unknown>) => ({
                      ...current,
                      page: result.pagination.page + 1,
                      pageSize: result.pagination.pageSize,
                    }),
                  })
                }
              >
                {pt('pagination.next')}
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}

export const GenericItemsCreatePage = () => <GenericItemsDetailPage mode="create" />;

export const GenericItemsEditPage = () => {
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  return <GenericItemsDetailPage mode="edit" contentId={params.contentId ?? params.id} />;
};
