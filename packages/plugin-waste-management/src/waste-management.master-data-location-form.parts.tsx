import type { WasteCityRecord, WasteHouseNumberRecord, WasteRegionRecord, WasteStreetRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Checkbox, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';

import type { CollectionLocationFormState } from './waste-management.master-data.forms.js';
import { LocationRegionCityFields, LocationStreetHouseNumberFields } from './waste-management.master-data-location-form.select-groups.js';

export const LocationFormActions = ({
  cancelLabel,
  saveLabel,
  saving,
  onCancel,
}: {
  readonly cancelLabel: string;
  readonly saveLabel: string;
  readonly saving: boolean;
  readonly onCancel: () => void;
}) => (
  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 shadow-shell">
    <Button type="submit" disabled={saving}>
      {saveLabel}
    </Button>
    <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
      {cancelLabel}
    </Button>
  </div>
);

export const LocationSelectSection = ({
  form,
  regions,
  filteredCities,
  filteredStreets,
  filteredHouseNumbers,
  onChange,
}: {
  readonly form: CollectionLocationFormState;
  readonly regions: readonly WasteRegionRecord[];
  readonly filteredCities: readonly WasteCityRecord[];
  readonly filteredStreets: readonly WasteStreetRecord[];
  readonly filteredHouseNumbers: readonly WasteHouseNumberRecord[];
  readonly onChange: (patch: Partial<CollectionLocationFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
      <StudioFieldGroup columns={2}>
        <LocationRegionCityFields form={form} regions={regions} filteredCities={filteredCities} onChange={onChange} />
        <LocationStreetHouseNumberFields
          form={form}
          filteredStreets={filteredStreets}
          filteredHouseNumbers={filteredHouseNumbers}
          onChange={onChange}
        />
      </StudioFieldGroup>
    </section>
  );
};

export const LocationStatusSection = ({
  active,
  onChange,
}: {
  readonly active: boolean;
  readonly onChange: (patch: Partial<CollectionLocationFormState>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
      <StudioField id="waste-location-active" label={pt('masterData.collectionLocations.fields.active')}>
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-4 py-3">
          <Checkbox id="waste-location-active" checked={active} onChange={(event) => onChange({ active: event.currentTarget.checked })} />
          <span className="text-sm text-muted-foreground">{active ? pt('common.active') : pt('common.inactive')}</span>
        </div>
      </StudioField>
    </section>
  );
};
