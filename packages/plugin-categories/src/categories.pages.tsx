import React from 'react';
import { translatePluginKey } from '@sva/plugin-sdk';
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
type CategoriesPageState = {
  readonly rows: readonly CategoryTableRow[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly reload: () => Promise<void>;
};

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

const usePluginTranslator = (): PluginTranslator =>
  React.useCallback<PluginTranslator>((key, variables) => translatePluginKey('categories', key, variables), []);

const readCategoriesErrorCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const { code } = error as { code?: unknown };
  return typeof code === 'string' && code.trim().length > 0 ? code : null;
};

const resolveLoadErrorMessage = (error: unknown, pt: PluginTranslator): string => {
  switch (readCategoriesErrorCode(error)) {
    case 'missing_credentials':
    case 'organization_mainserver_credentials_missing':
      return pt('messages.loadErrorMissingCredentials');
    case 'integration_disabled':
      return pt('messages.loadErrorIntegrationDisabled');
    case 'config_not_found':
      return pt('messages.loadErrorConfigMissing');
    case 'forbidden':
      return pt('messages.loadErrorForbidden');
    default:
      return pt('messages.loadError');
  }
};

const useCategoryColumns = (pt: PluginTranslator): readonly StudioColumnDef<CategoryTableRow>[] =>
  React.useMemo(
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
    ],
    [pt]
  );

const useCategoriesPageState = (pt: PluginTranslator): CategoriesPageState => {
  const [rows, setRows] = React.useState<readonly CategoryTableRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const categories = await listCategories();
      setRows(flattenCategoriesForTable(categories));
    } catch (error) {
      setRows([]);
      setError(resolveLoadErrorMessage(error, pt));
    } finally {
      setIsLoading(false);
    }
  }, [pt]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return {
    rows,
    isLoading,
    error,
    reload,
  };
};

const CategoriesPageToolbar = ({
  pt,
  count,
}: {
  readonly pt: PluginTranslator;
  readonly count: number;
}) => (
  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
    <span>{pt('table.countLabel', { count })}</span>
    <span>{pt('values.readOnlyHint')}</span>
  </div>
);

const CategoriesPageContent = ({
  pt,
  state,
  tableLabels,
  columns,
}: {
  readonly pt: PluginTranslator;
  readonly state: CategoriesPageState;
  readonly tableLabels: StudioDataTableLabels;
  readonly columns: readonly StudioColumnDef<CategoryTableRow>[];
}) => {
  if (state.isLoading) {
    return <StudioLoadingState>{pt('messages.loading')}</StudioLoadingState>;
  }

  if (state.error) {
    return (
      <div className="space-y-3">
        <StudioErrorState>{state.error}</StudioErrorState>
        <Button type="button" variant="outline" onClick={() => void state.reload()}>
          {pt('actions.reload')}
        </Button>
      </div>
    );
  }

  if (state.rows.length === 0) {
    return (
      <StudioEmptyState>
        <h2 className="text-lg font-medium">{pt('empty.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{pt('empty.description')}</p>
      </StudioEmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{pt('messages.actionsHint')}</p>
      <StudioDataTable
        ariaLabel={pt('table.ariaLabel')}
        caption={pt('table.caption')}
        labels={tableLabels}
        data={state.rows}
        columns={columns}
        rowActions={(row) => renderDisabledActions(row, pt)}
        emptyState={null}
        getRowId={(row) => row.id}
        selectionMode="none"
      />
    </div>
  );
};

export function CategoriesPage() {
  const pt = usePluginTranslator();
  const tableLabels = React.useMemo(() => createTableLabels(pt), [pt]);
  const columns = useCategoryColumns(pt);
  const state = useCategoriesPageState(pt);

  return (
    <StudioOverviewPageTemplate
      title={pt('list.title')}
      description={pt('list.description')}
      toolbar={<CategoriesPageToolbar pt={pt} count={state.rows.length} />}
    >
      <CategoriesPageContent pt={pt} state={state} tableLabels={tableLabels} columns={columns} />
    </StudioOverviewPageTemplate>
  );
}
