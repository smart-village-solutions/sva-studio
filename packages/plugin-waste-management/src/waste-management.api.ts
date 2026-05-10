import {
  wasteManagementImportCatalog,
} from '@sva/core';
import type {
  ApiItemResponse,
  StudioJobResponse,
  WasteCustomTourDate,
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteFractionRecord,
  WasteGlobalDateShiftRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteLocationTourLinkBulkCreateResult,
  WasteRegionRecord,
  WasteManagementSettingsRecord,
  WasteManagementAuditOverview,
  WasteManagementImportProfileCatalogEntry,
  WasteStreetRecord,
  WasteTourDateShiftRecord,
  WasteTourRecord,
  WasteTourRecurrence,
} from '@sva/core';
import { createMainserverJsonRequestHeaders, requestMainserverJson } from '@sva/plugin-sdk';

export class WasteManagementApiError extends Error {
  public constructor(
    public readonly code: string,
    message = code
  ) {
    super(message);
    this.name = 'WasteManagementApiError';
  }
}

export type WasteManagementSettingsInput = Readonly<{
  provider: 'supabase';
  projectUrl: string;
  schemaName?: string;
  enabled: boolean;
  databaseUrl?: string;
  serviceRoleKey?: string;
}>;

export type CreateWasteManagementFractionInput = Readonly<{
  id: string;
  name: string;
  containerSize?: string;
  color: string;
  description?: string;
  active: boolean;
}>;

export type UpdateWasteManagementFractionInput = Readonly<{
  name: string;
  containerSize?: string;
  color: string;
  description?: string;
  active: boolean;
}>;

export type CreateWasteManagementRegionInput = Readonly<{
  id: string;
  name: string;
}>;

export type UpdateWasteManagementRegionInput = Readonly<{
  name: string;
}>;

export type CreateWasteManagementCityInput = Readonly<{
  id: string;
  name: string;
  regionId?: string;
}>;

export type UpdateWasteManagementCityInput = Readonly<{
  name: string;
  regionId?: string;
}>;

export type CreateWasteManagementCollectionLocationInput = Readonly<{
  id: string;
  cityId: string;
  regionId?: string;
  streetId?: string;
  houseNumberId?: string;
  active: boolean;
}>;

export type UpdateWasteManagementCollectionLocationInput = Readonly<{
  cityId: string;
  regionId?: string;
  streetId?: string;
  houseNumberId?: string;
  active: boolean;
}>;

export type CreateWasteManagementLocationTourLinkInput = Readonly<{
  id: string;
  locationId: string;
  tourId: string;
  startDate?: string;
  endDate?: string;
}>;

export type UpdateWasteManagementLocationTourLinkInput = Readonly<{
  locationId: string;
  tourId: string;
  startDate?: string;
  endDate?: string;
}>;

export type CreateWasteManagementLocationTourLinksBulkInput = Readonly<{
  locationIds: readonly string[];
  tourId: string;
  startDate?: string;
  endDate?: string;
}>;

export type CreateWasteManagementTourInput = Readonly<{
  id: string;
  name: string;
  description?: string;
  wasteFractionIds: readonly string[];
  recurrence?: WasteTourRecurrence | null;
  firstDate?: string;
  endDate?: string;
  customDates?: readonly WasteCustomTourDate[];
  active: boolean;
}>;

export type UpdateWasteManagementTourInput = Readonly<{
  name: string;
  description?: string;
  wasteFractionIds: readonly string[];
  recurrence?: WasteTourRecurrence | null;
  firstDate?: string;
  endDate?: string;
  customDates?: readonly WasteCustomTourDate[];
  active: boolean;
}>;

export type CreateWasteManagementTourDateShiftInput = Readonly<{
  id: string;
  tourId: string;
  originalDate: string;
  actualDate: string;
  hasYear: boolean;
  description?: string;
}>;

export type UpdateWasteManagementTourDateShiftInput = Readonly<{
  tourId: string;
  originalDate: string;
  actualDate: string;
  hasYear: boolean;
  description?: string;
}>;

export type CreateWasteManagementGlobalDateShiftInput = Readonly<{
  id: string;
  originalDate: string;
  actualDate: string;
  hasYear: boolean;
  description?: string;
  tourIds?: readonly string[];
}>;

export type UpdateWasteManagementGlobalDateShiftInput = Readonly<{
  originalDate: string;
  actualDate: string;
  hasYear: boolean;
  description?: string;
  tourIds?: readonly string[];
}>;

export type StartWasteManagementMigrationsInput = Readonly<{
  targetSchema?: string;
  requestedByVersion?: string;
}>;

export type StartWasteManagementImportInput = Readonly<{
  importProfileId: string;
  blobRef: string;
  dryRun?: boolean;
}>;

export type StartWasteManagementSeedInput = Readonly<{
  seedKey?: 'baseline';
}>;

export type StartWasteManagementResetInput = Readonly<{
  confirmationToken: string;
}>;

