import { WasteListFilterChips } from './waste-management.list-filter-dialog.js';
import { useState } from 'react';
import { WasteListFilterDialog, WasteListSearch } from './waste-management.list-filter-dialog.js';
import type {
  WasteFractionRecord,
  WasteFractionDeleteConfirmation,
} from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconFilter } from '@tabler/icons-react';
import {
  Button,
  Select,
  type StudioBulkAction,
  type StudioDataTableLabels,
  type StudioDataTableSorting,
} from '@sva/studio-ui-react';
import type {
  WasteManagementFractionSortDirection,
  WasteManagementFractionSortField,
  WasteManagementStatusFilter,
  WasteManagementSearchParams,
} from './search-params.js';
import type { WasteBulkDeleteResult } from './waste-management.page.support.js';
export { FractionRowActions } from './waste-management.master-data-fraction-row-actions.js';

type StudioTableSortingState = Extract<StudioDataTableSorting, { mode: 'external' }>['state'];

export type WasteFractionsContentProps = {
  readonly search?: WasteManagementSearchParams;
  readonly fractions: readonly WasteFractionRecord[];
  readonly fractionsSortBy: WasteManagementFractionSortField;
  readonly fractionsSortDirection: WasteManagementFractionSortDirection;
  readonly fractionsStatus: WasteManagementStatusFilter;
  readonly onOpenCreateFraction: () => void;
  readonly onOpenEditFraction: (fraction: WasteFractionRecord) => void;
  readonly onOpenDeleteFraction: (
    fraction: WasteFractionRecord,
    confirmation?: Omit<WasteFractionDeleteConfirmation, 'fractionId'>
  ) => void | Promise<void>;
  readonly onDeleteFractions: (
    fractionIds: readonly string[]
  ) => WasteBulkDeleteResult | Promise<WasteBulkDeleteResult>;
  readonly onToggleFractionStatus: (
    fraction: WasteFractionRecord,
    active: boolean
  ) => void | Promise<void>;
  readonly onFractionsSortChange: (
    sortBy: WasteManagementFractionSortField,
    sortDirection: WasteManagementFractionSortDirection
  ) => void;
  readonly onQueryChange?: (q: string) => void;
  readonly onFractionsStatusChange: (
    status: WasteManagementStatusFilter,
    options?: { readonly resetQuery: boolean }
  ) => void;
  readonly page: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly saving?: boolean;
};

export type FractionBulkDeleteRequest = Readonly<{
  fractionIds: readonly string[];
  clearSelection: () => void;
}>;

const columnIdBySortField: Record<WasteManagementFractionSortField, string> = {
  name: 'nameWithContainerSize',
  containerSize: 'nameWithContainerSize',
  color: 'color',
  pdfShortLabel: 'pdfShortLabel',
  description: 'description',
  status: 'status',
};

export const sortFieldByColumnId: Record<string, WasteManagementFractionSortField> = {
  nameWithContainerSize: 'name',
  color: 'color',
  pdfShortLabel: 'pdfShortLabel',
  description: 'description',
  status: 'status',
};

export const createFractionSorting = (
  fractionsSortBy: WasteManagementFractionSortField,
  fractionsSortDirection: WasteManagementFractionSortDirection
): StudioTableSortingState => [
  { id: columnIdBySortField[fractionsSortBy], desc: fractionsSortDirection === 'desc' },
];

export const useFractionTableLabels = () => {
  const pt = usePluginTranslation('wasteManagement');
  const labels: StudioDataTableLabels = {
    selectionColumn: pt('masterData.fractions.table.selection'),
    actionsColumn: pt('masterData.fractions.table.actions'),
    loading: pt('masterData.messages.loading'),
    selectAllRows: (label) => pt('masterData.fractions.table.selectAllRows', { label }),
    selectRow: ({ rowId }) => pt('masterData.fractions.table.selectRow', { rowId }),
    selectMobileRow: ({ rowId }) => pt('masterData.fractions.table.selectMobileRow', { rowId }),
  };
  return labels;
};

