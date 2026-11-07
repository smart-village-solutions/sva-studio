import { useSyncExternalStore } from 'react';
import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
  resolveStandardContentAccessCapabilities,
} from '@sva/plugin-sdk';
export function useJobAccess(resourceAccess: Readonly<Record<string, boolean>> = {}) {
  const session = useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  return {
    ...resolveStandardContentAccessCapabilities('jobs', session, resourceAccess),
    session,
    permissionActions: session.permissionActions,
  };
}
