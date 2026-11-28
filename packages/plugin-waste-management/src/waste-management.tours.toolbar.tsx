import { formatCalendarDate, toDatetimeLocalValue, usePluginTranslation } from '@sva/plugin-sdk';
import { type WasteTourStatus } from '@sva/waste-management-contracts';
import { Button } from '@sva/studio-ui-react';

import {
  WasteToursFilterActions,
  WasteToursToolbarActions,
} from './waste-management.tours.toolbar.actions.js';
import { WasteToursToolbarFilters } from './waste-management.tours.toolbar.parts.js';
import { WasteListSearch, WasteListFilterChips } from './waste-management.list-filter-dialog.js';
import type {
  WasteManagementSearchParams,
  WasteManagementTourValidityPeriod,
} from './search-params.js';
import { WastePanelTableTopBar } from './waste-management.table-frame.js';
import { resolveWasteTourValidityYear } from './waste-management.tours.validity-filter.js';

type WasteToursToolbarProps = {
  readonly filterDialogOpen: boolean;
  readonly selectedCount: number;
  readonly hiddenSelectedCount: number;
  readonly filteredCount: number;
  readonly allFilteredSelected: boolean;
  readonly someFilteredSelected: boolean;
  readonly query: string;
  readonly status: 'all' | WasteTourStatus;
  readonly tourValidityPeriod: WasteManagementTourValidityPeriod;
  readonly tourReview: WasteManagementSearchParams['tourReview'];
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly tourWasteFractionId: string | undefined;
  readonly firstDateFrom: string | undefined;
  readonly firstDateTo: string | undefined;
  readonly endDateFrom: string | undefined;
  readonly endDateTo: string | undefined;
  readonly draftQuery: string;
  readonly draftStatus: 'all' | WasteTourStatus;
  readonly draftTourValidityPeriod: WasteManagementTourValidityPeriod;
  readonly draftTourReview: WasteManagementSearchParams['tourReview'];
  readonly draftTourWasteFractionId: string | undefined;
  readonly draftFirstDateFrom: string | undefined;
  readonly draftFirstDateTo: string | undefined;
  readonly draftEndDateFrom: string | undefined;
  readonly draftEndDateTo: string | undefined;
  readonly hasActiveFilters: boolean;
  readonly onOpenCreateDialog: () => void;
  readonly onOpenAnnualTransfer: () => void;
  readonly canTransferAnnualTours: boolean;
  readonly onOpenFilterDialog: () => void;
  readonly onFilterDialogOpenChange: (open: boolean) => void;
  readonly onOpenBulkDelete: () => void;
  readonly onOpenBulkValidity: () => void;
  readonly onOpenBulkStatus: () => void;
  readonly onOpenBulkReview: () => void;
  readonly onOpenTourMerge?: () => void;
  readonly onToggleSelectAllFiltered: (checked: boolean) => void;
  readonly onClearSelection: () => void;
  readonly onDraftQueryChange: (value: string) => void;
  readonly onDraftStatusChange: (value: 'all' | WasteTourStatus) => void;
  readonly onDraftTourValidityPeriodChange: (value: WasteManagementTourValidityPeriod) => void;
  readonly onDraftTourReviewChange: (value: WasteManagementSearchParams['tourReview']) => void;
  readonly onDraftTourWasteFractionIdChange: (value: string | undefined) => void;
  readonly onDraftFirstDateFromChange: (value: string | undefined) => void;
  readonly onDraftFirstDateToChange: (value: string | undefined) => void;
  readonly onDraftEndDateFromChange: (value: string | undefined) => void;
  readonly onDraftEndDateToChange: (value: string | undefined) => void;
  readonly onApplyFilters: () => void;
  readonly onResetFilters: () => void;
  readonly onSetCriterion: (
    patch: Partial<
      Pick<
        WasteManagementSearchParams,
        | 'q'
        | 'tourStatus'
        | 'tourValidityPeriod'
        | 'tourReview'
        | 'tourWasteFractionId'
        | 'firstDateFrom'
        | 'firstDateTo'
        | 'endDateFrom'
        | 'endDateTo'
      >
    >
  ) => void;
};

