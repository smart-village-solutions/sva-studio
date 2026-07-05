import React from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button, StudioDataTable, type StudioDataTableLabels } from '@sva/studio-ui-react';
import { usePluginTranslation } from '@sva/plugin-sdk';

import type { GenericItemContentItem, GenericItemListResult } from './generic-items.api-types.js';

export const createGenericItemsDataTableLabels = (
  pt: ReturnType<typeof usePluginTranslation>
): Readonly<StudioDataTableLabels> => ({
  selectionColumn: pt('fields.actions'),
  actionsColumn: pt('fields.actions'),
  loading: pt('messages.loading'),
  selectAllRows: (label: string) => label,
  selectRow: ({ label }: { label: string }) => label,
});

export const GenericItemsDataTable = ({
  data,
  pt,
}: Readonly<{
  data: readonly GenericItemContentItem[];
  pt: ReturnType<typeof usePluginTranslation>;
}>) => (
  <StudioDataTable
    ariaLabel={pt('list.title')}
    labels={createGenericItemsDataTableLabels(pt)}
    data={data}
    columns={[
      { id: 'title', header: pt('fields.title'), cell: (item: GenericItemContentItem) => item.title },
      { id: 'genericType', header: pt('fields.genericType'), cell: (item: GenericItemContentItem) => item.genericType },
      { id: 'updatedAt', header: pt('fields.updatedAt'), cell: (item: GenericItemContentItem) => item.updatedAt },
    ]}
    rowActions={(item: GenericItemContentItem) => (
      <Button asChild variant="outline" size="sm">
        <Link to="/admin/generic-items/$id" params={{ id: item.id }}>
          {pt('actions.edit')}
        </Link>
      </Button>
    )}
    emptyState={null}
    getRowId={(item: GenericItemContentItem) => item.id}
    selectionMode="none"
  />
);

export const GenericItemsPagination = ({
  pagination,
  pt,
}: Readonly<{
  pagination: GenericItemListResult['pagination'];
  pt: ReturnType<typeof usePluginTranslation>;
}>) => {
  const navigate = useNavigate();

  return (
    <nav aria-label={pt('pagination.ariaLabel')} className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <p key={pagination.page}>{pt('pagination.pageLabel', { page: pagination.page })}</p>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pagination.page <= 1}
          onClick={() =>
            void navigate({
              to: '/admin/generic-items',
              search: (current: Record<string, unknown>) => ({
                ...current,
                page: Math.max(1, pagination.page - 1),
                pageSize: pagination.pageSize,
              }),
            })
          }
        >
          {pt('pagination.previous')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!pagination.hasNextPage}
          onClick={() =>
            void navigate({
              to: '/admin/generic-items',
              search: (current: Record<string, unknown>) => ({
                ...current,
                page: pagination.page + 1,
                pageSize: pagination.pageSize,
              }),
            })
          }
        >
          {pt('pagination.next')}
        </Button>
      </div>
    </nav>
  );
};
