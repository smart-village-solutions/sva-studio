import { readSessionAccessSnapshot, subscribeSessionAccessSnapshot } from '@sva/plugin-sdk';
import { useSyncExternalStore } from 'react';

import type { WasteManagementTabId } from './search-params.js';

const readOnlyTabIds = ['fractions', 'tours', 'locations', 'scheduling', 'output'] as const satisfies readonly WasteManagementTabId[];

export type WasteManagementUiAccess = Readonly<{
  visibleTabIds: readonly WasteManagementTabId[];
  canAccessSettings: boolean;
  canAccessTools: boolean;
  canRunInitialize: boolean;
  canRunMigrations: boolean;
  canRunImport: boolean;
  canRunSeed: boolean;
  canRunReset: boolean;
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
  const canRunSeed = grantedPermissions.has('waste-management.seed.execute');
  const canRunReset = grantedPermissions.has('waste-management.reset.execute');
  const canAccessTools = canRunInitialize || canRunMigrations || canRunImport || canRunSeed || canRunReset;
  const visibleTabIds: WasteManagementTabId[] = [...readOnlyTabIds];

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
    canRunInitialize,
    canRunMigrations,
    canRunImport,
    canRunSeed,
    canRunReset,
    canDeleteHistoryEntries: false,
  };
};

export const useWasteManagementUiAccess = (currentTab?: WasteManagementTabId) => {
  const sessionAccess = useSyncExternalStore(subscribeSessionAccessSnapshot, readSessionAccessSnapshot, readSessionAccessSnapshot);
  const sessionRoles = (sessionAccess as { readonly roles?: readonly string[] }).roles ?? [];
  const canDeleteHistoryEntries = sessionRoles.some((role) => role.trim() === 'system_admin');

  return {
    ...deriveWasteManagementUiAccess(
      sessionAccess.permissionActions,
      sessionAccess.isResolved ? undefined : currentTab
    ),
    isResolved: sessionAccess.isResolved,
    canDeleteHistoryEntries,
  };
};
