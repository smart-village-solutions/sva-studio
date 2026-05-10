import { useNavigate, useSearch } from '@tanstack/react-router';
import type {
  StudioJobResponse,
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteCustomTourDate,
  WasteFractionRecord,
  WasteGlobalDateShiftRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteManagementSettingsRecord,
  WasteManagementImportProfileCatalogEntry,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
} from '@sva/core';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  StudioConfirmDialog,
  StudioErrorState,
  StudioField,
  StudioFieldGroup,
  StudioEmptyState,
  StudioJobSummaryCard,
  StudioLoadingState,
  StudioOverviewPageTemplate,
  StudioTechnicalStatusPanel,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@sva/studio-ui-react';
import { startTransition, useEffect, useState, type FormEvent, type ReactNode } from 'react';

import {
  normalizeWasteManagementSearchParams,
  wasteManagementTabIds,
  type WasteManagementSearchParams,
  type WasteManagementTabId,
} from './search-params.js';
import {
  createWasteManagementCity,
  createWasteManagementCollectionLocation,
  createWasteManagementLocationTourLinksBulk,
  createWasteManagementFraction,
  getWasteManagementHistoryOverview,
  createWasteManagementGlobalDateShift,
  createWasteManagementLocationTourLink,
  createWasteManagementRegion,
  createWasteManagementTour,
  createWasteManagementTourDateShift,
  getWasteManagementImportCatalog,
  getWasteManagementMasterDataOverview,
  getWasteManagementSchedulingOverview,
  getWasteManagementSettings,
  startWasteManagementImport,
  startWasteManagementMigrations,
  startWasteManagementReset,
  startWasteManagementSeed,
  getWasteManagementToursOverview,
  updateWasteManagementFraction,
  updateWasteManagementCity,
  updateWasteManagementCollectionLocation,
  updateWasteManagementGlobalDateShift,
  updateWasteManagementLocationTourLink,
  updateWasteManagementRegion,
  updateWasteManagementTour,
  updateWasteManagementTourDateShift,
  updateWasteManagementSettings,
  WasteManagementApiError,
  type CreateWasteManagementCityInput,
  type CreateWasteManagementCollectionLocationInput,
  type CreateWasteManagementLocationTourLinksBulkInput,
  type CreateWasteManagementFractionInput,
  type CreateWasteManagementGlobalDateShiftInput,
  type CreateWasteManagementLocationTourLinkInput,
  type CreateWasteManagementRegionInput,
  type CreateWasteManagementTourInput,
  type CreateWasteManagementTourDateShiftInput,
  type WasteManagementMasterDataOverview,
  type WasteManagementHistoryOverview,
  type WasteManagementSchedulingOverview,
  type WasteManagementSettingsInput,
  type WasteManagementToursOverview,
  type StartWasteManagementImportInput,
  type UpdateWasteManagementFractionInput,
  type UpdateWasteManagementCityInput,
  type UpdateWasteManagementCollectionLocationInput,
  type UpdateWasteManagementGlobalDateShiftInput,
  type UpdateWasteManagementLocationTourLinkInput,
  type UpdateWasteManagementRegionInput,
  type UpdateWasteManagementTourInput,
  type UpdateWasteManagementTourDateShiftInput,
} from './waste-management.api.js';

const tabTranslationKeyMap = {
  overview: 'overview',
  'master-data': 'masterData',
  tours: 'tours',
  scheduling: 'scheduling',
  tools: 'tools',
  settings: 'settings',
} as const satisfies Record<WasteManagementTabId, string>;

const updateSearch = (
  navigate: ReturnType<typeof useNavigate>,
  currentSearch: WasteManagementSearchParams,
  patch: Partial<WasteManagementSearchParams>
) => {
  const nextSearch = {
    ...currentSearch,
    ...patch,
    page: patch.page ?? (patch.q !== undefined || patch.tab !== undefined ? 1 : currentSearch.page),
  };

  void navigate({
    to: '/plugins/waste-management',
    search: nextSearch,
  });
};

type StatusMessage = {
  readonly kind: 'success' | 'error';
  readonly text: string;
};

type TechnicalStatusTone = 'neutral' | 'success' | 'warning' | 'error';

type FractionFormState = {
  readonly id: string;
  readonly name: string;
  readonly containerSize: string;
  readonly color: string;
  readonly description: string;
  readonly active: boolean;
};

type RegionFormState = {
  readonly id: string;
  readonly name: string;
};

type CityFormState = {
  readonly id: string;
  readonly name: string;
  readonly regionId: string;
};

type CollectionLocationFormState = {
  readonly id: string;
  readonly regionId: string;
  readonly cityId: string;
  readonly streetId: string;
  readonly houseNumberId: string;
  readonly active: boolean;
};

type LocationTourLinkFormState = {
  readonly id: string;
  readonly locationId: string;
  readonly tourId: string;
  readonly startDate: string;
  readonly endDate: string;
};

type LocationTourLinkBulkFormState = {
  readonly tourId: string;
  readonly startDate: string;
  readonly endDate: string;
};

type TourFormState = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly wasteFractionIds: readonly string[];
  readonly recurrence: NonNullable<WasteTourRecord['recurrence']> | '';
  readonly firstDate: string;
  readonly endDate: string;
  readonly customDatesText: string;
  readonly active: boolean;
};

type TourDateShiftFormState = {
  readonly id: string;
  readonly tourId: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly hasYear: boolean;
  readonly description: string;
};

type GlobalDateShiftFormState = {
  readonly id: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly hasYear: boolean;
  readonly description: string;
  readonly tourIds: readonly string[];
};

type SettingsFormState = {
  readonly provider: 'supabase';
  readonly projectUrl: string;
  readonly schemaName: string;
  readonly enabled: boolean;
  readonly databaseUrl: string;
  readonly serviceRoleKey: string;
};

const createDefaultSettingsForm = (): SettingsFormState => ({
  provider: 'supabase',
  projectUrl: '',
  schemaName: 'public',
  enabled: true,
  databaseUrl: '',
  serviceRoleKey: '',
});

const createFractionId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `fraction-${Math.random().toString(36).slice(2, 10)}`;

const createDefaultFractionForm = (): FractionFormState => ({
  id: createFractionId(),
  name: '',
  containerSize: '',
  color: '#4f6d7a',
  description: '',
  active: true,
});

const createDefaultRegionForm = (): RegionFormState => ({
  id: createFractionId(),
  name: '',
});

const createDefaultCityForm = (): CityFormState => ({
  id: createFractionId(),
  name: '',
  regionId: '',
});

const createDefaultCollectionLocationForm = (): CollectionLocationFormState => ({
  id: createFractionId(),
  regionId: '',
  cityId: '',
  streetId: '',
  houseNumberId: '',
  active: true,
});

const createDefaultLocationTourLinkForm = (): LocationTourLinkFormState => ({
  id: createFractionId(),
  locationId: '',
  tourId: '',
  startDate: '',
  endDate: '',
});

const createDefaultLocationTourLinkBulkForm = (): LocationTourLinkBulkFormState => ({
  tourId: '',
  startDate: '',
  endDate: '',
});

const createDefaultTourForm = (): TourFormState => ({
  id: createFractionId(),
  name: '',
  description: '',
  wasteFractionIds: [],
  recurrence: '',
  firstDate: '',
  endDate: '',
  customDatesText: '',
  active: true,
});

const createDefaultTourDateShiftForm = (): TourDateShiftFormState => ({
  id: createFractionId(),
  tourId: '',
  originalDate: '',
  actualDate: '',
  hasYear: true,
  description: '',
});

const createDefaultGlobalDateShiftForm = (): GlobalDateShiftFormState => ({
  id: createFractionId(),
  originalDate: '',
  actualDate: '',
  hasYear: true,
  description: '',
  tourIds: [],
});

const mapFractionToForm = (fraction: WasteFractionRecord): FractionFormState => ({
  id: fraction.id,
  name: fraction.name,
  containerSize: fraction.containerSize ?? '',
  color: fraction.color,
  description: fraction.description ?? '',
  active: fraction.active,
});

const mapRegionToForm = (region: WasteRegionRecord): RegionFormState => ({
  id: region.id,
  name: region.name,
});

const mapCityToForm = (city: WasteCityRecord): CityFormState => ({
  id: city.id,
  name: city.name,
  regionId: city.regionId ?? '',
});

const mapCollectionLocationToForm = (location: WasteCollectionLocationRecord): CollectionLocationFormState => ({
  id: location.id,
  regionId: location.regionId ?? '',
  cityId: location.cityId,
  streetId: location.streetId ?? '',
  houseNumberId: location.houseNumberId ?? '',
  active: location.active,
});

const mapLocationTourLinkToForm = (link: WasteLocationTourLinkRecord): LocationTourLinkFormState => ({
  id: link.id,
  locationId: link.locationId,
  tourId: link.tourId,
  startDate: link.startDate ?? '',
  endDate: link.endDate ?? '',
});

const mapTourToForm = (tour: WasteTourRecord): TourFormState => ({
  id: tour.id,
  name: tour.name,
  description: tour.description ?? '',
  wasteFractionIds: tour.wasteFractionIds,
  recurrence: tour.recurrence ?? '',
  firstDate: tour.firstDate ?? '',
  endDate: tour.endDate ?? '',
  customDatesText:
    tour.customDates
      ?.map((entry: WasteCustomTourDate) => (entry.description ? `${entry.date} | ${entry.description}` : entry.date))
      .join('\n') ?? '',
  active: tour.active,
});

const mapTourDateShiftToForm = (shift: WasteTourDateShiftRecord): TourDateShiftFormState => ({
  id: shift.id,
  tourId: shift.tourId,
  originalDate: shift.originalDate,
  actualDate: shift.actualDate,
  hasYear: shift.hasYear,
  description: shift.description ?? '',
});

const mapGlobalDateShiftToForm = (shift: WasteGlobalDateShiftRecord): GlobalDateShiftFormState => ({
  id: shift.id,
  originalDate: shift.originalDate,
  actualDate: shift.actualDate,
  hasYear: shift.hasYear,
  description: shift.description ?? '',
  tourIds: shift.tourIds ?? [],
});

const mapSettingsToForm = (settings: WasteManagementSettingsRecord | null): SettingsFormState =>
  settings
    ? {
        provider: settings.provider,
        projectUrl: settings.projectUrl,
        schemaName: settings.schemaName,
        enabled: settings.enabled,
        databaseUrl: '',
        serviceRoleKey: '',
      }
    : createDefaultSettingsForm();

const compactOptionalString = (value: string): string | undefined => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const toSettingsInput = (form: SettingsFormState): WasteManagementSettingsInput => ({
  provider: form.provider,
  projectUrl: form.projectUrl.trim(),
  schemaName: compactOptionalString(form.schemaName),
  enabled: form.enabled,
  databaseUrl: compactOptionalString(form.databaseUrl),
  serviceRoleKey: compactOptionalString(form.serviceRoleKey),
});

const toCreateFractionInput = (form: FractionFormState): CreateWasteManagementFractionInput => ({
  id: form.id,
  name: form.name.trim(),
  containerSize: compactOptionalString(form.containerSize),
  color: form.color.trim(),
  description: compactOptionalString(form.description),
  active: form.active,
});

const toUpdateFractionInput = (form: FractionFormState): UpdateWasteManagementFractionInput => ({
  name: form.name.trim(),
  containerSize: compactOptionalString(form.containerSize),
  color: form.color.trim(),
  description: compactOptionalString(form.description),
  active: form.active,
});

const toCreateRegionInput = (form: RegionFormState): CreateWasteManagementRegionInput => ({
  id: form.id,
  name: form.name.trim(),
});

const toUpdateRegionInput = (form: RegionFormState): UpdateWasteManagementRegionInput => ({
  name: form.name.trim(),
});

const toCreateCityInput = (form: CityFormState): CreateWasteManagementCityInput => ({
  id: form.id,
  name: form.name.trim(),
  regionId: compactOptionalString(form.regionId),
});

const toUpdateCityInput = (form: CityFormState): UpdateWasteManagementCityInput => ({
  name: form.name.trim(),
  regionId: compactOptionalString(form.regionId),
});

const toCreateCollectionLocationInput = (
  form: CollectionLocationFormState
): CreateWasteManagementCollectionLocationInput => ({
  id: form.id,
  regionId: compactOptionalString(form.regionId),
  cityId: form.cityId,
  streetId: compactOptionalString(form.streetId),
  houseNumberId: compactOptionalString(form.houseNumberId),
  active: form.active,
});

const toUpdateCollectionLocationInput = (
  form: CollectionLocationFormState
): UpdateWasteManagementCollectionLocationInput => ({
  regionId: compactOptionalString(form.regionId),
  cityId: form.cityId,
  streetId: compactOptionalString(form.streetId),
  houseNumberId: compactOptionalString(form.houseNumberId),
  active: form.active,
});

const toCreateLocationTourLinkInput = (form: LocationTourLinkFormState): CreateWasteManagementLocationTourLinkInput => ({
  id: form.id,
  locationId: form.locationId,
  tourId: form.tourId,
  startDate: compactOptionalString(form.startDate),
  endDate: compactOptionalString(form.endDate),
});

