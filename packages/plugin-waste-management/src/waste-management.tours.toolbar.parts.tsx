import { usePluginTranslation } from '@sva/plugin-sdk';
import type { WasteTourStatus } from '@sva/waste-management-contracts';
import { WasteListFilterDialog } from './waste-management.list-filter-dialog.js';

import { WasteToursToolbarFilterFields } from './waste-management.tours.toolbar.filter-fields.js';
import type {
  WasteManagementSearchParams,
  WasteManagementTourValidityPeriod,
} from './search-params.js';

type WasteToursToolbarFiltersProps = {
  readonly filterDialogOpen: boolean;
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
  readonly onFilterDialogOpenChange: (open: boolean) => void;
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
};

const hasWasteToursDraftFilterChanges = ({
  query,
  status,
  tourValidityPeriod,
  tourReview,
  tourWasteFractionId,
  firstDateFrom,
  firstDateTo,
  endDateFrom,
  endDateTo,
  draftQuery,
  draftStatus,
  draftTourValidityPeriod,
  draftTourReview,
  draftTourWasteFractionId,
  draftFirstDateFrom,
  draftFirstDateTo,
  draftEndDateFrom,
  draftEndDateTo,
}: {
  readonly query: string;
  readonly status: 'all' | WasteTourStatus;
  readonly tourValidityPeriod: WasteManagementTourValidityPeriod;
  readonly tourReview: WasteManagementSearchParams['tourReview'];
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
}) =>
  draftQuery !== query ||
  draftStatus !== status ||
  draftTourValidityPeriod !== tourValidityPeriod ||
  draftTourReview !== tourReview ||
  draftTourWasteFractionId !== tourWasteFractionId ||
  draftFirstDateFrom !== firstDateFrom ||
  draftFirstDateTo !== firstDateTo ||
  draftEndDateFrom !== endDateFrom ||
  draftEndDateTo !== endDateTo;

export const WasteToursToolbarFilters = (props: WasteToursToolbarFiltersProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const hasDraftChanges = hasWasteToursDraftFilterChanges(props);

  const invalidRange = [
    [props.draftFirstDateFrom, props.draftFirstDateTo],
    [props.draftEndDateFrom, props.draftEndDateTo],
  ].some(([from, to]) => from && to && from > to);

  return (
    <WasteListFilterDialog
      id="waste-tour-filters"
      title={pt('tours.filters.title')}
      description={pt('tours.filters.description')}
      open={props.filterDialogOpen}
      onOpenChange={props.onFilterDialogOpenChange}
      onApply={props.onApplyFilters}
      disabled={!hasDraftChanges || invalidRange}
      onReset={() => {
        props.onDraftQueryChange('');
        props.onDraftStatusChange('all');
        props.onDraftTourValidityPeriodChange('all');
        props.onDraftTourReviewChange(undefined);
        props.onDraftTourWasteFractionIdChange(undefined);
        props.onDraftFirstDateFromChange(undefined);
        props.onDraftFirstDateToChange(undefined);
        props.onDraftEndDateFromChange(undefined);
        props.onDraftEndDateToChange(undefined);
      }}
    >
      <WasteToursToolbarFilterFields {...props} />
      {invalidRange ? (
        <p role="alert" className="text-sm text-destructive">
          {pt('filters.invalidRange')}
        </p>
      ) : null}
    </WasteListFilterDialog>
  );
};
