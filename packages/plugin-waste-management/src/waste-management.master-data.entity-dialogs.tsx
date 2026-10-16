import type { CityFormState, FractionFormState, HouseNumberFormState, RegionFormState, StreetFormState } from './waste-management.master-data.forms.js';
import type { useWasteMasterDataViewModel } from './use-waste-master-data-view-model.js';
import { CityDialog, FractionDialog, HouseNumberDialog, RegionDialog, StreetDialog } from './waste-management.master-data-entity-dialogs.js';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioDestructiveActionDialog } from '@sva/studio-ui-react';
import { useState } from 'react';

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
      regions={controller.overview?.regions ?? []}
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
      cities={controller.overview?.cities ?? []}
      regions={controller.overview?.regions ?? []}
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
    <WasteAddressMoveConfirmation controller={controller} />
  </>
);

const WasteAddressMoveConfirmation = ({ controller }: { readonly controller: Controller }) => {
  const pt = usePluginTranslation('wasteManagement');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pending = controller.pendingAddressMove;
  const counts = pending?.preview.counts;
  return (
    <StudioDestructiveActionDialog
      open={pending !== null}
      title={pt('masterData.locationsWorkspace.addresses.moveTitle')}
      description={pt('masterData.locationsWorkspace.addresses.moveDescription', {
        source: pending?.sourceLabel ?? '',
        target: pending?.targetLabel ?? '',
      })}
      confirmLabel={pt(counts && counts.emailReminderSubscriptions > 0
        ? 'masterData.locationsWorkspace.addresses.moveConfirmSubscriptions'
        : 'masterData.locationsWorkspace.addresses.moveConfirm')}
      pendingLabel={pt('masterData.locationsWorkspace.addresses.moveSaving')}
      cancelLabel={pt('masterData.locationsWorkspace.addresses.cancel')}
      pending={controller.saving}
      confirmDisabled={Boolean(errorMessage)}
      errorMessage={errorMessage}
      onCancel={() => {
        setErrorMessage(null);
        controller.setPendingAddressMove(null);
      }}
      onConfirm={async () => {
        if (!pending) return;
        controller.setSaving(true);
        setErrorMessage(null);
        try {
          await pending.onConfirm();
        } catch {
          setErrorMessage(pt('masterData.locationsWorkspace.addresses.moveError'));
        } finally {
          controller.setSaving(false);
        }
      }}
    >
      {counts ? <div className="space-y-2 text-sm">
        <p>{pt('masterData.locationsWorkspace.addresses.moveLocations', { count: counts.collectionLocations })}</p>
        <p>{pt('masterData.locationsWorkspace.addresses.moveSubscriptions', { count: counts.emailReminderSubscriptions, items: counts.emailReminderSubscriptionItems, outbox: counts.emailReminderOutbox })}</p>
        {counts.sentEmailReminderOutbox > 0 ? <p className="font-medium text-destructive">{pt('masterData.locationsWorkspace.addresses.impact.sent', { count: counts.sentEmailReminderOutbox })}</p> : null}
        <details><summary className="cursor-pointer font-medium">{pt('masterData.locationsWorkspace.addresses.details')}</summary><div className="mt-2 space-y-1">
          <p>{pt('masterData.locationsWorkspace.addresses.impact.links', { count: counts.locationTourLinks })}</p>
          <p>{pt('masterData.locationsWorkspace.addresses.impact.pickupDates', { count: counts.locationTourPickupDates })}</p>
        </div></details>
      </div> : null}
      {errorMessage ? <Button type="button" variant="secondary" disabled={controller.saving} onClick={async () => {
        if (!pending) return;
        try {
          await pending.refresh();
          setErrorMessage(null);
        } catch {
          setErrorMessage(pt('masterData.locationsWorkspace.addresses.moveError'));
        }
      }}>{pt('masterData.locationsWorkspace.addresses.moveReloadPreview')}</Button> : null}
    </StudioDestructiveActionDialog>
  );
};
