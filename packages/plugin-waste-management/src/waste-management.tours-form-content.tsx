import type { FormEvent } from 'react';

import type {
  WasteCustomRecurrencePresetRecord,
  WasteFractionRecord,
  WasteTourRecord,
} from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { isWasteTourValidityApplicable } from '@sva/waste-management-contracts';
import { Button, StudioPageHeader, buttonVariants } from '@sva/studio-ui-react';
import { Link } from '@tanstack/react-router';

import { WasteToursTourFields } from './waste-management.tours-tour-fields.js';
import type { TourFormState } from './waste-management.tours.types.js';
import { WastePendingSaveButton } from './waste-management.pending-save-button.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { WasteTourShiftCreateLink } from './waste-management.tour-shift-create-link.js';
import { toWasteTourSchedulingSearch } from './waste-management.cross-link.navigation.js';

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
  readonly assignmentContextLoading?: boolean;
  readonly onOpenAssignments?: () => void;
  readonly onOpenCalendar?: () => void;
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
    <div className="min-w-0">
      <WasteTourShiftCreateLink
        search={search}
        tourId={persistedTour.id}
        label={pt('tours.actions.createShift')}
        disabled={dirty}
        disabledDescription={dirty ? dirtyHint : undefined}
      />
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
  const canOpenTourContext = props.mode === 'edit' && props.persistedTour && props.search;
  const schedulingDirty = Boolean(
    props.persistedTour && hasSchedulingChanges(props.form, props.persistedTour)
  );

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
          statusReadOnly={props.mode === 'create'}
          pt={pt}
          onChange={props.onChange}
        />

        {canOpenTourContext && props.persistedTour && props.search ? (
          <section
            className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-shell"
            aria-label={pt('tours.workspace.title')}
          >
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-foreground">
                {pt('tours.workspace.title')}
              </h2>
              <p className="text-sm text-muted-foreground">{pt('tours.workspace.description')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {props.onOpenAssignments ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={props.assignmentContextLoading}
                  onClick={props.onOpenAssignments}
                >
                  {pt('tours.workspace.assignments')}
                </Button>
              ) : null}
              {props.onOpenCalendar ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={schedulingDirty}
                  onClick={props.onOpenCalendar}
                >
                  {pt('tours.workspace.calendar')}
                </Button>
              ) : null}
              <Link
                to="/plugins/waste-management"
                search={toWasteTourSchedulingSearch(props.search, props.persistedTour.id)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: 'secondary' })}
                aria-label={`${pt('tours.workspace.scheduling')} – ${pt('tours.actions.opensInNewTab')}`}
              >
                {pt('tours.workspace.scheduling')}
              </Link>
              {schedulingAction}
            </div>
            {schedulingDirty ? (
              <p className="text-sm text-muted-foreground">
                {pt('tours.messages.saveSchedulingBeforeShift')}
              </p>
            ) : null}
          </section>
        ) : null}

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
