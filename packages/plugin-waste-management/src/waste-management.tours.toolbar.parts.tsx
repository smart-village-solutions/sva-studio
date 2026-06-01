import { IconFilter, IconTrash } from '@tabler/icons-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from '@sva/studio-ui-react';

import { WasteToursToolbarFilterFields } from './waste-management.tours.toolbar.filter-fields.js';

type WasteToursToolbarFiltersProps = {
  readonly filterDialogOpen: boolean;
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
  readonly onFilterDialogOpenChange: (open: boolean) => void;
  readonly onDraftQueryChange: (value: string) => void;
  readonly onDraftStatusChange: (value: 'all' | 'active' | 'inactive') => void;
  readonly onDraftTourWasteFractionIdChange: (value: string | undefined) => void;
  readonly onDraftFirstDateFromChange: (value: string | undefined) => void;
  readonly onDraftFirstDateToChange: (value: string | undefined) => void;
  readonly onDraftEndDateFromChange: (value: string | undefined) => void;
  readonly onDraftEndDateToChange: (value: string | undefined) => void;
  readonly onApplyFilters: () => void;
};

const toWasteToursToolbarFilterFieldProps = ({
  fractions,
  draftQuery,
  draftStatus,
  draftTourWasteFractionId,
  draftFirstDateFrom,
  draftFirstDateTo,
  draftEndDateFrom,
  draftEndDateTo,
  onDraftQueryChange,
  onDraftStatusChange,
  onDraftTourWasteFractionIdChange,
  onDraftFirstDateFromChange,
  onDraftFirstDateToChange,
  onDraftEndDateFromChange,
  onDraftEndDateToChange,
}: WasteToursToolbarFiltersProps) => ({
  fractions,
  draftQuery,
  draftStatus,
  draftTourWasteFractionId,
  draftFirstDateFrom,
  draftFirstDateTo,
  draftEndDateFrom,
  draftEndDateTo,
  onDraftQueryChange,
  onDraftStatusChange,
  onDraftTourWasteFractionIdChange,
  onDraftFirstDateFromChange,
  onDraftFirstDateToChange,
  onDraftEndDateFromChange,
  onDraftEndDateToChange,
});

export const WasteToursToolbarActions = ({
  selectedCount,
  filterDialogOpen,
  hasActiveFilters,
  onOpenBulkDelete,
  onOpenFilterDialog,
  onResetFilters,
}: {
  readonly selectedCount: number;
  readonly filterDialogOpen: boolean;
  readonly hasActiveFilters: boolean;
  readonly onOpenBulkDelete: () => void;
  readonly onOpenFilterDialog: () => void;
  readonly onResetFilters: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        className={cn(
          'h-10 rounded-lg border border-destructive/15 px-3 text-destructive hover:bg-destructive/5',
          selectedCount === 0 && 'text-destructive/50'
        )}
        disabled={selectedCount === 0}
        onClick={onOpenBulkDelete}
      >
        <IconTrash aria-hidden="true" className="h-4 w-4" />
        {pt('tours.table.deleteSelected')}
      </Button>
      {hasActiveFilters ? (
        <Button type="button" variant="ghost" className="h-10 rounded-lg px-3" onClick={onResetFilters}>
          {pt('tours.filters.reset')}
        </Button>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="h-10 rounded-lg border-border/70 px-3"
        aria-expanded={filterDialogOpen}
        onClick={onOpenFilterDialog}
      >
        <IconFilter aria-hidden="true" className="h-4 w-4" />
        {pt('tours.filters.open')}
      </Button>
    </div>
  );
};

const hasWasteToursDraftFilterChanges = ({
  query,
  status,
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
}: {
  readonly query: string;
  readonly status: 'all' | 'active' | 'inactive';
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
}) =>
  draftQuery !== query ||
  draftStatus !== status ||
  draftTourWasteFractionId !== tourWasteFractionId ||
  draftFirstDateFrom !== firstDateFrom ||
  draftFirstDateTo !== firstDateTo ||
  draftEndDateFrom !== endDateFrom ||
  draftEndDateTo !== endDateTo;

export const WasteToursToolbarFilters = (props: WasteToursToolbarFiltersProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const hasDraftChanges = hasWasteToursDraftFilterChanges(props);
  const filterFieldProps = toWasteToursToolbarFilterFieldProps(props);

  return (
    <Dialog open={props.filterDialogOpen} onOpenChange={props.onFilterDialogOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pt('tours.filters.title')}</DialogTitle>
          <DialogDescription>{pt('tours.filters.description')}</DialogDescription>
        </DialogHeader>
        <WasteToursToolbarFilterFields {...filterFieldProps} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => props.onFilterDialogOpenChange(false)}>
            {pt('tours.filters.cancel')}
          </Button>
          <Button type="button" onClick={props.onApplyFilters} disabled={!hasDraftChanges}>
            {pt('tours.filters.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
