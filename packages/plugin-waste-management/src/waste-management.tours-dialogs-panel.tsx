import { TourDialog, TourYearCalendarDialog } from './waste-management.tours.dialogs.js';
import { createDefaultTourForm } from './waste-management.tours.shared.js';
import type { useWasteToursViewModel } from './use-waste-tours-view-model.js';
import type { WasteManagementSearchParams } from './search-params.js';

type Controller = ReturnType<typeof useWasteToursViewModel>;

export const WasteToursDialogs = ({
  controller,
  search,
  canManageScheduling = false,
}: {
  readonly controller: Controller;
  readonly search: WasteManagementSearchParams;
  readonly canManageScheduling?: boolean;
}) => (
  <>
    <TourDialog
      open={controller.dialogOpen}
      mode={controller.dialogMode}
      form={controller.tourForm}
      fractions={controller.availableFractions}
      locations={controller.locationOptions}
      customRecurrencePresets={controller.customRecurrencePresets}
      saving={controller.saving}
      message={controller.dialogOpen ? controller.message : null}
      onOpenChange={(open) => {
        controller.setDialogOpen(open);
        if (!open) {
          controller.setTourForm(createDefaultTourForm());
          controller.setSelectedTour(null);
        }
      }}
      onChange={(patch) => controller.setTourForm((current) => ({ ...current, ...patch }))}
      onSubmit={controller.onSubmitTour}
    />
    <TourYearCalendarDialog
      open={controller.calendarOpen}
      tour={controller.selectedTour}
      scheduling={controller.schedulingOverview}
      schedulingLoadState={controller.schedulingLoadState}
      search={search}
      canManageScheduling={canManageScheduling}
      onOpenChange={controller.setCalendarOpen}
    />
  </>
);
