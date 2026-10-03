import { normalizeListSearch, usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioDataTable,
  StudioEmptyState,
  StudioErrorState,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioPagination,
} from '@sva/studio-ui-react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import * as React from 'react';

import { listProjects } from './projects.api.js';
import type { ProjectContentItem } from './projects.api-types.js';

function useProjectsListData(page: number, pageSize: number) {
  const [items, setItems] = React.useState<readonly ProjectContentItem[]>([]);
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading');
  const [hasNextPage, setHasNextPage] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void listProjects({ page, pageSize }).then(
      (result) => {
        if (!active) return;
        setItems(result.data);
        setHasNextPage(result.pagination.hasNextPage);
        setState('ready');
      },
      () => active && setState('error')
    );
    return () => {
      active = false;
    };
  }, [page, pageSize]);

  return { items, state, hasNextPage };
}

export function ProjectsListPage() {
  const pt = usePluginTranslation('projects');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { page?: number; pageSize?: number };
  const { page, pageSize } = normalizeListSearch(search);
  const { items, state, hasNextPage } = useProjectsListData(page, pageSize);

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
      {state === 'error' ? <StudioErrorState>{pt('messages.loadError')}</StudioErrorState> : null}
      {state === 'ready' && items.length === 0 ? (
        <StudioEmptyState>{pt('messages.empty')}</StudioEmptyState>
      ) : null}
      {state === 'ready' && items.length > 0 ? (
        <div className="space-y-4">
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
