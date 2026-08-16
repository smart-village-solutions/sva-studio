import type { FormEvent } from 'react';

import type {
  WasteCustomRecurrencePresetRecord,
  WasteFractionRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';
import { isWasteTourValidityApplicable, usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioPageHeader } from '@sva/studio-ui-react';

import { WasteToursTourFields } from './waste-management.tours-tour-fields.js';
import type { TourFormState } from './waste-management.tours.types.js';
import { WastePendingSaveButton } from './waste-management.pending-save-button.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { WasteTourShiftCreateLink } from './waste-management.tour-shift-create-link.js';

type WasteToursFormContentProps = {
  readonly mode: 'create' | 'edit';
  readonly form: TourFormState;
  readonly fractions: readonly WasteFractionRecord[];
  readonly locations: readonly { id: string; label: string }[];
  readonly customRecurrencePresets: readonly WasteCustomRecurrencePresetRecord[];
  readonly showDuplicationHint?: boolean;
  readonly duplicateFromTourName?: string;
  readonly saving: boolean;
  readonly search?: WasteManagementSearchParams;
  readonly canManageScheduling?: boolean;
  readonly persistedTour?: WasteTourRecord;
  readonly onChange: (patch: Partial<TourFormState>) => void;
  readonly onCancel: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

const hasSchedulingChanges = (form: TourFormState, tour: WasteTourRecord): boolean =>
  form.recurrence !== (tour.recurrence ?? '') ||
  form.customRecurrenceId !== (tour.customRecurrenceId ?? '') ||
  form.firstDate !== (tour.firstDate ?? '') ||
  form.endDate !== (tour.endDate ?? '');

const TourShiftSchedulingAction = ({
  form,
  persistedTour,
  search,
  pt,
}: {
  readonly form: TourFormState;
  readonly persistedTour: WasteTourRecord;
  readonly search: WasteManagementSearchParams;
  readonly pt: ReturnType<typeof usePluginTranslation>;
}) => {
  const dirty = hasSchedulingChanges(form, persistedTour);
  const dirtyHint = pt('tours.messages.saveSchedulingBeforeShift');
  return (
    <div className="min-w-0 space-y-2 text-right">
      <WasteTourShiftCreateLink
        search={search}
        tourId={persistedTour.id}
        label={pt('tours.actions.createShift')}
        disabled={dirty}
        disabledDescription={dirty ? dirtyHint : undefined}
      />
      {dirty ? <p className="break-words text-sm text-muted-foreground">{dirtyHint}</p> : null}
    </div>
  );
};

const resolveSaveLabel = (
  pt: ReturnType<typeof usePluginTranslation>,
  mode: 'create' | 'edit',
  saving: boolean
): string =>
  saving
    ? pt('tours.actions.saving')
    : pt(mode === 'create' ? 'tours.actions.create' : 'tours.actions.save');

const TourFormTopActions = ({
  label,
  onCancel,
  pt,
  saving,
}: Readonly<{
  label: string;
  onCancel: () => void;
  pt: ReturnType<typeof usePluginTranslation>;
  saving: boolean;
}>) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
      {pt('tours.actions.cancel')}
    </Button>
    <WastePendingSaveButton type="submit" form="waste-tour-form" saving={saving} label={label} />
  </div>
);

export const WasteToursFormContent = (props: WasteToursFormContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const saveLabel = resolveSaveLabel(pt, props.mode, props.saving);
  const showSchedulingAction = Boolean(
    props.mode === 'edit' &&
    props.canManageScheduling &&
    props.search &&
    props.persistedTour &&
    isWasteTourValidityApplicable(props.persistedTour)
  );
  const schedulingAction =
    showSchedulingAction && props.search && props.persistedTour ? (
      <TourShiftSchedulingAction
        form={props.form}
        persistedTour={props.persistedTour}
        search={props.search}
        pt={pt}
      />
    ) : null;

  return (
    <div className="space-y-6">
      <StudioPageHeader
        title={
          props.mode === 'create' ? pt('tours.dialog.createTitle') : pt('tours.dialog.editTitle')
        }
        description={
          props.mode === 'create'
            ? pt('tours.dialog.createDescription')
            : pt('tours.dialog.editDescription')
        }
        actions={
          <TourFormTopActions
            label={saveLabel}
            onCancel={props.onCancel}
            pt={pt}
            saving={props.saving}
          />
        }
      />

      <form
        id="waste-tour-form"
        className="space-y-6"
        onSubmit={(event) => void props.onSubmit(event)}
      >
        <WasteToursTourFields
          form={props.form}
          fractions={props.fractions}
          locations={props.locations}
          customRecurrencePresets={props.customRecurrencePresets}
          pt={pt}
          onChange={props.onChange}
          schedulingAction={schedulingAction}
        />

        {props.showDuplicationHint ? (
          <div className="rounded-2xl border border-info/40 bg-info/5 px-4 py-3 text-sm text-foreground">
            {pt('tours.messages.duplicateHint', {
              sourceName: props.duplicateFromTourName ?? '',
            })}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background px-5 py-4 shadow-shell">
          <WastePendingSaveButton type="submit" saving={props.saving} label={saveLabel} />
          <Button
            type="button"
            variant="secondary"
            onClick={props.onCancel}
            disabled={props.saving}
          >
            {pt('tours.actions.cancel')}
          </Button>
        </div>
      </form>
    </div>
  );
};
