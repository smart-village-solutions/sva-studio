import type {
  WasteCityRecord,
  WasteHouseNumberRecord,
  WasteRegionRecord,
  WasteStreetRecord,
} from '@sva/plugin-sdk';
import type { ReactNode } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, StudioFieldGroup } from '@sva/studio-ui-react';

import { WasteManagementFormSwitch } from './waste-management.form-switch.js';
import type { CollectionLocationFormState } from './waste-management.master-data.forms.js';
import {
  LocationRegionCityFields,
  LocationStreetHouseNumberFields,
} from './waste-management.master-data-location-form.select-groups.js';
import { WastePendingSaveButton } from './waste-management.pending-save-button.js';

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
  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-background px-5 py-4 shadow-shell">
    <WastePendingSaveButton type="submit" saving={saving} label={saveLabel} />
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
  cityError,
  cityPostalCodeField,
  onChange,
}: {
  readonly form: CollectionLocationFormState;
  readonly regions: readonly WasteRegionRecord[];
  readonly filteredCities: readonly WasteCityRecord[];
  readonly filteredStreets: readonly WasteStreetRecord[];
  readonly filteredHouseNumbers: readonly WasteHouseNumberRecord[];
  readonly cityError?: string;
  readonly cityPostalCodeField?: ReactNode;
  readonly onChange: (patch: Partial<CollectionLocationFormState>) => void;
}) => (
  <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-shell">
    <StudioFieldGroup
      columns={cityPostalCodeField ? 1 : 2}
      className={cityPostalCodeField ? 'md:grid-cols-3' : undefined}
    >
      <LocationRegionCityFields
        form={form}
        regions={regions}
        filteredCities={filteredCities}
        cityError={cityError}
        onChange={onChange}
      />
      {cityPostalCodeField}
      <LocationStreetHouseNumberFields
        form={form}
        filteredStreets={filteredStreets}
        filteredHouseNumbers={filteredHouseNumbers}
        onChange={onChange}
      />
    </StudioFieldGroup>
  </section>
);

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
      <div className="flex items-center gap-3">
        <WasteManagementFormSwitch
          checked={active}
          ariaLabel={pt('masterData.collectionLocations.fields.active')}
          onChange={(nextActive) => onChange({ active: nextActive })}
        />
        <span className="text-sm text-muted-foreground">
          {active ? pt('common.active') : pt('common.inactive')}
        </span>
      </div>
    </section>
  );
};
