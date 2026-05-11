import { useEffect, useState } from 'react';

import type { WasteManagementTabId } from './search-params.js';

const readOnlyTabIds = ['fractions', 'tours', 'locations', 'scheduling'] as const satisfies readonly WasteManagementTabId[];

type AuthMePayload = {
  readonly user?: {
    readonly permissionActions?: readonly unknown[];
  };
};

export type WasteManagementUiAccess = Readonly<{
  visibleTabIds: readonly WasteManagementTabId[];
  canAccessSettings: boolean;
  canAccessTools: boolean;
  canRunInitialize: boolean;
  canRunMigrations: boolean;
  canRunImport: boolean;
  canRunSeed: boolean;
  canRunReset: boolean;
}>;

const collectPermissionActions = (payload: unknown): readonly string[] => {
  const candidate = payload as AuthMePayload;
  return Array.isArray(candidate.user?.permissionActions)
    ? candidate.user.permissionActions.filter((entry): entry is string => typeof entry === 'string')
    : [];
};

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
  };
};

export const useWasteManagementUiAccess = (currentTab?: WasteManagementTabId) => {
  const [permissionActions, setPermissionActions] = useState<readonly string[]>([]);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    void fetch('/auth/me', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`auth_me_${response.status}`);
        }

        const payload = await response.json();
        if (!controller.signal.aborted) {
          setPermissionActions(collectPermissionActions(payload));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPermissionActions([]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsResolved(true);
        }
      });

    return () => {
      controller.abort();
    };
  }, []);

  return {
    isResolved,
    ...deriveWasteManagementUiAccess(permissionActions, isResolved ? undefined : currentTab),
  };
};
