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
import { Button, Input, StudioField, StudioPageHeader } from '@sva/studio-ui-react';

import type { CollectionLocationFormState } from './waste-management.master-data.forms.js';
import { useResetOnFormContextChange } from './waste-management.master-data-entity-dialogs.shared.js';
import { LocationAssignmentsSection } from './waste-management.master-data-location-assignments.js';
import {
  LocationFormActions,
  LocationSelectSection,
  LocationStatusSection,
} from './waste-management.master-data-location-form.parts.js';
import { WastePendingSaveButton } from './waste-management.pending-save-button.js';

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
  readonly onSubmit: (
    values: CollectionLocationFormState,
    cityPostalCodeUpdate?: Readonly<{ cityId: string; postalCode: string }>
  ) => void | Promise<void>;
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

const getCityPostalCodeUpdate = (
  selectedCity: WasteCityRecord | undefined,
  cityPostalCode: string,
  storedPostalCode: string
): Readonly<{ cityId: string; postalCode: string }> | undefined => {
  const normalizedPostalCode = cityPostalCode.trim();
  return selectedCity && normalizedPostalCode !== storedPostalCode.trim()
    ? { cityId: selectedCity.id, postalCode: normalizedPostalCode }
    : undefined;
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
  const { handleSubmit, register, reset, setValue, watch, formState } =
    useForm<CollectionLocationFormState>({
      defaultValues: form,
      resolver: locationFormResolver,
    });

  useResetOnFormContextChange(reset, form, `${mode}:${form.id}`);

  React.useEffect(() => {
    register('id');
    register('regionId');
    register('cityId');
    register('streetId');
    register('houseNumberId');
    register('active');
  }, [register]);

  const formValues = watch();
  const selectedCity = cities.find((city) => city.id === formValues.cityId);
  const [cityPostalCode, setCityPostalCode] = React.useState(selectedCity?.postalCode ?? '');
  const selectedCityId = selectedCity?.id;
  const selectedCityStoredPostalCode = selectedCity?.postalCode ?? '';
  React.useEffect(() => {
    setCityPostalCode(selectedCityStoredPostalCode);
  }, [form.id, selectedCityId, selectedCityStoredPostalCode]);
  const filteredCities = formValues.regionId
    ? cities.filter((city) => city.regionId === formValues.regionId)
    : cities;
  const filteredStreets = formValues.cityId
    ? streets.filter((street) => street.cityId === formValues.cityId)
    : [];
  const filteredHouseNumbers = formValues.streetId
    ? houseNumbers.filter((houseNumber) => houseNumber.streetId === formValues.streetId)
    : [];
  const currentLocationTourLinks = useMemo(
    () => locationTourLinks.filter((link) => link.locationId === formValues.id),
    [formValues.id, locationTourLinks]
  );
  const handleFormChange = (patch: Partial<CollectionLocationFormState>) => {
    for (const [key, value] of Object.entries(patch) as Array<
      [
        keyof CollectionLocationFormState,
        CollectionLocationFormState[keyof CollectionLocationFormState],
      ]
    >) {
      setValue(key, value, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
    onChange(patch);
  };
  const submitForm = handleSubmit(async (values) => {
    const cityPostalCodeUpdate = getCityPostalCodeUpdate(
      selectedCity,
      cityPostalCode,
      selectedCityStoredPostalCode
    );
    if (cityPostalCodeUpdate) {
      await onSubmit(values, cityPostalCodeUpdate);
    } else {
      await onSubmit(values);
    }
  });

  const saveLabel = saving
    ? pt('masterData.collectionLocations.actions.saving')
    : mode === 'create'
      ? pt('masterData.collectionLocations.actions.create')
      : pt('masterData.collectionLocations.actions.save');
  const cancelLabel = pt('masterData.collectionLocations.actions.cancel');

  const topActions = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
        {cancelLabel}
      </Button>
      <WastePendingSaveButton
        type="submit"
        form="waste-location-form"
        saving={saving}
        label={saveLabel}
      />
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
          cityError={
            formState.errors.cityId?.message ? pt(formState.errors.cityId.message) : undefined
          }
          cityPostalCodeField={
            mode === 'edit' ? (
              <StudioField
                id="waste-location-city-postal-code"
                label={pt('masterData.cities.fields.postalCode')}
                description={pt('masterData.collectionLocations.fields.postalCodeHint')}
              >
                <Input
                  id="waste-location-city-postal-code"
                  aria-label={pt('masterData.cities.fields.postalCode')}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={16}
                  disabled={!selectedCity}
                  value={cityPostalCode}
                  onChange={(event) => setCityPostalCode(event.target.value)}
                />
              </StudioField>
            ) : undefined
          }
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
        <LocationFormActions
          cancelLabel={cancelLabel}
          saveLabel={saveLabel}
          saving={saving}
          onCancel={onCancel}
        />
      </form>
    </div>
  );
};
