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

const useFilteredLocationIdsLoader = (
  state: WasteMasterDataState,
  pt: Translate,
  search: WasteManagementSearchParams
) => {
  const requestSequence = useRef(0);
  const ptRef = useRef(pt);
  ptRef.current = pt;
  const { setFilteredLocationIds, setMessage } = state;

  const loadFilteredLocationIds = useCallback(async (): Promise<readonly string[] | null> => {
    const sequence = ++requestSequence.current;
    try {
      const filteredIds = await getWasteCollectionLocationIds(toFilter(search));
      if (sequence !== requestSequence.current) return null;
      setFilteredLocationIds(filteredIds);
      return filteredIds;
    } catch (loadError) {
      if (sequence !== requestSequence.current) return null;
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
    requestSequence.current += 1;
    setFilteredLocationIds([]);
  }, [setFilteredLocationIds]);

  return { clearFilteredLocationIds, loadFilteredLocationIds };
};

export const useWasteCollectionLocationList = (
  state: WasteMasterDataState,
  pt: Translate,
  search: WasteManagementSearchParams
) => {
  const requestSequence = useRef(0);
  const ptRef = useRef(pt);
  ptRef.current = pt;
  const { setCollectionLocationListError, setCollectionLocationPage } = state;
  const { clearFilteredLocationIds, loadFilteredLocationIds } = useFilteredLocationIdsLoader(
    state,
    pt,
    search
  );

  const loadList = useCallback(async () => {
    if (search.masterDataTab !== 'locations' || search.locationsView !== 'list') {
      requestSequence.current += 1;
      setCollectionLocationListError(null);
      return;
    }
    const sequence = ++requestSequence.current;
    setCollectionLocationPage(null);
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
  ]);

  useEffect(() => {
    clearFilteredLocationIds();
  }, [
    search.cityId,
    search.locationsView,
    search.masterDataTab,
    search.q,
    search.regionId,
    search.status,
    search.tourId,
    clearFilteredLocationIds,
  ]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  return { clearFilteredLocationIds, loadFilteredLocationIds, loadList };
};