const toWasteToursToolbarActionsProps = ({
  selectedCount,
  hiddenSelectedCount,
  filteredCount,
  allFilteredSelected,
  someFilteredSelected,
  filterDialogOpen,
  hasActiveFilters,
  onOpenBulkDelete,
  onOpenBulkValidity,
  onOpenBulkStatus,
  onOpenBulkReview,
  onOpenTourMerge,
  onToggleSelectAllFiltered,
  onClearSelection,
  onOpenFilterDialog,
  onResetFilters,
}: WasteToursToolbarProps) => ({
  selectedCount,
  hiddenSelectedCount,
  filteredCount,
  allFilteredSelected,
  someFilteredSelected,
  filterDialogOpen,
  hasActiveFilters,
  onOpenBulkDelete,
  onOpenBulkValidity,
  onOpenBulkStatus,
  onOpenBulkReview,
  onOpenTourMerge,
  onToggleSelectAllFiltered,
  onClearSelection,
  onOpenFilterDialog,
  onResetFilters,
});

export const WasteToursToolbar = (props: WasteToursToolbarProps) => {
  const { onOpenCreateDialog, onOpenAnnualTransfer, canTransferAnnualTours } = props;
  const actionsProps = toWasteToursToolbarActionsProps(props);
  const pt = usePluginTranslation('wasteManagement');
  const selectedFraction = props.fractions.find(
    (fraction) => fraction.id === props.tourWasteFractionId
  );
  const referenceYear = Number(toDatetimeLocalValue(new Date().toISOString()).slice(0, 4));
  const activeFilters = [
    { id: 'q', label: props.query, clear: () => props.onSetCriterion({ q: '' }) },
    {
      id: 'status',
      label: props.status !== 'all' ? pt(`tours.status.${props.status}`) : '',
      clear: () => props.onSetCriterion({ tourStatus: 'all' }),
    },
    {
      id: 'review',
      label: props.tourReview ? pt(`tours.filters.review.${props.tourReview}`) : '',
      clear: () => props.onSetCriterion({ tourReview: undefined }),
    },
    {
      id: 'validity',
      label:
        props.tourValidityPeriod !== 'all'
          ? pt(`tours.filters.validityPeriod.${props.tourValidityPeriod}`, {
              year: resolveWasteTourValidityYear(props.tourValidityPeriod, referenceYear),
            })
          : '',
      clear: () => props.onSetCriterion({ tourValidityPeriod: 'all' }),
    },
    {
      id: 'fraction',
      label: props.tourWasteFractionId
        ? `${pt('tours.filters.fractionLabel')} · ${selectedFraction?.name ?? props.tourWasteFractionId}`
        : '',
      clear: () => props.onSetCriterion({ tourWasteFractionId: undefined }),
    },
    ...(['firstDateFrom', 'firstDateTo', 'endDateFrom', 'endDateTo'] as const).map((id) => ({
      id,
      label: props[id]
        ? `${pt(`tours.filters.${id}Label`)} · ${formatCalendarDate(props[id])}`
        : '',
      clear: () => props.onSetCriterion({ [id]: undefined }),
    })),
  ].filter(({ label }) => Boolean(label));

  return (
    <WastePanelTableTopBar
      activeFilters={<WasteListFilterChips chips={activeFilters} onReset={props.onResetFilters} />}
      selection={<WasteToursToolbarActions {...actionsProps} />}
      actions={
        <>
          {canTransferAnnualTours ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onOpenAnnualTransfer}
              className="rounded-md"
            >
              {pt('tours.annualTransfer.open')}
            </Button>
          ) : null}
          <Button type="button" onClick={onOpenCreateDialog} className="rounded-md">
            {pt('tours.actions.openCreate')}
          </Button>
        </>
      }
    >
      <WasteListSearch
        label={pt('filters.searchLabel')}
        value={props.query}
        onCommit={(q) => props.onSetCriterion({ q })}
      />
      <WasteToursFilterActions {...actionsProps} />
      <WasteToursToolbarFilters {...props} />
    </WastePanelTableTopBar>
  );
};
