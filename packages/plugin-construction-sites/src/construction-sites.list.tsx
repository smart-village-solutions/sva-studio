import { useEffect, useState } from 'react';
import { Link, useSearch, useNavigate } from '@tanstack/react-router';
import {
  normalizeListSearch,
  usePluginTranslation,
  toDatetimeLocalValue,
  formatDateTimeInEditorTimeZone,
} from '@sva/plugin-sdk';
import {
  Button,
  Input,
  Select,
  StudioField,
  StudioOverviewPageTemplate,
  StudioDataTable,
  StudioPagination,
  StudioLoadingState,
  StudioErrorState,
  StudioEmptyState,
} from '@sva/studio-ui-react';
import { constructionSiteTemporalState, type ConstructionSiteList } from './contract.js';
import { listConstructionSites, listConstructionSiteCategories } from './construction-sites.api.js';
import { useConstructionSiteAccess } from './construction-sites.access.js';

function ListFilters({
  filters,
  categories,
  filter,
}: Readonly<{
  filters: Record<string, string>;
  categories: readonly { id: string; name: string }[];
  filter: (key: string, value: string) => void;
}>) {
  const pt = usePluginTranslation('construction-sites');
  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StudioField id="cs-search" label={pt('fields.search')}>
        <Input
          id="cs-search"
          type="search"
          value={filters.search}
          onChange={(event) => filter('search', event.currentTarget.value)}
        />
      </StudioField>
      <StudioField id="cs-category" label={pt('fields.categories')}>
        <Select
          id="cs-category"
          value={filters.category}
          onChange={(event) => filter('category', event.currentTarget.value)}
        >
          <option value="">{pt('fields.allCategories')}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.name}>
              {category.name}
            </option>
          ))}
        </Select>
      </StudioField>
      {(['dateStart', 'dateEnd'] as const).map((key) => (
        <StudioField key={key} id={`cs-filter-${key}`} label={pt(`fields.${key}`)}>
          <Input
            id={`cs-filter-${key}`}
            type="date"
            value={filters[key]}
            onChange={(event) => filter(key, event.currentTarget.value)}
          />
        </StudioField>
      ))}
    </div>
  );
}
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
function useListData(query: string, scope: string) {
  const [result, setResult] = useState<ConstructionSiteList>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [categories, setCategories] = useState<readonly { id: string; name: string }[]>([]);
  useEffect(() => {
    let active = true;
    setState('loading');
    void listConstructionSites(JSON.parse(query) as Record<string, string | number>).then(
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
  }, [query, scope]);
  useEffect(() => {
    let active = true;
    void listConstructionSiteCategories().then(
      (items) => active && setCategories(items),
      () => undefined
    );
    return () => {
      active = false;
    };
  }, [scope]);
  return { result, state, categories };
}
function listFilters(search: Record<string, unknown>) {
  return Object.fromEntries(
    ['search', 'category', 'dateStart', 'dateEnd'].map((key) => [
      key,
      typeof search[key] === 'string' ? (search[key] as string) : '',
    ])
  );
}
export function ConstructionSitesListPage() {
  const pt = usePluginTranslation('construction-sites');
  const access = useConstructionSiteAccess();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const { page, pageSize } = normalizeListSearch(search);
  const filters = listFilters(search);
  const query = JSON.stringify({ ...filters, page, pageSize });
  const scope = JSON.stringify([
    access.session.instanceId,
    access.session.subjectId,
    access.session.organizationId,
  ]);
  const { result, state, categories } = useListData(query, scope);
  const filter = (key: string, value: string) =>
    void navigate({
      to: '/admin/content',
      search: (current: Record<string, unknown>) => ({
        ...current,
        type: 'construction-sites.construction-site',
        q: key === 'search' ? value || undefined : current.search,
        ...(key === 'search' ? {} : { [key]: value || undefined }),
        page: 1,
        pageSize,
      }),
      replace: true,
    });
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
      <ListFilters filters={filters} categories={categories} filter={filter} />
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