const toUpdateLocationTourLinkInput = (form: LocationTourLinkFormState): UpdateWasteManagementLocationTourLinkInput => ({
  locationId: form.locationId,
  tourId: form.tourId,
  startDate: compactOptionalString(form.startDate),
  endDate: compactOptionalString(form.endDate),
});

const toCreateLocationTourLinksBulkInput = (
  form: LocationTourLinkBulkFormState,
  locationIds: readonly string[]
): CreateWasteManagementLocationTourLinksBulkInput => ({
  locationIds,
  tourId: form.tourId,
  startDate: compactOptionalString(form.startDate),
  endDate: compactOptionalString(form.endDate),
});

const parseCustomTourDatesText = (value: string): CreateWasteManagementTourInput['customDates'] => {
  const entries = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [datePart, ...descriptionParts] = line.split('|');
      return {
        date: datePart?.trim() ?? '',
        description: compactOptionalString(descriptionParts.join('|')),
      };
    });

  return entries.length > 0 ? entries : undefined;
};

const toCreateTourInput = (form: TourFormState): CreateWasteManagementTourInput => ({
  id: form.id,
  name: form.name.trim(),
  description: compactOptionalString(form.description),
  wasteFractionIds: form.wasteFractionIds,
  recurrence: form.recurrence || undefined,
  firstDate: compactOptionalString(form.firstDate),
  endDate: compactOptionalString(form.endDate),
  customDates: parseCustomTourDatesText(form.customDatesText),
  active: form.active,
});

const toUpdateTourInput = (form: TourFormState): UpdateWasteManagementTourInput => ({
  name: form.name.trim(),
  description: compactOptionalString(form.description),
  wasteFractionIds: form.wasteFractionIds,
  recurrence: form.recurrence || undefined,
  firstDate: compactOptionalString(form.firstDate),
  endDate: compactOptionalString(form.endDate),
  customDates: parseCustomTourDatesText(form.customDatesText),
  active: form.active,
});

const toCreateTourDateShiftInput = (form: TourDateShiftFormState): CreateWasteManagementTourDateShiftInput => ({
  id: form.id,
  tourId: form.tourId,
  originalDate: form.originalDate,
  actualDate: form.actualDate,
  hasYear: form.hasYear,
  description: compactOptionalString(form.description),
});

const toUpdateTourDateShiftInput = (form: TourDateShiftFormState): UpdateWasteManagementTourDateShiftInput => ({
  tourId: form.tourId,
  originalDate: form.originalDate,
  actualDate: form.actualDate,
  hasYear: form.hasYear,
  description: compactOptionalString(form.description),
});

const toCreateGlobalDateShiftInput = (form: GlobalDateShiftFormState): CreateWasteManagementGlobalDateShiftInput => ({
  id: form.id,
  originalDate: form.originalDate,
  actualDate: form.actualDate,
  hasYear: form.hasYear,
  description: compactOptionalString(form.description),
  tourIds: form.tourIds.length ? form.tourIds : undefined,
});

const toUpdateGlobalDateShiftInput = (form: GlobalDateShiftFormState): UpdateWasteManagementGlobalDateShiftInput => ({
  originalDate: form.originalDate,
  actualDate: form.actualDate,
  hasYear: form.hasYear,
  description: compactOptionalString(form.description),
  tourIds: form.tourIds.length ? form.tourIds : undefined,
});

const resolveApiErrorCode = (error: unknown): string | null =>
  error instanceof WasteManagementApiError ? error.code : null;

const formatUpdatedAt = (value?: string) => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const toTechnicalStatusTone = (status: WasteManagementSettingsRecord['visibleStatus'] | undefined): TechnicalStatusTone => {
  switch (status) {
    case 'ok':
      return 'success';
    case 'error':
      return 'error';
    case 'unknown':
      return 'warning';
    case 'not_configured':
    default:
      return 'neutral';
  }
};

const toJobStatusTone = (status: StudioJobResponse['data']['status'] | undefined): TechnicalStatusTone => {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
    case 'cancelled':
      return 'error';
    case 'queued':
    case 'running':
    case 'retrying':
      return 'warning';
    default:
      return 'neutral';
  }
};

const createImportTemplateCsv = (profile: WasteManagementImportProfileCatalogEntry) => {
  const headers = [...profile.requiredColumns, ...profile.optionalColumns].map((column) => column.key);
  const sampleRow = [...profile.requiredColumns, ...profile.optionalColumns].map((column) => column.example ?? '');
  return `${headers.join(',')}\n${sampleRow.join(',')}\n`;
};

const downloadImportTemplate = (profile: WasteManagementImportProfileCatalogEntry) => {
  const csv = createImportTemplateCsv(profile);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${profile.profileId}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const StatusNotice = ({ message }: { readonly message: StatusMessage | null }) =>
  message ? (
    <Alert>
      <AlertTitle>{message.kind === 'success' ? 'OK' : 'Fehler'}</AlertTitle>
      <AlertDescription>{message.text}</AlertDescription>
    </Alert>
  ) : null;

const ResetConfirmationDialog = ({
  open,
  token,
  running,
  onOpenChange,
  onTokenChange,
  onConfirm,
}: {
  readonly open: boolean;
  readonly token: string;
  readonly running: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onTokenChange: (value: string) => void;
  readonly onConfirm: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <StudioConfirmDialog
      open={open}
      title={pt('tools.reset.confirmTitle')}
      description={pt('tools.reset.confirmDescription')}
      confirmLabel={running ? pt('tools.actions.starting') : pt('tools.reset.confirmAction')}
      cancelLabel={pt('tools.reset.confirmCancel')}
      confirmDisabled={running || token.trim().length === 0}
      onCancel={() => onOpenChange(false)}
      onConfirm={onConfirm}
    >
      <StudioFieldGroup>
        <StudioField id="waste-tools-reset-token-dialog" label={pt('tools.reset.tokenLabel')}>
          <Input
            id="waste-tools-reset-token-dialog"
            value={token}
            onChange={(event) => onTokenChange(event.target.value)}
            placeholder="RESET"
          />
        </StudioField>
      </StudioFieldGroup>
    </StudioConfirmDialog>
  );
};

const matchesSearch = (value: string, query: string) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase());

const matchesStatusFilter = (
  status: WasteManagementSearchParams['status'],
  active: boolean | undefined
): boolean => {
  if (status === 'all' || active === undefined) {
    return true;
  }
  return status === 'active' ? active : !active;
};

const filterFractions = (
  fractions: readonly WasteFractionRecord[],
  search: WasteManagementSearchParams
): readonly WasteFractionRecord[] =>
  fractions.filter((fraction) => {
    if (!matchesStatusFilter(search.status, fraction.active)) {
      return false;
    }

    if (!search.q) {
      return true;
    }

    return [fraction.name, fraction.description, fraction.containerSize]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => matchesSearch(value, search.q));
  });

const filterRegions = (
  regions: readonly WasteRegionRecord[],
  search: WasteManagementSearchParams
): readonly WasteRegionRecord[] =>
  regions.filter((region) => {
    if (search.regionId && region.id !== search.regionId) {
      return false;
    }

    if (search.regionId) {
      return true;
    }

    return search.q ? matchesSearch(region.name, search.q) : true;
  });

const filterCities = (
  cities: readonly WasteCityRecord[],
  search: WasteManagementSearchParams
): readonly WasteCityRecord[] =>
  cities.filter((city) => {
    if (search.cityId && city.id !== search.cityId) {
      return false;
    }
    if (search.regionId && city.regionId !== search.regionId) {
      return false;
    }

    if (search.cityId || search.regionId) {
      return true;
    }

    return search.q ? matchesSearch(city.name, search.q) : true;
  });

const filterCollectionLocations = (
  locations: readonly WasteCollectionLocationRecord[],
  search: WasteManagementSearchParams
): readonly WasteCollectionLocationRecord[] =>
  locations.filter((location) => {
    if (!matchesStatusFilter(search.status, location.active)) {
      return false;
    }
    if (search.regionId && location.regionId !== search.regionId) {
      return false;
    }
    if (search.cityId && location.cityId !== search.cityId) {
      return false;
    }
    return true;
  });

const findRegionName = (regions: readonly WasteRegionRecord[], regionId?: string): string | undefined =>
  regionId ? regions.find((region) => region.id === regionId)?.name : undefined;

const findCityName = (cities: readonly WasteCityRecord[], cityId: string): string =>
  cities.find((city) => city.id === cityId)?.name ?? cityId;

const findStreetName = (streets: readonly WasteStreetRecord[], streetId?: string): string | undefined =>
  streetId ? streets.find((street) => street.id === streetId)?.name : undefined;

const findHouseNumberValue = (
  houseNumbers: readonly WasteHouseNumberRecord[],
  houseNumberId?: string
): string | undefined => (houseNumberId ? houseNumbers.find((entry) => entry.id === houseNumberId)?.number : undefined);

const formatCollectionLocationLabel = (
  pt: ReturnType<typeof usePluginTranslation>,
  data: Pick<
    WasteManagementMasterDataOverview,
    'regions' | 'cities' | 'streets' | 'houseNumbers'
  >,
  location: WasteCollectionLocationRecord
): string => {
  const parts = [
    findRegionName(data.regions, location.regionId),
    findCityName(data.cities, location.cityId),
    findStreetName(data.streets, location.streetId) ?? pt('masterData.collectionLocations.meta.allStreets'),
    findHouseNumberValue(data.houseNumbers, location.houseNumberId) ??
      pt('masterData.collectionLocations.meta.allHouseNumbers'),
  ].filter((value): value is string => Boolean(value));

  return parts.join(' / ');
};

const calculateTourOccurrencesForYear = (
  tour: WasteTourRecord,
  year: number,
  scheduling: WasteManagementSchedulingOverview
): readonly string[] => {
  const results = new Set<string>();

  const addDate = (value?: string) => {
    if (value?.startsWith(`${year}-`)) {
      results.add(value);
    }
  };

  if (tour.recurrence && tour.firstDate) {
    const start = new Date(`${tour.firstDate}T00:00:00`);
    const end = new Date(`${tour.endDate ?? `${year}-12-31`}T00:00:00`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      const current = new Date(start);
      const advanceDays =
        tour.recurrence === 'weekly'
          ? 7
          : tour.recurrence === 'biweekly'
            ? 14
            : tour.recurrence === 'fourweekly'
              ? 28
              : null;

      if (advanceDays !== null) {
        while (current <= end) {
          const iso = current.toISOString().slice(0, 10);
          addDate(iso);
          current.setDate(current.getDate() + advanceDays);
        }
      } else if (tour.recurrence === 'yearly') {
        while (current <= end) {
          const iso = current.toISOString().slice(0, 10);
          addDate(iso);
          current.setFullYear(current.getFullYear() + 1);
        }
      }
    }
  }

  for (const customDate of tour.customDates ?? []) {
    addDate(customDate.date);
  }

  const tourShiftMap = new Map(
    (scheduling.tourDateShifts ?? [])
      .filter((shift) => shift.tourId === tour.id)
      .map((shift) => [shift.originalDate, shift.actualDate] as const)
  );
  const globalShiftMap = new Map(
    (scheduling.globalDateShifts ?? [])
      .filter((shift) => !shift.tourIds || shift.tourIds.includes(tour.id))
      .map((shift) => [shift.originalDate, shift.actualDate] as const)
  );

  const shiftedResults = new Set<string>();
  for (const date of results) {
    shiftedResults.add(tourShiftMap.get(date) ?? globalShiftMap.get(date) ?? date);
  }

  return Array.from(shiftedResults)
    .filter((value) => value.startsWith(`${year}-`))
    .sort((left, right) => left.localeCompare(right));
};

