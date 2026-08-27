import {
  wasteManagementImportCatalog,
  type WasteCollectionLocationPage,
  type WasteCollectionLocationQuery,
  type WasteCollectionLocationSelectionFilter,
  type WasteManagementImportProfileCatalogEntry,
  type WasteManagementHistoryOverview,
  type WasteMainserverSyncStatusRecord,
  type WasteManagementSettingsRecord,
} from '@sva/plugin-sdk';

import type {
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
  WasteManagementToursOverview,
} from './waste-management.api.types.js';
import { requestWasteManagementItem } from './waste-management.api.shared.js';

const inFlightWasteReadRequests = new Map<string, Promise<unknown>>();

const requestWasteManagementRead = <T>(key: string, load: () => Promise<T>): Promise<T> => {
  const inFlightRequest = inFlightWasteReadRequests.get(key) as Promise<T> | undefined;
  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = load().finally(() => {
    if (inFlightWasteReadRequests.get(key) === request) {
      inFlightWasteReadRequests.delete(key);
    }
  });

  inFlightWasteReadRequests.set(key, request);
  return request;
};

export const getWasteManagementImportCatalog =
  (): readonly WasteManagementImportProfileCatalogEntry[] => wasteManagementImportCatalog;

export const getWasteManagementSettings = async (): Promise<WasteManagementSettingsRecord | null> =>
  requestWasteManagementRead('settings', async () =>
    requestWasteManagementItem<WasteManagementSettingsRecord | null>({
      url: '/api/v1/waste-management/settings',
    })
  );

export const getWasteMainserverSyncStatus = async (): Promise<WasteMainserverSyncStatusRecord> =>
  requestWasteManagementRead('mainserver-sync-status', async () =>
    requestWasteManagementItem<WasteMainserverSyncStatusRecord>({
      url: '/api/v1/waste-management/mainserver-sync-status',
    })
  );

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

  return requestWasteManagementRead(`history:${url.search}`, async () =>
    requestWasteManagementItem<WasteManagementHistoryOverview>({
      url: `${url.pathname}${url.search}`,
    })
  );
};

export const getWasteManagementMasterDataOverview = async (input?: {
  readonly scope?: 'fractions' | 'locations';
}): Promise<WasteManagementMasterDataOverview> => {
  const url = new URL('/api/v1/waste-management/master-data', 'https://studio.invalid');
  if (input?.scope) {
    url.searchParams.set('scope', input.scope);
  }

  return requestWasteManagementRead(`master-data:${url.search}`, async () =>
    requestWasteManagementItem<WasteManagementMasterDataOverview>({
      url: `${url.pathname}${url.search}`,
    })
  );
};

const appendCollectionLocationFilters = (
  params: URLSearchParams,
  filter: WasteCollectionLocationSelectionFilter
): void => {
  if (filter.q?.trim()) params.set('q', filter.q.trim());
  params.set('status', filter.status);
  if (filter.regionId) params.set('regionId', filter.regionId);
  if (filter.cityId) params.set('cityId', filter.cityId);
  if (filter.tourId) params.set('tourId', filter.tourId);
};

export const getWasteCollectionLocationPage = async (
  query: WasteCollectionLocationQuery
): Promise<WasteCollectionLocationPage> => {
  const url = new URL('/api/v1/waste-management/collection-locations', 'https://studio.invalid');
  appendCollectionLocationFilters(url.searchParams, query);
  url.searchParams.set('sortMode', query.sortMode);
  url.searchParams.set('sortDirection', query.sortDirection);
  url.searchParams.set('page', String(query.page));
  url.searchParams.set('pageSize', String(query.pageSize));
  return requestWasteManagementRead(`collection-locations:${url.search}`, async () =>
    requestWasteManagementItem<WasteCollectionLocationPage>({
      url: `${url.pathname}${url.search}`,
    })
  );
};

export const getWasteCollectionLocationIds = async (
  filter: WasteCollectionLocationSelectionFilter
): Promise<readonly string[]> => {
  const url = new URL(
    '/api/v1/waste-management/collection-locations/selection',
    'https://studio.invalid'
  );
  appendCollectionLocationFilters(url.searchParams, filter);
  const response = await requestWasteManagementRead(
    `collection-location-ids:${url.search}`,
    async () =>
      requestWasteManagementItem<Readonly<{ ids: readonly string[] }>>({
        url: `${url.pathname}${url.search}`,
      })
  );
  return response.ids;
};

export const getWasteManagementToursOverview = async (): Promise<WasteManagementToursOverview> =>
  requestWasteManagementRead('tours', async () =>
    requestWasteManagementItem<WasteManagementToursOverview>({
      url: '/api/v1/waste-management/tours',
    })
  );

export const getWasteManagementSchedulingOverview =
  async (): Promise<WasteManagementSchedulingOverview> =>
    requestWasteManagementRead('scheduling', async () =>
      requestWasteManagementItem<WasteManagementSchedulingOverview>({
        url: '/api/v1/waste-management/scheduling',
      })
    );
