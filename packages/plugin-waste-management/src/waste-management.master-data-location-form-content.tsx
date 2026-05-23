import React, { useMemo } from 'react';
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';

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
  readonly onSubmit: (values: CollectionLocationFormState) => void | Promise<void>;
  readonly onReloadAssignments: () => Promise<void>;
};

const locationFormResolver: Resolver<CollectionLocationFormState> = async (values) => {
  const errors: FieldErrors<CollectionLocationFormState> =
    values.cityId.trim().length === 0
      ? {
          cityId: {
            type: 'required',
            message: 'masterData.collectionLocations.fields.cityId',
          },
        }
      : {};

  return {
    values: Object.keys(errors).length === 0 ? values : {},
    errors,
  };
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
  const { handleSubmit, register, reset, setValue, watch, formState } = useForm<CollectionLocationFormState>({
    defaultValues: form,
    resolver: locationFormResolver,
  });

  React.useEffect(() => {
    reset(form);
  }, [form, reset]);

  React.useEffect(() => {
    register('id');
    register('regionId');
    register('cityId');
    register('streetId');
    register('houseNumberId');
    register('active');
  }, [register]);

  const formValues = watch();
  const filteredCities = formValues.regionId ? cities.filter((city) => city.regionId === formValues.regionId) : cities;
  const filteredStreets = formValues.cityId ? streets.filter((street) => street.cityId === formValues.cityId) : [];
  const filteredHouseNumbers = formValues.streetId ? houseNumbers.filter((houseNumber) => houseNumber.streetId === formValues.streetId) : [];
  const currentLocationTourLinks = useMemo(
    () => locationTourLinks.filter((link) => link.locationId === formValues.id),
    [formValues.id, locationTourLinks]
  );
  const handleFormChange = (patch: Partial<CollectionLocationFormState>) => {
    for (const [key, value] of Object.entries(patch) as Array<[keyof CollectionLocationFormState, CollectionLocationFormState[keyof CollectionLocationFormState]]>) {
      setValue(key, value);
    }
    onChange(patch);
  };
  const submitForm = handleSubmit(async (values) => {
    await onSubmit(values);
  });

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

      <form id="waste-location-form" className="space-y-6" onSubmit={submitForm}>
        <LocationSelectSection
          form={formValues}
          regions={regions}
          filteredCities={filteredCities}
          filteredStreets={filteredStreets}
          filteredHouseNumbers={filteredHouseNumbers}
          cityError={formState.errors.cityId?.message ? pt(formState.errors.cityId.message) : undefined}
          onChange={handleFormChange}
        />
        <LocationStatusSection active={formValues.active} onChange={handleFormChange} />
        {mode === 'edit' ? (
          <LocationAssignmentsSection
            locationId={formValues.id}
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
