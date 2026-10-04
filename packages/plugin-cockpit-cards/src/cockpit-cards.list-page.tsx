import { usePluginTranslation } from '@sva/plugin-sdk';
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

import { getCockpitCard, listCockpitCards } from './cockpit-cards.api.js';
import { readCockpitCardPayload } from './cockpit-cards.model.js';

export function CockpitCardsListPage() {
  const pt = usePluginTranslation('cockpit-cards');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { page?: number; pageSize?: number };
  const page = Number.isInteger(search.page) && (search.page ?? 0) > 0 ? (search.page ?? 1) : 1;
  const pageSize = search.pageSize === 50 || search.pageSize === 100 ? search.pageSize : 25;
  const [items, setItems] = React.useState<readonly Awaited<ReturnType<typeof getCockpitCard>>[]>(
    []
  );
  const [state, setState] = React.useState<'loading' | 'error' | 'ready'>('loading');
  const [hasNextPage, setHasNextPage] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    void listCockpitCards({ page, pageSize }).then(
      (result) => {
        if (active) {
          setItems(result.data);
          setHasNextPage(result.pagination.hasNextPage);
          setState('ready');
        }
      },
      () => active && setState('error')
    );
    return () => {
      active = false;
    };
  }, [page, pageSize]);
  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      primaryAction={
        <Button asChild>
          <Link to="/admin/cockpit-cards/new">{pt('actions.create')}</Link>
        </Button>
      }
    >
      {state === 'loading' ? (
        <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>
      ) : null}
      {state === 'error' ? <StudioErrorState>{pt('messages.loadError')}</StudioErrorState> : null}
      {state === 'ready' && items.length === 0 ? (
        <StudioEmptyState>{pt('list.empty')}</StudioEmptyState>
      ) : null}
      {state === 'ready' && items.length ? (
        <div className="space-y-4">
          <CockpitCardTable items={items} pt={pt} />
          <StudioPagination
            page={page}
            hasNextPage={hasNextPage}
            ariaLabel={pt('pagination.ariaLabel')}
            pageLabel={pt('pagination.pageLabel').replace('{{page}}', String(page))}
            previousLabel={pt('pagination.previous')}
            nextLabel={pt('pagination.next')}
            onPageChange={(nextPage) =>
              void navigate({
                to: '/admin/cockpit-cards',
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

function CockpitCardTable({
  items,
  pt,
}: Readonly<{
  items: readonly Awaited<ReturnType<typeof getCockpitCard>>[];
  pt: ReturnType<typeof usePluginTranslation>;
}>) {
  return (
    <StudioDataTable
      sorting={{ mode: 'disabled' }}
      ariaLabel={pt('list.title')}
      data={items}
      columns={[
        { id: 'heading', header: pt('fields.heading'), cell: (item) => item.title },
        {
          id: 'language',
          header: pt('fields.languageCode'),
          cell: (item) => readCockpitCardPayload(item.payload).languageCode,
        },
      ]}
      rowActions={(item) => (
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/cockpit-cards/$id" params={{ id: item.id }}>
            {pt('actions.edit')}
          </Link>
        </Button>
      )}
      getRowId={(item) => item.id}
      selectionMode="none"
      emptyState={null}
      labels={{
        selectionColumn: pt('fields.heading'),
        actionsColumn: pt('fields.actions'),
        loading: pt('messages.loading'),
        selectAllRows: (label) => label,
        selectRow: ({ label }) => label,
      }}
    />
  );
}
