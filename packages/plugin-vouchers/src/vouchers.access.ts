import { useSyncExternalStore } from 'react';
import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  resolveStandardContentAccessCapabilities,
} from '@sva/plugin-sdk';
export const useVoucherAccess = (resourceAccess: Readonly<Record<string, boolean>> = {}) => {
  const session = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  return {
    ...resolveStandardContentAccessCapabilities('vouchers', session, resourceAccess),
    canPublish:
      session.permissionActions.includes('vouchers.publish') &&
      (session.unscopedPermissionActions?.includes('vouchers.publish') === true ||
        resourceAccess['vouchers.publish'] === true),
    permissionActions: session.permissionActions,
  };
};
