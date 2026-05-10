import type { CityFormState, CollectionLocationFormState, FractionFormState, HouseNumberFormState, LocationTourLinkBulkFormState, RegionFormState, StreetFormState } from './waste-management.master-data.forms.js';
import type { useWasteMasterDataController } from './waste-management.master-data.controller.js';
import { CityDialog, FractionDialog, HouseNumberDialog, RegionDialog, StreetDialog } from './waste-management.master-data-entity-dialogs.js';
import { BulkLocationAssignmentsDialog, CollectionLocationDialog } from './waste-management.master-data-location-dialogs.js';

type Controller = ReturnType<typeof useWasteMasterDataController>;

export const WasteMasterDataDialogs = ({ controller }: { readonly controller: Controller }) => (
  <>
    <FractionDialog
      open={controller.dialogOpen}
      mode={controller.dialogMode}
      form={controller.fractionForm}
      saving={controller.saving}
      message={controller.dialogOpen ? controller.message : null}
      onOpenChange={(open) => {
        controller.setDialogOpen(open);
        if (!open) controller.resetFractionForm();
      }}
      onChange={(patch) => controller.setFractionForm((current: FractionFormState) => ({ ...current, ...patch }))}
      onSubmit={controller.onSubmitFraction}
    />
    <RegionDialog
      open={controller.regionDialogOpen}
      mode={controller.regionDialogMode}
      form={controller.regionForm}
      saving={controller.saving}
      message={controller.regionDialogOpen ? controller.message : null}
      onOpenChange={(open) => {
        controller.setRegionDialogOpen(open);
        if (!open) controller.resetRegionForm();
      }}
      onChange={(patch) => controller.setRegionForm((current: RegionFormState) => ({ ...current, ...patch }))}
      onSubmit={controller.onSubmitRegion}
    />
    <CityDialog
      open={controller.cityDialogOpen}
      mode={controller.cityDialogMode}
      form={controller.cityForm}
      regions={controller.overview?.regions ?? []}
      saving={controller.saving}
      message={controller.cityDialogOpen ? controller.message : null}
      onOpenChange={(open) => {
        controller.setCityDialogOpen(open);
        if (!open) controller.resetCityForm();
      }}
      onChange={(patch) => controller.setCityForm((current: CityFormState) => ({ ...current, ...patch }))}
      onSubmit={controller.onSubmitCity}
    />
    <StreetDialog
      open={controller.streetDialogOpen}
      mode={controller.streetDialogMode}
      form={controller.streetForm}
      cities={controller.overview?.cities ?? []}
      saving={controller.saving}
      message={controller.streetDialogOpen ? controller.message : null}
      onOpenChange={(open) => {
        controller.setStreetDialogOpen(open);
        if (!open) controller.resetStreetForm();
      }}
      onChange={(patch) => controller.setStreetForm((current: StreetFormState) => ({ ...current, ...patch }))}
      onSubmit={controller.onSubmitStreet}
    />
    <HouseNumberDialog
      open={controller.houseNumberDialogOpen}
      mode={controller.houseNumberDialogMode}
      form={controller.houseNumberForm}
      streets={controller.overview?.streets ?? []}
      saving={controller.saving}
      message={controller.houseNumberDialogOpen ? controller.message : null}
      onOpenChange={(open) => {
        controller.setHouseNumberDialogOpen(open);
        if (!open) controller.resetHouseNumberForm();
      }}
      onChange={(patch) => controller.setHouseNumberForm((current: HouseNumberFormState) => ({ ...current, ...patch }))}
      onSubmit={controller.onSubmitHouseNumber}
    />
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
      onSubmit={controller.onSubmitLocation}
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
