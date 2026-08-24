import type {
  WasteCollectionLocationPage,
  WasteCollectionLocationQuery,
  WasteCollectionLocationSelectionFilter,
} from '@sva/core';

export type WasteCollectionLocationReadHandlerDeps = {
  readonly loadWasteCollectionLocationPage?: (
    instanceId: string,
    query: WasteCollectionLocationQuery
  ) => Promise<WasteCollectionLocationPage>;
  readonly loadWasteCollectionLocationIds?: (
    instanceId: string,
    filter: WasteCollectionLocationSelectionFilter
  ) => Promise<readonly string[]>;
};
