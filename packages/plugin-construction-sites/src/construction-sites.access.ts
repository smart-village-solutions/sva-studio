import { useSyncExternalStore } from 'react';
import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  resolveStandardContentAccessCapabilities,
} from '@sva/plugin-sdk';
export function useConstructionSiteAccess(resourceAccess: Readonly<Record<string, boolean>> = {}) {
  const session = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  return {
    ...resolveStandardContentAccessCapabilities('construction-sites', session, resourceAccess),
    session,
    permissionActions: session.permissionActions,
  };
}
