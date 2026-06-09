import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteFractionReminderCount,
  WasteHouseNumberRecord,
  WasteLocalizedTextRecord,
  WasteRegionRecord,
  WasteStreetRecord,
} from '@sva/plugin-sdk';

import type {
  CreateWasteManagementCityInput,
  CreateWasteManagementCollectionLocationInput,
  CreateWasteManagementFractionInput,
  CreateWasteManagementHouseNumberInput,
  CreateWasteManagementLocationTourLinksBulkInput,
  CreateWasteManagementRegionInput,
  CreateWasteManagementStreetInput,
  UpdateWasteManagementCityInput,
  UpdateWasteManagementCollectionLocationInput,
  UpdateWasteManagementFractionInput,
  UpdateWasteManagementHouseNumberInput,
  UpdateWasteManagementRegionInput,
  UpdateWasteManagementStreetInput,
} from './waste-management.api.js';
import { compactOptionalString, createId, normalizeLocalizedTextRecord } from './waste-management.master-data.form-helpers.js';

export type FractionFormState = {
  readonly id: string;
  readonly name: string;
  readonly pdfShortLabel: string;
  readonly translations: WasteLocalizedTextRecord;
  readonly containerSize: string;
  readonly color: string;
  readonly description: string;
  readonly active: boolean;
  readonly reminderCount: WasteFractionReminderCount;
  readonly firstReminderMaxLeadDays?: number;
  readonly secondReminderMaxLeadDays?: number;
  readonly reminderChannelPushEnabled: boolean;
  readonly reminderChannelEmailEnabled: boolean;
  readonly reminderChannelCalendarEnabled: boolean;
};

export type RegionFormState = { readonly id: string; readonly name: string };
export type CityFormState = { readonly id: string; readonly name: string; readonly regionId: string };
export type StreetFormState = { readonly id: string; readonly name: string; readonly cityId: string };
export type HouseNumberFormState = { readonly id: string; readonly number: string; readonly streetId: string };

export type CollectionLocationFormState = {
  readonly id: string;
  readonly regionId: string;
  readonly cityId: string;
  readonly streetId: string;
  readonly houseNumberId: string;
  readonly active: boolean;
};

export type LocationTourLinkBulkFormState = { readonly tourId: string; readonly startDate: string; readonly endDate: string };
const defaultFractionReminderLeadDays = 1;

export const wasteMasterDataFormDefaults = {
  createFraction: (): FractionFormState => ({
    id: createId(),
    name: '',
    pdfShortLabel: '',
    translations: {},
    containerSize: '',
    color: '#4f6d7a',
    description: '',
    active: true,
    reminderCount: 'none',
    firstReminderMaxLeadDays: defaultFractionReminderLeadDays,
    secondReminderMaxLeadDays: defaultFractionReminderLeadDays,
    reminderChannelPushEnabled: false,
    reminderChannelEmailEnabled: false,
    reminderChannelCalendarEnabled: false,
  }),
  createRegion: (): RegionFormState => ({ id: createId(), name: '' }),
  createCity: (): CityFormState => ({ id: createId(), name: '', regionId: '' }),
  createStreet: (): StreetFormState => ({ id: createId(), name: '', cityId: '' }),
  createHouseNumber: (): HouseNumberFormState => ({ id: createId(), number: '', streetId: '' }),
  createCollectionLocation: (): CollectionLocationFormState => ({
    id: createId(),
    regionId: '',
    cityId: '',
    streetId: '',
    houseNumberId: '',
    active: true,
  }),
  createBulkAssignments: (): LocationTourLinkBulkFormState => ({ tourId: '', startDate: '', endDate: '' }),
};

export const wasteMasterDataFormMappers = {
  fractionToForm: (fraction: WasteFractionRecord): FractionFormState => ({
    id: fraction.id,
    name: fraction.name,
    pdfShortLabel: fraction.pdfShortLabel ?? '',
    translations: fraction.translations ?? {},
    containerSize: fraction.containerSize ?? '',
    color: fraction.color,
    description: fraction.description ?? '',
    active: fraction.active,
    reminderCount: fraction.reminderCount,
    firstReminderMaxLeadDays: fraction.firstReminderMaxLeadDays ?? defaultFractionReminderLeadDays,
    secondReminderMaxLeadDays: fraction.secondReminderMaxLeadDays ?? defaultFractionReminderLeadDays,
    reminderChannelPushEnabled: fraction.reminderChannelPushEnabled,
    reminderChannelEmailEnabled: fraction.reminderChannelEmailEnabled,
    reminderChannelCalendarEnabled: fraction.reminderChannelCalendarEnabled,
  }),
  regionToForm: (region: WasteRegionRecord): RegionFormState => ({ id: region.id, name: region.name }),
  cityToForm: (city: WasteCityRecord): CityFormState => ({ id: city.id, name: city.name, regionId: city.regionId ?? '' }),
  streetToForm: (street: WasteStreetRecord): StreetFormState => ({ id: street.id, name: street.name, cityId: street.cityId }),
  houseNumberToForm: (houseNumber: WasteHouseNumberRecord): HouseNumberFormState => ({
    id: houseNumber.id,
    number: houseNumber.number,
    streetId: houseNumber.streetId,
  }),
  collectionLocationToForm: (location: WasteCollectionLocationRecord): CollectionLocationFormState => ({
    id: location.id,
    regionId: location.regionId ?? '',
    cityId: location.cityId,
    streetId: location.streetId ?? '',
    houseNumberId: location.houseNumberId ?? '',
    active: location.active,
  }),
};

