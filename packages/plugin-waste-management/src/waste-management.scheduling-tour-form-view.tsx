import { useNavigate } from '@tanstack/react-router';

import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';
import { WasteSchedulingFormContent } from './waste-management.scheduling-form-content.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteSchedulingController = ReturnType<typeof useWasteSchedulingController>;

export const WasteSchedulingTourFormView = ({
  controller,
  search,
}: {
  readonly controller: WasteSchedulingController;
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
