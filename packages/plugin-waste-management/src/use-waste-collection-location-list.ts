import type {
  WasteCollectionLocationPageSize,
  WasteCollectionLocationQuery,
  WasteCollectionLocationSelectionFilter,
} from '@sva/plugin-sdk';
import { useCallback, useEffect, useRef } from 'react';

import {
  getWasteCollectionLocationIds,
  getWasteCollectionLocationPage,
} from './waste-management.api.js';
import { resolveApiErrorCode } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';
import type { WasteMasterDataState } from './use-waste-master-data-state.js';

type Translate = (key: string, variables?: Readonly<Record<string, string | number>>) => string;

const toFilter = (search: WasteManagementSearchParams): WasteCollectionLocationSelectionFilter => ({
  q: search.q || undefined,
  status: search.status,
  regionId: search.regionId,
  cityId: search.cityId,
  tourId: search.tourId,
});

const toQuery = (search: WasteManagementSearchParams): WasteCollectionLocationQuery => ({
  ...toFilter(search),
  sortMode: search.locationSortMode,
  sortDirection: search.locationSortDirection,
  page: search.page,
  pageSize: search.pageSize as WasteCollectionLocationPageSize,
});

export const useWasteCollectionLocationList = (
  state: WasteMasterDataState,
  pt: Translate,
  search: WasteManagementSearchParams
) => {
  const requestSequence = useRef(0);
  const filteredIdsRequestSequence = useRef(0);
  const ptRef = useRef(pt);
  ptRef.current = pt;
  const {
    setCollectionLocationListError,
    setCollectionLocationPage,
    setFilteredLocationIds,
    setMessage,
  } = state;

  const loadList = useCallback(async () => {
    if (search.masterDataTab !== 'locations' || search.locationsView !== 'list') {
      requestSequence.current += 1;
      filteredIdsRequestSequence.current += 1;
      setCollectionLocationListError(null);
      return;
    }
    const sequence = ++requestSequence.current;
    filteredIdsRequestSequence.current += 1;
    setCollectionLocationPage(null);
    setFilteredLocationIds([]);
    try {
      const page = await getWasteCollectionLocationPage(toQuery(search));
      if (sequence !== requestSequence.current) return;
      setCollectionLocationPage(page);
      setCollectionLocationListError(null);
    } catch (loadError) {
      if (sequence !== requestSequence.current) return;
      const code = resolveApiErrorCode(loadError);
      setCollectionLocationListError(
        code === 'forbidden'
          ? ptRef.current('masterData.messages.loadForbidden')
          : ptRef.current('masterData.messages.loadError')
      );
    }
  }, [
    search.cityId,
    search.locationSortDirection,
    search.locationSortMode,
    search.locationsView,
    search.masterDataTab,
    search.page,
    search.pageSize,
    search.q,
    search.regionId,
    search.status,
    search.tourId,
    setCollectionLocationPage,
    setCollectionLocationListError,
    setFilteredLocationIds,
  ]);

  const loadFilteredLocationIds = useCallback(async (): Promise<readonly string[] | null> => {
    const sequence = ++filteredIdsRequestSequence.current;
    try {
      const filteredIds = await getWasteCollectionLocationIds(toFilter(search));
      if (sequence !== filteredIdsRequestSequence.current) return null;
      setFilteredLocationIds(filteredIds);
      return filteredIds;
    } catch (loadError) {
      if (sequence !== filteredIdsRequestSequence.current) return null;
      const code = resolveApiErrorCode(loadError);
      setMessage({
        kind: 'error',
        text:
          code === 'forbidden'
            ? ptRef.current('masterData.messages.loadForbidden')
            : ptRef.current('masterData.messages.loadError'),
      });
      return null;
    }
  }, [
    search.cityId,
    search.q,
    search.regionId,
    search.status,
    search.tourId,
    setFilteredLocationIds,
    setMessage,
  ]);

  const clearFilteredLocationIds = useCallback(() => {
    filteredIdsRequestSequence.current += 1;
    setFilteredLocationIds([]);
  }, [setFilteredLocationIds]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  return { clearFilteredLocationIds, loadFilteredLocationIds, loadList };
};
