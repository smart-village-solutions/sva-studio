import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import {
  captureWasteManagementTabListState,
  resetWasteManagementTabListState,
  toWasteManagementTabSearch,
  type WasteManagementMasterDataTabId,
  type WasteManagementSearchParams,
  type WasteManagementTabId,
} from './search-params.js';
import type { useWasteManagementUiAccess } from './waste-management.ui-access.js';

export const toMasterDataTab = (
  tab: WasteManagementTabId
): WasteManagementMasterDataTabId | undefined => {
  if (tab === 'fractions' || tab === 'locations') {
    return tab;
  }

  if (tab === 'masterData') return 'locations';

  return undefined;
};
export const useWasteManagementVisibleTabRedirect = (
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams,
  uiAccess: ReturnType<typeof useWasteManagementUiAccess>
) => {
  useEffect(() => {
    if (!uiAccess.canRead || uiAccess.visibleTabIds.includes(search.tab)) {
      return;
    }

    const fallbackTab = uiAccess.visibleTabIds[0];
    if (!fallbackTab) {
      return;
    }

    void navigate({
      to: '/plugins/waste-management',
      search: toWasteManagementTabSearch(fallbackTab),
      replace: true,
    });
  }, [navigate, search, uiAccess.canRead, uiAccess.visibleTabIds]);
};

export const useWasteManagementTabNavigation = (
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams,
  uiAccess: Pick<ReturnType<typeof useWasteManagementUiAccess>, 'contextKey' | 'canRead' | 'isResolved'>,
  locationKey: string
) => {
  const contextKey = uiAccess.canRead || !uiAccess.isResolved ? uiAccess.contextKey : null;
  const [lastRoute, setLastRoute] = useState({
    contextKey,
    locationKey,
    discardedLocationKey: undefined as string | undefined,
  });
  // A route already open when the context ends must not seed the next context's tab state.
  const discardedLocationKey =
    lastRoute.contextKey !== null && contextKey !== lastRoute.contextKey
      ? lastRoute.locationKey
      : lastRoute.discardedLocationKey;
  if (lastRoute.contextKey !== contextKey || lastRoute.locationKey !== locationKey) {
    setLastRoute({ contextKey, locationKey, discardedLocationKey });
  }

  const discardCurrentListState = uiAccess.canRead && discardedLocationKey === locationKey;
  const activeSearch = discardCurrentListState ? resetWasteManagementTabListState(search) : search;
  const resettingLocationKey = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!discardCurrentListState || resettingLocationKey.current === locationKey) return;
    resettingLocationKey.current = locationKey;
    void navigate({ to: '/plugins/waste-management', search: activeSearch, replace: true });
  }, [activeSearch, discardCurrentListState, locationKey, navigate]);

  const saved = useRef({
    contextKey,
    tabs: new Map<WasteManagementTabId, Partial<WasteManagementSearchParams>>(),
  });
  useEffect(() => {
    if (saved.current.contextKey !== contextKey) {
      saved.current.contextKey = contextKey;
      saved.current.tabs.clear();
    }
  }, [contextKey]);

  const changeTab = (tab: WasteManagementTabId) => {
    if (tab === activeSearch.tab) return;
    const activeTabs =
      uiAccess.canRead && contextKey !== null && saved.current.contextKey === contextKey
        ? saved.current.tabs
        : undefined;
    activeTabs?.set(activeSearch.tab, captureWasteManagementTabListState(activeSearch));
    void navigate({
      to: '/plugins/waste-management',
      search: toWasteManagementTabSearch(tab, activeTabs?.get(tab)),
    });
  };
  return { search: activeSearch, changeTab };
};
