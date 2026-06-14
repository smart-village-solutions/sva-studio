import type { CollectionLocationFormState, LocationTourLinkBulkFormState } from './waste-management.master-data.forms.js';
import type { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';
import { BulkLocationAssignmentsDialog, CollectionLocationDialog } from './waste-management.master-data-location-dialogs.js';

type Controller = ReturnType<typeof useWasteMasterDataViewModel>;

export const WasteMasterDataLocationDialogs = ({ controller }: { readonly controller: Controller }) => (
  <>
    <CollectionLocationDialog
      open={controller.locationDialogOpen}
      mode={controller.locationDialogMode}
      form={controller.locationForm}
      regions={controller.overview?.regions ?? []}
      cities={controller.overview?.cities ?? []}
      streets={controller.overview?.streets ?? []}
      houseNumbers={controller.overview?.houseNumbers ?? []}
      saving={controller.saving}
      message={controller.locationDialogOpen ? controller.message : null}
      onOpenChange={(open) => {
        controller.setLocationDialogOpen(open);
        if (!open) controller.resetLocationForm();
      }}
      onChange={(patch) => controller.setLocationForm((current: CollectionLocationFormState) => ({ ...current, ...patch }))}
      onSubmit={(values) => controller.onSubmitLocation(values)}
    />
    <BulkLocationAssignmentsDialog
      open={controller.bulkAssignmentsDialogOpen}
      form={controller.bulkAssignmentsForm}
      selectedLocations={controller.selectedLocations}
      tours={controller.availableTours}
      saving={controller.saving}
      message={controller.bulkAssignmentsDialogOpen ? controller.message : null}
      onOpenChange={(open) => {
        controller.setBulkAssignmentsDialogOpen(open);
        if (!open) controller.resetBulkAssignmentsForm();
      }}
      onChange={(patch) => controller.setBulkAssignmentsForm((current: LocationTourLinkBulkFormState) => ({ ...current, ...patch }))}
      onSubmit={controller.onSubmitBulkAssignments}
    />
  </>
);
