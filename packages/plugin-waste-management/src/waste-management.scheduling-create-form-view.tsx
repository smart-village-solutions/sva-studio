import { useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import { useNavigate } from '@tanstack/react-router';

import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';
import { WasteSchedulingFormContent } from './waste-management.scheduling-form-content.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteSchedulingController = ReturnType<typeof useWasteSchedulingController>;
type WasteSchedulingCreateVariant = 'global' | 'tour';

const resolveDefaultCreateVariant = (
  search: WasteManagementSearchParams,
  availableTours: readonly { readonly id: string }[],
): WasteSchedulingCreateVariant => {
  if (search.shiftContext === 'global') {
    return 'global';
  }
  if (search.shiftContext === 'tour' && availableTours.length > 0) {
    return 'tour';
  }
  return availableTours.length > 0 ? 'tour' : 'global';
};

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
      search: { ...search, schedulingView: 'list', globalDateShiftId: undefined, tourDateShiftId: undefined },
    });
  };

  const variantField = (
    <StudioFieldGroup>
      <StudioField
        id="waste-scheduling-create-variant"
        label={pt('scheduling.create.scope')}
        description={pt('scheduling.create.scopeHint')}
      >
        <Select
          id="waste-scheduling-create-variant"
          value={variant}
          onChange={(event) => setVariant(event.target.value as WasteSchedulingCreateVariant)}
        >
          <option value="tour">{pt('scheduling.create.scopeTour')}</option>
          <option value="global">{pt('scheduling.create.scopeGlobal')}</option>
        </Select>
      </StudioField>
    </StudioFieldGroup>
  );

  if (variant === 'global') {
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
