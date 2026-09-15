import type { WasteTourStatus } from '@sva/plugin-sdk';

export type WasteManagementTourStatusFilter = 'all' | WasteTourStatus;

const wasteManagementTourStatusFilters = ['all', 'draft', 'published', 'archived'] as const;

export const normalizeTourStatus = (
  value: unknown,
  legacyStatus: unknown
): WasteManagementTourStatusFilter => {
  if (
    typeof value === 'string' &&
    wasteManagementTourStatusFilters.includes(value as WasteManagementTourStatusFilter)
  ) {
    return value as WasteManagementTourStatusFilter;
  }
  if (legacyStatus === 'active') return 'published';
  if (legacyStatus === 'inactive') return 'draft';
  return 'all';
};