export type WasteManagementMasterDataOverview = Readonly<{
  fractions: readonly WasteFractionRecord[];
  regions: readonly WasteRegionRecord[];
  cities: readonly WasteCityRecord[];
  streets: readonly WasteStreetRecord[];
  houseNumbers: readonly WasteHouseNumberRecord[];
  collectionLocations: readonly WasteCollectionLocationRecord[];
  locationTourLinks: readonly WasteLocationTourLinkRecord[];
}>;

export type WasteManagementToursOverview = Readonly<{
  tours: readonly WasteTourRecord[];
}>;

export type WasteManagementSchedulingOverview = Readonly<{
  tourDateShifts: readonly WasteTourDateShiftRecord[];
  globalDateShifts: readonly WasteGlobalDateShiftRecord[];
}>;

export type WasteManagementHistoryOverview = WasteManagementAuditOverview;

export const getWasteManagementImportCatalog =
  (): readonly WasteManagementImportProfileCatalogEntry[] => wasteManagementImportCatalog;

const createWasteManagementApiError = (code: string, message: string) => new WasteManagementApiError(code, message);

const createIdempotencyKey = () => crypto.randomUUID();

const requestWasteManagementItem = async <T>(input: {
  readonly url: string;
  readonly init?: RequestInit;
}): Promise<T> => {
  const response = await requestMainserverJson<ApiItemResponse<T>, WasteManagementApiError>({
    url: input.url,
    init: input.init,
    errorFactory: createWasteManagementApiError,
  });

  return response.data;
};

const requestWasteManagementJob = async (
  url: string,
  body: Readonly<Record<string, unknown>>
) => {
  const response = await requestWasteManagementItem<StudioJobResponse['data']>({
    url,
    init: {
      method: 'POST',
      headers: createMainserverJsonRequestHeaders({
        'Idempotency-Key': createIdempotencyKey(),
      }),
      body: JSON.stringify(body),
    },
  });

  return response;
};

export const getWasteManagementSettings = async (): Promise<WasteManagementSettingsRecord | null> =>
  requestWasteManagementItem<WasteManagementSettingsRecord | null>({
    url: '/api/v1/waste-management/settings',
  });

export const getWasteManagementHistoryOverview = async (input: {
  readonly q?: string;
  readonly page: number;
  readonly pageSize: number;
}): Promise<WasteManagementHistoryOverview> => {
  const url = new URL('/api/v1/waste-management/history', 'https://studio.invalid');
  url.searchParams.set('page', String(input.page));
  url.searchParams.set('pageSize', String(input.pageSize));
  if (input.q?.trim()) {
    url.searchParams.set('q', input.q.trim());
  }

  return requestWasteManagementItem<WasteManagementHistoryOverview>({
    url: `${url.pathname}${url.search}`,
  });
};

export const getWasteManagementMasterDataOverview = async (): Promise<WasteManagementMasterDataOverview> =>
  requestWasteManagementItem<WasteManagementMasterDataOverview>({
    url: '/api/v1/waste-management/master-data',
  });

