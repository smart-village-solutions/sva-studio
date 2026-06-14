import type { CityFormState, FractionFormState, HouseNumberFormState, RegionFormState, StreetFormState } from './waste-management.master-data.forms.js';
import type { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';
import { CityDialog, FractionDialog, HouseNumberDialog, RegionDialog, StreetDialog } from './waste-management.master-data-entity-dialogs.js';

type Controller = ReturnType<typeof useWasteMasterDataViewModel>;

export const WasteMasterDataEntityDialogs = ({ controller }: { readonly controller: Controller }) => (
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
      onBeforeSubmit={() => controller.setMessage(null)}
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
      onBeforeSubmit={() => controller.setMessage(null)}
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
      onBeforeSubmit={() => controller.setMessage(null)}
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
      onBeforeSubmit={() => controller.setMessage(null)}
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
      onBeforeSubmit={() => controller.setMessage(null)}
      onSubmit={controller.onSubmitHouseNumber}
    />
  </>
);
