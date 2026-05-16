import type { FormEvent } from 'react';

import type {
  WasteCityRecord,
  WasteHouseNumberRecord,
  WasteRegionRecord,
  WasteStreetRecord,
} from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Button,
  Checkbox,
  Select,
  StudioField,
  StudioFieldGroup,
  StudioPageHeader,
} from '@sva/studio-ui-react';

import type { CollectionLocationFormState } from './waste-management.master-data.forms.js';

type WasteMasterDataLocationFormContentProps = {
  readonly mode: 'create' | 'edit';
  readonly form: CollectionLocationFormState;
  readonly regions: readonly WasteRegionRecord[];
  readonly cities: readonly WasteCityRecord[];
  readonly streets: readonly WasteStreetRecord[];
  readonly houseNumbers: readonly WasteHouseNumberRecord[];
  readonly saving: boolean;
  readonly onChange: (patch: Partial<CollectionLocationFormState>) => void;
  readonly onCancel: () => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export const WasteMasterDataLocationFormContent = ({
  mode,
  form,
  regions,
  cities,
  streets,
  houseNumbers,
  saving,
  onChange,
  onCancel,
  onSubmit,
}: WasteMasterDataLocationFormContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const filteredCities = form.regionId ? cities.filter((city) => city.regionId === form.regionId) : cities;
  const filteredStreets = form.cityId ? streets.filter((street) => street.cityId === form.cityId) : [];
  const filteredHouseNumbers = form.streetId ? houseNumbers.filter((houseNumber) => houseNumber.streetId === form.streetId) : [];

  const saveLabel = saving
    ? pt('masterData.collectionLocations.actions.saving')
    : mode === 'create'
      ? pt('masterData.collectionLocations.actions.create')
      : pt('masterData.collectionLocations.actions.save');

  const topActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
        {pt('masterData.collectionLocations.actions.cancel')}
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
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
          <StudioFieldGroup columns={2}>
            <StudioField id="waste-location-region-id" label={pt('masterData.collectionLocations.fields.regionId')}>
              <Select
                id="waste-location-region-id"
                name="regionId"
                value={form.regionId}
                onChange={(event) =>
                  onChange({
                    regionId: event.target.value,
                    cityId: '',
                    streetId: '',
                    houseNumberId: '',
                  })
                }
              >
                <option value="">{pt('masterData.collectionLocations.fields.regionUnset')}</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField id="waste-location-city-id" label={pt('masterData.collectionLocations.fields.cityId')}>
              <Select
                id="waste-location-city-id"
                name="cityId"
                value={form.cityId}
                onChange={(event) =>
                  onChange({
                    cityId: event.target.value,
                    streetId: '',
                    houseNumberId: '',
                  })
                }
              >
                <option value="">{pt('masterData.collectionLocations.fields.cityUnset')}</option>
                {filteredCities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField id="waste-location-street-id" label={pt('masterData.collectionLocations.fields.streetId')}>
              <Select
                id="waste-location-street-id"
                name="streetId"
                value={form.streetId}
                onChange={(event) =>
                  onChange({
                    streetId: event.target.value,
                    houseNumberId: '',
                  })
                }
              >
                <option value="">{pt('masterData.collectionLocations.fields.streetUnset')}</option>
                {filteredStreets.map((street) => (
                  <option key={street.id} value={street.id}>
                    {street.name}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField
              id="waste-location-house-number-id"
              label={pt('masterData.collectionLocations.fields.houseNumberId')}
            >
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
          </StudioFieldGroup>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
          <StudioField id="waste-location-active" label={pt('masterData.collectionLocations.fields.active')}>
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-4 py-3">
              <Checkbox
                id="waste-location-active"
                checked={form.active}
                onChange={(event) => onChange({ active: event.currentTarget.checked })}
              />
              <span className="text-sm text-muted-foreground">
                {form.active ? pt('common.active') : pt('common.inactive')}
              </span>
            </div>
          </StudioField>
        </section>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 shadow-shell">
          <Button type="submit" disabled={saving}>
            {saveLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {pt('masterData.collectionLocations.actions.cancel')}
          </Button>
        </div>
      </form>
    </div>
  );
};
