import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import {
  Button,
  StudioConfirmDialog,
  StudioDataTable,
  type StudioColumnDef,
  type StudioDataTableLabels,
  type StudioDataTableProps,
} from '@sva/studio-ui-react';
import { useMemo, useState } from 'react';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';
import type { WasteManagementFractionSortDirection, WasteManagementFractionSortField } from './search-params.js';

type StudioTableSortingState = NonNullable<StudioDataTableProps<WasteFractionRecord>['sorting']>;

const columnIdBySortField: Record<WasteManagementFractionSortField, string> = {
  name: 'nameWithContainerSize',
  containerSize: 'nameWithContainerSize',
  color: 'color',
  description: 'description',
  status: 'status',
};

const sortFieldByColumnId: Record<string, WasteManagementFractionSortField> = {
  nameWithContainerSize: 'name',
  color: 'color',
  description: 'description',
  status: 'status',
};

export const WasteMasterDataFractionsContent = ({
  fractions,
  fractionsSortBy,
  fractionsSortDirection,
  onOpenCreateFraction,
  onOpenEditFraction,
  onOpenDeleteFraction,
  onFractionsSortChange,
}: {
  readonly fractions: readonly WasteFractionRecord[];
  readonly fractionsSortBy: WasteManagementFractionSortField;
  readonly fractionsSortDirection: WasteManagementFractionSortDirection;
  readonly onOpenCreateFraction: () => void;
  readonly onOpenEditFraction: (fraction: WasteFractionRecord) => void;
  readonly onOpenDeleteFraction: (fraction: WasteFractionRecord) => void | Promise<void>;
  readonly onFractionsSortChange: (
    sortBy: WasteManagementFractionSortField,
    sortDirection: WasteManagementFractionSortDirection
  ) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [fractionPendingDelete, setFractionPendingDelete] = useState<WasteFractionRecord | null>(null);
  const panelActions = useMemo(
    () => (
      <Button type="button" onClick={onOpenCreateFraction}>
        {pt('masterData.fractions.actions.openCreate')}
      </Button>
    ),
    [onOpenCreateFraction, pt]
  );
  const sorting = useMemo<StudioTableSortingState>(
    () => [{ id: columnIdBySortField[fractionsSortBy], desc: fractionsSortDirection === 'desc' }],
    [fractionsSortBy, fractionsSortDirection]
  );
  const tableLabels = useMemo<StudioDataTableLabels>(
    () => ({
      selectionColumn: pt('masterData.fractions.table.selection'),
      actionsColumn: pt('masterData.fractions.table.actions'),
      loading: pt('masterData.messages.loading'),
      selectAllRows: (label) => pt('masterData.fractions.table.selectAllRows', { label }),
      selectRow: ({ rowId }) => pt('masterData.fractions.table.selectRow', { rowId }),
      selectMobileRow: ({ rowId }) => pt('masterData.fractions.table.selectMobileRow', { rowId }),
    }),
    [pt]
  );
  const columns = useMemo<readonly StudioColumnDef<WasteFractionRecord>[]>(
    () => [
      {
        id: 'nameWithContainerSize',
        header: pt('masterData.fractions.table.nameWithContainerSize'),
        mobileLabel: pt('masterData.fractions.table.nameWithContainerSize'),
        sortable: true,
        sortValue: (fraction) =>
          `${fraction.name.toLocaleLowerCase()}|${fraction.containerSize?.toLocaleLowerCase() ?? ''}`,
        cell: (fraction) => (
          <div className="space-y-1">
            <p className="font-medium">
              {fraction.containerSize ? `${fraction.name} (${fraction.containerSize})` : fraction.name}
            </p>
          </div>
        ),
      },
      {
        id: 'color',
        header: pt('masterData.fractions.table.color'),
        mobileLabel: pt('masterData.fractions.table.color'),
        sortable: true,
        sortValue: (fraction) => fraction.color.toLocaleLowerCase(),
        cell: (fraction) => (
          <div className="flex items-center gap-2">
            <span
              aria-label={pt('masterData.fractions.table.colorSwatch', { value: fraction.color })}
              className="inline-block h-4 w-4 rounded-sm border border-border/70"
              style={{ backgroundColor: fraction.color }}
            />
            <span className="font-mono text-sm">{fraction.color}</span>
          </div>
        ),
      },
      {
        id: 'description',
        header: pt('masterData.fractions.fields.description'),
        mobileLabel: pt('masterData.fractions.fields.description'),
        sortable: true,
        sortValue: (fraction) => fraction.description?.toLocaleLowerCase() ?? '',
        cell: (fraction) => (
          <span className={fraction.description ? 'text-sm' : 'text-sm text-muted-foreground'}>
            {fraction.description || pt('masterData.fractions.table.noDescription')}
          </span>
        ),
      },
      {
        id: 'status',
        header: pt('masterData.fractions.table.status'),
        mobileLabel: pt('masterData.fractions.table.status'),
        sortable: true,
        sortValue: (fraction) => (fraction.active ? 'active' : 'inactive'),
        cell: (fraction) => <span className="text-sm">{fraction.active ? pt('common.active') : pt('common.inactive')}</span>,
      },
    ],
    [pt]
  );

  useWasteTabPanelActions(panelActions);

  return (
    <div className="space-y-4">
      <StudioDataTable
        ariaLabel={pt('masterData.fractions.table.ariaLabel')}
        caption={pt('masterData.fractions.table.caption')}
        labels={tableLabels}
        data={fractions}
        columns={columns}
        getRowId={(fraction) => fraction.id}
        selectionMode="multiple"
        emptyState={<p className="text-sm text-muted-foreground">{pt('masterData.messages.emptyBody')}</p>}
        sorting={sorting}
        onSortingChange={(nextSorting) => {
          const current = nextSorting[0];
          if (!current) {
            onFractionsSortChange('name', 'asc');
            return;
          }
          onFractionsSortChange(sortFieldByColumnId[current.id] ?? 'name', current.desc ? 'desc' : 'asc');
        }}
        rowActions={(fraction) => (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 px-0"
              aria-label={pt('masterData.fractions.actions.edit')}
              onClick={() => onOpenEditFraction(fraction)}
            >
              <IconEdit aria-hidden="true" className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 px-0"
              aria-label={pt('masterData.fractions.actions.delete')}
              onClick={() => setFractionPendingDelete(fraction)}
            >
              <IconTrash aria-hidden="true" className="h-4 w-4" />
            </Button>
          </>
        )}
      />
      <StudioConfirmDialog
        open={fractionPendingDelete !== null}
        title={pt('masterData.fractions.deleteDialog.title')}
        description={pt('masterData.fractions.deleteDialog.description', {
          value: fractionPendingDelete?.name ?? '',
        })}
        confirmLabel={pt('masterData.fractions.deleteDialog.confirm')}
        cancelLabel={pt('masterData.fractions.deleteDialog.cancel')}
        onCancel={() => setFractionPendingDelete(null)}
        onConfirm={() => {
          if (!fractionPendingDelete) {
            return;
          }
          void Promise.resolve(onOpenDeleteFraction(fractionPendingDelete)).finally(() => setFractionPendingDelete(null));
        }}
      />
    </div>
  );
};
