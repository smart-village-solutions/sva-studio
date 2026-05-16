import type { WasteFractionRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import {
  Button,
  StudioConfirmDialog,
  StudioDataTable,
  type StudioBulkAction,
  type StudioColumnDef,
  type StudioDataTableLabels,
  type StudioDataTableProps,
  cn,
} from '@sva/studio-ui-react';
import { useMemo, useState } from 'react';
import { createPagedItems, WastePanelTableBottomBar } from './waste-management.table-frame.js';
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
  onDeleteFractions,
  onToggleFractionStatus,
  onFractionsSortChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  saving,
}: {
  readonly fractions: readonly WasteFractionRecord[];
  readonly fractionsSortBy: WasteManagementFractionSortField;
  readonly fractionsSortDirection: WasteManagementFractionSortDirection;
  readonly onOpenCreateFraction: () => void;
  readonly onOpenEditFraction: (fraction: WasteFractionRecord) => void;
  readonly onOpenDeleteFraction: (fraction: WasteFractionRecord) => void | Promise<void>;
  readonly onDeleteFractions: (fractionIds: readonly string[]) => void | Promise<void>;
  readonly onToggleFractionStatus: (fraction: WasteFractionRecord, active: boolean) => void | Promise<void>;
  readonly onFractionsSortChange: (
    sortBy: WasteManagementFractionSortField,
    sortDirection: WasteManagementFractionSortDirection
  ) => void;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly saving?: boolean;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [fractionPendingDelete, setFractionPendingDelete] = useState<WasteFractionRecord | null>(null);
  const pagedFractions = useMemo(
    () =>
      createPagedItems({
        items: fractions,
        page,
        pageSize,
      }),
    [fractions, page, pageSize]
  );
  const primaryAction = useMemo(
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
  const bulkActions = useMemo<readonly StudioBulkAction<WasteFractionRecord>[]>(
    () => [
      {
        id: 'delete-selected-fractions',
        label: pt('masterData.fractions.actions.deleteSelected'),
        variant: 'outline',
        disabled: saving,
        onClick: async ({ selectedRows, clearSelection }) => {
          await onDeleteFractions(selectedRows.map((row) => row.id));
          clearSelection();
        },
      },
    ],
    [onDeleteFractions, pt, saving]
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
              className="inline-block h-6 w-6 shrink-0 rounded-sm border border-border/70"
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
        cell: (fraction) => {
          const nextActiveState = !fraction.active;
          return (
            <div className="flex items-center justify-center">
              <button
                type="button"
                role="switch"
                aria-checked={fraction.active}
                aria-label={
                  fraction.active
                    ? pt('masterData.fractions.actions.deactivateStatus', { value: fraction.name })
                    : pt('masterData.fractions.actions.activateStatus', { value: fraction.name })
                }
                disabled={saving}
                className={cn(
                  'relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border border-transparent transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  fraction.active ? 'bg-primary' : 'bg-muted'
                )}
                onClick={() => {
                  void onToggleFractionStatus(fraction, nextActiveState);
                }}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none inline-block h-[14px] w-[14px] rounded-full bg-background shadow-sm transition-transform',
                    fraction.active ? 'translate-x-[16px]' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>
          );
        },
      },
    ],
    [onToggleFractionStatus, pt, saving]
  );

  useWasteTabPanelActions(null);

  return (
    <div className="space-y-4">
      <div className="[&>div]:rounded-none [&>div]:border-x-0">
        <StudioDataTable
          ariaLabel={pt('masterData.fractions.table.ariaLabel')}
          caption={pt('masterData.fractions.table.caption')}
          labels={tableLabels}
          data={pagedFractions.items}
          columns={columns}
          getRowId={(fraction) => fraction.id}
          bulkActions={bulkActions}
          toolbarEnd={primaryAction}
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
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
                aria-label={pt('masterData.fractions.actions.edit')}
                onClick={() => onOpenEditFraction(fraction)}
              >
                <IconEdit aria-hidden="true" className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-destructive"
                aria-label={pt('masterData.fractions.actions.delete')}
                onClick={() => setFractionPendingDelete(fraction)}
              >
                <IconTrash aria-hidden="true" className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        />
        <WastePanelTableBottomBar
          pt={pt}
          page={pagedFractions.safePage}
          pageSize={pageSize}
          pageCount={pagedFractions.pageCount}
          totalItems={pagedFractions.totalItems}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>
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
