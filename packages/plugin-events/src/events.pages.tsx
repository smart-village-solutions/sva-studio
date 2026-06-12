import React from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { formatDateTimeInEditorTimeZone, usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioDataTable,
  StudioEmptyState,
  StudioErrorState,
  StudioLoadingState,
  StudioOverviewPageTemplate,
} from '@sva/studio-ui-react';

import { listEvents } from './events.api.js';
import { EventsDetailPage } from './events.detail-page.js';
import { normalizeListSearch } from './list-pagination.js';
import type { EventContentItem, EventListResult } from './events.types.js';

type ListSearchState = Record<string, unknown>;

const errorMessage = (pt: ReturnType<typeof usePluginTranslation>, fallbackKey: string) => pt(fallbackKey);

const updateListSearchPage = (
  current: ListSearchState,
  page: number,
  pageSize: number
): ListSearchState => ({
  ...current,
  page,
  pageSize,
});

export function EventsListPage() {
  const pt = usePluginTranslation('events');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { readonly page?: number; readonly pageSize?: number };
  const { page, pageSize } = normalizeListSearch(search);
  const [result, setResult] = React.useState<EventListResult>({
    data: [],
    pagination: { page, pageSize, hasNextPage: false },
  });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (search.page === page && search.pageSize === pageSize) {
      return;
    }

    Promise.resolve(
      navigate({
        to: '/admin/events',
        replace: true,
        search: (current: ListSearchState) => updateListSearchPage(current, page, pageSize),
      })
    ).catch(() => undefined);
  }, [navigate, page, pageSize, search.page, search.pageSize]);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    listEvents({ page, pageSize })
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
          <Link to="/admin/events/new">{pt('actions.create')}</Link>
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
            columns={[
              { id: 'title', header: pt('fields.title'), cell: (item: EventContentItem) => item.title },
              { id: 'categoryName', header: pt('fields.categoryName'), cell: (item: EventContentItem) => item.categoryName ?? '—' },
              {
                id: 'dateStart',
                header: pt('fields.dateStart'),
                cell: (item: EventContentItem) =>
                  item.dates?.[0]?.dateStart ? formatDateTimeInEditorTimeZone(item.dates[0].dateStart) : '—',
              },
            ]}
            rowActions={(item) => (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin/events/$id" params={{ id: item.id }}>
                  {pt('actions.edit')}
                </Link>
              </Button>
            )}
            emptyState={null}
            getRowId={(item) => item.id}
            selectionMode="none"
          />
          <nav aria-label={pt('pagination.ariaLabel')} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            <p key={result.pagination.page} aria-live="polite" className="animate-pagination-active">
              {pt('pagination.pageLabel', { page: result.pagination.page })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={result.pagination.page <= 1}
                onClick={() =>
                  void navigate({
                    to: '/admin/events',
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
                    to: '/admin/events',
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

export function EventsCreatePage() {
  return <EventsDetailPage mode="create" />;
}

export function EventsEditPage() {
  const params = useParams({ strict: false }) as { readonly contentId?: string; readonly id?: string };
  return <EventsDetailPage mode="edit" contentId={params.contentId ?? params.id} />;
}
