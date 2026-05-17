import { useNavigate } from '@tanstack/react-router';

import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';
import { WasteSchedulingFormContent } from './waste-management.scheduling-form-content.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteSchedulingController = ReturnType<typeof useWasteSchedulingController>;

export const WasteSchedulingGlobalFormView = ({
  controller,
  search,
}: {
  readonly controller: WasteSchedulingController;
  readonly search: WasteManagementSearchParams;
}) => {
  const navigate = useNavigate();

  return (
    <WasteSchedulingFormContent
      variant="global"
      mode={search.schedulingView === 'edit-global' ? 'edit' : 'create'}
      form={controller.globalShiftForm}
      tours={controller.availableTours}
      saving={controller.saving}
      onChange={(patch) => controller.setGlobalShiftForm((current) => ({ ...current, ...patch }))}
      onCancel={() => {
        controller.setGlobalDialogOpen(false);
        controller.resetGlobalShiftForm();
        controller.setMessage(null);
        void navigate({ to: '/plugins/waste-management', search: { ...search, schedulingView: 'list' } });
      }}
      onSubmit={(event) => controller.onSubmitGlobalShift(event, search.schedulingView === 'edit-global' ? 'edit' : 'create')}
    />
  );
};
