import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';

import { WasteToursToolbarActions, WasteToursToolbarFilters } from './waste-management.tours.toolbar.parts.js';

type WasteToursToolbarProps = {
  readonly filterDialogOpen: boolean;
  readonly selectedCount: number;
  readonly query: string;
  readonly status: 'all' | 'active' | 'inactive';
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly tourWasteFractionId: string | undefined;
  readonly firstDateFrom: string | undefined;
  readonly firstDateTo: string | undefined;
  readonly endDateFrom: string | undefined;
  readonly endDateTo: string | undefined;
  readonly draftQuery: string;
  readonly draftStatus: 'all' | 'active' | 'inactive';
  readonly draftTourWasteFractionId: string | undefined;
  readonly draftFirstDateFrom: string | undefined;
  readonly draftFirstDateTo: string | undefined;
  readonly draftEndDateFrom: string | undefined;
  readonly draftEndDateTo: string | undefined;
  readonly hasActiveFilters: boolean;
  readonly onOpenCreateDialog: () => void;
  readonly onOpenFilterDialog: () => void;
  readonly onFilterDialogOpenChange: (open: boolean) => void;
  readonly onOpenBulkDelete: () => void;
  readonly onDraftQueryChange: (value: string) => void;
  readonly onDraftStatusChange: (value: 'all' | 'active' | 'inactive') => void;
  readonly onDraftTourWasteFractionIdChange: (value: string | undefined) => void;
  readonly onDraftFirstDateFromChange: (value: string | undefined) => void;
  readonly onDraftFirstDateToChange: (value: string | undefined) => void;
  readonly onDraftEndDateFromChange: (value: string | undefined) => void;
  readonly onDraftEndDateToChange: (value: string | undefined) => void;
  readonly onApplyFilters: () => void;
  readonly onResetFilters: () => void;
};

const toWasteToursToolbarActionsProps = ({
  selectedCount,
  filterDialogOpen,
  hasActiveFilters,
  onOpenBulkDelete,
  onOpenFilterDialog,
  onResetFilters,
}: WasteToursToolbarProps) => ({
  selectedCount,
  filterDialogOpen,
  hasActiveFilters,
  onOpenBulkDelete,
  onOpenFilterDialog,
  onResetFilters,
});

const toWasteToursToolbarFiltersProps = ({
  filterDialogOpen,
  query,
  status,
  fractions,
  tourWasteFractionId,
  firstDateFrom,
  firstDateTo,
  endDateFrom,
  endDateTo,
  draftQuery,
  draftStatus,
  draftTourWasteFractionId,
  draftFirstDateFrom,
  draftFirstDateTo,
  draftEndDateFrom,
  draftEndDateTo,
  onFilterDialogOpenChange,
  onDraftQueryChange,
  onDraftStatusChange,
  onDraftTourWasteFractionIdChange,
  onDraftFirstDateFromChange,
  onDraftFirstDateToChange,
  onDraftEndDateFromChange,
  onDraftEndDateToChange,
  onApplyFilters,
}: WasteToursToolbarProps) => ({
  filterDialogOpen,
  query,
  status,
  fractions,
  tourWasteFractionId,
  firstDateFrom,
  firstDateTo,
  endDateFrom,
  endDateTo,
  draftQuery,
  draftStatus,
  draftTourWasteFractionId,
  draftFirstDateFrom,
  draftFirstDateTo,
  draftEndDateFrom,
  draftEndDateTo,
  onFilterDialogOpenChange,
  onDraftQueryChange,
  onDraftStatusChange,
  onDraftTourWasteFractionIdChange,
  onDraftFirstDateFromChange,
  onDraftFirstDateToChange,
  onDraftEndDateFromChange,
  onDraftEndDateToChange,
  onApplyFilters,
});

export const WasteToursToolbar = (props: WasteToursToolbarProps) => {
  const {
    onOpenCreateDialog,
  } = props;
  const actionsProps = toWasteToursToolbarActionsProps(props);
  const filtersProps = toWasteToursToolbarFiltersProps(props);
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-1 flex-col gap-3">
        <WasteToursToolbarActions {...actionsProps} />
        <WasteToursToolbarFilters {...filtersProps} />
      </div>
      <div className="flex justify-end">
        <Button type="button" onClick={onOpenCreateDialog} className="rounded-lg">
          {pt('tours.actions.openCreate')}
        </Button>
      </div>
    </div>
  );
};
