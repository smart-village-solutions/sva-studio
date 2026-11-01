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
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { constructionSiteTemporalState, type ConstructionSiteList } from './contract.js';
import { listConstructionSites, listConstructionSiteCategories } from './construction-sites.api.js';
import { useConstructionSiteAccess } from './construction-sites.access.js';
import { ListFilters, listFilters } from './construction-sites.list-filters.js';

function ListTable({ result, today }: Readonly<{ result: ConstructionSiteList; today: string }>) {
  const pt = usePluginTranslation('construction-sites');
  return (
    <StudioDataTable
      sorting={{ mode: 'disabled' }}
      ariaLabel={pt('list.title')}
      data={result.data}
      getRowId={(item) => item.id}
      selectionMode="none"
      emptyState={null}
      columns={[
        { id: 'title', header: pt('fields.title'), cell: (item) => item.title },
        {
          id: 'location',
          header: pt('fields.locations'),
          cell: (item) => item.input.locations[0]?.name ?? '',
        },
        {
          id: 'start',
          header: pt('fields.dateStart'),
          cell: (item) => item.input.dates[0]?.dateStart ?? '',
        },
        {
          id: 'end',
          header: pt('fields.dateEnd'),
          cell: (item) => item.input.dates[0]?.dateEnd ?? '',
        },
        {
          id: 'state',
          header: pt('fields.state'),
          cell: (item) =>
            pt(`temporal.${constructionSiteTemporalState(item.input.dates[0], today)}`),
        },
        {
          id: 'updated',
          header: pt('fields.updatedAt'),
          cell: (item) => formatDateTimeInEditorTimeZone(item.updatedAt) ?? item.updatedAt,
        },
      ]}
      rowActions={(item) => (
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/construction-sites/$id" params={{ id: item.id }}>
            {pt('actions.edit')}
          </Link>
        </Button>
      )}
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
  const [result, setResult] = useState<ConstructionSiteList>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [categories, setCategories] = useState<readonly { id: string; name: string }[]>([]);
  useEffect(() => {
    let active = true;
    setState('loading');
    void listConstructionSites(
      JSON.parse(query) as Record<string, string | number>,
      principal
    ).then(
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
    void listConstructionSiteCategories(principal).then(
      (items) => active && setCategories(items),
      () => undefined
    );
    return () => {
      active = false;
    };
  }, [scope, principal]);
  return { result, state, categories };
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
            <Link to="/admin/construction-sites/new">{pt('actions.create')}</Link>
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
                  type: 'construction-sites.construction-site',
                  q: current.search,
                  page: next,
                  pageSize,
                }),
              })
            }
          />
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}
