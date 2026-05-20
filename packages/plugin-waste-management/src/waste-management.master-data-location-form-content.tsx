import { type FormEvent, useMemo } from 'react';

import type {
  WasteCityRecord,
  WasteFractionRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  StudioPageHeader,
} from '@sva/studio-ui-react';

import type { CollectionLocationFormState } from './waste-management.master-data.forms.js';
import { LocationAssignmentsSection } from './waste-management.master-data-location-assignments.js';
import { LocationFormActions, LocationSelectSection, LocationStatusSection } from './waste-management.master-data-location-form.parts.js';

type WasteMasterDataLocationFormContentProps = {
  readonly mode: 'create' | 'edit';
  readonly form: CollectionLocationFormState;
  readonly regions: readonly WasteRegionRecord[];
  readonly cities: readonly WasteCityRecord[];
  readonly streets: readonly WasteStreetRecord[];
  readonly houseNumbers: readonly WasteHouseNumberRecord[];
  readonly fractions: readonly WasteFractionRecord[];
  readonly availableTours: readonly WasteTourRecord[];
  readonly locationTourLinks: readonly WasteLocationTourLinkRecord[];
  readonly saving: boolean;
  readonly onChange: (patch: Partial<CollectionLocationFormState>) => void;
  readonly onCancel: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  readonly onReloadAssignments: () => Promise<void>;
};


export const WasteMasterDataLocationFormContent = ({
  mode,
  form,
  regions,
  cities,
  streets,
  houseNumbers,
  fractions,
  availableTours,
  locationTourLinks,
  saving,
  onChange,
  onCancel,
  onSubmit,
  onReloadAssignments,
}: WasteMasterDataLocationFormContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const filteredCities = form.regionId ? cities.filter((city) => city.regionId === form.regionId) : cities;
  const filteredStreets = form.cityId ? streets.filter((street) => street.cityId === form.cityId) : [];
  const filteredHouseNumbers = form.streetId ? houseNumbers.filter((houseNumber) => houseNumber.streetId === form.streetId) : [];
  const currentLocationTourLinks = useMemo(
    () => locationTourLinks.filter((link) => link.locationId === form.id),
    [form.id, locationTourLinks]
  );

  const saveLabel = saving
    ? pt('masterData.collectionLocations.actions.saving')
    : mode === 'create'
      ? pt('masterData.collectionLocations.actions.create')
      : pt('masterData.collectionLocations.actions.save');
  const cancelLabel = pt('masterData.collectionLocations.actions.cancel');

  const topActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
        {cancelLabel}
      </Button>
      <Button type="submit" form="waste-location-form" disabled={saving}>
        {saveLabel}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <StudioPageHeader
        title={
          mode === 'create'
            ? pt('masterData.collectionLocations.dialog.createTitle')
            : pt('masterData.collectionLocations.dialog.editTitle')
        }
        description={
          mode === 'create'
            ? pt('masterData.collectionLocations.dialog.createDescription')
            : pt('masterData.collectionLocations.dialog.editDescription')
        }
        actions={topActions}
      />

      <form id="waste-location-form" className="space-y-6" onSubmit={(event) => void onSubmit(event)}>
        <LocationSelectSection
          form={form}
          regions={regions}
          filteredCities={filteredCities}
          filteredStreets={filteredStreets}
          filteredHouseNumbers={filteredHouseNumbers}
          onChange={onChange}
        />
        <LocationStatusSection active={form.active} onChange={onChange} />
        {mode === 'edit' ? (
          <LocationAssignmentsSection
            locationId={form.id}
            tours={availableTours}
            fractions={fractions}
            links={currentLocationTourLinks}
            disabled={saving}
            onReload={onReloadAssignments}
          />
        ) : null}
        <LocationFormActions cancelLabel={cancelLabel} saveLabel={saveLabel} saving={saving} onCancel={onCancel} />
      </form>
    </div>
  );
};
