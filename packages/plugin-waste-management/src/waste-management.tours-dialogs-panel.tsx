import { TourAssignmentsDialog, TourDialog, TourYearCalendarDialog } from './waste-management.tours.dialogs.js';
import { createDefaultLocationTourLinkForm, createDefaultTourForm } from './waste-management.tours.shared.js';
import type { useWasteToursViewModel } from './use-waste-tours-view-model.js';

type Controller = ReturnType<typeof useWasteToursViewModel>;

export const WasteToursDialogs = ({ controller }: { readonly controller: Controller }) => (
  <>
    <TourDialog
      open={controller.dialogOpen}
      mode={controller.dialogMode}
      form={controller.tourForm}
      fractions={controller.availableFractions}
      customRecurrencePresets={controller.customRecurrencePresets}
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
      locations={controller.assignmentLocationOptions}
      saving={controller.saving}
      loading={controller.assignmentContextLoading}
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
