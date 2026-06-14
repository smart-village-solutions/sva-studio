import { useNavigate } from '@tanstack/react-router';

import { useWasteSchedulingViewModel } from './use-waste-scheduling-view-model.js';
import { WasteSchedulingFormContent } from './waste-management.scheduling-form-content.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteViewModel = ReturnType<typeof useWasteSchedulingViewModel>;

export const WasteSchedulingGlobalFormView = ({
  controller,
  search,
}: {
  readonly controller: WasteViewModel;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigate = useNavigate();

  return (
    <WasteSchedulingFormContent
      variant="global"
      mode="edit"
      form={controller.globalShiftForm}
      tours={controller.availableTours}
      saving={controller.saving}
      onChange={(patch) => controller.setGlobalShiftForm((current) => ({ ...current, ...patch }))}
      onCancel={() => {
        controller.setGlobalDialogOpen(false);
        controller.resetGlobalShiftForm();
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
      onSubmit={(event) => controller.onSubmitGlobalShift(event, 'edit')}
    />
  );
};
