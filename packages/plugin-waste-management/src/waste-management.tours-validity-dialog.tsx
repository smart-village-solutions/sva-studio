import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  WasteTourRecord,
  WasteTourValidityBulkUpdateInput,
  WasteTourValidityDateOperation,
} from '@sva/plugin-sdk';
import {
  isWasteTourValidityApplicable,
  resolveWasteTourValidityDates,
  usePluginTranslation,
} from '@sva/plugin-sdk';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  StudioFieldGroup,
} from '@sva/studio-ui-react';
import { ValidityModeField, type ValidityMode } from './waste-management.tours-validity-field.js';

const createDateOperation = (mode: ValidityMode, value: string): WasteTourValidityDateOperation =>
  mode === 'set' ? { mode, value } : { mode };

export const buildTourValidityBulkInput = ({
  tours,
  firstMode,
  firstDate,
  endMode,
  endDate,
}: {
  readonly tours: readonly WasteTourRecord[];
  readonly firstMode: ValidityMode;
  readonly firstDate: string;
  readonly endMode: ValidityMode;
  readonly endDate: string;
}): WasteTourValidityBulkUpdateInput => ({
  tourIds: tours.map((tour) => tour.id),
  firstDate: createDateOperation(firstMode, firstDate),
  endDate: createDateOperation(endMode, endDate),
});

const useValidityDialogState = (tours: readonly WasteTourRecord[], open: boolean) => {
  const [firstMode, setFirstMode] = useState<ValidityMode>('unchanged');
  const [firstDate, setFirstDate] = useState('');
  const [endMode, setEndMode] = useState<ValidityMode>('unchanged');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (open) {
      setFirstMode('unchanged');
      setFirstDate('');
      setEndMode('unchanged');
      setEndDate('');
    }
  }, [open]);

  const input = useMemo(
    () => buildTourValidityBulkInput({ tours, firstMode, firstDate, endMode, endDate }),
    [endDate, endMode, firstDate, firstMode, tours]
  );
  const inapplicableTours = useMemo(
    () => tours.filter((tour) => !isWasteTourValidityApplicable(tour)),
    [tours]
  );
  const hasInvalidRange = useMemo(
    () =>
      tours
        .filter(isWasteTourValidityApplicable)
        .some((tour) => resolveWasteTourValidityDates(tour, input) === null),
    [input, tours]
  );
  const hasChange = firstMode !== 'unchanged' || endMode !== 'unchanged';
  const missingSetDate =
    (firstMode === 'set' && firstDate.length === 0) || (endMode === 'set' && endDate.length === 0);

  return {
    firstMode,
    setFirstMode,
    firstDate,
    setFirstDate,
    endMode,
    setEndMode,
    endDate,
    setEndDate,
    input,
    inapplicableTours,
    hasInvalidRange,
    hasChange,
    missingSetDate,
  } as const;
};

const InapplicableToursWarning = ({ tours }: Readonly<{ tours: readonly WasteTourRecord[] }>) => {
  const pt = usePluginTranslation('wasteManagement');
  return tours.length > 0 ? (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
      <p className="text-sm font-semibold text-destructive">
        {pt('tours.bulkValidityDialog.inapplicableTitle')}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {pt('tours.bulkValidityDialog.inapplicableDescription', {
          value: tours.map((tour) => tour.name).join(', '),
        })}
      </p>
    </div>
  ) : null;
};

type ValidityFieldsProps = Readonly<{
  state: ReturnType<typeof useValidityDialogState>;
  saving: boolean;
}>;

const ValidityFields = ({ state, saving }: ValidityFieldsProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <StudioFieldGroup>
      <ValidityModeField
        id="waste-tour-bulk-validity-first"
        label={pt('tours.bulkValidityDialog.fields.firstMode')}
        mode={state.firstMode}
        date={state.firstDate}
        dateLabel={pt('tours.bulkValidityDialog.fields.firstDate')}
        disabled={saving}
        onModeChange={state.setFirstMode}
        onDateChange={state.setFirstDate}
      />
      <ValidityModeField
        id="waste-tour-bulk-validity-end"
        label={pt('tours.bulkValidityDialog.fields.endMode')}
        mode={state.endMode}
        date={state.endDate}
        dateLabel={pt('tours.bulkValidityDialog.fields.endDate')}
        disabled={saving}
        onModeChange={state.setEndMode}
        onDateChange={state.setEndDate}
      />
    </StudioFieldGroup>
  );
};

export const WasteToursValidityDialog = ({
  open,
  tours,
  saving,
  onOpenChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly tours: readonly WasteTourRecord[];
  readonly saving: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (input: WasteTourValidityBulkUpdateInput) => Promise<boolean>;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const state = useValidityDialogState(tours, open);
  const canSubmit =
    tours.length > 0 &&
    state.inapplicableTours.length === 0 &&
    state.hasChange &&
    !state.missingSetDate &&
    !state.hasInvalidRange &&
    !saving;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    await onSubmit(state.input);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-2xl">
        <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          <DialogHeader>
            <DialogTitle>{pt('tours.bulkValidityDialog.title')}</DialogTitle>
            <DialogDescription>
              {pt('tours.bulkValidityDialog.description', { value: tours.length })}
            </DialogDescription>
          </DialogHeader>

          <p className="text-sm font-medium text-foreground">
            {pt('tours.bulkValidityDialog.selectedCount', { value: tours.length })}
          </p>

          <InapplicableToursWarning tours={state.inapplicableTours} />
          <ValidityFields state={state} saving={saving} />
          {state.hasInvalidRange ? (
            <p className="text-sm text-destructive" role="alert">
              {pt('tours.bulkValidityDialog.invalidRange')}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              {pt('tours.bulkValidityDialog.cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {saving ? pt('tours.actions.saving') : pt('tours.bulkValidityDialog.apply')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
