import type {
  WasteCollectionLocationPageSize,
  WasteCollectionLocationQuery,
  WasteCollectionLocationSelectionFilter,
} from '@sva/waste-management-contracts';
import { useStudioTableInvalidation, useStudioTableQuery } from '@sva/studio-ui-react';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

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
  streetId: search.locationStreetId,
  houseNumberId: search.locationHouseNumberId,
  tourId: search.tourId,
});

const toQuery = (search: WasteManagementSearchParams): WasteCollectionLocationQuery => ({
  ...toFilter(search),
  tourYear: search.locationYear,
  tourStatus: search.locationTourStatus,
  sortMode: search.locationSortMode,
  sortDirection: search.locationSortDirection,
  page: search.page,
  pageSize: search.pageSize as WasteCollectionLocationPageSize,
});

const isActiveLocationList = (search: WasteManagementSearchParams): boolean =>
  search.tab === 'locations' &&
  search.masterDataTab === 'locations' &&
  search.locationsView === 'list';

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
    search.locationStreetId,
    search.locationHouseNumberId,
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

const useCollectionLocationPageLoader = (
  state: WasteMasterDataState,
  pt: Translate,
  search: WasteManagementSearchParams
) => {
  const { setCollectionLocationListError, setCollectionLocationPage } = state;
  const query = toQuery(search);
  const invalidate = useStudioTableInvalidation();
  const list = useStudioTableQuery(
    ['waste', 'collection-locations', query],
    (signal) => getWasteCollectionLocationPage(query, signal),
    isActiveLocationList(search)
  );
  const error = list.error
    ? pt(
        resolveApiErrorCode(list.error) === 'forbidden'
          ? 'masterData.messages.loadForbidden'
          : 'masterData.messages.loadError'
      )
    : null;
  useLayoutEffect(() => {
    setCollectionLocationPage(list.data ?? null);
    setCollectionLocationListError(error);
  }, [error, list.data, setCollectionLocationListError, setCollectionLocationPage]);

  return useCallback(async () => {
    await invalidate(['waste', 'collection-locations'], false);
    await list.refresh(true);
  }, [invalidate, list.refresh]);
};

export const useWasteCollectionLocationList = (
  state: WasteMasterDataState,
  pt: Translate,
  search: WasteManagementSearchParams
) => {
  const loadList = useCollectionLocationPageLoader(state, pt, search);
  const { clearFilteredLocationIds, loadFilteredLocationIds } = useFilteredLocationIdsLoader(
    state,
    pt,
    search
  );

  useEffect(() => {
    clearFilteredLocationIds();
  }, [
    search.cityId,
    search.locationStreetId,
    search.locationHouseNumberId,
    search.locationsView,
    search.masterDataTab,
    search.q,
    search.regionId,
    search.status,
    search.tourId,
    clearFilteredLocationIds,
  ]);

  const refreshList = useCallback(async () => {
    clearFilteredLocationIds();
    await loadList();
  }, [clearFilteredLocationIds, loadList]);

  return { clearFilteredLocationIds, loadFilteredLocationIds, loadList, refreshList };
};
