import type { WasteCityRecord, WasteHouseNumberRecord, WasteRegionRecord, WasteStreetRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import type { CollectionLocationFormState } from './waste-management.master-data.forms.js';

export const LocationRegionCityFields = ({
  form,
  regions,
  filteredCities,
  cityError,
  onChange,
}: {
  readonly form: CollectionLocationFormState;
  readonly regions: readonly WasteRegionRecord[];
  readonly filteredCities: readonly WasteCityRecord[];
  readonly cityError?: string;
  readonly onChange: (patch: Partial<CollectionLocationFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <>
      <StudioField id="waste-location-region-id" label={pt('masterData.collectionLocations.fields.regionId')}>
        <Select
          id="waste-location-region-id"
          name="regionId"
          value={form.regionId}
          onChange={(event) => onChange({ regionId: event.target.value, cityId: '', streetId: '', houseNumberId: '' })}
        >
          <option value="">{pt('masterData.collectionLocations.fields.regionUnset')}</option>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </Select>
      </StudioField>
      <StudioField id="waste-location-city-id" label={pt('masterData.collectionLocations.fields.cityId')} error={cityError} required>
        <Select
          id="waste-location-city-id"
          name="cityId"
          value={form.cityId}
          onChange={(event) => onChange({ cityId: event.target.value, streetId: '', houseNumberId: '' })}
        >
          <option value="">{pt('masterData.collectionLocations.fields.cityUnset')}</option>
          {filteredCities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </Select>
      </StudioField>
    </>
  );
};

export const LocationStreetHouseNumberFields = ({
  form,
  filteredStreets,
  filteredHouseNumbers,
  onChange,
}: {
  readonly form: CollectionLocationFormState;
  readonly filteredStreets: readonly WasteStreetRecord[];
  readonly filteredHouseNumbers: readonly WasteHouseNumberRecord[];
  readonly onChange: (patch: Partial<CollectionLocationFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <>
      <StudioField id="waste-location-street-id" label={pt('masterData.collectionLocations.fields.streetId')}>
        <Select
          id="waste-location-street-id"
          name="streetId"
          value={form.streetId}
          onChange={(event) => onChange({ streetId: event.target.value, houseNumberId: '' })}
        >
          <option value="">{pt('masterData.collectionLocations.fields.streetUnset')}</option>
          {filteredStreets.map((street) => (
            <option key={street.id} value={street.id}>
              {street.name}
            </option>
          ))}
        </Select>
      </StudioField>
      <StudioField id="waste-location-house-number-id" label={pt('masterData.collectionLocations.fields.houseNumberId')}>
        <Select
          id="waste-location-house-number-id"
          name="houseNumberId"
          value={form.houseNumberId}
          onChange={(event) => onChange({ houseNumberId: event.target.value })}
        >
          <option value="">{pt('masterData.collectionLocations.fields.houseNumberUnset')}</option>
          {filteredHouseNumbers.map((houseNumber) => (
            <option key={houseNumber.id} value={houseNumber.id}>
              {houseNumber.number}
            </option>
          ))}
        </Select>
      </StudioField>
    </>
  );
};
