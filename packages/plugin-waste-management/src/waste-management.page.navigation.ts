import { useEffect } from 'react';
import { readSessionAccessSnapshot, subscribeSessionAccessSnapshot } from '@sva/plugin-sdk';
import { useNavigate } from '@tanstack/react-router';
import {
  captureWasteManagementTabListState,
  resetWasteManagementTabListState,
  toWasteManagementTabSearch,
  type WasteManagementMasterDataTabId,
  type WasteManagementSearchParams,
  type WasteManagementTabId,
} from './search-params.js';
import { getWasteManagementNavigationContext, type useWasteManagementUiAccess } from './waste-management.ui-access.js';

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

type TabNavigationMemory = {
  contextKey: string | null;
  locationKey?: string;
  discardedLocationKey?: string;
  resettingLocationKey?: string;
  tabs: Map<WasteManagementTabId, Partial<WasteManagementSearchParams>>;
  locationEditor?: Pick<WasteManagementSearchParams, 'locationsView' | 'collectionLocationId'>;
};

// Route transitions remount plugin pages. This memory lives only in the current browser document.
let browserNavigation: TabNavigationMemory | undefined;

const synchronizeContext = (memory: TabNavigationMemory, contextKey: string | null) => {
  if (memory.contextKey === contextKey) return;
  if (memory.contextKey !== null) memory.discardedLocationKey = memory.locationKey;
  memory.contextKey = contextKey;
  memory.locationKey = undefined;
  memory.resettingLocationKey = undefined;
  memory.tabs.clear();
  memory.locationEditor = undefined;
};

const getBrowserNavigation = () => {
  if (typeof window === 'undefined') return undefined;

  if (!browserNavigation) {
    const memory: TabNavigationMemory = {
      contextKey: null,
      tabs: new Map(),
    };
    subscribeSessionAccessSnapshot(() =>
      synchronizeContext(memory, getWasteManagementNavigationContext(readSessionAccessSnapshot()))
    );
    browserNavigation = memory;
  }
  return browserNavigation;
};

export const useWasteManagementTabNavigation = (
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams,
  uiAccess: Pick<ReturnType<typeof useWasteManagementUiAccess>, 'contextKey' | 'canRead' | 'isResolved'>,
  locationKey: string
) => {
  const contextKey = uiAccess.canRead || !uiAccess.isResolved ? uiAccess.contextKey : null;
  const memory = typeof window === 'undefined' ? undefined : browserNavigation;
  const discardedLocationKey =
    memory?.contextKey && memory.contextKey !== contextKey
      ? memory.locationKey
      : memory?.discardedLocationKey;
  const discardCurrentListState = uiAccess.canRead && discardedLocationKey === locationKey;
  const activeSearch = discardCurrentListState
    ? {
        ...resetWasteManagementTabListState(search),
        ...(search.tab === 'locations'
          ? { locationsView: 'list' as const, collectionLocationId: undefined }
          : {}),
      }
    : search;

  useEffect(() => {
    if (!contextKey && !browserNavigation) return;
    const saved = getBrowserNavigation();
    if (!saved) return;
    synchronizeContext(saved, contextKey);
    if (contextKey && uiAccess.canRead) saved.locationKey = locationKey;
    if (discardCurrentListState && saved.resettingLocationKey !== locationKey) {
      saved.resettingLocationKey = locationKey;
      void navigate({ to: '/plugins/waste-management', search: activeSearch, replace: true });
    }
  }, [activeSearch, contextKey, discardCurrentListState, locationKey, navigate, uiAccess.canRead]);

  const changeTab = (tab: WasteManagementTabId) => {
    if (tab === activeSearch.tab) return;
    const saved = uiAccess.canRead && contextKey ? getBrowserNavigation() : undefined;
    if (saved && contextKey) {
      synchronizeContext(saved, contextKey);
      saved.locationKey = locationKey;
      saved.tabs.set(activeSearch.tab, captureWasteManagementTabListState(activeSearch));
      if (activeSearch.tab === 'locations') {
        saved.locationEditor =
          activeSearch.locationsView === 'edit' && activeSearch.collectionLocationId
            ? {
                locationsView: activeSearch.locationsView,
                collectionLocationId: activeSearch.collectionLocationId,
              }
            : undefined;
      }
    }
    void navigate({
      to: '/plugins/waste-management',
      search: toWasteManagementTabSearch(tab, {
        ...saved?.tabs.get(tab),
        ...(tab === 'locations' ? saved?.locationEditor : {}),
      }),
    });
  };
  return { search: activeSearch, changeTab };
};
