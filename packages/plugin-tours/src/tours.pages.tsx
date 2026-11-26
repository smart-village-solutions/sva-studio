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
  StudioDetailPageTemplate,
  StudioEmptyState,
  StudioErrorState,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioPagination,
} from '@sva/studio-ui-react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { tourDetailPath, toursCreatePath, toursPath } from './descriptor.js';
import { TourDetailContent, type TourDetailFields } from './tour-detail-content.js';

type NamedRecord = { id: string; name?: string | null };
type TourSummary = NamedRecord & {
  active?: boolean | null;
  visible?: boolean | null;
  lengthKm?: number | null;
  updatedAt?: string | null;
  categories: readonly NamedRecord[];
  dataProvider?: NamedRecord | null;
};
type TourDetail = TourSummary & TourDetailFields;
type TourList = {
  data: readonly TourSummary[];
  pagination: { page: number; pageSize: number; hasNextPage: boolean };
};
type ReadResult<T> = { data: T } | { error: 'forbidden' | 'notFound' | 'error' };
type Translator = ReturnType<typeof usePluginTranslation>;
const apiPath = '/api/v1/mainserver/tours';

function useTourRead<T>(url: string) {
  const access = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const [state, setState] = useState<{
    url: string;
    access: typeof access;
    result: ReadResult<T>;
  }>();

  useEffect(() => {
    if (!access.isResolved || access.hasError) return;
    const controller = new AbortController();
    const store = (result: ReadResult<T>) => {
      if (!controller.signal.aborted) setState({ url, access, result });
    };
    void requestMainserverJson<T, MainserverApiError>({
      url,
      init: { signal: controller.signal, cache: 'no-store' },
      errorFactory: (code, message, denial) => new MainserverApiError(code, message, denial),
    }).then(
      (data) => store({ data }),
      (error: unknown) => {
        const code = error instanceof MainserverApiError ? error.code : undefined;
        store({
          error: code === 'not_found' ? 'notFound' : code === 'forbidden' ? 'forbidden' : 'error',
        });
      }
    );
    return () => controller.abort();
  }, [access, url]);

  if (access.hasError) return { error: 'error' } as const;
  return state?.url === url && state.access === access ? state.result : undefined;
}

const summaryFields = (pt: Translator) => {
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
  const list = result && 'data' in result ? result.data : undefined;

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
      {!result ? <StudioLoadingState>{pt('loading')}</StudioLoadingState> : null}
      {result && 'error' in result ? <StudioErrorState>{pt(result.error)}</StudioErrorState> : null}
      {list?.data.length === 0 ? (
        <StudioEmptyState>{pt(query.page === 1 ? 'empty' : 'emptyPage')}</StudioEmptyState>
      ) : null}
      {list && list.data.length > 0 ? (
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
      ) : null}
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

export function TourDetailPage() {
  const pt = usePluginTranslation('tours');
  const id = useParams({ strict: false, select: (params) => (params as { id: string }).id });
  const search = normalizeListSearch(useSearch({ strict: false }));
  const result = useTourRead<{ data: TourDetail }>(`${apiPath}/${encodeURIComponent(id)}`);
  const tour = result && 'data' in result ? result.data.data : undefined;

  return (
    <StudioDetailPageTemplate
      title={tour?.name || pt('title')}
      actions={
        <Button asChild variant="secondary">
          <Link to={toursPath} search={search}>
            {pt('back')}
          </Link>
        </Button>
      }
    >
      {!result ? <StudioLoadingState>{pt('loading')}</StudioLoadingState> : null}
      {result && 'error' in result ? <StudioErrorState>{pt(result.error)}</StudioErrorState> : null}
      {tour ? (
        <>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summaryFields(pt).map(({ id, header, cell }) => (
              <div key={id}>
                <dt className="font-medium">{header}</dt>
                <dd>{cell(tour)}</dd>
              </div>
            ))}
          </dl>
          <TourDetailContent tour={tour} pt={pt} />
        </>
      ) : null}
    </StudioDetailPageTemplate>
  );
}