export const createWasteManagementFraction = async (
  input: CreateWasteManagementFractionInput
): Promise<WasteFractionRecord> =>
  requestWasteManagementItem<WasteFractionRecord>({
    url: '/api/v1/waste-management/fractions',
    init: {
      method: 'POST',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const updateWasteManagementFraction = async (
  fractionId: string,
  input: UpdateWasteManagementFractionInput
): Promise<WasteFractionRecord> =>
  requestWasteManagementItem<WasteFractionRecord>({
    url: `/api/v1/waste-management/fractions/${encodeURIComponent(fractionId)}`,
    init: {
      method: 'PUT',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const createWasteManagementRegion = async (
  input: CreateWasteManagementRegionInput
): Promise<WasteRegionRecord> =>
  requestWasteManagementItem<WasteRegionRecord>({
    url: '/api/v1/waste-management/regions',
    init: {
      method: 'POST',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const updateWasteManagementRegion = async (
  regionId: string,
  input: UpdateWasteManagementRegionInput
): Promise<WasteRegionRecord> =>
  requestWasteManagementItem<WasteRegionRecord>({
    url: `/api/v1/waste-management/regions/${encodeURIComponent(regionId)}`,
    init: {
      method: 'PUT',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const createWasteManagementCity = async (
  input: CreateWasteManagementCityInput
): Promise<WasteCityRecord> =>
  requestWasteManagementItem<WasteCityRecord>({
    url: '/api/v1/waste-management/cities',
    init: {
      method: 'POST',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const updateWasteManagementCity = async (
  cityId: string,
  input: UpdateWasteManagementCityInput
): Promise<WasteCityRecord> =>
  requestWasteManagementItem<WasteCityRecord>({
    url: `/api/v1/waste-management/cities/${encodeURIComponent(cityId)}`,
    init: {
      method: 'PUT',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const createWasteManagementCollectionLocation = async (
  input: CreateWasteManagementCollectionLocationInput
): Promise<WasteCollectionLocationRecord> =>
  requestWasteManagementItem<WasteCollectionLocationRecord>({
    url: '/api/v1/waste-management/collection-locations',
    init: {
      method: 'POST',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const updateWasteManagementCollectionLocation = async (
  locationId: string,
  input: UpdateWasteManagementCollectionLocationInput
): Promise<WasteCollectionLocationRecord> =>
  requestWasteManagementItem<WasteCollectionLocationRecord>({
    url: `/api/v1/waste-management/collection-locations/${encodeURIComponent(locationId)}`,
    init: {
      method: 'PUT',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const createWasteManagementLocationTourLink = async (
  input: CreateWasteManagementLocationTourLinkInput
): Promise<WasteLocationTourLinkRecord> =>
  requestWasteManagementItem<WasteLocationTourLinkRecord>({
    url: '/api/v1/waste-management/location-tour-links',
    init: {
      method: 'POST',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const updateWasteManagementLocationTourLink = async (
  linkId: string,
  input: UpdateWasteManagementLocationTourLinkInput
): Promise<WasteLocationTourLinkRecord> =>
  requestWasteManagementItem<WasteLocationTourLinkRecord>({
    url: `/api/v1/waste-management/location-tour-links/${encodeURIComponent(linkId)}`,
    init: {
      method: 'PUT',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const createWasteManagementLocationTourLinksBulk = async (
  input: CreateWasteManagementLocationTourLinksBulkInput
): Promise<WasteLocationTourLinkBulkCreateResult> =>
  requestWasteManagementItem<WasteLocationTourLinkBulkCreateResult>({
    url: '/api/v1/waste-management/location-tour-links/bulk',
    init: {
      method: 'POST',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const getWasteManagementToursOverview = async (): Promise<WasteManagementToursOverview> =>
  requestWasteManagementItem<WasteManagementToursOverview>({
    url: '/api/v1/waste-management/tours',
  });

export const createWasteManagementTour = async (
  input: CreateWasteManagementTourInput
): Promise<WasteTourRecord> =>
  requestWasteManagementItem<WasteTourRecord>({
    url: '/api/v1/waste-management/tours',
    init: {
      method: 'POST',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const updateWasteManagementTour = async (
  tourId: string,
  input: UpdateWasteManagementTourInput
): Promise<WasteTourRecord> =>
  requestWasteManagementItem<WasteTourRecord>({
    url: `/api/v1/waste-management/tours/${encodeURIComponent(tourId)}`,
    init: {
      method: 'PUT',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const getWasteManagementSchedulingOverview = async (): Promise<WasteManagementSchedulingOverview> =>
  requestWasteManagementItem<WasteManagementSchedulingOverview>({
    url: '/api/v1/waste-management/scheduling',
  });

export const createWasteManagementTourDateShift = async (
  input: CreateWasteManagementTourDateShiftInput
): Promise<WasteTourDateShiftRecord> =>
  requestWasteManagementItem<WasteTourDateShiftRecord>({
    url: '/api/v1/waste-management/tour-date-shifts',
    init: {
      method: 'POST',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const updateWasteManagementTourDateShift = async (
  shiftId: string,
  input: UpdateWasteManagementTourDateShiftInput
): Promise<WasteTourDateShiftRecord> =>
  requestWasteManagementItem<WasteTourDateShiftRecord>({
    url: `/api/v1/waste-management/tour-date-shifts/${encodeURIComponent(shiftId)}`,
    init: {
      method: 'PUT',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const createWasteManagementGlobalDateShift = async (
  input: CreateWasteManagementGlobalDateShiftInput
): Promise<WasteGlobalDateShiftRecord> =>
  requestWasteManagementItem<WasteGlobalDateShiftRecord>({
    url: '/api/v1/waste-management/global-date-shifts',
    init: {
      method: 'POST',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const updateWasteManagementGlobalDateShift = async (
  shiftId: string,
  input: UpdateWasteManagementGlobalDateShiftInput
): Promise<WasteGlobalDateShiftRecord> =>
  requestWasteManagementItem<WasteGlobalDateShiftRecord>({
    url: `/api/v1/waste-management/global-date-shifts/${encodeURIComponent(shiftId)}`,
    init: {
      method: 'PUT',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const updateWasteManagementSettings = async (
  input: WasteManagementSettingsInput
): Promise<WasteManagementSettingsRecord | null> =>
  requestWasteManagementItem<WasteManagementSettingsRecord | null>({
    url: '/api/v1/waste-management/settings',
    init: {
      method: 'PUT',
      headers: createMainserverJsonRequestHeaders(),
      body: JSON.stringify(input),
    },
  });

export const startWasteManagementMigrations = async (
  input: StartWasteManagementMigrationsInput
) => requestWasteManagementJob('/api/v1/waste-management/tools/migrations', input);

export const startWasteManagementImport = async (
  input: StartWasteManagementImportInput
) => requestWasteManagementJob('/api/v1/waste-management/tools/imports', input);

export const startWasteManagementSeed = async (input: StartWasteManagementSeedInput = {}) =>
  requestWasteManagementJob('/api/v1/waste-management/tools/seed', {
    seedKey: input.seedKey ?? 'baseline',
  });

export const startWasteManagementReset = async (input: StartWasteManagementResetInput) =>
  requestWasteManagementJob('/api/v1/waste-management/tools/reset', input);
