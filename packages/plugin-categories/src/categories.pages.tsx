import React from 'react';
import { formatDateTimeInEditorTimeZone, translatePluginKey } from '@sva/plugin-sdk';
import {
  Button,
  StudioDataTable,
  StudioEmptyState,
  StudioErrorState,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  type StudioColumnDef,
  type StudioDataTableLabels,
} from '@sva/studio-ui-react';

import { flattenCategoriesForTable, listCategories, type CategoryTableRow } from './categories.api.js';

type PluginTranslator = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const createTableLabels = (
  pt: PluginTranslator
): StudioDataTableLabels => ({
  selectionColumn: pt('fields.actions'),
  actionsColumn: pt('fields.actions'),
  loading: pt('messages.loading'),
  selectAllRows: (label) => label,
  selectRow: ({ label }) => label,
  selectMobileRow: ({ label }) => label,
});

const formatDate = (value?: string, fallback = '—') => {
  if (!value) {
    return fallback;
  }

  return formatDateTimeInEditorTimeZone(value) ?? value;
};

const renderTags = (row: CategoryTableRow, emptyLabel: string) => {
  if (row.tags.length === 0) {
    return emptyLabel;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {row.tags.map((tag) => (
        <span
          key={`${row.id}:${tag}`}
          className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
        >
          {tag}
        </span>
      ))}
    </div>
  );
};

const renderDisabledActions = (row: CategoryTableRow, pt: PluginTranslator) => (
  <div data-action-target-id={row.actionTargetId} className="flex justify-end gap-2">
    <Button type="button" size="sm" variant="outline" disabled>
      {pt('actions.edit')}
    </Button>
    <Button type="button" size="sm" variant="outline" disabled>
      {pt('actions.createChild')}
    </Button>
    <Button type="button" size="sm" variant="destructive" disabled>
      {pt('actions.delete')}
    </Button>
  </div>
);

export function CategoriesPage() {
  const pt = React.useCallback<PluginTranslator>(
    (key, variables) => translatePluginKey('categories', key, variables),
    []
  );
  const tableLabels = React.useMemo(() => createTableLabels(pt), [pt]);
  const [rows, setRows] = React.useState<readonly CategoryTableRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const columns = React.useMemo<readonly StudioColumnDef<CategoryTableRow>[]>(
    () => [
      {
        id: 'name',
        header: pt('fields.name'),
        cell: (row) => row.name,
      },
      {
        id: 'id',
        header: pt('fields.id'),
        cell: (row) => row.categoryId || pt('values.notAvailable'),
      },
      {
        id: 'hierarchy',
        header: pt('fields.hierarchy'),
        cell: (row) => row.hierarchyLabel,
      },
      {
        id: 'position',
        header: pt('fields.position'),
        cell: (row) => row.position ?? pt('values.notAvailable'),
      },
      {
        id: 'tags',
        header: pt('fields.tags'),
        cell: (row) => renderTags(row, pt('values.notAvailable')),
      },
      {
        id: 'updatedAt',
        header: pt('fields.updatedAt'),
        cell: (row) => formatDate(row.updatedAt, pt('values.notAvailable')),
      },
    ],
    [pt]
  );

  const load = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const categories = await listCategories();
      setRows(flattenCategoriesForTable(categories));
    } catch {
      setRows([]);
      setError(pt('messages.loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [pt]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      toolbar={
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>{pt('table.countLabel', { count: rows.length })}</span>
          <span>{pt('values.readOnlyHint')}</span>
        </div>
      }
    >
      {isLoading ? <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState> : null}

      {!isLoading && error ? (
        <div className="space-y-3">
          <StudioErrorState>{error}</StudioErrorState>
          <Button type="button" variant="outline" onClick={() => void load()}>
            {pt('actions.reload')}
          </Button>
        </div>
      ) : null}

      {!isLoading && !error && rows.length === 0 ? (
        <StudioEmptyState>
          <h2 className="text-lg font-medium">{pt('empty.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{pt('empty.description')}</p>
        </StudioEmptyState>
      ) : null}

      {!isLoading && !error && rows.length > 0 ? (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{pt('messages.actionsHint')}</p>
          <StudioDataTable
            ariaLabel={pt('table.ariaLabel')}
            caption={pt('table.caption')}
            labels={tableLabels}
            data={rows}
            columns={columns}
            rowActions={(row) => renderDisabledActions(row, pt)}
            emptyState={null}
            getRowId={(row) => row.id}
            selectionMode="none"
          />
        </div>
      ) : null}
    </StudioOverviewPageTemplate>
  );
}
