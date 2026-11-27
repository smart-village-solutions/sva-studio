import { normalizeListSearch, usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioDataTable,
  useStudioTableQuery,
  StudioEmptyState,
  StudioErrorState,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioPagination,
} from '@sva/studio-ui-react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';

import { listProjects } from './projects.api.js';

export function ProjectsListPage() {
  const pt = usePluginTranslation('projects');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { page?: number; pageSize?: number };
  const { page, pageSize } = normalizeListSearch(search);
  const { data, state, error, refetch } = useStudioTableQuery(
    ['projects', page, pageSize],
    (signal) => listProjects({ page, pageSize }, signal)
  );
  const items = data?.data ?? [];
  const hasNextPage = data?.pagination.hasNextPage ?? false;

  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      primaryAction={
        <Button asChild>
          <Link to="/admin/projects/new">{pt('actions.create')}</Link>
        </Button>
      }
    >
      {state === 'loading' ? (
        <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>
      ) : null}
      {error ? (
        <StudioErrorState onRetry={() => void refetch()}>
          {pt('messages.loadError')}
        </StudioErrorState>
      ) : null}
      {state === 'ready' && items.length === 0 ? (
        <StudioEmptyState>{pt('messages.empty')}</StudioEmptyState>
      ) : null}
      {state === 'ready' && items.length > 0 ? (
        <div className="space-y-4">
          <ProjectsTable items={items} pt={pt} />
          <StudioPagination
            page={page}
            hasNextPage={hasNextPage}
            ariaLabel={pt('pagination.ariaLabel')}
            pageLabel={pt('pagination.pageLabel', { page })}
            previousLabel={pt('pagination.previous')}
            nextLabel={pt('pagination.next')}
            onPageChange={(nextPage) =>
              void navigate({
                to: '/admin/projects',
                search: (current: Record<string, unknown>) => ({
                  ...current,
                  page: nextPage,
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

function ProjectsTable({
  items,
  pt,
}: {
  items: Awaited<ReturnType<typeof listProjects>>['data'];
  pt: ReturnType<typeof usePluginTranslation>;
}) {
  return (
    <StudioDataTable
      sorting={{ mode: 'disabled' }}
      ariaLabel={pt('list.title')}
      data={items}
      columns={[
        { id: 'title', header: pt('fields.title'), cell: (item) => item.title },
        { id: 'language', header: pt('fields.language'), cell: (item) => item.language },
        {
          id: 'status',
          header: pt('fields.status'),
          cell: (item) => pt(`status.${item.status}`),
        },
      ]}
      rowActions={(project) => (
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/projects/$id" params={{ id: project.id }}>
            {pt('actions.edit')}
          </Link>
        </Button>
      )}
      getRowId={(project) => project.id}
      selectionMode="none"
      emptyState={null}
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
