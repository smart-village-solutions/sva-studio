import {
  buildMainserverListUrl,
  MainserverApiError,
  normalizeListSearch,
  readPluginLocales,
  readSessionAccessSnapshot,
  requestMainserverJson,
  subscribeSessionAccessSnapshot,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  StudioDataTable,
  StudioEmptyState,
  StudioErrorState,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioPagination,
  useStudioTableQuery,
} from '@sva/studio-ui-react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useSyncExternalStore } from 'react';

import { tourDetailPath, toursCreatePath, toursPath } from './descriptor.js';

type NamedRecord = { id: string; name?: string | null };
export type TourSummary = NamedRecord & {
  active?: boolean | null;
  visible?: boolean | null;
  lengthKm?: number | null;
  updatedAt?: string | null;
  categories: readonly NamedRecord[];
  dataProvider?: NamedRecord | null;
};
type TourList = {
  data: readonly TourSummary[];
  pagination: { page: number; pageSize: number; hasNextPage: boolean };
};
type ReadError = 'forbidden' | 'notFound' | 'error';
type Translator = ReturnType<typeof usePluginTranslation>;
export const apiPath = '/api/v1/mainserver/tours';

export function useTourRead<T>(url: string) {
  const access = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const result = useStudioTableQuery(
    ['tours', url],
    (signal) =>
      requestMainserverJson<T, MainserverApiError>({
        url,
        init: { signal, cache: 'no-store' },
        errorFactory: (code, message, denial) => new MainserverApiError(code, message, denial),
      }),
    access.isResolved && !access.hasError
  );
  const code = result.error instanceof MainserverApiError ? result.error.code : undefined;
  const error: ReadError | undefined = access.hasError
    ? 'error'
    : result.error
      ? code === 'not_found'
        ? 'notFound'
        : code === 'forbidden'
          ? 'forbidden'
          : 'error'
      : undefined;
  return { ...result, error, loading: !error && result.state === 'loading' };
}

export const summaryFields = (pt: Translator) => {
  const { locale } = readPluginLocales();
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return [
    {
      id: 'categories',
      header: pt('categories'),
      cell: (tour: TourSummary) =>
        tour.categories
          .map(({ name }) => name)
          .filter(Boolean)
          .join(', ') || pt('unknown'),
    },
    {
      id: 'active',
      header: pt('active'),
      cell: (tour: TourSummary) => pt(tour.active == null ? 'unknown' : tour.active ? 'yes' : 'no'),
    },
    {
      id: 'visibility',
      header: pt('visibility'),
      cell: (tour: TourSummary) =>
        pt(tour.visible == null ? 'unknown' : tour.visible ? 'published' : 'unpublished'),
    },
    {
      id: 'length',
      header: pt('length'),
      cell: (tour: TourSummary) =>
        tour.lengthKm == null
          ? pt('unknown')
          : pt('distance', { length: tour.lengthKm.toLocaleString(locale) }),
    },
    {
      id: 'updated',
      header: pt('updated'),
      cell: (tour: TourSummary) => {
        const timestamp = Date.parse(tour.updatedAt ?? '');
        return Number.isFinite(timestamp) ? date.format(timestamp) : pt('unknown');
      },
    },
    {
      id: 'provider',
      header: pt('provider'),
      cell: (tour: TourSummary) => tour.dataProvider?.name || pt('unknown'),
    },
  ];
};

export function ToursListPage() {
  const pt = usePluginTranslation('tours');
  const query = normalizeListSearch(useSearch({ strict: false }));
  const navigate = useNavigate();
  const result = useTourRead<TourList>(buildMainserverListUrl(apiPath, query));
  const access = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const list = result.data;

  return (
    <StudioOverviewPageTemplate
      title={pt('title')}
      description={pt('description')}
      primaryAction={
        access.permissionActions.includes('tours.create') ? (
          <Button asChild>
            <Link to={toursCreatePath}>{pt('create')}</Link>
          </Button>
        ) : undefined
      }
    >
      {result.loading ? <StudioLoadingState>{pt('loading')}</StudioLoadingState> : null}
      {result.error ? (
        <StudioErrorState onRetry={list ? () => void result.refetch() : undefined}>
          {pt(result.error)}
        </StudioErrorState>
      ) : null}
      {list?.data.length === 0 ? (
        <StudioEmptyState>{pt(query.page === 1 ? 'empty' : 'emptyPage')}</StudioEmptyState>
      ) : null}
      {list && list.data.length > 0 ? <ToursTable list={list} query={query} pt={pt} /> : null}
      {list && (list.pagination.page > 1 || list.pagination.hasNextPage) ? (
        <StudioPagination
          page={list.pagination.page}
          hasNextPage={list.pagination.hasNextPage}
          ariaLabel={pt('pagination')}
          pageLabel={pt('page', { page: list.pagination.page })}
          previousLabel={pt('previous')}
          nextLabel={pt('next')}
          onPageChange={(page) =>
            void navigate({ to: toursPath, search: { page, pageSize: list.pagination.pageSize } })
          }
        />
      ) : null}
    </StudioOverviewPageTemplate>
  );
}

function ToursTable({
  list,
  query,
  pt,
}: {
  list: TourList;
  query: ReturnType<typeof normalizeListSearch>;
  pt: Translator;
}) {
  return (
    <StudioDataTable
      ariaLabel={pt('title')}
      data={list.data}
      columns={[
        {
          id: 'name',
          header: pt('name'),
          cell: (tour) => (
            <Link
              to={tourDetailPath}
              params={{ id: tour.id }}
              search={query}
              className="font-medium underline underline-offset-4"
            >
              {tour.name || pt('unknown')}
            </Link>
          ),
        },
        ...summaryFields(pt),
      ]}
      getRowId={(tour) => tour.id}
      emptyState={null}
      selectionMode="none"
      sorting={{ mode: 'disabled' }}
      labels={{
        selectionColumn: pt('name'),
        actionsColumn: pt('open'),
        loading: pt('loading'),
        selectAllRows: (label) => label,
        selectRow: ({ label }) => label,
      }}
    />
  );
}
