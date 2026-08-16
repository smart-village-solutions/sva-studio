import { readSessionAccessSnapshot, subscribeSessionAccessSnapshot } from '@sva/plugin-sdk';
import { useSyncExternalStore } from 'react';

import type { WasteManagementTabId } from './search-params.js';

const readOnlyTabIds = [
  'fractions',
  'tours',
  'locations',
  'scheduling',
] as const satisfies readonly WasteManagementTabId[];

export type WasteManagementUiAccess = Readonly<{
  visibleTabIds: readonly WasteManagementTabId[];
  canAccessSettings: boolean;
  canAccessTools: boolean;
  canDuplicateTour: boolean;
  canRunInitialize: boolean;
  canRunMigrations: boolean;
  canEnrichPostalCodes: boolean;
  canRunImport: boolean;
  canRunExport: boolean;
  canRunSeed: boolean;
  canRunReset: boolean;
  canRunMainserverSync: boolean;
  canDeleteHistoryEntries: boolean;
}>;

export const deriveWasteManagementUiAccess = (
  permissionActions: readonly string[],
  currentTab?: WasteManagementTabId
): WasteManagementUiAccess => {
  const grantedPermissions = new Set(permissionActions);
  const canAccessSettings = grantedPermissions.has('waste-management.settings.manage');
  const canRunInitialize = canAccessSettings;
  const canRunMigrations = canAccessSettings;
  const canRunImport = grantedPermissions.has('waste-management.import.execute');
  const canRunExport = grantedPermissions.has('waste-management.export.execute');
  const canRunSeed = grantedPermissions.has('waste-management.seed.execute');
  const canRunReset = grantedPermissions.has('waste-management.reset.execute');
  const canEnrichPostalCodes = grantedPermissions.has('waste-management.master-data.manage');
  const canManageTours = grantedPermissions.has('waste-management.tours.manage');
  const canManageScheduling = grantedPermissions.has('waste-management.scheduling.manage');
  const canAccessTools =
    canRunInitialize ||
      canRunMigrations ||
      canRunImport ||
    canRunExport ||
    canRunSeed ||
    canRunReset ||
    canEnrichPostalCodes ||
    canManageScheduling;
  const visibleTabIds: WasteManagementTabId[] = [...readOnlyTabIds];

  if (canAccessSettings) {
    visibleTabIds.push('output');
  }

  if (canAccessTools) {
    visibleTabIds.push('tools');
  }

  if (canAccessSettings) {
    visibleTabIds.push('settings');
  }

  if (currentTab && visibleTabIds.includes(currentTab) === false) {
    visibleTabIds.push(currentTab);
  }

  return {
    visibleTabIds,
    canAccessSettings,
    canAccessTools,
    canDuplicateTour: canManageTours && canManageScheduling,
    canRunInitialize,
    canRunMigrations,
    canEnrichPostalCodes,
    canRunImport,
    canRunExport,
    canRunSeed,
    canRunReset,
    canRunMainserverSync: canManageScheduling,
    canDeleteHistoryEntries: false,
  };
};

export const useWasteManagementUiAccess = (currentTab?: WasteManagementTabId) => {
  const sessionAccess = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );

  return {
    ...deriveWasteManagementUiAccess(
      sessionAccess.permissionActions,
      sessionAccess.isResolved ? undefined : currentTab
    ),
    isResolved: sessionAccess.isResolved,
  };
};
