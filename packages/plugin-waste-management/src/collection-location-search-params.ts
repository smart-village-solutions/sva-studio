import type {
  WasteCollectionLocationSortDirection,
  WasteCollectionLocationSortMode,
} from '@sva/waste-management-contracts';
import { wasteCollectionLocationSortModes } from '@sva/waste-management-contracts';
import {
  normalizeTourStatus,
  type WasteManagementTourStatusFilter,
} from './search-params.tour-status.js';

export type WasteCollectionLocationSearchParams = Readonly<{
  locationSortMode: WasteCollectionLocationSortMode;
  locationSortDirection: WasteCollectionLocationSortDirection;
  locationStreetId?: string;
  locationHouseNumberId?: string;
  locationYear?: number;
  locationTourStatus?: Exclude<WasteManagementTourStatusFilter, 'all'>;
}>;

export const normalizeCollectionLocationSearchParams = (
  search: Record<string, unknown>
): WasteCollectionLocationSearchParams => {
  const year =
    typeof search.locationYear === 'number' || typeof search.locationYear === 'string'
      ? Number(search.locationYear)
      : NaN;
  const status = normalizeTourStatus(search.locationTourStatus, undefined);
  return {
    ...(typeof search.locationStreetId === 'string' && search.locationStreetId.trim()
      ? { locationStreetId: search.locationStreetId.trim() }
      : {}),
    ...(typeof search.locationHouseNumberId === 'string' && search.locationHouseNumberId.trim()
      ? { locationHouseNumberId: search.locationHouseNumberId.trim() }
      : {}),
    locationSortMode: normalizeWasteCollectionLocationSortMode(search.locationSortMode),
    locationSortDirection: normalizeWasteCollectionLocationSortDirection(
      search.locationSortDirection
    ),
    ...(Number.isInteger(year) && year >= 2000 && year <= 2100 ? { locationYear: year } : {}),
    ...(status !== 'all' ? { locationTourStatus: status } : {}),
  };
};

const sortDirections = ['asc', 'desc'] as const;

export const normalizeWasteCollectionLocationSortMode = (
  value: unknown
): WasteCollectionLocationSortMode =>
  typeof value === 'string' &&
  wasteCollectionLocationSortModes.includes(value as WasteCollectionLocationSortMode)
    ? (value as WasteCollectionLocationSortMode)
    : 'address';

export const normalizeWasteCollectionLocationSortDirection = (
  value: unknown
): WasteCollectionLocationSortDirection =>
  typeof value === 'string' &&
  sortDirections.includes(value as WasteCollectionLocationSortDirection)
    ? (value as WasteCollectionLocationSortDirection)
    : 'asc';
