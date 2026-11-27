import { formatCalendarDate } from '@sva/plugin-sdk';
/** Baustellenübersicht mit gemeinsamen Studio-Tabellenbereichen und fachlichen Spalten. */
import {
  formatDateTimeInEditorTimeZone,
  normalizeListSearch,
  toDatetimeLocalValue,
  usePluginTranslation,
  type MainserverActingPrincipalType,
} from '@sva/plugin-sdk';
import {
  Button,
  MainserverPrincipalControl,
  resolveMainserverPrincipalOptions,
  Select,
  StudioDataTable,
  useStudioTableQuery,
  StudioEmptyState,
  StudioErrorState,
  StudioField,
  StudioListPageTemplate,
  StudioLoadingState,
  StudioPagination,
  StudioTableValueAction,
  type MainserverPrincipalControlModel,
  type StudioColumnDef,
} from '@sva/studio-ui-react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useConstructionSiteAccess } from './construction-sites.access.js';
import { listConstructionSiteCategories, listConstructionSites } from './construction-sites.api.js';
import { ListFilters, listFilters } from './construction-sites.list-filters.js';
import { constructionSiteTemporalState, type ConstructionSiteList } from './contract.js';

function useListData(
  query: Record<string, string | number>,
  scope: string,
  principal: MainserverActingPrincipalType
) {
  const list = useStudioTableQuery(['construction-sites', scope, principal, query], (signal) =>
    listConstructionSites(query, principal, signal)
  );
  const categories = useStudioTableQuery(
    ['categories', 'construction-sites', scope, principal],
    (signal) => listConstructionSiteCategories(principal, signal)
  );
  return {
    result: list.data,
    state: list.state,
    error: list.error,
    refetch: list.refetch,
    categories: categories.data ?? [],
  };
}
type Translator = ReturnType<typeof usePluginTranslation>;
function listColumns(
  pt: Translator,
  today: string
): StudioColumnDef<ConstructionSiteList['data'][number]>[] {
  return [
    {
      id: 'title',
      header: pt('fields.title'),
      cell: (item) => (
        <StudioTableValueAction asChild emphasis="primary">
          <Link to="/admin/construction-sites/$id" params={{ id: item.id }}>
            {item.title}
          </Link>
        </StudioTableValueAction>
      ),
    },
    {
      id: 'location',
      header: pt('fields.locations'),
      cell: (item) => item.input.locations[0]?.name ?? '',
    },
    {
      id: 'start',
      header: pt('fields.dateStart'),
      cell: (item) => formatCalendarDate(item.input.dates[0]?.dateStart) ?? '',
    },
    {
      id: 'end',
      header: pt('fields.dateEnd'),
      cell: (item) => formatCalendarDate(item.input.dates[0]?.dateEnd) ?? '',
    },
    {
      id: 'state',
      header: pt('fields.state'),
      cell: (item) => pt(`temporal.${constructionSiteTemporalState(item.input.dates[0], today)}`),
    },
    {
      id: 'updated',
      header: pt('fields.updatedAt'),
      cell: (item) => formatDateTimeInEditorTimeZone(item.updatedAt) ?? item.updatedAt,
    },
  ];
}
function listFooter(
  result: ConstructionSiteList,
  page: number,
  pageSize: number,
  navigatePage: (page: number, pageSize: number) => void,
  pt: Translator
) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <StudioField id="cs-page-size" label={pt('pagination.pageSize')}>
        <Select
          id="cs-page-size"
          value={String(pageSize)}
          onChange={(event) => navigatePage(1, Number(event.currentTarget.value))}
        >
          {[25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </StudioField>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {pt('pagination.results', {
            start: result.data.length ? (page - 1) * pageSize + 1 : 0,
            end: result.data.length ? (page - 1) * pageSize + result.data.length : 0,
            total: result.pagination.total,
          })}
        </p>
        <StudioPagination
          page={page}
          hasNextPage={result.pagination.hasNextPage}
          ariaLabel={pt('pagination.label')}
          pageLabel={pt('pagination.page', { page })}
          previousLabel={pt('pagination.previous')}
          nextLabel={pt('pagination.next')}
          onPageChange={(next) => navigatePage(next, pageSize)}
        />
      </div>
    </div>
  );
}
function listPrincipal(
  principalControl: MainserverPrincipalControlModel | undefined,
  principal: MainserverActingPrincipalType,
  setPrincipal: (principal: MainserverActingPrincipalType) => void,
  pt: Translator
) {
  return (
    <MainserverPrincipalControl
      id="cs-list-principal"
      label={pt('principal.actAs')}
      value={principal}
      onChange={setPrincipal}
      options={resolveMainserverPrincipalOptions(principalControl, {
        value: principal,
        label: pt(`principal.${principal}`),
      })}
      contextOptions={principalControl?.contextOptions}
      onContextChange={principalControl?.onContextChange}
      readinessByPrincipal={principalControl?.readinessByPrincipal}
      readinessMessage={principalControl?.readinessMessage}
    />
  );
}
export function ConstructionSitesListPage({
  principalControl,
}: Readonly<{ principalControl?: MainserverPrincipalControlModel }>) {
  const pt = usePluginTranslation('construction-sites');
  const access = useConstructionSiteAccess();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const { page, pageSize } = normalizeListSearch(search);
  const { filters, filter } = listFilters(search, navigate, pageSize);
  const query = { ...filters, page, pageSize };
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
  const { result, state, error, refetch, categories } = useListData(query, scope, principal);
  const today = toDatetimeLocalValue(new Date().toISOString()).slice(0, 10);
  const navigatePage = (nextPage: number, nextPageSize: number) =>
    void navigate({
      to: '/admin/content',
      search: (current: Record<string, unknown>) => ({
        ...current,
        type: 'construction-sites.construction-site',
        q: current.search,
        page: nextPage,
        pageSize: nextPageSize,
      }),
    });
  return (
    <StudioListPageTemplate title={pt('list.title')} description={pt('list.description')}>
      {listPrincipal(principalControl, principal, setPrincipal, pt)}
      {state === 'ready' && error ? (
        <StudioErrorState onRetry={() => void refetch()}>
          {pt('messages.loadError')}
        </StudioErrorState>
      ) : null}
      <section aria-busy={state === 'loading'} aria-label={pt('list.title')}>
        <StudioDataTable
          sorting={{ mode: 'disabled' }}
          ariaLabel={pt('list.title')}
          data={state === 'ready' ? (result?.data ?? []) : []}
          getRowId={(item) => item.id}
          selectionMode="none"
          emptyState={
            state === 'loading' ? (
              <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>
            ) : state === 'error' ? (
              <StudioErrorState onRetry={() => void refetch()}>
                {pt('messages.loadError')}
              </StudioErrorState>
            ) : (
              <StudioEmptyState>{pt('list.empty')}</StudioEmptyState>
            )
          }
          columns={listColumns(pt, today)}
          toolbarCenter={<ListFilters filters={filters} categories={categories} filter={filter} />}
          toolbarEnd={
            access.canCreate ? (
              <Button asChild>
                <Link to="/admin/construction-sites/new">{pt('actions.create')}</Link>
              </Button>
            ) : undefined
          }
          footer={
            state === 'ready' && result
              ? listFooter(result, page, pageSize, navigatePage, pt)
              : undefined
          }
          labels={{
            selectionColumn: pt('fields.actions'),
            actionsColumn: pt('fields.actions'),
            loading: pt('messages.loading'),
            selectAllRows: (label) => label,
            selectRow: ({ label }) => label,
          }}
        />
      </section>
    </StudioListPageTemplate>
  );
}
