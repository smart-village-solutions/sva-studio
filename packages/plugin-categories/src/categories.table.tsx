import {
  Button,
  StudioDataTable,
  StudioEmptyState,
  StudioErrorState,
  StudioLoadingState,
  type StudioColumnDef,
  type StudioDataTableLabels,
} from '@sva/studio-ui-react';

import type { DataTypeCatalog } from './categories.data-types.js';
import { CategoryDetailsDialog } from './categories.details-dialog.js';
import type { Translator } from './categories.page-support.js';
import type { CategoryManagementItem, CategoryTableRow } from './categories.types.js';

const labels = (pt: Translator): StudioDataTableLabels => ({
  selectionColumn: pt('fields.actions'),
  actionsColumn: pt('fields.actions'),
  loading: pt('messages.loading'),
  selectAllRows: (label) => label,
  selectRow: ({ label }) => label,
  selectMobileRow: ({ label }) => label,
});

const columns = (
  pt: Translator,
  dataTypeLabel: DataTypeCatalog['label'],
  categoryById: ReadonlyMap<string, CategoryManagementItem>
): readonly StudioColumnDef<CategoryTableRow>[] => [
  {
    id: 'active',
    header: pt('fields.status'),
    cell: (row) => (row.active === false ? pt('values.inactive') : pt('values.active')),
  },
  {
    id: 'name',
    header: pt('fields.name'),
    cell: (row) => {
      const item = categoryById.get(row.id);
      return item ? <CategoryDetailsDialog category={item} pt={pt} /> : row.name;
    },
  },
  { id: 'hierarchy', header: pt('fields.hierarchy'), cell: (row) => row.hierarchyLabel },
  {
    id: 'position',
    header: pt('fields.position'),
    cell: (row) => row.position ?? pt('values.notAvailable'),
  },
  {
    id: 'tags',
    header: pt('fields.dataTypes'),
    cell: (row) => row.tags.map(dataTypeLabel).join(', ') || pt('values.notAvailable'),
  },
];

const CategoryActions = ({
  item,
  can,
  pt,
  onEdit,
  onCreateChild,
  onDelete,
}: Readonly<{
  item?: CategoryManagementItem;
  can: (action: string) => boolean;
  pt: Translator;
  onEdit: (item: CategoryManagementItem) => void;
  onCreateChild: (item: CategoryManagementItem) => void;
  onDelete: (item: CategoryManagementItem) => void;
}>) => (
  <div className="flex flex-wrap justify-end gap-2 md:flex-nowrap">
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={!item || !can('categories.update')}
      onClick={() => item && onEdit(item)}
    >
      {pt('actions.edit')}
    </Button>
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={!item || !can('categories.create')}
      onClick={() => item && onCreateChild(item)}
    >
      {pt('actions.createChild')}
    </Button>
    <Button
      type="button"
      size="sm"
      variant="destructive"
      disabled={!item || !can('categories.delete')}
      onClick={() => item && onDelete(item)}
    >
      {pt('actions.delete')}
    </Button>
  </div>
);

const CategoryTable = (
  props: Readonly<{
    rows: readonly CategoryTableRow[];
    categories: readonly CategoryManagementItem[];
    can: (action: string) => boolean;
    pt: Translator;
    dataTypeLabel: DataTypeCatalog['label'];
    onEdit: (item: CategoryManagementItem) => void;
    onCreateChild: (item: CategoryManagementItem) => void;
    onDelete: (item: CategoryManagementItem) => void;
  }>
) => {
  const categoryById = new Map(props.categories.map((category) => [category.id, category]));
  return (
    <StudioDataTable
      sorting={{ mode: 'disabled' }}
      ariaLabel={props.pt('table.ariaLabel')}
      caption={props.pt('table.caption')}
      labels={labels(props.pt)}
      data={props.rows}
      columns={columns(props.pt, props.dataTypeLabel, categoryById)}
      rowActions={(row) => (
        <CategoryActions
          item={categoryById.get(row.id)}
          can={props.can}
          pt={props.pt}
          onEdit={props.onEdit}
          onCreateChild={props.onCreateChild}
          onDelete={props.onDelete}
        />
      )}
      emptyState={null}
      getRowId={(row) => row.id}
      selectionMode="none"
    />
  );
};

export function CategoriesTableView(
  props: Readonly<{
    loading: boolean;
    error: string | null;
    rows: readonly CategoryTableRow[];
    categories: readonly CategoryManagementItem[];
    can: (action: string) => boolean;
    pt: Translator;
    dataTypeLabel: DataTypeCatalog['label'];
    onReload: () => void;
    onEdit: (item: CategoryManagementItem) => void;
    onCreateChild: (item: CategoryManagementItem) => void;
    onDelete: (item: CategoryManagementItem) => void;
  }>
) {
  if (props.loading) return <StudioLoadingState>{props.pt('messages.loading')}</StudioLoadingState>;
  if (props.error)
    return (
      <div className="space-y-3">
        <StudioErrorState>{props.error}</StudioErrorState>
        <Button type="button" variant="secondary" onClick={props.onReload}>
          {props.pt('actions.reload')}
        </Button>
      </div>
    );
  if (!props.rows.length)
    return (
      <StudioEmptyState>
        <h2 className="text-lg font-medium">{props.pt('empty.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{props.pt('empty.description')}</p>
      </StudioEmptyState>
    );
  return <CategoryTable {...props} />;
}
