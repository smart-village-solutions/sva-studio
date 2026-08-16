import { useState, type ReactNode } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import { useWasteSchedulingViewModel } from './use-waste-scheduling-view-model.js';
import { WasteSchedulingFormContent } from './waste-management.scheduling-form-content.js';
import { resolveSchedulingEntryTypeFromShiftContext } from './waste-management.scheduling.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { clearTourShiftCreateContext } from './waste-management.tour-shift-navigation.js';
import type { TourShiftCreateContextResolution } from './waste-management.tour-shift-navigation.js';

type WasteViewModel = ReturnType<typeof useWasteSchedulingViewModel>;
type WasteSchedulingCreateVariant = 'global-shift' | 'tour-shift';

const resolveDefaultCreateVariant = (
  search: WasteManagementSearchParams,
  availableTours: readonly { readonly id: string }[]
): WasteSchedulingCreateVariant => {
  if (
    search.schedulingEntryType === 'global-shift' ||
    search.schedulingEntryType === 'tour-shift'
  ) {
    return search.schedulingEntryType;
  }
  return resolveSchedulingEntryTypeFromShiftContext(search.shiftContext, availableTours);
};

const createSchedulingListSearch = (
  search: WasteManagementSearchParams
): WasteManagementSearchParams =>
  clearTourShiftCreateContext({
    ...search,
    schedulingView: 'list',
    schedulingEntryType: undefined,
    schedulingEntryId: undefined,
  });

const createSchedulingVariantSearch = (
  search: WasteManagementSearchParams,
  variant: WasteSchedulingCreateVariant
): WasteManagementSearchParams =>
  clearTourShiftCreateContext({
    ...search,
    schedulingView: 'create',
    schedulingEntryType: variant,
    schedulingEntryId: undefined,
  });

const WasteSchedulingCreateVariantField = ({
  pt,
  search,
  variant,
  setVariant,
  navigate,
}: {
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly search: WasteManagementSearchParams;
  readonly variant: WasteSchedulingCreateVariant;
  readonly setVariant: (variant: WasteSchedulingCreateVariant) => void;
  readonly navigate: ReturnType<typeof useNavigate>;
}) => (
  <StudioFieldGroup>
    <StudioField
      id="waste-scheduling-create-variant"
      label={pt('scheduling.create.scope')}
      description={pt('scheduling.create.scopeHint')}
    >
      <Select
        id="waste-scheduling-create-variant"
        value={variant}
        onChange={(event) => {
          const nextVariant = event.target.value as WasteSchedulingCreateVariant;
          setVariant(nextVariant);
          void navigate({
            to: '/plugins/waste-management',
            search: createSchedulingVariantSearch(search, nextVariant),
            replace: true,
          });
        }}
      >
        <option value="tour-shift">{pt('scheduling.create.scopeTour')}</option>
        <option value="global-shift">{pt('scheduling.create.scopeGlobal')}</option>
      </Select>
    </StudioField>
  </StudioFieldGroup>
);

const hasAnnualBaseRule = (controller: WasteViewModel): boolean =>
  Boolean(
    controller.tourShiftForm.hasYear &&
    controller.tourShiftForm.tourId &&
    /^\d{4}-\d{2}-\d{2}$/u.test(controller.tourShiftForm.originalDate) &&
    controller.overview?.tourDateShifts.some(
      (shift) =>
        !shift.hasYear &&
        shift.tourId === controller.tourShiftForm.tourId &&
        shift.originalDate.slice(5) === controller.tourShiftForm.originalDate.slice(5)
    )
  );

const WasteSchedulingCreateContextFields = ({
  context,
  contextualTourName,
  controller,
  variantField,
  pt,
}: {
  readonly context: TourShiftCreateContextResolution;
  readonly contextualTourName?: string;
  readonly controller: WasteViewModel;
  readonly variantField: ReactNode;
  readonly pt: ReturnType<typeof usePluginTranslation>;
}) => (
  <div className="space-y-3">
    {context.kind === 'none' ? (
      variantField
    ) : (
      <div
        role={context.kind === 'valid' && contextualTourName ? 'note' : 'status'}
        className="min-w-0 space-y-1 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm"
      >
        <p className="font-semibold">{pt('scheduling.create.contextTitle')}</p>
        {context.kind === 'valid' && contextualTourName ? (
          <p className="break-words text-muted-foreground">
            {pt('scheduling.create.contextDescription', {
              tour: contextualTourName,
              date: context.originalDate ?? pt('scheduling.create.contextDateUnset'),
            })}
          </p>
        ) : (
          <p className="text-destructive">{pt('scheduling.create.contextInvalid')}</p>
        )}
      </div>
    )}
    {hasAnnualBaseRule(controller) ? (
      <p role="note" className="rounded-xl border border-info/40 bg-info/5 px-4 py-3 text-sm">
        {pt('scheduling.create.annualOverrideHint', {
          year: controller.tourShiftForm.originalDate.slice(0, 4),
        })}
      </p>
    ) : null}
  </div>
);

type WasteSchedulingCreateFormViewProps = {
  readonly controller: WasteViewModel;
  readonly search: WasteManagementSearchParams;
  readonly tourShiftCreateContext?: TourShiftCreateContextResolution;
};

export const WasteSchedulingCreateFormView = (props: WasteSchedulingCreateFormViewProps) => {
  const { controller, search } = props;
  const tourShiftCreateContext = props.tourShiftCreateContext ?? { kind: 'none' };
  const navigate = useNavigate();
  const pt = usePluginTranslation('wasteManagement');
  const [variant, setVariant] = useState<WasteSchedulingCreateVariant>(() =>
    resolveDefaultCreateVariant(search, controller.availableTours)
  );
  const contextualTourName =
    tourShiftCreateContext.kind === 'valid'
      ? controller.availableTours.find((tour) => tour.id === tourShiftCreateContext.tourId)?.name
      : undefined;

  const handleCancel = () => {
    controller.setDialogOpen(false);
    controller.setGlobalDialogOpen(false);
    controller.resetTourShiftForm();
    controller.resetGlobalShiftForm();
    controller.setMessage(null);
    void navigate({
      to: '/plugins/waste-management',
      search: createSchedulingListSearch(search),
    });
  };

  const variantField = (
    <WasteSchedulingCreateVariantField
      pt={pt}
      search={search}
      variant={variant}
      setVariant={setVariant}
      navigate={navigate}
    />
  );
  const beforeFields = (
    <WasteSchedulingCreateContextFields
      context={tourShiftCreateContext}
      contextualTourName={contextualTourName}
      controller={controller}
      variantField={variantField}
      pt={pt}
    />
  );

  if (variant === 'global-shift') {
    return (
      <WasteSchedulingFormContent
        variant="global"
        mode="create"
        form={controller.globalShiftForm}
        tours={controller.availableTours}
        saving={controller.saving}
        message={controller.message}
        beforeFields={beforeFields}
        onChange={(patch) => controller.setGlobalShiftForm((current) => ({ ...current, ...patch }))}
        onCancel={handleCancel}
        onSubmit={(event) => controller.onSubmitGlobalShift(event, 'create')}
      />
    );
  }

  return (
    <WasteSchedulingFormContent
      variant="tour"
      mode="create"
      form={controller.tourShiftForm}
      tours={controller.availableTours}
      saving={controller.saving}
      message={controller.message}
      beforeFields={beforeFields}
      onChange={(patch) => controller.setTourShiftForm((current) => ({ ...current, ...patch }))}
      onCancel={handleCancel}
      onSubmit={(event) => controller.onSubmitTourShift(event, 'create')}
    />
  );
};
