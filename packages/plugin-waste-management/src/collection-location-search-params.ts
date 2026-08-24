import type {
  WasteCollectionLocationSortDirection,
  WasteCollectionLocationSortMode,
} from '@sva/plugin-sdk';

const sortModes = ['address', 'addressWithRegion'] as const;
const sortDirections = ['asc', 'desc'] as const;

export const normalizeWasteCollectionLocationSortMode = (
  value: unknown
): WasteCollectionLocationSortMode =>
  typeof value === 'string' && sortModes.includes(value as WasteCollectionLocationSortMode)
    ? (value as WasteCollectionLocationSortMode)
    : 'address';

export const normalizeWasteCollectionLocationSortDirection = (
  value: unknown
): WasteCollectionLocationSortDirection =>
  typeof value === 'string' &&
  sortDirections.includes(value as WasteCollectionLocationSortDirection)
    ? (value as WasteCollectionLocationSortDirection)
    : 'asc';
