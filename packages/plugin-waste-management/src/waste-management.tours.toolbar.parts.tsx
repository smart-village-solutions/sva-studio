import { usePluginTranslation } from '@sva/plugin-sdk';
import type { WasteTourStatus } from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@sva/studio-ui-react';

import { WasteToursToolbarFilterFields } from './waste-management.tours.toolbar.filter-fields.js';
import type { WasteManagementTourValidityPeriod } from './search-params.js';

type WasteToursToolbarFiltersProps = {
  readonly filterDialogOpen: boolean;
  readonly query: string;
  readonly status: 'all' | WasteTourStatus;
  readonly tourValidityPeriod: WasteManagementTourValidityPeriod;
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly tourWasteFractionId: string | undefined;
  readonly firstDateFrom: string | undefined;
  readonly firstDateTo: string | undefined;
  readonly endDateFrom: string | undefined;
  readonly endDateTo: string | undefined;
  readonly draftQuery: string;
  readonly draftStatus: 'all' | WasteTourStatus;
  readonly draftTourValidityPeriod: WasteManagementTourValidityPeriod;
  readonly draftTourWasteFractionId: string | undefined;
  readonly draftFirstDateFrom: string | undefined;
  readonly draftFirstDateTo: string | undefined;
  readonly draftEndDateFrom: string | undefined;
  readonly draftEndDateTo: string | undefined;
  readonly onFilterDialogOpenChange: (open: boolean) => void;
  readonly onDraftQueryChange: (value: string) => void;
  readonly onDraftStatusChange: (value: 'all' | WasteTourStatus) => void;
  readonly onDraftTourValidityPeriodChange: (value: WasteManagementTourValidityPeriod) => void;
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
  draftTourValidityPeriod,
  draftTourWasteFractionId,
  draftFirstDateFrom,
  draftFirstDateTo,
  draftEndDateFrom,
  draftEndDateTo,
  onDraftQueryChange,
  onDraftStatusChange,
  onDraftTourValidityPeriodChange,
  onDraftTourWasteFractionIdChange,
  onDraftFirstDateFromChange,
  onDraftFirstDateToChange,
  onDraftEndDateFromChange,
  onDraftEndDateToChange,
}: WasteToursToolbarFiltersProps) => ({
  fractions,
  draftQuery,
  draftStatus,
  draftTourValidityPeriod,
  draftTourWasteFractionId,
  draftFirstDateFrom,
  draftFirstDateTo,
  draftEndDateFrom,
  draftEndDateTo,
  onDraftQueryChange,
  onDraftStatusChange,
  onDraftTourValidityPeriodChange,
  onDraftTourWasteFractionIdChange,
  onDraftFirstDateFromChange,
  onDraftFirstDateToChange,
  onDraftEndDateFromChange,
  onDraftEndDateToChange,
});

const hasWasteToursDraftFilterChanges = ({
  query,
  status,
  tourValidityPeriod,
  tourWasteFractionId,
  firstDateFrom,
  firstDateTo,
  endDateFrom,
  endDateTo,
  draftQuery,
  draftStatus,
  draftTourValidityPeriod,
  draftTourWasteFractionId,
  draftFirstDateFrom,
  draftFirstDateTo,
  draftEndDateFrom,
  draftEndDateTo,
}: {
  readonly query: string;
  readonly status: 'all' | WasteTourStatus;
  readonly tourValidityPeriod: WasteManagementTourValidityPeriod;
  readonly tourWasteFractionId: string | undefined;
  readonly firstDateFrom: string | undefined;
  readonly firstDateTo: string | undefined;
  readonly endDateFrom: string | undefined;
  readonly endDateTo: string | undefined;
  readonly draftQuery: string;
  readonly draftStatus: 'all' | WasteTourStatus;
  readonly draftTourValidityPeriod: WasteManagementTourValidityPeriod;
  readonly draftTourWasteFractionId: string | undefined;
  readonly draftFirstDateFrom: string | undefined;
  readonly draftFirstDateTo: string | undefined;
  readonly draftEndDateFrom: string | undefined;
  readonly draftEndDateTo: string | undefined;
}) =>
  draftQuery !== query ||
  draftStatus !== status ||
  draftTourValidityPeriod !== tourValidityPeriod ||
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => props.onFilterDialogOpenChange(false)}
          >
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
