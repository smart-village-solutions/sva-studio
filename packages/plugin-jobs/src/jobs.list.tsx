import {
  formatCalendarDate,
  formatDateTimeInEditorTimeZone,
  normalizeListSearch,
  toDatetimeLocalValue,
  usePluginTranslation,
  type MainserverActingPrincipalType,
} from '@sva/plugin-sdk';
import {
  Button,
  Select,
  StudioDataTable,
  useStudioTableQuery,
  StudioEmptyState,
  StudioErrorState,
  StudioField,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioPagination,
  type MainserverPrincipalControlModel,
  type StudioColumnDef,
} from '@sva/studio-ui-react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { jobTemporalState, type JobList } from './contract.js';
import { resolveJobPrincipal, useJobAccess } from './jobs.access.js';
import { listJobCategories, listJobs } from './jobs.api.js';
import { ListFilters, listFilters } from './jobs.list-filters.js';

function listColumns(
  pt: ReturnType<typeof usePluginTranslation>,
  today: string,
  principal: MainserverActingPrincipalType
): readonly StudioColumnDef<JobList['data'][number]>[] {
  return [
    {
      id: 'title',
      header: pt('fields.title'),
      cell: (item) => (
        <Link
          className="underline underline-offset-4"
          to="/admin/jobs/$id"
          params={{ id: item.id }}
          search={{ principal }}
        >
          {item.title}
        </Link>
      ),
    },
    {
      id: 'employer',
      header: pt('fields.companies'),
      cell: (item) => item.input.companies[0]?.name ?? '',
    },
    {
      id: 'employmentType',
      header: pt('fields.employmentType'),
      cell: (item) => item.input.employmentType,
    },
    {
      id: 'visible',
      header: pt('fields.visible'),
      cell: (item) => pt(item.visible ? 'fields.visibleYes' : 'fields.visibleNo'),
    },
    {
      id: 'publicationDate',
      header: pt('fields.publicationDate'),
      cell: (item) => formatCalendarDate(item.input.publicationDate) ?? '',
    },
    {
      id: 'end',
      header: pt('fields.dateEnd'),
      cell: (item) => formatCalendarDate(item.input.dates[0]?.dateEnd) ?? '',
    },
    {
      id: 'state',
      header: pt('fields.state'),
      cell: (item) => pt(`temporal.${jobTemporalState(item.input, today)}`),
    },
    {
      id: 'updated',
      header: pt('fields.updatedAt'),
      cell: (item) => formatDateTimeInEditorTimeZone(item.updatedAt) ?? item.updatedAt,
    },
  ];
}
function ListTable({
  result,
  today,
  principal,
}: Readonly<{ result: JobList; today: string; principal: MainserverActingPrincipalType }>) {
  const pt = usePluginTranslation('jobs');
  return (
    <StudioDataTable
      sorting={{ mode: 'disabled' }}
      ariaLabel={pt('list.title')}
      data={result.data}
      getRowId={(item) => item.id}
      selectionMode="none"
      emptyState={null}
      columns={listColumns(pt, today, principal)}
      labels={{
        selectionColumn: pt('fields.actions'),
        actionsColumn: pt('fields.actions'),
        loading: pt('messages.loading'),
        selectAllRows: (label) => label,
        selectRow: ({ label }) => label,
      }}
    />
  );
}
function useListData(
  query: Record<string, string | number>,
  scope: string,
  principal: MainserverActingPrincipalType
) {
  const list = useStudioTableQuery(['jobs', scope, principal, query], (signal) =>
    listJobs(query, principal, signal)
  );
  const categories = useStudioTableQuery(['categories', 'jobs', scope, principal], (signal) =>
    listJobCategories(principal, signal)
  );
  return {
    result: list.data,
    state: list.state,
    error: list.error,
    refetch: list.refetch,
    categories: categories.data ?? [],
  };
}
function listPagination(
  result: JobList,
  page: number,
  pageSize: number,
  navigate: ReturnType<typeof useNavigate>,
  pt: ReturnType<typeof usePluginTranslation>
) {
  return (
    <>
      <StudioField id="job-pageSize" label={pt('fields.pageSize')}>
        <Select
          id="job-pageSize"
          value={String(pageSize)}
          onChange={(event) =>
            void navigate({
              to: '/admin/content',
              search: (current: Record<string, unknown>) => ({
                ...current,
                type: 'jobs.job',
                page: 1,
                pageSize: Number(event.currentTarget.value),
              }),
            })
          }
        >
          {[25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </StudioField>
      <StudioPagination
        page={page}
        hasNextPage={result.pagination.hasNextPage}
        ariaLabel={pt('pagination.label')}
        pageLabel={pt('pagination.page', { page })}
        previousLabel={pt('pagination.previous')}
        nextLabel={pt('pagination.next')}
        onPageChange={(next) =>
          void navigate({
            to: '/admin/content',
            search: (current: Record<string, unknown>) => ({
              ...current,
              type: 'jobs.job',
              q: current.search,
              page: next,
              pageSize,
            }),
          })
        }
      />
    </>
  );
}
export function JobsListPage({
  principalControl,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel }>) {
  const pt = usePluginTranslation('jobs');
  const access = useJobAccess();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const { page, pageSize } = normalizeListSearch(search);
  const { filters, filter, setPrincipal } = listFilters(search, navigate, pageSize);
  const query = { ...filters, page, pageSize };
  const scope = JSON.stringify([
    access.session.instanceId,
    access.session.subjectId,
    access.session.organizationId,
  ]);
  const principal = resolveJobPrincipal(search.principal, principalControl);
  const { result, state, error, refetch, categories } = useListData(query, scope, principal);
  const today = toDatetimeLocalValue(new Date().toISOString()).slice(0, 10);
  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      primaryAction={
        access.canCreate ? (
          <Button asChild>
            <Link to="/admin/jobs/new" search={{ principal }}>
              {pt('actions.create')}
            </Link>
          </Button>
        ) : undefined
      }
    >
      <ListFilters
        filters={filters}
        categories={categories}
        filter={filter}
        principalControl={principalControl}
        principal={principal}
        onPrincipalChange={setPrincipal}
      />
      {state === 'ready' && error ? (
        <StudioErrorState onRetry={() => void refetch()}>
          {pt('messages.loadError')}
        </StudioErrorState>
      ) : null}
      {state === 'loading' ? (
        <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>
      ) : state === 'error' ? (
        <StudioErrorState onRetry={() => void refetch()}>
          {pt('messages.loadError')}
        </StudioErrorState>
      ) : result ? (
        <div className="space-y-4">
          {!result.data.length ? (
            <StudioEmptyState>{pt('list.empty')}</StudioEmptyState>
          ) : (
            <ListTable result={result} today={today} principal={principal} />
          )}
          {listPagination(result, page, pageSize, navigate, pt)}
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}
