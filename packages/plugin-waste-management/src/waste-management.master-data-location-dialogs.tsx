import type { WasteCityRecord, WasteHouseNumberRecord, WasteRegionRecord, WasteStreetRecord, WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Select, StudioField, StudioFieldGroup } from '@sva/studio-ui-react';
import React from 'react';
import { useForm, type Resolver } from 'react-hook-form';

import { WasteManagementFormSwitch } from './waste-management.form-switch.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import type { CollectionLocationFormState, LocationTourLinkBulkFormState } from './waste-management.master-data.forms.js';

type LocationDialogProps = {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: CollectionLocationFormState;
  readonly regions: readonly WasteRegionRecord[];
  readonly cities: readonly WasteCityRecord[];
  readonly streets: readonly WasteStreetRecord[];
  readonly houseNumbers: readonly WasteHouseNumberRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<CollectionLocationFormState>) => void;
  readonly onSubmit: (values: CollectionLocationFormState) => void | Promise<void>;
};

const collectionLocationDialogResolver: Resolver<CollectionLocationFormState> = async (values) => ({
  values: values.cityId.trim().length > 0 ? values : {},
  errors:
    values.cityId.trim().length > 0
      ? {}
      : {
          cityId: {
            type: 'required',
            message: 'masterData.collectionLocations.fields.cityId',
          },
        },
});

export const CollectionLocationDialog = ({ open, mode, form, regions, cities, streets, houseNumbers, saving, message, onOpenChange, onChange, onSubmit }: LocationDialogProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const { handleSubmit, register, reset, setValue, watch } = useForm<CollectionLocationFormState>({
    defaultValues: form,
    resolver: collectionLocationDialogResolver,
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
  const handleFormChange = (patch: Partial<CollectionLocationFormState>) => {
    for (const [key, value] of Object.entries(patch) as Array<[keyof CollectionLocationFormState, CollectionLocationFormState[keyof CollectionLocationFormState]]>) {
      setValue(key, value);
    }
    onChange(patch);
  };
  const submitForm = handleSubmit(async (values) => {
    await onSubmit(values);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('masterData.collectionLocations.dialog.createTitle') : pt('masterData.collectionLocations.dialog.editTitle')}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? pt('masterData.collectionLocations.dialog.createDescription')
              : pt('masterData.collectionLocations.dialog.editDescription')}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submitForm}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField id="waste-location-region-id" label={pt('masterData.collectionLocations.fields.regionId')}>
              <Select
                id="waste-location-region-id"
                name="regionId"
                value={formValues.regionId}
                onChange={(event) => handleFormChange({ regionId: event.target.value, cityId: '', streetId: '', houseNumberId: '' })}
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
                value={formValues.cityId}
                onChange={(event) => handleFormChange({ cityId: event.target.value, streetId: '', houseNumberId: '' })}
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
                value={formValues.streetId}
                onChange={(event) => handleFormChange({ streetId: event.target.value, houseNumberId: '' })}
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
                value={formValues.houseNumberId}
                onChange={(event) => handleFormChange({ houseNumberId: event.target.value })}
              >
                <option value="">{pt('masterData.collectionLocations.fields.houseNumberUnset')}</option>
                {filteredHouseNumbers.map((houseNumber) => (
                  <option key={houseNumber.id} value={houseNumber.id}>
                    {houseNumber.number}
                  </option>
                ))}
              </Select>
            </StudioField>
            <div className="flex items-center gap-3">
              <WasteManagementFormSwitch
                checked={formValues.active}
                ariaLabel={pt('masterData.collectionLocations.fields.active')}
                onChange={(active) => handleFormChange({ active })}
              />
              <span className="text-sm text-muted-foreground">{formValues.active ? pt('common.active') : pt('common.inactive')}</span>
            </div>
          </StudioFieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('masterData.collectionLocations.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? pt('masterData.collectionLocations.actions.saving')
                : mode === 'create'
                  ? pt('masterData.collectionLocations.actions.create')
                  : pt('masterData.collectionLocations.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

type BulkDialogProps = {
  readonly open: boolean;
  readonly form: LocationTourLinkBulkFormState;
  readonly selectedLocations: readonly { id: string; label: string }[];
  readonly tours: readonly WasteTourRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<LocationTourLinkBulkFormState>) => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export const BulkLocationAssignmentsDialog = ({ open, form, selectedLocations, tours, saving, message, onOpenChange, onChange, onSubmit }: BulkDialogProps) => {
  const pt = usePluginTranslation('wasteManagement');
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{pt('masterData.collectionLocations.bulk.dialog.title')}</DialogTitle><DialogDescription>{pt('masterData.collectionLocations.bulk.dialog.description', { value: selectedLocations.length })}</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={onSubmit}><StatusNotice message={message} /><StudioFieldGroup><StudioField id="waste-bulk-tour-link-tour-id" label={pt('masterData.collectionLocations.bulk.fields.tourId')}><Select id="waste-bulk-tour-link-tour-id" value={form.tourId} onChange={(event) => onChange({ tourId: event.target.value })}><option value="">{pt('masterData.collectionLocations.bulk.fields.tourUnset')}</option>{tours.map((tour) => <option key={tour.id} value={tour.id}>{tour.name}</option>)}</Select></StudioField><StudioField id="waste-bulk-tour-link-start-date" label={pt('masterData.collectionLocations.bulk.fields.startDate')}><Input id="waste-bulk-tour-link-start-date" type="date" value={form.startDate} onChange={(event) => onChange({ startDate: event.target.value })} /></StudioField><StudioField id="waste-bulk-tour-link-end-date" label={pt('masterData.collectionLocations.bulk.fields.endDate')}><Input id="waste-bulk-tour-link-end-date" type="date" value={form.endDate} onChange={(event) => onChange({ endDate: event.target.value })} /></StudioField></StudioFieldGroup><div className="space-y-2 rounded-md border border-border/60 p-3"><p className="text-sm font-medium">{pt('masterData.collectionLocations.bulk.selectedTitle')}</p><div className="flex flex-wrap gap-2">{selectedLocations.map((location) => <Badge key={location.id} variant="outline">{location.label}</Badge>)}</div></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{pt('masterData.collectionLocations.bulk.actions.cancel')}</Button><Button type="submit" disabled={saving || selectedLocations.length === 0}>{saving ? pt('masterData.collectionLocations.bulk.actions.saving') : pt('masterData.collectionLocations.bulk.actions.assign')}</Button></DialogFooter></form></DialogContent></Dialog>;
};
