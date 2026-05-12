import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';

import { WasteSchedulingContent, WasteSchedulingEmptyState } from './waste-management.scheduling-content.js';
import { useWasteSchedulingController } from './waste-management.scheduling.controller.js';
import { GlobalDateShiftDialog, TourDateShiftDialog } from './waste-management.scheduling.dialogs.js';
import {
  createDefaultGlobalDateShiftForm,
  createDefaultTourDateShiftForm,
} from './waste-management.scheduling.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteSchedulingPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const controller = useWasteSchedulingController(pt, search);

  if (controller.loading) {
    return <StudioLoadingState>{pt('scheduling.messages.loading')}</StudioLoadingState>;
  }

  if (controller.error) {
    return <StudioErrorState>{controller.error}</StudioErrorState>;
  }

  const dialogs = (
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

  if (!controller.tourDateShifts.length && !controller.globalDateShifts.length) {
    return (
      <>
        <WasteSchedulingEmptyState
          onOpenCreateGlobalShiftDialog={controller.openCreateGlobalShiftDialog}
          onOpenCreateTourShiftDialog={controller.openCreateTourShiftDialog}
        />
        {dialogs}
      </>
    );
  }

  return (
    <>
      <WasteSchedulingContent
        message={controller.message}
        globalDateShifts={controller.globalDateShifts}
        tourDateShifts={controller.tourDateShifts}
        onOpenCreateGlobalShiftDialog={controller.openCreateGlobalShiftDialog}
        onOpenCreateTourShiftDialog={controller.openCreateTourShiftDialog}
        onEditGlobalShiftDialog={controller.openEditGlobalShiftDialog}
        onEditTourShiftDialog={controller.openEditTourShiftDialog}
      />
      {dialogs}
    </>
  );
};
