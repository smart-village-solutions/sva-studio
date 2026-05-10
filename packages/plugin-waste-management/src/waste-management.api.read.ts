import { wasteManagementImportCatalog, type WasteManagementImportProfileCatalogEntry, type WasteManagementHistoryOverview, type WasteManagementSettingsRecord } from '@sva/core';

import type {
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
  WasteManagementToursOverview,
} from './waste-management.api.types.js';
import { requestWasteManagementItem } from './waste-management.api.shared.js';

export const getWasteManagementImportCatalog =
  (): readonly WasteManagementImportProfileCatalogEntry[] => wasteManagementImportCatalog;

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

export const getWasteManagementToursOverview = async (): Promise<WasteManagementToursOverview> =>
  requestWasteManagementItem<WasteManagementToursOverview>({
    url: '/api/v1/waste-management/tours',
  });

export const getWasteManagementSchedulingOverview = async (): Promise<WasteManagementSchedulingOverview> =>
  requestWasteManagementItem<WasteManagementSchedulingOverview>({
    url: '/api/v1/waste-management/scheduling',
  });
