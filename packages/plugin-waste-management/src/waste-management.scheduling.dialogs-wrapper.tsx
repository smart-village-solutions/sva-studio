import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';
import { GlobalDateShiftDialog, TourDateShiftDialog } from './waste-management.scheduling.dialogs.js';
import {
  createDefaultGlobalDateShiftForm,
  createDefaultTourDateShiftForm,
} from './waste-management.scheduling.shared.js';

type WasteSchedulingController = ReturnType<typeof useWasteSchedulingController>;

export const WasteSchedulingDialogs = ({ controller }: { readonly controller: WasteSchedulingController }) => (
  <>
    <TourDateShiftDialog
      open={controller.dialogOpen}
      mode={controller.dialogMode}
      form={controller.tourShiftForm}
      tours={controller.availableTours}
      saving={controller.saving}
      message={controller.dialogOpen ? controller.message : null}
      onOpenChange={(open) => {
        controller.setDialogOpen(open);
        if (!open) {
          controller.setTourShiftForm(createDefaultTourDateShiftForm());
        }
      }}
      onChange={(patch) => controller.setTourShiftForm((current) => ({ ...current, ...patch }))}
      onSubmit={controller.onSubmitTourShift}
    />
    <GlobalDateShiftDialog
      open={controller.globalDialogOpen}
      mode={controller.globalDialogMode}
      form={controller.globalShiftForm}
      tours={controller.availableTours}
      saving={controller.saving}
      message={controller.globalDialogOpen ? controller.message : null}
      onOpenChange={(open) => {
        controller.setGlobalDialogOpen(open);
        if (!open) {
          controller.setGlobalShiftForm(createDefaultGlobalDateShiftForm());
        }
      }}
      onChange={(patch) => controller.setGlobalShiftForm((current) => ({ ...current, ...patch }))}
      onSubmit={controller.onSubmitGlobalShift}
    />
  </>
);
