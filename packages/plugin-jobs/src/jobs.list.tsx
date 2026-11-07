import { useEffect, useState } from 'react';
import { Link, useSearch, useNavigate } from '@tanstack/react-router';
import {
  normalizeListSearch,
  type MainserverActingPrincipalType,
  usePluginTranslation,
  toDatetimeLocalValue,
  formatDateTimeInEditorTimeZone,
} from '@sva/plugin-sdk';
import {
  Button,
  StudioOverviewPageTemplate,
  StudioDataTable,
  StudioPagination,
  StudioLoadingState,
  StudioErrorState,
  StudioEmptyState,
  Select,
  StudioField,
  type MainserverPrincipalControlModel,
  type StudioColumnDef,
} from '@sva/studio-ui-react';
import { jobTemporalState, type JobList } from './contract.js';
import { listJobs, listJobCategories } from './jobs.api.js';
import { useJobAccess } from './jobs.access.js';
import { ListFilters, listFilters } from './jobs.list-filters.js';

function listColumns(
  pt: ReturnType<typeof usePluginTranslation>,
  today: string
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
      cell: (item) => item.input.publicationDate,
    },
    {
      id: 'end',
      header: pt('fields.dateEnd'),
      cell: (item) => item.input.dates[0]?.dateEnd ?? '',
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
function ListTable({ result, today }: Readonly<{ result: JobList; today: string }>) {
  const pt = usePluginTranslation('jobs');
  return (
    <StudioDataTable
      sorting={{ mode: 'disabled' }}
      ariaLabel={pt('list.title')}
      data={result.data}
      getRowId={(item) => item.id}
      selectionMode="none"
      emptyState={null}
      columns={listColumns(pt, today)}
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
function useListData(query: string, scope: string, principal: MainserverActingPrincipalType) {
  const [result, setResult] = useState<JobList>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [categories, setCategories] = useState<readonly { id: string; name: string }[]>([]);
  useEffect(() => {
    let active = true;
    setState('loading');
    void listJobs(JSON.parse(query) as Record<string, string | number>, principal).then(
      (data) => {
        if (active) {
          setResult(data);
          setState('ready');
        }
      },
      () => active && setState('error')
    );
    return () => {
      active = false;
    };
  }, [query, scope, principal]);
  useEffect(() => {
    let active = true;
    setCategories([]);
    void listJobCategories(principal).then(
      (items) => active && setCategories(items),
      () => undefined
    );
    return () => {
      active = false;
    };
  }, [scope, principal]);
  return { result, state, categories };
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
  const { filters, filter } = listFilters(search, navigate, pageSize);
  const query = JSON.stringify({ ...filters, page, pageSize });
  const scope = JSON.stringify([
    access.session.instanceId,
    access.session.subjectId,
    access.session.organizationId,
  ]);
  const [selectedPrincipal, setPrincipal] = useState<MainserverActingPrincipalType>(
    principalControl?.value ?? 'user'
  );
  const principal =
    principalControl?.kind === 'selectable'
      ? selectedPrincipal
      : (principalControl?.value ?? 'user');
  const { result, state, categories } = useListData(query, scope, principal);
  const today = toDatetimeLocalValue(new Date().toISOString()).slice(0, 10);
  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      primaryAction={
        access.canCreate ? (
          <Button asChild>
            <Link to="/admin/jobs/new">{pt('actions.create')}</Link>
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
      {state === 'loading' ? (
        <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>
      ) : state === 'error' ? (
        <StudioErrorState>{pt('messages.loadError')}</StudioErrorState>
      ) : result ? (
        <div className="space-y-4">
          {!result.data.length ? (
            <StudioEmptyState>{pt('list.empty')}</StudioEmptyState>
          ) : (
            <ListTable result={result} today={today} />
          )}
          {listPagination(result, page, pageSize, navigate, pt)}
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}
