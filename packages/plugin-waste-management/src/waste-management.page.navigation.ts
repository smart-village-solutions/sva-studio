import { useEffect, useState } from 'react';
import { readSessionAccessSnapshot, subscribeSessionAccessSnapshot } from '@sva/plugin-sdk';
import { useNavigate } from '@tanstack/react-router';
import {
  type WasteManagementMasterDataTabId,
  type WasteManagementSearchParams,
  type WasteManagementTabId,
} from './search-params.js';
import {
  getWasteManagementNavigationContext,
  type useWasteManagementUiAccess,
} from './waste-management.ui-access.js';

import {
  captureWasteManagementTabListState,
  toWasteManagementTabSearch,
  resetWasteManagementTabListState,
} from './waste-management.page.list-state.js';

const toMasterDataTab = (tab: WasteManagementTabId): WasteManagementMasterDataTabId | undefined => {
  if (tab === 'fractions' || tab === 'locations') {
    return tab;
  }

  if (tab === 'masterData') return 'locations';

  return undefined;
};
export const updateWasteManagementSearch = (
  navigate: ReturnType<typeof useNavigate>,
  currentSearch: WasteManagementSearchParams,
  patch: Partial<WasteManagementSearchParams>
) => {
  const nextTab = patch.tab ?? currentSearch.tab;
  const nextSearch = {
    ...currentSearch,
    ...patch,
    masterDataTab: patch.masterDataTab ?? toMasterDataTab(nextTab) ?? currentSearch.masterDataTab,
    page: patch.page ?? (patch.q !== undefined || patch.tab !== undefined ? 1 : currentSearch.page),
  };

  void navigate({
    to: '/plugins/waste-management',
    search: nextSearch,
  });
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

const getDiscardedLocation = (
  memory: TabNavigationMemory | undefined,
  contextKey: string | null
) =>
  memory?.contextKey && memory.contextKey !== contextKey
    ? memory.locationKey
    : memory?.discardedLocationKey;

const discardTabListState = (search: WasteManagementSearchParams): WasteManagementSearchParams => ({
  ...resetWasteManagementTabListState(search),
  ...(search.tab === 'locations'
    ? { locationsView: 'list' as const, collectionLocationId: undefined }
    : {}),
});

const rememberTab = (
  memory: TabNavigationMemory,
  contextKey: string,
  locationKey: string,
  search: WasteManagementSearchParams
) => {
  synchronizeContext(memory, contextKey);
  memory.locationKey = locationKey;
  memory.tabs.set(search.tab, captureWasteManagementTabListState(search));
  if (search.tab !== 'locations') return;
  memory.locationEditor =
    search.locationsView === 'edit' && search.collectionLocationId
      ? {
          locationsView: search.locationsView,
          collectionLocationId: search.collectionLocationId,
        }
      : undefined;
};

const changeWasteManagementTab = (
  navigate: ReturnType<typeof useNavigate>,
  tab: WasteManagementTabId,
  activeSearch: WasteManagementSearchParams,
  contextKey: string | null,
  locationKey: string
) => {
  if (tab === activeSearch.tab) return;
  const saved = contextKey ? getBrowserNavigation() : undefined;
  if (saved && contextKey) rememberTab(saved, contextKey, locationKey, activeSearch);
  void navigate({
    to: '/plugins/waste-management',
    search: toWasteManagementTabSearch(tab, {
      ...saved?.tabs.get(tab),
      ...(tab === 'locations' ? saved?.locationEditor : {}),
    }),
  });
};

export const useWasteManagementTabNavigation = (
  navigate: ReturnType<typeof useNavigate>,
  search: WasteManagementSearchParams,
  uiAccess: Pick<
    ReturnType<typeof useWasteManagementUiAccess>,
    'contextKey' | 'canRead' | 'isResolved'
  >,
  locationKey: string
) => {
  const contextKey = uiAccess.canRead || !uiAccess.isResolved ? uiAccess.contextKey : null;
  const memory = typeof window === 'undefined' ? undefined : browserNavigation;
  const discardCurrentListState =
    uiAccess.canRead && getDiscardedLocation(memory, contextKey) === locationKey;
  const activeSearch = discardCurrentListState ? discardTabListState(search) : search;

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

  return {
    search: activeSearch,
    changeTab: (tab: WasteManagementTabId) =>
      changeWasteManagementTab(
        navigate,
        tab,
        activeSearch,
        uiAccess.canRead ? contextKey : null,
        locationKey
      ),
  };
};

export const useWasteManagementTabsAccess = (
  uiAccess: ReturnType<typeof useWasteManagementUiAccess>
) => {
  const activeAccess = uiAccess.canRead ? uiAccess : null;
  const [confirmedAccess, setConfirmedAccess] = useState(activeAccess);
  if (
    activeAccess !== confirmedAccess &&
    (uiAccess.isResolved || uiAccess.contextKey !== confirmedAccess?.contextKey)
  ) {
    setConfirmedAccess(activeAccess);
  }

  const retainTabs =
    !uiAccess.isResolved &&
    uiAccess.contextKey !== null &&
    uiAccess.contextKey === confirmedAccess?.contextKey;
  const tabsAccess = activeAccess ?? (retainTabs ? confirmedAccess : null);

  return { activeAccess, tabsAccess };
};