const toFractionReminderInput = (
  form: FractionFormState
): Pick<
  CreateWasteManagementFractionInput,
  | 'reminderCount'
  | 'firstReminderMaxLeadDays'
  | 'secondReminderMaxLeadDays'
  | 'reminderChannelPushEnabled'
  | 'reminderChannelEmailEnabled'
  | 'reminderChannelCalendarEnabled'
> => {
  const firstReminderMaxLeadDays = form.firstReminderMaxLeadDays ?? defaultFractionReminderLeadDays;
  const secondReminderMaxLeadDays = form.secondReminderMaxLeadDays ?? defaultFractionReminderLeadDays;

  if (form.reminderCount === 'none') {
    return {
      reminderCount: 'none',
      firstReminderMaxLeadDays: undefined,
      secondReminderMaxLeadDays: undefined,
      reminderChannelPushEnabled: false,
      reminderChannelEmailEnabled: false,
      reminderChannelCalendarEnabled: false,
    };
  }

  if (form.reminderCount === 'once') {
    return {
      reminderCount: 'once',
      firstReminderMaxLeadDays,
      secondReminderMaxLeadDays: undefined,
      reminderChannelPushEnabled: form.reminderChannelPushEnabled,
      reminderChannelEmailEnabled: form.reminderChannelEmailEnabled,
      reminderChannelCalendarEnabled: form.reminderChannelCalendarEnabled,
    };
  }

  return {
    reminderCount: 'twice',
    firstReminderMaxLeadDays,
    secondReminderMaxLeadDays,
    reminderChannelPushEnabled: form.reminderChannelPushEnabled,
    reminderChannelEmailEnabled: form.reminderChannelEmailEnabled,
    reminderChannelCalendarEnabled: form.reminderChannelCalendarEnabled,
  };
};

export const wasteMasterDataInputMappers = {
  toCreateFractionInput: (form: FractionFormState): CreateWasteManagementFractionInput => ({
    id: form.id,
    name: form.name.trim(),
    pdfShortLabel: form.pdfShortLabel.trim(),
    translations: normalizeLocalizedTextRecord(form.translations),
    containerSize: compactOptionalString(form.containerSize),
    color: form.color.trim(),
    description: compactOptionalString(form.description),
    active: form.active,
    ...toFractionReminderInput(form),
  }),
  toUpdateFractionInput: (form: FractionFormState): UpdateWasteManagementFractionInput => ({
    name: form.name.trim(),
    pdfShortLabel: form.pdfShortLabel.trim(),
    translations: normalizeLocalizedTextRecord(form.translations),
    containerSize: compactOptionalString(form.containerSize),
    color: form.color.trim(),
    description: compactOptionalString(form.description),
    active: form.active,
    ...toFractionReminderInput(form),
  }),
  toCreateRegionInput: (form: RegionFormState): CreateWasteManagementRegionInput => ({ id: form.id, name: form.name.trim() }),
  toUpdateRegionInput: (form: RegionFormState): UpdateWasteManagementRegionInput => ({ name: form.name.trim() }),
  toCreateCityInput: (form: CityFormState): CreateWasteManagementCityInput => ({
    id: form.id,
    name: form.name.trim(),
    regionId: compactOptionalString(form.regionId),
  }),
  toUpdateCityInput: (form: CityFormState): UpdateWasteManagementCityInput => ({
    name: form.name.trim(),
    regionId: compactOptionalString(form.regionId),
  }),
  toCreateStreetInput: (form: StreetFormState): CreateWasteManagementStreetInput => ({
    id: form.id.trim(),
    name: form.name.trim(),
    cityId: form.cityId.trim(),
  }),
  toUpdateStreetInput: (form: StreetFormState): UpdateWasteManagementStreetInput => ({
    name: form.name.trim(),
    cityId: form.cityId.trim(),
  }),
  toCreateHouseNumberInput: (form: HouseNumberFormState): CreateWasteManagementHouseNumberInput => ({
    id: form.id.trim(),
    number: form.number.trim(),
    streetId: form.streetId.trim(),
  }),
  toUpdateHouseNumberInput: (form: HouseNumberFormState): UpdateWasteManagementHouseNumberInput => ({
    number: form.number.trim(),
    streetId: form.streetId.trim(),
  }),
  toCreateCollectionLocationInput: (form: CollectionLocationFormState): CreateWasteManagementCollectionLocationInput => ({
    id: form.id,
    regionId: compactOptionalString(form.regionId),
    cityId: form.cityId,
    streetId: compactOptionalString(form.streetId),
    houseNumberId: compactOptionalString(form.houseNumberId),
    active: form.active,
  }),
  toUpdateCollectionLocationInput: (form: CollectionLocationFormState): UpdateWasteManagementCollectionLocationInput => ({
    regionId: compactOptionalString(form.regionId),
    cityId: form.cityId,
    streetId: compactOptionalString(form.streetId),
    houseNumberId: compactOptionalString(form.houseNumberId),
    active: form.active,
  }),
  toCreateLocationTourLinksBulkInput: (
    form: LocationTourLinkBulkFormState,
    locationIds: readonly string[]
  ): CreateWasteManagementLocationTourLinksBulkInput => ({
    locationIds,
    tourId: form.tourId,
    startDate: compactOptionalString(form.startDate),
    endDate: compactOptionalString(form.endDate),
  }),
  resolveSingleSelectValue: (form: HTMLFormElement, fieldName: string): string => {
    const field = form.elements.namedItem(fieldName);
    const values =
      field instanceof HTMLSelectElement ? Array.from(field.options).map((option) => option.value.trim()).filter(Boolean) : [];
    return values.length === 1 ? (values[0] ?? '') : '';
  },
};
