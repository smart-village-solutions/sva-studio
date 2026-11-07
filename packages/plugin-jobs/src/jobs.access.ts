import type { JobRecord } from './contract.js';
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

export function canPublishJob(
  record: JobRecord | undefined,
  access: ReturnType<typeof useJobAccess>,
  resourceAccess: Readonly<Record<string, boolean>>
): boolean {
  const lifecycle = record
    ? record.visible
      ? 'content.changeStatus'
      : 'content.publish'
    : 'content.publish';
  return record
    ? access.session.unscopedPermissionActions.includes(lifecycle) ||
        resourceAccess[lifecycle] === true
    : access.permissionActions.includes(lifecycle);
}
