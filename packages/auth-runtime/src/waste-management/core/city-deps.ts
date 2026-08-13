import type { WasteCityRecord } from '@sva/core';

export type WasteCityHandlerDeps = Readonly<{
  saveWasteCity?: (
    instanceId: string,
    input: Omit<WasteCityRecord, 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  patchWasteCity?: (
    instanceId: string,
    cityId: string,
    input: Readonly<{
      name?: string;
      postalCode?: string | null;
      regionId?: string | null;
    }>
  ) => Promise<void>;
  loadWasteCityById?: (instanceId: string, cityId: string) => Promise<WasteCityRecord | null>;
}>;
