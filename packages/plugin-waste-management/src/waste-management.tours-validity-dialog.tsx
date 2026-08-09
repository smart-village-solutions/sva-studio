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
  Input,
  Select,
  StudioField,
  StudioFieldGroup,
} from '@sva/studio-ui-react';

type ValidityMode = WasteTourValidityDateOperation['mode'];

const createDateOperation = (
  mode: ValidityMode,
  value: string
): WasteTourValidityDateOperation =>
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

const ValidityModeField = ({
  id,
  label,
  mode,
  date,
  dateLabel,
  disabled,
  onModeChange,
  onDateChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly mode: ValidityMode;
  readonly date: string;
  readonly dateLabel: string;
  readonly disabled: boolean;
  readonly onModeChange: (mode: ValidityMode) => void;
  readonly onDateChange: (date: string) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <>
      <StudioField id={`${id}-mode`} label={label}>
        <Select
          id={`${id}-mode`}
          value={mode}
          disabled={disabled}
          onChange={(event) => onModeChange(event.target.value as ValidityMode)}
        >
          <option value="unchanged">{pt('tours.bulkValidityDialog.modes.unchanged')}</option>
          <option value="set">{pt('tours.bulkValidityDialog.modes.set')}</option>
          <option value="clear">{pt('tours.bulkValidityDialog.modes.clear')}</option>
        </Select>
      </StudioField>
      {mode === 'set' ? (
        <StudioField id={`${id}-date`} label={dateLabel} required>
          <Input
            id={`${id}-date`}
            type="date"
            value={date}
            disabled={disabled}
            required
            onChange={(event) => onDateChange(event.target.value)}
          />
        </StudioField>
      ) : null}
    </>
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
  const [firstMode, setFirstMode] = useState<ValidityMode>('unchanged');
  const [firstDate, setFirstDate] = useState('');
  const [endMode, setEndMode] = useState<ValidityMode>('unchanged');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setFirstMode('unchanged');
    setFirstDate('');
    setEndMode('unchanged');
    setEndDate('');
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
    (firstMode === 'set' && firstDate.length === 0) ||
    (endMode === 'set' && endDate.length === 0);
  const canSubmit =
    tours.length > 0 &&
    inapplicableTours.length === 0 &&
    hasChange &&
    !missingSetDate &&
    !hasInvalidRange &&
    !saving;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    await onSubmit(input);
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

          {inapplicableTours.length > 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
              <p className="text-sm font-semibold text-destructive">
                {pt('tours.bulkValidityDialog.inapplicableTitle')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {pt('tours.bulkValidityDialog.inapplicableDescription', {
                  value: inapplicableTours.map((tour) => tour.name).join(', '),
                })}
              </p>
            </div>
          ) : null}

          <StudioFieldGroup>
            <ValidityModeField
              id="waste-tour-bulk-validity-first"
              label={pt('tours.bulkValidityDialog.fields.firstMode')}
              mode={firstMode}
              date={firstDate}
              dateLabel={pt('tours.bulkValidityDialog.fields.firstDate')}
              disabled={saving}
              onModeChange={setFirstMode}
              onDateChange={setFirstDate}
            />
            <ValidityModeField
              id="waste-tour-bulk-validity-end"
              label={pt('tours.bulkValidityDialog.fields.endMode')}
              mode={endMode}
              date={endDate}
              dateLabel={pt('tours.bulkValidityDialog.fields.endDate')}
              disabled={saving}
              onModeChange={setEndMode}
              onDateChange={setEndDate}
            />
          </StudioFieldGroup>

          {hasInvalidRange ? (
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
              {saving
                ? pt('tours.actions.saving')
                : pt('tours.bulkValidityDialog.apply')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