export const useFractionSortingLabels = () => {
  const pt = usePluginTranslation('wasteManagement');
  return {
    field: pt('masterData.fractions.table.sortingField'),
    direction: pt('masterData.fractions.table.sortingDirection'),
    none: pt('masterData.fractions.table.sortingNone'),
    ascending: pt('masterData.fractions.table.sortingAscending'),
    descending: pt('masterData.fractions.table.sortingDescending'),
  };
};

export const useFractionBulkActions = ({
  saving,
  onRequestDeleteFractions,
}: {
  readonly saving?: boolean;
  readonly onRequestDeleteFractions: (request: FractionBulkDeleteRequest) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const actions: readonly StudioBulkAction<WasteFractionRecord>[] = [
    {
      id: 'delete-selected-fractions',
      label: pt('masterData.fractions.actions.deleteSelected'),
      variant: 'secondary',
      ...(saving ? { disabled: true } : {}),
      onClick: ({ selectedRows, clearSelection }) => {
        onRequestDeleteFractions({
          fractionIds: selectedRows.map((row) => row.id),
          clearSelection,
        });
      },
    },
  ];
  return actions;
};

const triggerId = 'waste-fraction-filters';

export const WasteFractionsFilterAction = ({
  fractionsStatus,
  query,
  onFractionsStatusChange,
  onQueryChange,
}: Pick<
  WasteFractionsContentProps,
  'fractionsStatus' | 'onFractionsStatusChange' | 'onQueryChange'
> & {
  readonly query: string;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [draft, setDraft] = useState<{
    status: WasteManagementStatusFilter;
    resetQuery: boolean;
  } | null>(null);
  return (
    <>
      <WasteListSearch
        label={pt('filters.searchLabel')}
        value={query}
        onCommit={(q) => onQueryChange?.(q)}
      />
      <Button
        type="button"
        variant="secondary"
        id={triggerId}
        aria-haspopup="dialog"
        aria-expanded={draft !== null}
        onClick={() => setDraft({ status: fractionsStatus, resetQuery: false })}
      >
        <IconFilter aria-hidden="true" className="h-4 w-4" />
        {pt('filters.open')}
      </Button>
      <WasteListFilterDialog
        id={triggerId}
        title={pt('filters.open')}
        open={draft !== null}
        onOpenChange={(open) => {
          if (!open) setDraft(null);
        }}
        onReset={() => setDraft({ status: 'all', resetQuery: true })}
        onApply={() => {
          if (!draft) return;
          if (draft.resetQuery) onFractionsStatusChange(draft.status, { resetQuery: true });
          else onFractionsStatusChange(draft.status);
          setDraft(null);
        }}
      >
        {draft ? (
          <label className="grid gap-1 text-sm">
            {pt('filters.statusLabel')}
            <Select
              value={draft.status}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  status: event.currentTarget.value as WasteManagementStatusFilter,
                })
              }
            >
              {(['all', 'active', 'inactive'] as const).map((status) => (
                <option key={status} value={status}>
                  {pt(`filters.status.${status}`)}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </WasteListFilterDialog>
    </>
  );
};

export const WasteFractionFilterSummary = ({
  query,
  fractionsStatus,
  onQueryChange,
  onFractionsStatusChange,
}: Pick<
  WasteFractionsContentProps,
  'fractionsStatus' | 'onQueryChange' | 'onFractionsStatusChange'
> & { readonly query: string }) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <WasteListFilterChips
      chips={[
        ...(query ? [{ id: 'q', label: query, clear: () => onQueryChange?.('') }] : []),
        ...(fractionsStatus !== 'all'
          ? [
              {
                id: 'status',
                label: pt(`filters.status.${fractionsStatus}`),
                clear: () => onFractionsStatusChange('all'),
              },
            ]
          : []),
      ]}
      onReset={() => onFractionsStatusChange('all', { resetQuery: true })}
    />
  );
};
