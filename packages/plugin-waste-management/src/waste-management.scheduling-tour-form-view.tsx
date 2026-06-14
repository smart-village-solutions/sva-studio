import { useNavigate } from '@tanstack/react-router';

import { useWasteSchedulingViewModel } from './use-waste-scheduling-view-model.js';
import { WasteSchedulingFormContent } from './waste-management.scheduling-form-content.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteViewModel = ReturnType<typeof useWasteSchedulingViewModel>;

export const WasteSchedulingTourFormView = ({
  controller,
  search,
}: {
  readonly controller: WasteViewModel;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigate = useNavigate();

  return (
    <WasteSchedulingFormContent
      variant="tour"
      mode="edit"
      form={controller.tourShiftForm}
      tours={controller.availableTours}
      saving={controller.saving}
      onChange={(patch) => controller.setTourShiftForm((current) => ({ ...current, ...patch }))}
      onCancel={() => {
        controller.setDialogOpen(false);
        controller.resetTourShiftForm();
        controller.setMessage(null);
        void navigate({
          to: '/plugins/waste-management',
          search: {
            ...search,
            schedulingView: 'list',
            schedulingEntryType: undefined,
            schedulingEntryId: undefined,
          },
        });
      }}
      onSubmit={(event) => controller.onSubmitTourShift(event, 'edit')}
    />
  );
};
