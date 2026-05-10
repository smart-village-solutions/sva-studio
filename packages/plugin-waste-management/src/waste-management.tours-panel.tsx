import { usePluginTranslation } from '@sva/plugin-sdk';
import { StudioErrorState, StudioLoadingState } from '@sva/studio-ui-react';

import { TourAssignmentsDialog, TourDialog, TourYearCalendarDialog } from './waste-management.tours.dialogs.js';
import { useWasteToursController } from './waste-management.tours.controller.js';
import { WasteToursContent, WasteToursEmptyState } from './waste-management.tours.content.js';
import { createDefaultLocationTourLinkForm, createDefaultTourForm } from './waste-management.tours.shared.js';
import type { WasteManagementSearchParams } from './search-params.js';

export const WasteToursPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const controller = useWasteToursController(pt, search);

  if (controller.loading) {
    return <StudioLoadingState>{pt('tours.messages.loading')}</StudioLoadingState>;
  }

  if (controller.error) {
    return <StudioErrorState>{controller.error}</StudioErrorState>;
  }

  const dialogs = (
    <>
      <TourDialog
        open={controller.dialogOpen}
        mode={controller.dialogMode}
        form={controller.tourForm}
        fractions={controller.availableFractions}
        saving={controller.saving}
        message={controller.dialogOpen ? controller.message : null}
        onOpenChange={(open) => {
          controller.setDialogOpen(open);
          if (!open) {
            controller.setTourForm(createDefaultTourForm());
          }
        }}
        onChange={(patch) => controller.setTourForm((current) => ({ ...current, ...patch }))}
        onSubmit={controller.onSubmitTour}
      />
      <TourAssignmentsDialog
        open={controller.assignmentsDialogOpen}
        mode={controller.assignmentsDialogMode}
        form={controller.linkForm}
        tour={controller.selectedTour}
        tours={controller.overview?.tours ?? []}
        locations={controller.locationOptions}
        saving={controller.saving}
        message={controller.assignmentsDialogOpen ? controller.message : null}
        onOpenChange={(open) => {
          controller.setAssignmentsDialogOpen(open);
          if (!open) {
            controller.setLinkForm(createDefaultLocationTourLinkForm());
          }
        }}
        onChange={(patch) => controller.setLinkForm((current) => ({ ...current, ...patch }))}
        onSubmit={controller.onSubmitAssignments}
      />
      <TourYearCalendarDialog
        open={controller.calendarOpen}
        tour={controller.selectedTour}
        scheduling={controller.schedulingOverview}
        onOpenChange={controller.setCalendarOpen}
      />
    </>
  );

  if (!controller.tours.length) {
    return (
      <>
        <WasteToursEmptyState onOpenCreateDialog={controller.openCreateDialog} />
        {dialogs}
      </>
    );
  }

  return (
    <>
      <WasteToursContent
        message={controller.message}
        tours={controller.tours}
        masterDataOverview={controller.masterDataOverview}
        onOpenCreateDialog={controller.openCreateDialog}
        onOpenEditDialog={controller.openEditDialog}
        onOpenCreateAssignmentsDialog={controller.openCreateAssignmentsDialog}
        onOpenEditAssignmentsDialog={controller.openEditAssignmentsDialog}
        onOpenCalendar={controller.openCalendar}
      />
      {dialogs}
    </>
  );
};
