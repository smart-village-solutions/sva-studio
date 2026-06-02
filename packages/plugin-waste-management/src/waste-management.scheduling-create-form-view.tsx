import { useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';
import { WasteSchedulingFormContent } from './waste-management.scheduling-form-content.js';
import { resolveSchedulingEntryTypeFromShiftContext } from './waste-management.scheduling.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteSchedulingController = ReturnType<typeof useWasteSchedulingController>;
type WasteSchedulingCreateVariant = 'global-shift' | 'tour-shift';

const resolveDefaultCreateVariant = (
  search: WasteManagementSearchParams,
  availableTours: readonly { readonly id: string }[],
): WasteSchedulingCreateVariant => {
  if (search.schedulingEntryType === 'global-shift' || search.schedulingEntryType === 'tour-shift') {
    return search.schedulingEntryType;
  }
  return resolveSchedulingEntryTypeFromShiftContext(search.shiftContext, availableTours);
};

const createSchedulingListSearch = (search: WasteManagementSearchParams): WasteManagementSearchParams => ({
  ...search,
  schedulingView: 'list',
  schedulingEntryType: undefined,
  schedulingEntryId: undefined,
});

const createSchedulingVariantSearch = (
  search: WasteManagementSearchParams,
  variant: WasteSchedulingCreateVariant,
): WasteManagementSearchParams => ({
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

export const WasteSchedulingCreateFormView = ({
  controller,
  search,
}: {
  readonly controller: WasteSchedulingController;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigate = useNavigate();
  const pt = usePluginTranslation('wasteManagement');
  const [variant, setVariant] = useState<WasteSchedulingCreateVariant>(() =>
    resolveDefaultCreateVariant(search, controller.availableTours),
  );

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

  if (variant === 'global-shift') {
    return (
      <WasteSchedulingFormContent
        variant="global"
        mode="create"
        form={controller.globalShiftForm}
        tours={controller.availableTours}
        saving={controller.saving}
        beforeFields={variantField}
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
      beforeFields={variantField}
      onChange={(patch) => controller.setTourShiftForm((current) => ({ ...current, ...patch }))}
      onCancel={handleCancel}
      onSubmit={(event) => controller.onSubmitTourShift(event, 'create')}
    />
  );
};