const FractionDialog = ({
  open,
  mode,
  form,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: FractionFormState;
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<FractionFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? pt('masterData.fractions.dialog.createTitle') : pt('masterData.fractions.dialog.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? pt('masterData.fractions.dialog.createDescription')
              : pt('masterData.fractions.dialog.editDescription')}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField id="waste-fraction-name" label={pt('masterData.fractions.fields.name')}>
              <Input id="waste-fraction-name" value={form.name} onChange={(event) => onChange({ name: event.target.value })} />
            </StudioField>
            <StudioField id="waste-fraction-color" label={pt('masterData.fractions.fields.color')}>
              <Input id="waste-fraction-color" value={form.color} onChange={(event) => onChange({ color: event.target.value })} />
            </StudioField>
            <StudioField id="waste-fraction-container-size" label={pt('masterData.fractions.fields.containerSize')}>
              <Input
                id="waste-fraction-container-size"
                value={form.containerSize}
                onChange={(event) => onChange({ containerSize: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-fraction-description" label={pt('masterData.fractions.fields.description')}>
              <Input
                id="waste-fraction-description"
                value={form.description}
                onChange={(event) => onChange({ description: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-fraction-active" label={pt('masterData.fractions.fields.active')}>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="waste-fraction-active"
                  checked={form.active}
                  onChange={(event) => onChange({ active: event.currentTarget.checked })}
                />
                <span className="text-sm text-muted-foreground">
                  {form.active ? pt('common.active') : pt('common.inactive')}
                </span>
              </div>
            </StudioField>
          </StudioFieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('masterData.fractions.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? pt('masterData.fractions.actions.saving')
                : mode === 'create'
                  ? pt('masterData.fractions.actions.create')
                  : pt('masterData.fractions.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const RegionDialog = ({
  open,
  mode,
  form,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: RegionFormState;
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<RegionFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? pt('masterData.regions.dialog.createTitle') : pt('masterData.regions.dialog.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? pt('masterData.regions.dialog.createDescription')
              : pt('masterData.regions.dialog.editDescription')}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField id="waste-region-name" label={pt('masterData.regions.fields.name')}>
              <Input id="waste-region-name" value={form.name} onChange={(event) => onChange({ name: event.target.value })} />
            </StudioField>
          </StudioFieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('masterData.regions.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? pt('masterData.regions.actions.saving')
                : mode === 'create'
                  ? pt('masterData.regions.actions.create')
                  : pt('masterData.regions.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const CityDialog = ({
  open,
  mode,
  form,
  regions,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: CityFormState;
  readonly regions: readonly WasteRegionRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<CityFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? pt('masterData.cities.dialog.createTitle') : pt('masterData.cities.dialog.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? pt('masterData.cities.dialog.createDescription')
              : pt('masterData.cities.dialog.editDescription')}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField id="waste-city-name" label={pt('masterData.cities.fields.name')}>
              <Input
                id="waste-city-name"
                name="name"
                value={form.name}
                onChange={(event) => onChange({ name: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-city-region-id" label={pt('masterData.cities.fields.regionId')}>
              <Select
                id="waste-city-region-id"
                aria-label={pt('masterData.cities.fields.regionId')}
                name="regionId"
                value={form.regionId}
                onChange={(event) => onChange({ regionId: event.target.value })}
              >
                <option value="">{pt('masterData.cities.fields.regionUnset')}</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>
                    {region.name}
                  </option>
                ))}
              </Select>
            </StudioField>
          </StudioFieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('masterData.cities.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? pt('masterData.cities.actions.saving')
                : mode === 'create'
                  ? pt('masterData.cities.actions.create')
                  : pt('masterData.cities.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const TourDialog = ({
  open,
  mode,
  form,
  fractions,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: TourFormState;
  readonly fractions: readonly WasteFractionRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<TourFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? pt('tours.dialog.createTitle') : pt('tours.dialog.editTitle')}</DialogTitle>
          <DialogDescription>
            {mode === 'create' ? pt('tours.dialog.createDescription') : pt('tours.dialog.editDescription')}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField id="waste-tour-name" label={pt('tours.fields.name')}>
              <Input id="waste-tour-name" value={form.name} onChange={(event) => onChange({ name: event.target.value })} />
            </StudioField>
            <StudioField id="waste-tour-description" label={pt('tours.fields.description')}>
              <Textarea
                id="waste-tour-description"
                value={form.description}
                onChange={(event) => onChange({ description: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-tour-recurrence" label={pt('tours.fields.recurrence')}>
              <Select
                id="waste-tour-recurrence"
                value={form.recurrence}
                onChange={(event) => onChange({ recurrence: event.target.value as TourFormState['recurrence'] })}
              >
                <option value="">{pt('tours.fields.recurrenceUnset')}</option>
                <option value="weekly">{pt('tours.recurrence.weekly')}</option>
                <option value="biweekly">{pt('tours.recurrence.biweekly')}</option>
                <option value="fourweekly">{pt('tours.recurrence.fourweekly')}</option>
                <option value="yearly">{pt('tours.recurrence.yearly')}</option>
                <option value="on-demand">{pt('tours.recurrence.onDemand')}</option>
                <option value="custom">{pt('tours.recurrence.custom')}</option>
              </Select>
            </StudioField>
            <StudioField id="waste-tour-first-date" label={pt('tours.fields.firstDate')}>
              <Input
                id="waste-tour-first-date"
                type="date"
                value={form.firstDate}
                onChange={(event) => onChange({ firstDate: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-tour-end-date" label={pt('tours.fields.endDate')}>
              <Input
                id="waste-tour-end-date"
                type="date"
                value={form.endDate}
                onChange={(event) => onChange({ endDate: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-tour-custom-dates" label={pt('tours.fields.customDates')}>
              <Textarea
                id="waste-tour-custom-dates"
                value={form.customDatesText}
                onChange={(event) => onChange({ customDatesText: event.target.value })}
                placeholder={pt('tours.fields.customDatesPlaceholder')}
              />
            </StudioField>
            <StudioField id="waste-tour-fractions" label={pt('tours.fields.wasteFractions')}>
              <div className="space-y-2 rounded-md border border-border/70 p-3">
                {fractions.length ? (
                  fractions.map((fraction) => {
                    const checked = form.wasteFractionIds.includes(fraction.id);
                    return (
                      <label key={fraction.id} className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={checked}
                          onChange={(event) =>
                            onChange({
                              wasteFractionIds: event.currentTarget.checked
                                ? [...form.wasteFractionIds, fraction.id]
                                : form.wasteFractionIds.filter((value) => value !== fraction.id),
                            })
                          }
                        />
                        <span>{fraction.name}</span>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">{pt('tours.fields.noFractionsAvailable')}</p>
                )}
              </div>
            </StudioField>
            <StudioField id="waste-tour-active" label={pt('tours.fields.active')}>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="waste-tour-active"
                  checked={form.active}
                  onChange={(event) => onChange({ active: event.currentTarget.checked })}
                />
                <span className="text-sm text-muted-foreground">
                  {form.active ? pt('common.active') : pt('common.inactive')}
                </span>
              </div>
            </StudioField>
          </StudioFieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('tours.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? pt('tours.actions.saving') : mode === 'create' ? pt('tours.actions.create') : pt('tours.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const CollectionLocationDialog = ({
  open,
  mode,
  form,
  regions,
  cities,
  streets,
  houseNumbers,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
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
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const filteredCities = form.regionId ? cities.filter((city) => city.regionId === form.regionId) : cities;
  const filteredStreets = form.cityId ? streets.filter((street) => street.cityId === form.cityId) : [];
  const filteredHouseNumbers = form.streetId
    ? houseNumbers.filter((houseNumber) => houseNumber.streetId === form.streetId)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? pt('masterData.collectionLocations.dialog.createTitle')
              : pt('masterData.collectionLocations.dialog.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? pt('masterData.collectionLocations.dialog.createDescription')
              : pt('masterData.collectionLocations.dialog.editDescription')}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
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
            <StudioField id="waste-location-city-id" label={pt('masterData.collectionLocations.fields.cityId')}>
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
            <StudioField id="waste-location-active" label={pt('masterData.collectionLocations.fields.active')}>
              <div className="flex items-center gap-3">
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

const TourAssignmentsDialog = ({
  open,
  mode,
  form,
  tour,
  locations,
  tours,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: LocationTourLinkFormState;
  readonly tour: WasteTourRecord | null;
  readonly locations: readonly { id: string; label: string }[];
  readonly tours: readonly WasteTourRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<LocationTourLinkFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? pt('tours.assignments.dialog.createTitle') : pt('tours.assignments.dialog.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {tour
              ? pt('tours.assignments.dialog.description', { value: tour.name })
              : pt('tours.assignments.dialog.descriptionFallback')}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField id="waste-tour-link-tour-id" label={pt('tours.assignments.fields.tourId')}>
              <Select
                id="waste-tour-link-tour-id"
                value={form.tourId}
                onChange={(event) => onChange({ tourId: event.target.value })}
              >
                <option value="">{pt('tours.assignments.fields.tourUnset')}</option>
                {tours.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField id="waste-tour-link-location-id" label={pt('tours.assignments.fields.locationId')}>
              <Select
                id="waste-tour-link-location-id"
                value={form.locationId}
                onChange={(event) => onChange({ locationId: event.target.value })}
              >
                <option value="">{pt('tours.assignments.fields.locationUnset')}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.label}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField id="waste-tour-link-start-date" label={pt('tours.assignments.fields.startDate')}>
              <Input
                id="waste-tour-link-start-date"
                type="date"
                value={form.startDate}
                onChange={(event) => onChange({ startDate: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-tour-link-end-date" label={pt('tours.assignments.fields.endDate')}>
              <Input
                id="waste-tour-link-end-date"
                type="date"
                value={form.endDate}
                onChange={(event) => onChange({ endDate: event.target.value })}
              />
            </StudioField>
          </StudioFieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('tours.assignments.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? pt('tours.assignments.actions.saving')
                : mode === 'create'
                  ? pt('tours.assignments.actions.create')
                  : pt('tours.assignments.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const BulkLocationAssignmentsDialog = ({
  open,
  form,
  selectedLocations,
  tours,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly form: LocationTourLinkBulkFormState;
  readonly selectedLocations: readonly { id: string; label: string }[];
  readonly tours: readonly WasteTourRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<LocationTourLinkBulkFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{pt('masterData.collectionLocations.bulk.dialog.title')}</DialogTitle>
          <DialogDescription>
            {pt('masterData.collectionLocations.bulk.dialog.description', { value: selectedLocations.length })}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField id="waste-bulk-tour-link-tour-id" label={pt('masterData.collectionLocations.bulk.fields.tourId')}>
              <Select
                id="waste-bulk-tour-link-tour-id"
                value={form.tourId}
                onChange={(event) => onChange({ tourId: event.target.value })}
              >
                <option value="">{pt('masterData.collectionLocations.bulk.fields.tourUnset')}</option>
                {tours.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.name}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField
              id="waste-bulk-tour-link-start-date"
              label={pt('masterData.collectionLocations.bulk.fields.startDate')}
            >
              <Input
                id="waste-bulk-tour-link-start-date"
                type="date"
                value={form.startDate}
                onChange={(event) => onChange({ startDate: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-bulk-tour-link-end-date" label={pt('masterData.collectionLocations.bulk.fields.endDate')}>
              <Input
                id="waste-bulk-tour-link-end-date"
                type="date"
                value={form.endDate}
                onChange={(event) => onChange({ endDate: event.target.value })}
              />
            </StudioField>
          </StudioFieldGroup>
          <div className="space-y-2 rounded-md border border-border/60 p-3">
            <p className="text-sm font-medium">{pt('masterData.collectionLocations.bulk.selectedTitle')}</p>
            <div className="flex flex-wrap gap-2">
              {selectedLocations.map((location) => (
                <Badge key={location.id} variant="outline">
                  {location.label}
                </Badge>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('masterData.collectionLocations.bulk.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving || selectedLocations.length === 0}>
              {saving
                ? pt('masterData.collectionLocations.bulk.actions.saving')
                : pt('masterData.collectionLocations.bulk.actions.assign')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const TourYearCalendarDialog = ({
  open,
  tour,
  scheduling,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly tour: WasteTourRecord | null;
  readonly scheduling: WasteManagementSchedulingOverview | null;
  readonly onOpenChange: (open: boolean) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  useEffect(() => {
    if (open) {
      setYear(currentYear);
    }
  }, [open, currentYear]);

  const dates = tour && scheduling ? calculateTourOccurrencesForYear(tour, year, scheduling) : [];
  const months = Array.from({ length: 12 }, (_, monthIndex) => {
    const first = new Date(year, monthIndex, 1);
    const startWeekday = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const highlighted = new Set(
      dates
        .filter((value) => Number(value.slice(5, 7)) === monthIndex + 1)
        .map((value) => Number(value.slice(8, 10)))
    );
    return { monthIndex, startWeekday, daysInMonth, highlighted };
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{pt('tours.yearCalendar.title')}</DialogTitle>
          <DialogDescription>
            {tour
              ? pt('tours.yearCalendar.description', { value: tour.name })
              : pt('tours.yearCalendar.descriptionFallback')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={() => setYear((current) => current - 1)}>
            {pt('tours.yearCalendar.actions.previousYear')}
          </Button>
          <Badge>{pt('tours.yearCalendar.meta.year', { value: year })}</Badge>
          <Button type="button" variant="outline" onClick={() => setYear((current) => current + 1)}>
            {pt('tours.yearCalendar.actions.nextYear')}
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {months.map((month) => (
            <section key={month.monthIndex} className="space-y-2 rounded-lg border border-border/70 p-3">
              <h3 className="text-sm font-semibold">
                {new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date(year, month.monthIndex, 1))}
              </h3>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
                  <div key={`${month.monthIndex}-${day}`}>{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {Array.from({ length: month.startWeekday }).map((_, index) => (
                  <div key={`empty-${month.monthIndex}-${index}`} />
                ))}
                {Array.from({ length: month.daysInMonth }, (_, index) => index + 1).map((day) => {
                  const active = month.highlighted.has(day);
                  return (
                    <div
                      key={`${month.monthIndex}-${day}`}
                      className={`rounded px-1 py-2 ${active ? 'bg-primary text-primary-foreground' : 'border border-border/50'}`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{pt('tours.yearCalendar.meta.dateListTitle')}</p>
          <div className="flex flex-wrap gap-2">
            {dates.length ? (
              dates.map((date) => (
                <Badge key={date} variant="outline">
                  {date}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{pt('tours.yearCalendar.meta.noDates')}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const WasteMasterDataPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementMasterDataOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [fractionForm, setFractionForm] = useState<FractionFormState>(createDefaultFractionForm());
  const [regionDialogOpen, setRegionDialogOpen] = useState(false);
  const [regionDialogMode, setRegionDialogMode] = useState<'create' | 'edit'>('create');
  const [regionForm, setRegionForm] = useState<RegionFormState>(createDefaultRegionForm());
  const [cityDialogOpen, setCityDialogOpen] = useState(false);
  const [cityDialogMode, setCityDialogMode] = useState<'create' | 'edit'>('create');
  const [cityForm, setCityForm] = useState<CityFormState>(createDefaultCityForm());
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [locationDialogMode, setLocationDialogMode] = useState<'create' | 'edit'>('create');
  const [locationForm, setLocationForm] = useState<CollectionLocationFormState>(createDefaultCollectionLocationForm());
  const [bulkAssignmentsDialogOpen, setBulkAssignmentsDialogOpen] = useState(false);
  const [bulkAssignmentsForm, setBulkAssignmentsForm] = useState<LocationTourLinkBulkFormState>(
    createDefaultLocationTourLinkBulkForm()
  );
  const [selectedLocationIds, setSelectedLocationIds] = useState<readonly string[]>([]);
  const [availableTours, setAvailableTours] = useState<readonly WasteTourRecord[]>([]);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [saving, setSaving] = useState(false);

  const loadOverview = async (active = true) => {
    try {
      const response = await getWasteManagementMasterDataOverview();
      if (!active) {
        return;
      }
      setOverview(response);
      setError(null);
    } catch (loadError) {
      if (!active) {
        return;
      }
      const code = resolveApiErrorCode(loadError);
      setError(code === 'forbidden' ? pt('masterData.messages.loadForbidden') : pt('masterData.messages.loadError'));
    } finally {
      if (active) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let active = true;

    void (async () => {
      await loadOverview(active);
    })();

    return () => {
      active = false;
    };
  }, [pt]);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await getWasteManagementToursOverview();
        if (active) {
          setAvailableTours(response.tours);
        }
      } catch {
        if (active) {
          setAvailableTours([]);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <StudioLoadingState>{pt('masterData.messages.loading')}</StudioLoadingState>;
  }

  if (error) {
    return <StudioErrorState>{error}</StudioErrorState>;
  }

  const filteredFractions = filterFractions(overview?.fractions ?? [], search);
  const filteredRegions = filterRegions(overview?.regions ?? [], search);
  const filteredCities = filterCities(overview?.cities ?? [], search);
  const filteredCollectionLocations = filterCollectionLocations(overview?.collectionLocations ?? [], search);
  const selectedCollectionLocations = filteredCollectionLocations.filter((location) =>
    selectedLocationIds.includes(location.id)
  );
  const allFilteredLocationsSelected =
    filteredCollectionLocations.length > 0 &&
    filteredCollectionLocations.every((location) => selectedLocationIds.includes(location.id));

  const openCreateDialog = () => {
    setDialogMode('create');
    setFractionForm(createDefaultFractionForm());
    setMessage(null);
    setDialogOpen(true);
  };

  const openEditDialog = (fraction: WasteFractionRecord) => {
    setDialogMode('edit');
    setFractionForm(mapFractionToForm(fraction));
    setMessage(null);
    setDialogOpen(true);
  };

  const openCreateRegionDialog = () => {
    setRegionDialogMode('create');
    setRegionForm(createDefaultRegionForm());
    setMessage(null);
    setRegionDialogOpen(true);
  };

  const openEditRegionDialog = (region: WasteRegionRecord) => {
    setRegionDialogMode('edit');
    setRegionForm(mapRegionToForm(region));
    setMessage(null);
    setRegionDialogOpen(true);
  };

  const openCreateCityDialog = () => {
    setCityDialogMode('create');
    setCityForm({
      ...createDefaultCityForm(),
      regionId: overview?.regions.length === 1 ? overview.regions[0]?.id ?? '' : '',
    });
    setMessage(null);
    setCityDialogOpen(true);
  };

  const openEditCityDialog = (city: WasteCityRecord) => {
    setCityDialogMode('edit');
    setCityForm(mapCityToForm(city));
    setMessage(null);
    setCityDialogOpen(true);
  };

  const openCreateLocationDialog = () => {
    setLocationDialogMode('create');
    setLocationForm({
      ...createDefaultCollectionLocationForm(),
      regionId: search.regionId ?? '',
      cityId: search.cityId ?? '',
    });
    setMessage(null);
    setLocationDialogOpen(true);
  };

  const openEditLocationDialog = (location: WasteCollectionLocationRecord) => {
    setLocationDialogMode('edit');
    setLocationForm(mapCollectionLocationToForm(location));
    setMessage(null);
    setLocationDialogOpen(true);
  };

  const openBulkAssignmentsDialog = () => {
    setBulkAssignmentsForm({
      ...createDefaultLocationTourLinkBulkForm(),
      tourId: availableTours.length === 1 ? availableTours[0]?.id ?? '' : '',
    });
    setMessage(null);
    setBulkAssignmentsDialogOpen(true);
  };

  const toggleLocationSelection = (locationId: string, checked: boolean) => {
    setSelectedLocationIds((current) =>
      checked ? (current.includes(locationId) ? current : [...current, locationId]) : current.filter((id) => id !== locationId)
    );
  };

  const toggleSelectAllFilteredLocations = (checked: boolean) => {
    setSelectedLocationIds((current) => {
      if (!checked) {
        const filteredIds = new Set(filteredCollectionLocations.map((location) => location.id));
        return current.filter((id) => !filteredIds.has(id));
      }
      const merged = new Set(current);
      for (const location of filteredCollectionLocations) {
        merged.add(location.id);
      }
      return Array.from(merged);
    });
  };

  const onSubmitFraction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      if (dialogMode === 'create') {
        await createWasteManagementFraction(toCreateFractionInput(fractionForm));
      } else {
        await updateWasteManagementFraction(fractionForm.id, toUpdateFractionInput(fractionForm));
      }

      await loadOverview(true);
      startTransition(() => {
        setDialogOpen(false);
        setMessage({
          kind: 'success',
          text:
            dialogMode === 'create'
              ? pt('masterData.fractions.messages.createSuccess')
              : pt('masterData.fractions.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('masterData.fractions.messages.saveForbidden')
            : pt('masterData.fractions.messages.saveError'),
      });
    } finally {
      setSaving(false);
    }
  };

  const onSubmitRegion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      if (regionDialogMode === 'create') {
        await createWasteManagementRegion(toCreateRegionInput(regionForm));
      } else {
        await updateWasteManagementRegion(regionForm.id, toUpdateRegionInput(regionForm));
      }

      await loadOverview(true);
      startTransition(() => {
        setRegionDialogOpen(false);
        setMessage({
          kind: 'success',
          text:
            regionDialogMode === 'create'
              ? pt('masterData.regions.messages.createSuccess')
              : pt('masterData.regions.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('masterData.regions.messages.saveForbidden')
            : pt('masterData.regions.messages.saveError'),
      });
    } finally {
      setSaving(false);
    }
  };

  const onSubmitCity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const submittedFormData = new FormData(event.currentTarget);
    const fallbackRegionId = overview?.regions.length === 1 ? overview.regions[0]?.id ?? '' : '';
    const submittedForm: CityFormState = {
      ...cityForm,
      name: String(submittedFormData.get('name') ?? cityForm.name),
      regionId: String((submittedFormData.get('regionId') ?? cityForm.regionId) || fallbackRegionId),
    };

    try {
      if (cityDialogMode === 'create') {
        await createWasteManagementCity(toCreateCityInput(submittedForm));
      } else {
        await updateWasteManagementCity(cityForm.id, toUpdateCityInput(submittedForm));
      }

      await loadOverview(true);
      startTransition(() => {
        setCityDialogOpen(false);
        setMessage({
          kind: 'success',
          text:
            cityDialogMode === 'create'
              ? pt('masterData.cities.messages.createSuccess')
              : pt('masterData.cities.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('masterData.cities.messages.saveForbidden')
            : pt('masterData.cities.messages.saveError'),
      });
    } finally {
      setSaving(false);
    }
  };

  const onSubmitLocation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const submittedFormData = new FormData(event.currentTarget);
    const submittedForm: CollectionLocationFormState = {
      ...locationForm,
      regionId: String(submittedFormData.get('regionId') ?? locationForm.regionId),
      cityId: String(submittedFormData.get('cityId') ?? locationForm.cityId),
      streetId: String(submittedFormData.get('streetId') ?? locationForm.streetId),
      houseNumberId: String(submittedFormData.get('houseNumberId') ?? locationForm.houseNumberId),
    };

    try {
      if (locationDialogMode === 'create') {
        await createWasteManagementCollectionLocation(toCreateCollectionLocationInput(submittedForm));
      } else {
        await updateWasteManagementCollectionLocation(locationForm.id, toUpdateCollectionLocationInput(submittedForm));
      }

      await loadOverview(true);
      startTransition(() => {
        setLocationDialogOpen(false);
        setMessage({
          kind: 'success',
          text:
            locationDialogMode === 'create'
              ? pt('masterData.collectionLocations.messages.createSuccess')
              : pt('masterData.collectionLocations.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('masterData.collectionLocations.messages.saveForbidden')
            : pt('masterData.collectionLocations.messages.saveError'),
      });
    } finally {
      setSaving(false);
    }
  };

  const onSubmitBulkAssignments = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await createWasteManagementLocationTourLinksBulk(
        toCreateLocationTourLinksBulkInput(bulkAssignmentsForm, selectedCollectionLocations.map((location) => location.id))
      );

      await loadOverview(true);
      startTransition(() => {
        setBulkAssignmentsDialogOpen(false);
        setSelectedLocationIds([]);
        setMessage({
          kind: 'success',
          text: pt('masterData.collectionLocations.bulk.messages.assignSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('masterData.collectionLocations.bulk.messages.assignForbidden')
            : pt('masterData.collectionLocations.bulk.messages.assignError'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!filteredFractions.length && !filteredRegions.length && !filteredCities.length && !filteredCollectionLocations.length) {
    return (
      <>
        <StudioEmptyState>
          <div className="space-y-2 text-left">
            <p className="font-medium">{pt('masterData.messages.emptyTitle')}</p>
            <p>{pt('masterData.messages.emptyBody')}</p>
            <div className="flex gap-2 pt-2">
              <Button type="button" onClick={openCreateDialog}>
                {pt('masterData.fractions.actions.openCreate')}
              </Button>
              <Button type="button" variant="outline" onClick={openCreateLocationDialog}>
                {pt('masterData.collectionLocations.actions.openCreate')}
              </Button>
            </div>
          </div>
        </StudioEmptyState>
        <FractionDialog
          open={dialogOpen}
          mode={dialogMode}
          form={fractionForm}
          saving={saving}
          message={dialogOpen ? message : null}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setFractionForm(createDefaultFractionForm());
            }
          }}
          onChange={(patch) => setFractionForm((current) => ({ ...current, ...patch }))}
          onSubmit={onSubmitFraction}
        />
        <RegionDialog
          open={regionDialogOpen}
          mode={regionDialogMode}
          form={regionForm}
          saving={saving}
          message={regionDialogOpen ? message : null}
          onOpenChange={(open) => {
            setRegionDialogOpen(open);
            if (!open) {
              setRegionForm(createDefaultRegionForm());
            }
          }}
          onChange={(patch) => setRegionForm((current) => ({ ...current, ...patch }))}
          onSubmit={onSubmitRegion}
        />
        <CityDialog
          open={cityDialogOpen}
          mode={cityDialogMode}
          form={cityForm}
          regions={overview?.regions ?? []}
          saving={saving}
          message={cityDialogOpen ? message : null}
          onOpenChange={(open) => {
            setCityDialogOpen(open);
            if (!open) {
              setCityForm(createDefaultCityForm());
            }
          }}
          onChange={(patch) => setCityForm((current) => ({ ...current, ...patch }))}
          onSubmit={onSubmitCity}
        />
        <CollectionLocationDialog
          open={locationDialogOpen}
          mode={locationDialogMode}
          form={locationForm}
          regions={overview?.regions ?? []}
          cities={overview?.cities ?? []}
          streets={overview?.streets ?? []}
          houseNumbers={overview?.houseNumbers ?? []}
          saving={saving}
          message={locationDialogOpen ? message : null}
          onOpenChange={(open) => {
            setLocationDialogOpen(open);
            if (!open) {
              setLocationForm(createDefaultCollectionLocationForm());
            }
          }}
          onChange={(patch) => setLocationForm((current) => ({ ...current, ...patch }))}
          onSubmit={onSubmitLocation}
        />
        <BulkLocationAssignmentsDialog
          open={bulkAssignmentsDialogOpen}
          form={bulkAssignmentsForm}
          selectedLocations={selectedCollectionLocations.map((location) => ({
            id: location.id,
            label: formatCollectionLocationLabel(
              pt,
              overview ?? {
                fractions: [],
                regions: [],
                cities: [],
                streets: [],
                houseNumbers: [],
                collectionLocations: [],
                locationTourLinks: [],
              },
              location
            ),
          }))}
          tours={availableTours}
          saving={saving}
          message={bulkAssignmentsDialogOpen ? message : null}
          onOpenChange={(open) => {
            setBulkAssignmentsDialogOpen(open);
            if (!open) {
              setBulkAssignmentsForm(createDefaultLocationTourLinkBulkForm());
            }
          }}
          onChange={(patch) => setBulkAssignmentsForm((current) => ({ ...current, ...patch }))}
          onSubmit={onSubmitBulkAssignments}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <div className="flex justify-end">
        <Button type="button" onClick={openCreateDialog}>
          {pt('masterData.fractions.actions.openCreate')}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>{pt('masterData.meta.fractionCount', { value: filteredFractions.length })}</Badge>
        <Badge variant="outline">{pt('masterData.meta.regionCount', { value: filteredRegions.length })}</Badge>
        <Badge variant="outline">{pt('masterData.meta.cityCount', { value: filteredCities.length })}</Badge>
        <Badge variant="outline">
          {pt('masterData.meta.collectionLocationCount', { value: filteredCollectionLocations.length })}
        </Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('masterData.fractions.title')}</h3>
            <p className="text-sm text-muted-foreground">{pt('masterData.fractions.description')}</p>
          </div>
          <div className="space-y-2">
            {filteredFractions.map((fraction) => (
              <div key={fraction.id} className="rounded-md border border-border/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{fraction.name}</p>
                    {fraction.description ? (
                      <p className="text-sm text-muted-foreground">{fraction.description}</p>
                    ) : null}
                  </div>
                  <Badge variant={fraction.active ? 'default' : 'secondary'}>
                    {fraction.active ? pt('common.active') : pt('common.inactive')}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{pt('masterData.fractions.color', { value: fraction.color })}</Badge>
                  {fraction.containerSize ? (
                    <Badge variant="outline">
                      {pt('masterData.fractions.containerSize', { value: fraction.containerSize })}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(fraction)}>
                    {pt('masterData.fractions.actions.edit')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('masterData.regions.title')}</h3>
            <p className="text-sm text-muted-foreground">{pt('masterData.regions.description')}</p>
          </div>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={openCreateRegionDialog}>
              {pt('masterData.regions.actions.openCreate')}
            </Button>
          </div>
          <div className="space-y-2">
            {filteredRegions.map((region) => (
              <div key={region.id} className="rounded-md border border-border/60 p-3">
                <p className="font-medium">{region.name}</p>
                <p className="text-sm text-muted-foreground">
                  {pt('masterData.regions.regionId', { value: region.id })}
                </p>
                <div className="mt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEditRegionDialog(region)}>
                    {pt('masterData.regions.actions.edit')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('masterData.cities.title')}</h3>
            <p className="text-sm text-muted-foreground">{pt('masterData.cities.description')}</p>
          </div>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={openCreateCityDialog}>
              {pt('masterData.cities.actions.openCreate')}
            </Button>
          </div>
          <div className="space-y-2">
            {filteredCities.map((city) => (
              <div key={city.id} className="rounded-md border border-border/60 p-3">
                <p className="font-medium">{city.name}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">{pt('masterData.cities.cityId', { value: city.id })}</Badge>
                  {city.regionId ? (
                    <Badge variant="outline">{pt('masterData.cities.regionId', { value: city.regionId })}</Badge>
                  ) : null}
                </div>
                <div className="mt-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEditCityDialog(city)}>
                    {pt('masterData.cities.actions.edit')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('masterData.collectionLocations.title')}</h3>
            <p className="text-sm text-muted-foreground">{pt('masterData.collectionLocations.description')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={openCreateLocationDialog}>
              {pt('masterData.collectionLocations.actions.openCreate')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={selectedCollectionLocations.length === 0 || availableTours.length === 0}
              onClick={openBulkAssignmentsDialog}
            >
              {pt('masterData.collectionLocations.bulk.actions.openAssign', {
                value: selectedCollectionLocations.length,
              })}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={allFilteredLocationsSelected}
              onChange={(event) => toggleSelectAllFilteredLocations(event.currentTarget.checked)}
            />
            <span>{pt('masterData.collectionLocations.bulk.actions.selectAllFiltered')}</span>
          </label>
          {selectedCollectionLocations.length ? (
            <Badge variant="outline">
              {pt('masterData.collectionLocations.bulk.meta.selectedCount', {
                value: selectedCollectionLocations.length,
              })}
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {filteredCollectionLocations.map((location) => (
            <div key={location.id} className="rounded-md border border-border/60 p-3">
              <label className="flex items-start gap-2">
                <Checkbox
                  checked={selectedLocationIds.includes(location.id)}
                  onChange={(event) => toggleLocationSelection(location.id, event.currentTarget.checked)}
                />
                <span className="font-medium">
                  {formatCollectionLocationLabel(pt, overview ?? {
                    fractions: [],
                    regions: [],
                    cities: [],
                    streets: [],
                    houseNumbers: [],
                    collectionLocations: [],
                    locationTourLinks: [],
                  }, location)}
                </span>
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">
                  {pt('masterData.collectionLocations.meta.locationId', { value: location.id })}
                </Badge>
                <Badge variant={location.active ? 'default' : 'secondary'}>
                  {location.active ? pt('common.active') : pt('common.inactive')}
                </Badge>
              </div>
              <div className="mt-3">
                <Button type="button" variant="outline" size="sm" onClick={() => openEditLocationDialog(location)}>
                  {pt('masterData.collectionLocations.actions.edit')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <FractionDialog
        open={dialogOpen}
        mode={dialogMode}
        form={fractionForm}
        saving={saving}
        message={dialogOpen ? message : null}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setFractionForm(createDefaultFractionForm());
          }
        }}
        onChange={(patch) => setFractionForm((current) => ({ ...current, ...patch }))}
        onSubmit={onSubmitFraction}
      />
      <RegionDialog
        open={regionDialogOpen}
        mode={regionDialogMode}
        form={regionForm}
        saving={saving}
        message={regionDialogOpen ? message : null}
        onOpenChange={(open) => {
          setRegionDialogOpen(open);
          if (!open) {
            setRegionForm(createDefaultRegionForm());
          }
        }}
        onChange={(patch) => setRegionForm((current) => ({ ...current, ...patch }))}
        onSubmit={onSubmitRegion}
      />
      <CityDialog
        open={cityDialogOpen}
        mode={cityDialogMode}
        form={cityForm}
        regions={overview?.regions ?? []}
        saving={saving}
        message={cityDialogOpen ? message : null}
        onOpenChange={(open) => {
          setCityDialogOpen(open);
          if (!open) {
            setCityForm(createDefaultCityForm());
          }
        }}
        onChange={(patch) => setCityForm((current) => ({ ...current, ...patch }))}
        onSubmit={onSubmitCity}
      />
      <CollectionLocationDialog
        open={locationDialogOpen}
        mode={locationDialogMode}
        form={locationForm}
        regions={overview?.regions ?? []}
        cities={overview?.cities ?? []}
        streets={overview?.streets ?? []}
        houseNumbers={overview?.houseNumbers ?? []}
        saving={saving}
        message={locationDialogOpen ? message : null}
        onOpenChange={(open) => {
          setLocationDialogOpen(open);
          if (!open) {
            setLocationForm(createDefaultCollectionLocationForm());
          }
        }}
        onChange={(patch) => setLocationForm((current) => ({ ...current, ...patch }))}
        onSubmit={onSubmitLocation}
      />
      <BulkLocationAssignmentsDialog
        open={bulkAssignmentsDialogOpen}
        form={bulkAssignmentsForm}
        selectedLocations={selectedCollectionLocations.map((location) => ({
          id: location.id,
          label: formatCollectionLocationLabel(
            pt,
            overview ?? {
              fractions: [],
              regions: [],
              cities: [],
              streets: [],
              houseNumbers: [],
              collectionLocations: [],
              locationTourLinks: [],
            },
            location
          ),
        }))}
        tours={availableTours}
        saving={saving}
        message={bulkAssignmentsDialogOpen ? message : null}
        onOpenChange={(open) => {
          setBulkAssignmentsDialogOpen(open);
          if (!open) {
            setBulkAssignmentsForm(createDefaultLocationTourLinkBulkForm());
          }
        }}
        onChange={(patch) => setBulkAssignmentsForm((current) => ({ ...current, ...patch }))}
        onSubmit={onSubmitBulkAssignments}
      />
    </div>
  );
};

const formatTourRecurrence = (
  pt: ReturnType<typeof usePluginTranslation>,
  value: WasteTourRecord['recurrence'] | undefined
) => {
  if (!value) {
    return '—';
  }

  const translationKeyMap = {
    weekly: 'tours.recurrence.weekly',
    biweekly: 'tours.recurrence.biweekly',
    fourweekly: 'tours.recurrence.fourweekly',
    yearly: 'tours.recurrence.yearly',
    'on-demand': 'tours.recurrence.onDemand',
    custom: 'tours.recurrence.custom',
  } as const satisfies Record<NonNullable<WasteTourRecord['recurrence']>, string>;

  return pt(translationKeyMap[value as NonNullable<WasteTourRecord['recurrence']>]);
};

const formatTourDateRange = (tour: WasteTourRecord) => {
  if (tour.firstDate && tour.endDate) {
    return `${tour.firstDate} – ${tour.endDate}`;
  }
  return tour.firstDate ?? tour.endDate ?? '—';
};

const filterTours = (
  tours: readonly WasteTourRecord[],
  search: WasteManagementSearchParams
): readonly WasteTourRecord[] =>
  tours.filter((tour) => {
    if (search.tourId && tour.id !== search.tourId) {
      return false;
    }
    if (!matchesStatusFilter(search.status, tour.active)) {
      return false;
    }
    if (search.wasteFractionId && !tour.wasteFractionIds.includes(search.wasteFractionId)) {
      return false;
    }
    if (!search.q) {
      return true;
    }

    return [tour.name, tour.description]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => matchesSearch(value, search.q));
  });

const WasteToursPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementToursOverview | null>(null);
  const [availableFractions, setAvailableFractions] = useState<readonly WasteFractionRecord[]>([]);
  const [masterDataOverview, setMasterDataOverview] = useState<WasteManagementMasterDataOverview | null>(null);
  const [schedulingOverview, setSchedulingOverview] = useState<WasteManagementSchedulingOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [tourForm, setTourForm] = useState<TourFormState>(createDefaultTourForm());
  const [assignmentsDialogOpen, setAssignmentsDialogOpen] = useState(false);
  const [assignmentsDialogMode, setAssignmentsDialogMode] = useState<'create' | 'edit'>('create');
  const [linkForm, setLinkForm] = useState<LocationTourLinkFormState>(createDefaultLocationTourLinkForm());
  const [selectedTour, setSelectedTour] = useState<WasteTourRecord | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [saving, setSaving] = useState(false);

  const loadOverview = async (active = true) => {
    try {
      const [toursResponse, masterDataResponse, schedulingResponse] = await Promise.all([
        getWasteManagementToursOverview(),
        getWasteManagementMasterDataOverview(),
        getWasteManagementSchedulingOverview(),
      ]);
      if (!active) {
        return;
      }
      setOverview(toursResponse);
      setAvailableFractions(masterDataResponse.fractions);
      setMasterDataOverview(masterDataResponse);
      setSchedulingOverview(schedulingResponse);
      setError(null);
    } catch (loadError) {
      if (!active) {
        return;
      }
      const code = resolveApiErrorCode(loadError);
      setError(code === 'forbidden' ? pt('tours.messages.loadForbidden') : pt('tours.messages.loadError'));
    } finally {
      if (active) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let active = true;

    void (async () => {
      await loadOverview(active);
    })();

    return () => {
      active = false;
    };
  }, [pt]);

  if (loading) {
    return <StudioLoadingState>{pt('tours.messages.loading')}</StudioLoadingState>;
  }

  if (error) {
    return <StudioErrorState>{error}</StudioErrorState>;
  }

  const tours = filterTours(overview?.tours ?? [], search);

  const openCreateDialog = () => {
    setDialogMode('create');
    setTourForm(createDefaultTourForm());
    setMessage(null);
    setDialogOpen(true);
  };

  const openEditDialog = (tour: WasteTourRecord) => {
    setDialogMode('edit');
    setTourForm(mapTourToForm(tour));
    setMessage(null);
    setDialogOpen(true);
  };

  const openCreateAssignmentsDialog = (tour: WasteTourRecord) => {
    setSelectedTour(tour);
    setAssignmentsDialogMode('create');
    setLinkForm({
      ...createDefaultLocationTourLinkForm(),
      tourId: tour.id,
    });
    setMessage(null);
    setAssignmentsDialogOpen(true);
  };

  const openEditAssignmentsDialog = (tour: WasteTourRecord, link: WasteLocationTourLinkRecord) => {
    setSelectedTour(tour);
    setAssignmentsDialogMode('edit');
    setLinkForm(mapLocationTourLinkToForm(link));
    setMessage(null);
    setAssignmentsDialogOpen(true);
  };

  const openCalendar = (tour: WasteTourRecord) => {
    setSelectedTour(tour);
    setCalendarOpen(true);
  };

  const onSubmitTour = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      if (dialogMode === 'create') {
        await createWasteManagementTour(toCreateTourInput(tourForm));
      } else {
        await updateWasteManagementTour(tourForm.id, toUpdateTourInput(tourForm));
      }

      await loadOverview(true);
      startTransition(() => {
        setDialogOpen(false);
        setMessage({
          kind: 'success',
          text: dialogMode === 'create' ? pt('tours.messages.createSuccess') : pt('tours.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text: code === 'forbidden' ? pt('tours.messages.saveForbidden') : pt('tours.messages.saveError'),
      });
    } finally {
      setSaving(false);
    }
  };

  const onSubmitAssignments = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      if (assignmentsDialogMode === 'create') {
        await createWasteManagementLocationTourLink(toCreateLocationTourLinkInput(linkForm));
      } else {
        await updateWasteManagementLocationTourLink(linkForm.id, toUpdateLocationTourLinkInput(linkForm));
      }

      await loadOverview(true);
      startTransition(() => {
        setAssignmentsDialogOpen(false);
        setMessage({
          kind: 'success',
          text:
            assignmentsDialogMode === 'create'
              ? pt('tours.assignments.messages.createSuccess')
              : pt('tours.assignments.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('tours.assignments.messages.saveForbidden')
            : pt('tours.assignments.messages.saveError'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!tours.length) {
    return (
      <>
        <StudioEmptyState>
          <div className="space-y-2 text-left">
            <p className="font-medium">{pt('tours.messages.emptyTitle')}</p>
            <p>{pt('tours.messages.emptyBody')}</p>
            <div className="pt-2">
              <Button type="button" onClick={openCreateDialog}>
                {pt('tours.actions.openCreate')}
              </Button>
            </div>
          </div>
        </StudioEmptyState>
        <TourDialog
          open={dialogOpen}
          mode={dialogMode}
          form={tourForm}
          fractions={availableFractions}
          saving={saving}
          message={dialogOpen ? message : null}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setTourForm(createDefaultTourForm());
            }
          }}
          onChange={(patch) => setTourForm((current) => ({ ...current, ...patch }))}
          onSubmit={onSubmitTour}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <StatusNotice message={message} />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={openCreateDialog}>
            {pt('tours.actions.openCreate')}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
        <Badge>{pt('tours.meta.count', { value: tours.length })}</Badge>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {tours.map((tour) => (
            <section key={tour.id} className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">{tour.name}</h3>
                  {tour.description ? <p className="text-sm text-muted-foreground">{tour.description}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(tour)}>
                    {pt('tours.actions.edit')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => openCreateAssignmentsDialog(tour)}>
                    {pt('tours.assignments.actions.openCreate')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => openCalendar(tour)}>
                    {pt('tours.yearCalendar.actions.open')}
                  </Button>
                  <Badge variant={tour.active ? 'default' : 'secondary'}>
                    {tour.active ? pt('common.active') : pt('common.inactive')}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{pt('tours.meta.recurrence', { value: formatTourRecurrence(pt, tour.recurrence) })}</Badge>
                <Badge variant="outline">{pt('tours.meta.fractionCount', { value: tour.wasteFractionIds.length })}</Badge>
                <Badge variant="outline">{pt('tours.meta.locationCount', { value: tour.locationCount ?? 0 })}</Badge>
              </div>
              <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                <p>{pt('tours.meta.dateRange', { value: formatTourDateRange(tour) })}</p>
                <p>{pt('tours.meta.tourId', { value: tour.id })}</p>
              </div>
              {tour.customDates?.length ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{pt('tours.customDates.title')}</p>
                  <div className="flex flex-wrap gap-2">
                    {tour.customDates.map((customDate: WasteCustomTourDate) => (
                      <Badge key={`${tour.id}-${customDate.date}`} variant="outline">
                        {customDate.description ? `${customDate.date} · ${customDate.description}` : customDate.date}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {masterDataOverview ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{pt('tours.assignments.title')}</p>
                  <div className="space-y-2">
                    {(masterDataOverview.locationTourLinks ?? [])
                      .filter((link) => link.tourId === tour.id)
                      .map((link) => {
                        const location = masterDataOverview.collectionLocations.find(
                          (entry) => entry.id === link.locationId
                        );
                        if (!location) {
                          return null;
                        }
                        return (
                          <div key={link.id} className="flex items-center justify-between gap-3 rounded-md border border-border/60 p-2">
                            <div className="space-y-1">
                              <p className="text-sm">
                                {formatCollectionLocationLabel(pt, masterDataOverview, location)}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {link.startDate ? (
                                  <Badge variant="outline">
                                    {pt('tours.assignments.meta.startDate', { value: link.startDate })}
                                  </Badge>
                                ) : null}
                                {link.endDate ? (
                                  <Badge variant="outline">
                                    {pt('tours.assignments.meta.endDate', { value: link.endDate })}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openEditAssignmentsDialog(tour, link)}
                            >
                              {pt('tours.assignments.actions.edit')}
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : null}
            </section>
          ))}
        </div>
      </div>
      <TourDialog
        open={dialogOpen}
        mode={dialogMode}
        form={tourForm}
        fractions={availableFractions}
        saving={saving}
        message={dialogOpen ? message : null}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setTourForm(createDefaultTourForm());
          }
        }}
        onChange={(patch) => setTourForm((current) => ({ ...current, ...patch }))}
        onSubmit={onSubmitTour}
      />
      <TourAssignmentsDialog
        open={assignmentsDialogOpen}
        mode={assignmentsDialogMode}
        form={linkForm}
        tour={selectedTour}
        tours={overview?.tours ?? []}
        locations={(masterDataOverview?.collectionLocations ?? []).map((location) => ({
          id: location.id,
          label: formatCollectionLocationLabel(pt, masterDataOverview ?? {
            fractions: [],
            regions: [],
            cities: [],
            streets: [],
            houseNumbers: [],
            collectionLocations: [],
            locationTourLinks: [],
          }, location),
        }))}
        saving={saving}
        message={assignmentsDialogOpen ? message : null}
        onOpenChange={(open) => {
          setAssignmentsDialogOpen(open);
          if (!open) {
            setLinkForm(createDefaultLocationTourLinkForm());
          }
        }}
        onChange={(patch) => setLinkForm((current) => ({ ...current, ...patch }))}
        onSubmit={onSubmitAssignments}
      />
      <TourYearCalendarDialog
        open={calendarOpen}
        tour={selectedTour}
        scheduling={schedulingOverview}
        onOpenChange={setCalendarOpen}
      />
    </>
  );
};

const matchesShiftContext = (
  search: WasteManagementSearchParams['shiftContext'],
  kind: 'global' | 'tour'
): boolean => search === 'all' || search === kind;

const filterTourDateShifts = (
  shifts: readonly WasteTourDateShiftRecord[],
  search: WasteManagementSearchParams
): readonly WasteTourDateShiftRecord[] =>
  shifts.filter((shift) => {
    if (!matchesShiftContext(search.shiftContext, 'tour')) {
      return false;
    }
    if (search.tourId && shift.tourId !== search.tourId) {
      return false;
    }
    if (!search.q) {
      return true;
    }
    return [shift.description, shift.originalDate, shift.actualDate]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => matchesSearch(value, search.q));
  });

const filterGlobalDateShifts = (
  shifts: readonly WasteGlobalDateShiftRecord[],
  search: WasteManagementSearchParams
): readonly WasteGlobalDateShiftRecord[] =>
  shifts.filter((shift) => {
    if (!matchesShiftContext(search.shiftContext, 'global')) {
      return false;
    }
    if (search.tourId && !shift.tourIds?.includes(search.tourId)) {
      return false;
    }
    if (!search.q) {
      return true;
    }
    return [shift.description, shift.originalDate, shift.actualDate]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => matchesSearch(value, search.q));
  });

const ShiftCard = ({
  title,
  originalDate,
  actualDate,
  description,
  badges,
  actions,
}: {
  readonly title: string;
  readonly originalDate: string;
  readonly actualDate: string;
  readonly description?: string;
  readonly badges: readonly string[];
  readonly actions?: ReactNode;
}) => (
  <section className="space-y-3 rounded-lg border border-border/70 bg-card p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline">{originalDate}</Badge>
      <Badge>{actualDate}</Badge>
      {badges.map((badge) => (
        <Badge key={badge} variant="secondary">
          {badge}
        </Badge>
      ))}
    </div>
  </section>
);

const TourDateShiftDialog = ({
  open,
  mode,
  form,
  tours,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: TourDateShiftFormState;
  readonly tours: readonly WasteTourRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<TourDateShiftFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? pt('scheduling.tour.dialog.createTitle') : pt('scheduling.tour.dialog.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? pt('scheduling.tour.dialog.createDescription')
              : pt('scheduling.tour.dialog.editDescription')}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField id="waste-tour-shift-tour" label={pt('scheduling.tour.fields.tourId')}>
              <Select
                id="waste-tour-shift-tour"
                value={form.tourId}
                onChange={(event) => onChange({ tourId: event.target.value })}
              >
                <option value="">{pt('scheduling.tour.fields.tourUnset')}</option>
                {tours.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.name}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField id="waste-tour-shift-original-date" label={pt('scheduling.tour.fields.originalDate')}>
              <Input
                id="waste-tour-shift-original-date"
                type="date"
                value={form.originalDate}
                onChange={(event) => onChange({ originalDate: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-tour-shift-actual-date" label={pt('scheduling.tour.fields.actualDate')}>
              <Input
                id="waste-tour-shift-actual-date"
                type="date"
                value={form.actualDate}
                onChange={(event) => onChange({ actualDate: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-tour-shift-description" label={pt('scheduling.tour.fields.description')}>
              <Textarea
                id="waste-tour-shift-description"
                value={form.description}
                onChange={(event) => onChange({ description: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-tour-shift-has-year" label={pt('scheduling.tour.fields.hasYear')}>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="waste-tour-shift-has-year"
                  checked={form.hasYear}
                  onChange={(event) => onChange({ hasYear: event.currentTarget.checked })}
                />
                <span className="text-sm text-muted-foreground">
                  {form.hasYear ? pt('common.yes') : pt('common.no')}
                </span>
              </div>
            </StudioField>
          </StudioFieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('scheduling.tour.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? pt('scheduling.tour.actions.saving')
                : mode === 'create'
                  ? pt('scheduling.tour.actions.create')
                  : pt('scheduling.tour.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const GlobalDateShiftDialog = ({
  open,
  mode,
  form,
  tours,
  saving,
  message,
  onOpenChange,
  onChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: 'create' | 'edit';
  readonly form: GlobalDateShiftFormState;
  readonly tours: readonly WasteTourRecord[];
  readonly saving: boolean;
  readonly message: StatusMessage | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onChange: (patch: Partial<GlobalDateShiftFormState>) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? pt('scheduling.global.dialog.createTitle') : pt('scheduling.global.dialog.editTitle')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? pt('scheduling.global.dialog.createDescription')
              : pt('scheduling.global.dialog.editDescription')}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={onSubmit}>
          <StatusNotice message={message} />
          <StudioFieldGroup>
            <StudioField id="waste-global-shift-original-date" label={pt('scheduling.global.fields.originalDate')}>
              <Input
                id="waste-global-shift-original-date"
                type="date"
                value={form.originalDate}
                onChange={(event) => onChange({ originalDate: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-global-shift-actual-date" label={pt('scheduling.global.fields.actualDate')}>
              <Input
                id="waste-global-shift-actual-date"
                type="date"
                value={form.actualDate}
                onChange={(event) => onChange({ actualDate: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-global-shift-description" label={pt('scheduling.global.fields.description')}>
              <Textarea
                id="waste-global-shift-description"
                value={form.description}
                onChange={(event) => onChange({ description: event.target.value })}
              />
            </StudioField>
            <StudioField id="waste-global-shift-has-year" label={pt('scheduling.global.fields.hasYear')}>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="waste-global-shift-has-year"
                  checked={form.hasYear}
                  onChange={(event) => onChange({ hasYear: event.currentTarget.checked })}
                />
                <span className="text-sm text-muted-foreground">
                  {form.hasYear ? pt('common.yes') : pt('common.no')}
                </span>
              </div>
            </StudioField>
            <StudioField id="waste-global-shift-tours" label={pt('scheduling.global.fields.tourIds')}>
              <div className="space-y-2 rounded-md border border-border/70 p-3">
                {tours.length ? (
                  tours.map((tour) => {
                    const checked = form.tourIds.includes(tour.id);
                    return (
                      <label key={tour.id} className="flex items-center gap-3 text-sm">
                        <Checkbox
                          checked={checked}
                          onChange={(event) =>
                            onChange({
                              tourIds: event.currentTarget.checked
                                ? [...form.tourIds, tour.id]
                                : form.tourIds.filter((value) => value !== tour.id),
                            })
                          }
                        />
                        <span>{tour.name}</span>
                      </label>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">{pt('scheduling.global.fields.noToursAvailable')}</p>
                )}
              </div>
            </StudioField>
          </StudioFieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {pt('scheduling.global.actions.cancel')}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? pt('scheduling.global.actions.saving')
                : mode === 'create'
                  ? pt('scheduling.global.actions.create')
                  : pt('scheduling.global.actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const WasteSchedulingPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementSchedulingOverview | null>(null);
  const [availableTours, setAvailableTours] = useState<readonly WasteTourRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [tourShiftForm, setTourShiftForm] = useState<TourDateShiftFormState>(createDefaultTourDateShiftForm());
  const [globalDialogOpen, setGlobalDialogOpen] = useState(false);
  const [globalDialogMode, setGlobalDialogMode] = useState<'create' | 'edit'>('create');
  const [globalShiftForm, setGlobalShiftForm] = useState<GlobalDateShiftFormState>(createDefaultGlobalDateShiftForm());
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [saving, setSaving] = useState(false);

  const loadOverview = async (active = true) => {
    try {
      const [schedulingResponse, toursResponse] = await Promise.all([
        getWasteManagementSchedulingOverview(),
        getWasteManagementToursOverview(),
      ]);
      if (!active) {
        return;
      }
      setOverview(schedulingResponse);
      setAvailableTours(toursResponse.tours);
      setError(null);
    } catch (loadError) {
      if (!active) {
        return;
      }
      const code = resolveApiErrorCode(loadError);
      setError(
        code === 'forbidden' ? pt('scheduling.messages.loadForbidden') : pt('scheduling.messages.loadError')
      );
    } finally {
      if (active) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let active = true;

    void (async () => {
      await loadOverview(active);
    })();

    return () => {
      active = false;
    };
  }, [pt]);

  if (loading) {
    return <StudioLoadingState>{pt('scheduling.messages.loading')}</StudioLoadingState>;
  }

  if (error) {
    return <StudioErrorState>{error}</StudioErrorState>;
  }

  const tourDateShifts = filterTourDateShifts(overview?.tourDateShifts ?? [], search);
  const globalDateShifts = filterGlobalDateShifts(overview?.globalDateShifts ?? [], search);

  const openCreateTourShiftDialog = () => {
    setDialogMode('create');
    setTourShiftForm({
      ...createDefaultTourDateShiftForm(),
      tourId: availableTours.length === 1 ? availableTours[0]?.id ?? '' : '',
    });
    setMessage(null);
    setDialogOpen(true);
  };

  const openEditTourShiftDialog = (shift: WasteTourDateShiftRecord) => {
    setDialogMode('edit');
    setTourShiftForm(mapTourDateShiftToForm(shift));
    setMessage(null);
    setDialogOpen(true);
  };

  const onSubmitTourShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      if (dialogMode === 'create') {
        await createWasteManagementTourDateShift(toCreateTourDateShiftInput(tourShiftForm));
      } else {
        await updateWasteManagementTourDateShift(tourShiftForm.id, toUpdateTourDateShiftInput(tourShiftForm));
      }

      await loadOverview(true);
      startTransition(() => {
        setDialogOpen(false);
        setMessage({
          kind: 'success',
          text:
            dialogMode === 'create'
              ? pt('scheduling.tour.messages.createSuccess')
              : pt('scheduling.tour.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('scheduling.tour.messages.saveForbidden')
            : pt('scheduling.tour.messages.saveError'),
      });
    } finally {
      setSaving(false);
    }
  };

  const openCreateGlobalShiftDialog = () => {
    setGlobalDialogMode('create');
    setGlobalShiftForm(createDefaultGlobalDateShiftForm());
    setMessage(null);
    setGlobalDialogOpen(true);
  };

  const openEditGlobalShiftDialog = (shift: WasteGlobalDateShiftRecord) => {
    setGlobalDialogMode('edit');
    setGlobalShiftForm(mapGlobalDateShiftToForm(shift));
    setMessage(null);
    setGlobalDialogOpen(true);
  };

  const onSubmitGlobalShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      if (globalDialogMode === 'create') {
        await createWasteManagementGlobalDateShift(toCreateGlobalDateShiftInput(globalShiftForm));
      } else {
        await updateWasteManagementGlobalDateShift(globalShiftForm.id, toUpdateGlobalDateShiftInput(globalShiftForm));
      }

      await loadOverview(true);
      startTransition(() => {
        setGlobalDialogOpen(false);
        setMessage({
          kind: 'success',
          text:
            globalDialogMode === 'create'
              ? pt('scheduling.global.messages.createSuccess')
              : pt('scheduling.global.messages.updateSuccess'),
        });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('scheduling.global.messages.saveForbidden')
            : pt('scheduling.global.messages.saveError'),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!tourDateShifts.length && !globalDateShifts.length) {
    return (
      <>
        <StudioEmptyState>
          <div className="space-y-2 text-left">
            <p className="font-medium">{pt('scheduling.messages.emptyTitle')}</p>
            <p>{pt('scheduling.messages.emptyBody')}</p>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={openCreateGlobalShiftDialog}>
                {pt('scheduling.global.actions.openCreate')}
              </Button>
              <Button type="button" onClick={openCreateTourShiftDialog}>
                {pt('scheduling.tour.actions.openCreate')}
              </Button>
            </div>
          </div>
        </StudioEmptyState>
        <TourDateShiftDialog
          open={dialogOpen}
          mode={dialogMode}
          form={tourShiftForm}
          tours={availableTours}
          saving={saving}
          message={dialogOpen ? message : null}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setTourShiftForm(createDefaultTourDateShiftForm());
            }
          }}
          onChange={(patch) => setTourShiftForm((current) => ({ ...current, ...patch }))}
          onSubmit={onSubmitTourShift}
        />
        <GlobalDateShiftDialog
          open={globalDialogOpen}
          mode={globalDialogMode}
          form={globalShiftForm}
          tours={availableTours}
          saving={saving}
          message={globalDialogOpen ? message : null}
          onOpenChange={(open) => {
            setGlobalDialogOpen(open);
            if (!open) {
              setGlobalShiftForm(createDefaultGlobalDateShiftForm());
            }
          }}
          onChange={(patch) => setGlobalShiftForm((current) => ({ ...current, ...patch }))}
          onSubmit={onSubmitGlobalShift}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
      <StatusNotice message={message} />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={openCreateGlobalShiftDialog}>
          {pt('scheduling.global.actions.openCreate')}
        </Button>
        <Button type="button" onClick={openCreateTourShiftDialog}>
          {pt('scheduling.tour.actions.openCreate')}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>{pt('scheduling.meta.globalCount', { value: globalDateShifts.length })}</Badge>
        <Badge variant="outline">{pt('scheduling.meta.tourCount', { value: tourDateShifts.length })}</Badge>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('scheduling.global.title')}</h3>
            <p className="text-sm text-muted-foreground">{pt('scheduling.global.description')}</p>
          </div>
          {globalDateShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              title={pt('scheduling.global.cardTitle', { value: shift.id })}
              originalDate={shift.originalDate}
              actualDate={shift.actualDate}
              description={shift.description}
              badges={[
                pt('scheduling.meta.hasYear', { value: shift.hasYear ? pt('common.yes') : pt('common.no') }),
                pt('scheduling.meta.affectedTours', { value: shift.tourIds?.length ?? 0 }),
              ]}
              actions={
                <Button type="button" variant="outline" size="sm" onClick={() => openEditGlobalShiftDialog(shift)}>
                  {pt('scheduling.global.actions.edit')}
                </Button>
              }
            />
          ))}
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('scheduling.tour.title')}</h3>
            <p className="text-sm text-muted-foreground">{pt('scheduling.tour.description')}</p>
          </div>
          {tourDateShifts.map((shift) => (
            <ShiftCard
              key={shift.id}
              title={pt('scheduling.tour.cardTitle', { value: shift.tourId })}
              originalDate={shift.originalDate}
              actualDate={shift.actualDate}
              description={shift.description}
              badges={[
                pt('scheduling.meta.hasYear', { value: shift.hasYear ? pt('common.yes') : pt('common.no') }),
              ]}
              actions={
                <Button type="button" variant="outline" size="sm" onClick={() => openEditTourShiftDialog(shift)}>
                  {pt('scheduling.tour.actions.edit')}
                </Button>
              }
            />
          ))}
        </div>
      </div>
    </div>
      <TourDateShiftDialog
        open={dialogOpen}
        mode={dialogMode}
        form={tourShiftForm}
        tours={availableTours}
        saving={saving}
        message={dialogOpen ? message : null}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setTourShiftForm(createDefaultTourDateShiftForm());
          }
        }}
        onChange={(patch) => setTourShiftForm((current) => ({ ...current, ...patch }))}
        onSubmit={onSubmitTourShift}
      />
      <GlobalDateShiftDialog
        open={globalDialogOpen}
        mode={globalDialogMode}
        form={globalShiftForm}
        tours={availableTours}
        saving={saving}
        message={globalDialogOpen ? message : null}
        onOpenChange={(open) => {
          setGlobalDialogOpen(open);
          if (!open) {
            setGlobalShiftForm(createDefaultGlobalDateShiftForm());
          }
        }}
        onChange={(patch) => setGlobalShiftForm((current) => ({ ...current, ...patch }))}
        onSubmit={onSubmitGlobalShift}
      />
    </>
  );
};

const WasteSettingsPanel = () => {
  const pt = usePluginTranslation('wasteManagement');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<WasteManagementSettingsRecord | null>(null);
  const [form, setForm] = useState<SettingsFormState>(createDefaultSettingsForm());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await getWasteManagementSettings();
        if (!active) {
          return;
        }
        setSettings(response);
        setForm(mapSettingsToForm(response));
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        const code = resolveApiErrorCode(loadError);
        setError(
          code === 'forbidden' ? pt('settings.messages.loadForbidden') : pt('settings.messages.loadError')
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [pt]);

  if (loading) {
    return <StudioLoadingState>{pt('settings.messages.loading')}</StudioLoadingState>;
  }

  if (error) {
    return <StudioErrorState>{error}</StudioErrorState>;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await updateWasteManagementSettings(toSettingsInput(form));
      startTransition(() => {
        setSettings(response);
        setForm(mapSettingsToForm(response));
        setMessage({ kind: 'success', text: pt('settings.messages.saveSuccess') });
      });
    } catch (saveError) {
      const code = resolveApiErrorCode(saveError);
      setMessage({
        kind: 'error',
        text: code === 'forbidden' ? pt('settings.messages.saveForbidden') : pt('settings.messages.saveError'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <StudioTechnicalStatusPanel
        title={pt('settings.technical.title')}
        description={pt('settings.technical.description')}
        statusLabel={settings?.visibleStatus ?? 'not_configured'}
        statusTone={toTechnicalStatusTone(settings?.visibleStatus)}
        metadata={[
          {
            id: 'databaseUrlConfigured',
            label: pt('settings.meta.databaseUrlConfiguredLabel'),
            value: settings?.databaseUrlConfigured ? pt('common.yes') : pt('common.no'),
          },
          {
            id: 'serviceRoleKeyConfigured',
            label: pt('settings.meta.serviceRoleKeyConfiguredLabel'),
            value: settings?.serviceRoleKeyConfigured ? pt('common.yes') : pt('common.no'),
          },
          {
            id: 'lastCheckedAt',
            label: pt('settings.meta.lastCheckedAtLabel'),
            value: formatUpdatedAt(settings?.lastCheckedAt),
          },
        ]}
      />
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('settings.groupTitle')}</h3>
            <p className="text-sm text-muted-foreground">{pt('settings.groupDescription')}</p>
          </div>
          <StudioFieldGroup>
            <StudioField id="waste-settings-project-url" label={pt('settings.fields.projectUrl')}>
              <Input
                value={form.projectUrl}
                onChange={(event) => setForm((current) => ({ ...current, projectUrl: event.target.value }))}
                placeholder="https://example.supabase.co"
              />
            </StudioField>
            <StudioField id="waste-settings-schema-name" label={pt('settings.fields.schemaName')}>
              <Input
                value={form.schemaName}
                onChange={(event) => setForm((current) => ({ ...current, schemaName: event.target.value }))}
                placeholder="public"
              />
            </StudioField>
            <StudioField id="waste-settings-database-url" label={pt('settings.fields.databaseUrl')}>
              <Input
                value={form.databaseUrl}
                onChange={(event) => setForm((current) => ({ ...current, databaseUrl: event.target.value }))}
                placeholder="postgresql://..."
              />
            </StudioField>
            <StudioField id="waste-settings-service-role-key" label={pt('settings.fields.serviceRoleKey')}>
              <Input
                value={form.serviceRoleKey}
                onChange={(event) => setForm((current) => ({ ...current, serviceRoleKey: event.target.value }))}
                placeholder="service-role-key"
              />
            </StudioField>
            <label className="flex items-center gap-3 text-sm font-medium">
              <Checkbox
                checked={form.enabled}
                onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                aria-label={pt('settings.fields.enabled')}
              />
              <span>{pt('settings.fields.enabled')}</span>
            </label>
          </StudioFieldGroup>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? pt('settings.actions.saving') : pt('settings.actions.save')}
        </Button>
      </form>
    </div>
  );
};

const WasteOverviewPanel = ({ search }: { readonly search: WasteManagementSearchParams }) => {
  const pt = usePluginTranslation('wasteManagement');
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<WasteManagementHistoryOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      try {
        const response = await getWasteManagementHistoryOverview({
          q: search.q,
          page: search.page,
          pageSize: search.pageSize,
        });
        if (!active) {
          return;
        }
        setOverview(response);
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        const code = resolveApiErrorCode(loadError);
        setError(code === 'forbidden' ? pt('overview.messages.loadForbidden') : pt('overview.messages.loadError'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [pt, search.page, search.pageSize, search.q]);

  if (loading) {
    return <StudioLoadingState>{pt('overview.messages.loading')}</StudioLoadingState>;
  }

  if (error) {
    return <StudioErrorState>{error}</StudioErrorState>;
  }

  const items = overview?.items ?? [];
  if (!items.length) {
    return (
      <StudioEmptyState>
        <div className="space-y-2 text-left">
          <p className="font-medium">{pt('overview.messages.emptyTitle')}</p>
          <p>{pt('overview.messages.emptyBody')}</p>
        </div>
      </StudioEmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge>{pt('overview.meta.total', { value: overview?.total ?? 0 })}</Badge>
        <Badge variant="outline">{pt('overview.meta.visible', { value: items.length })}</Badge>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="space-y-2 rounded-lg border border-border/70 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{item.actionId}</Badge>
              <Badge variant={item.outcome === 'success' ? 'default' : item.outcome === 'failure' ? 'destructive' : 'secondary'}>
                {pt(`overview.outcome.${item.outcome}`)}
              </Badge>
              <Badge variant="outline">{pt('overview.meta.occurredAt', { value: formatUpdatedAt(item.occurredAt) })}</Badge>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              {item.resourceType ? <p>{pt('overview.meta.resourceType', { value: item.resourceType })}</p> : null}
              {item.resourceId ? <p>{pt('overview.meta.resourceId', { value: item.resourceId })}</p> : null}
              {item.reasonCode ? <p>{pt('overview.meta.reasonCode', { value: item.reasonCode })}</p> : null}
              {item.requestId ? <p>{pt('overview.meta.requestId', { value: item.requestId })}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const WasteToolsPanel = () => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const importCatalog = getWasteManagementImportCatalog();
  const [importProfileId, setImportProfileId] = useState<StartWasteManagementImportInput['importProfileId'] | ''>(
    importCatalog[0]?.profileId ?? ''
  );
  const [importBlobRef, setImportBlobRef] = useState('');
  const [importDryRun, setImportDryRun] = useState(true);
  const [migrationSchema, setMigrationSchema] = useState('public');
  const [migrationVersion, setMigrationVersion] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [runningAction, setRunningAction] = useState<'import' | 'migration' | 'seed' | 'reset' | null>(null);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [lastJob, setLastJob] = useState<StudioJobResponse['data'] | null>(null);
  const selectedImportProfile =
    importCatalog.find((profile) => profile.profileId === importProfileId) ?? importCatalog[0] ?? null;

  const runJob = async (
    action: 'import' | 'migration' | 'seed' | 'reset',
    callback: () => Promise<StudioJobResponse['data']>
  ) => {
    setRunningAction(action);
    setMessage(null);
    try {
      const job = await callback();
      setLastJob(job);
      setMessage({ kind: 'success', text: pt('tools.messages.jobStarted', { jobId: job.id }) });
    } catch (error) {
      const code = resolveApiErrorCode(error);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? pt('tools.messages.forbidden')
            : action === 'import' && code === 'invalid_request'
              ? pt('tools.messages.importValidationError')
            : action === 'reset' && code === 'invalid_request'
              ? pt('tools.messages.resetValidationError')
              : pt('tools.messages.jobStartError'),
      });
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <StatusNotice message={message} />
        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('tools.imports.title')}</h3>
            <p className="text-sm text-muted-foreground">{pt('tools.imports.description')}</p>
          </div>
          <StudioFieldGroup>
            <StudioField id="waste-tools-import-profile" label={pt('tools.imports.profileLabel')}>
              <Select
                value={importProfileId}
                onChange={(event) => {
                  const nextProfileId = event.target.value;
                  const matchingProfile = importCatalog.find((profile) => profile.profileId === nextProfileId);
                  if (matchingProfile) {
                    setImportProfileId(matchingProfile.profileId);
                  }
                }}
              >
                {importCatalog.map((profile) => (
                  <option key={profile.profileId} value={profile.profileId}>
                    {profile.displayName}
                  </option>
                ))}
              </Select>
            </StudioField>
            <StudioField id="waste-tools-import-blob-ref" label={pt('tools.imports.blobRefLabel')}>
              <Input value={importBlobRef} onChange={(event) => setImportBlobRef(event.target.value)} />
            </StudioField>
          </StudioFieldGroup>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox checked={importDryRun} onChange={(event) => setImportDryRun(event.currentTarget.checked)} />
            <span>{pt('tools.imports.dryRunLabel')}</span>
          </label>
          {selectedImportProfile ? (
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">{selectedImportProfile.description}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {pt('tools.imports.templateColumns')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedImportProfile.requiredColumns.map((column) => (
                  <Badge key={column.key} variant="secondary">
                    {column.key}
                  </Badge>
                ))}
                {selectedImportProfile.optionalColumns.map((column) => (
                  <Badge key={column.key} variant="outline">
                    {column.key}
                  </Badge>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => downloadImportTemplate(selectedImportProfile)}>
                  {pt('tools.actions.downloadTemplate')}
                </Button>
                <Button
                  type="button"
                  disabled={runningAction !== null || importBlobRef.trim().length === 0}
                  onClick={() =>
                    void runJob('import', () =>
                      startWasteManagementImport({
                        importProfileId,
                        blobRef: importBlobRef.trim(),
                        dryRun: importDryRun,
                      } satisfies StartWasteManagementImportInput)
                    )
                  }
                >
                  {runningAction === 'import' ? pt('tools.actions.starting') : pt('tools.actions.startImport')}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('tools.migrations.title')}</h3>
            <p className="text-sm text-muted-foreground">{pt('tools.migrations.description')}</p>
          </div>
          <StudioFieldGroup>
            <StudioField id="waste-tools-migration-schema" label={pt('tools.migrations.schemaLabel')}>
              <Input value={migrationSchema} onChange={(event) => setMigrationSchema(event.target.value)} />
            </StudioField>
            <StudioField id="waste-tools-migration-version" label={pt('tools.migrations.versionLabel')}>
              <Input value={migrationVersion} onChange={(event) => setMigrationVersion(event.target.value)} />
            </StudioField>
          </StudioFieldGroup>
          <Button
            type="button"
            disabled={runningAction !== null}
            onClick={() =>
              void runJob('migration', () =>
                startWasteManagementMigrations({
                  targetSchema: compactOptionalString(migrationSchema),
                  requestedByVersion: compactOptionalString(migrationVersion),
                })
              )
            }
          >
            {runningAction === 'migration' ? pt('tools.actions.starting') : pt('tools.actions.startMigrations')}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('tools.seed.title')}</h3>
            <p className="text-sm text-muted-foreground">{pt('tools.seed.description')}</p>
          </div>
          <Button
            type="button"
            disabled={runningAction !== null}
            onClick={() => void runJob('seed', () => startWasteManagementSeed())}
          >
            {runningAction === 'seed' ? pt('tools.actions.starting') : pt('tools.actions.startSeed')}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{pt('tools.reset.title')}</h3>
            <p className="text-sm text-muted-foreground">{pt('tools.reset.description')}</p>
          </div>
          <Button
            type="button"
            variant="destructive"
            disabled={runningAction !== null}
            onClick={() => setResetConfirmOpen(true)}
          >
            {runningAction === 'reset' ? pt('tools.actions.starting') : pt('tools.actions.startReset')}
          </Button>
        </div>

        <StudioJobSummaryCard
          title={pt('tools.meta.lastJobTitle')}
          description={lastJob ? pt('tools.meta.lastJobDescription') : pt('tools.meta.noJobYet')}
          statusLabel={lastJob?.status ?? pt('tools.meta.noJobStatus')}
          statusTone={toJobStatusTone(lastJob?.status)}
          metadata={
            lastJob
              ? [
                  { id: 'jobId', label: pt('tools.meta.jobIdLabel'), value: lastJob.id },
                  { id: 'jobTypeId', label: pt('tools.meta.jobTypeLabel'), value: lastJob.jobTypeId },
                  { id: 'jobStatus', label: pt('tools.meta.jobStatusLabel'), value: lastJob.status },
                ]
              : undefined
          }
          emptyState={pt('tools.meta.noJobYet')}
          actions={
            lastJob ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void navigate({ to: '/monitoring/jobs/$jobId', params: { jobId: lastJob.id } })}
              >
                {pt('tools.actions.openJob')}
              </Button>
            ) : undefined
          }
        />
      </div>
      <ResetConfirmationDialog
        open={resetConfirmOpen}
        token={resetToken}
        running={runningAction === 'reset'}
        onOpenChange={setResetConfirmOpen}
        onTokenChange={setResetToken}
        onConfirm={() =>
          void runJob('reset', async () => {
            const job = await startWasteManagementReset({
              confirmationToken: resetToken.trim(),
            });
            setResetConfirmOpen(false);
            setResetToken('');
            return job;
          })
        }
      />
    </>
  );
};

export const WasteManagementPage = () => {
  const pt = usePluginTranslation('wasteManagement');
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false });
  const search = normalizeWasteManagementSearchParams(rawSearch as Record<string, unknown>);
  const activeTabKey = tabTranslationKeyMap[search.tab];

  return (
    <StudioOverviewPageTemplate
      title={pt('page.title')}
      description={pt('page.description')}
      primaryAction={
        <Button type="button" variant="outline" onClick={() => updateSearch(navigate, search, { tab: 'settings' })}>
          {pt('actions.openSettings')}
        </Button>
      }
      toolbar={
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Input
            aria-label={pt('filters.searchLabel')}
            value={search.q}
            onChange={(event) => updateSearch(navigate, search, { q: event.target.value })}
            placeholder={pt('filters.searchPlaceholder')}
          />
          <Select
            aria-label={pt('filters.statusLabel')}
            value={search.status}
            onChange={(event) =>
              updateSearch(navigate, search, {
                status: event.target.value as WasteManagementSearchParams['status'],
              })
            }
          >
            <option value="all">{pt('filters.status.all')}</option>
            <option value="active">{pt('filters.status.active')}</option>
            <option value="inactive">{pt('filters.status.inactive')}</option>
          </Select>
          <Select
            aria-label={pt('filters.shiftContextLabel')}
            value={search.shiftContext}
            onChange={(event) =>
              updateSearch(navigate, search, {
                shiftContext: event.target.value as WasteManagementSearchParams['shiftContext'],
              })
            }
          >
            <option value="all">{pt('filters.shiftContext.all')}</option>
            <option value="global">{pt('filters.shiftContext.global')}</option>
            <option value="tour">{pt('filters.shiftContext.tour')}</option>
          </Select>
        </div>
      }
    >
      <div className="space-y-4">
        <Alert>
          <AlertTitle>{pt(`tabs.${activeTabKey}.title`)}</AlertTitle>
          <AlertDescription>{pt(`tabs.${activeTabKey}.body`)}</AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Badge>{pt(`tabs.${activeTabKey}.title`)}</Badge>
          <Badge variant="outline">{pt('meta.page', { page: search.page })}</Badge>
          <Badge variant="outline">{pt('meta.pageSize', { pageSize: search.pageSize })}</Badge>
          {search.q ? <Badge variant="secondary">{pt('meta.search', { value: search.q })}</Badge> : null}
        </div>

        <Tabs
          value={search.tab}
          onValueChange={(value) => updateSearch(navigate, search, { tab: value as WasteManagementTabId })}
          className="space-y-4"
        >
          <TabsList aria-label={pt('tabs.ariaLabel')}>
            {wasteManagementTabIds.map((tabId) => {
              const tabKey = tabTranslationKeyMap[tabId];
              return (
                <TabsTrigger key={tabId} value={tabId}>
                  {pt(`tabs.${tabKey}.title`)}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {wasteManagementTabIds.map((tabId) => {
            const tabKey = tabTranslationKeyMap[tabId];
            return (
              <TabsContent key={tabId} value={tabId}>
                {tabId === 'overview' ? (
                  <WasteOverviewPanel search={search} />
                ) : tabId === 'master-data' ? (
                  <WasteMasterDataPanel search={search} />
                ) : tabId === 'tours' ? (
                  <WasteToursPanel search={search} />
                ) : tabId === 'scheduling' ? (
                  <WasteSchedulingPanel search={search} />
                ) : tabId === 'settings' ? (
                  <WasteSettingsPanel />
                ) : tabId === 'tools' ? (
                  <WasteToolsPanel />
                ) : (
                  <StudioEmptyState>
                    <div className="space-y-2 text-left">
                      <p className="font-medium">{pt(`tabs.${tabKey}.emptyTitle`)}</p>
                      <p>{pt(`tabs.${tabKey}.emptyBody`)}</p>
                    </div>
                  </StudioEmptyState>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </StudioOverviewPageTemplate>
  );
};
