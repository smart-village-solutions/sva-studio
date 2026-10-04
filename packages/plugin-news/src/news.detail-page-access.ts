import * as React from 'react';
import {
  hasContentLifecycleAccess,
  readSessionAccessSnapshot,
  resolveContentMediaCapabilities,
  resolveContentVisibilityAction,
  resolveStandardContentAccessCapabilities,
  subscribeSessionAccessSnapshot,
} from '@sva/plugin-sdk';
import type { NewsContentItem } from './news.types.js';

export const useNewsDetailAccess = (
  mode: 'create' | 'edit',
  loadedItem: NewsContentItem | null,
  resourceAccess: Readonly<Record<string, boolean>>,
  publicationMode: string
) => {
  const sessionAccess = React.useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot
  );
  const hasWasteTargetingAccess =
    sessionAccess.assignedModules.includes('waste-management') &&
    sessionAccess.permissionActions.includes('waste-management.read');
  const accessCapabilities = React.useMemo(
    () => resolveStandardContentAccessCapabilities('news', sessionAccess, resourceAccess),
    [resourceAccess, sessionAccess]
  );
  const canSave =
    mode === 'create'
      ? accessCapabilities.canCreate
      : accessCapabilities.canUpdate &&
        loadedItem !== null &&
        hasContentLifecycleAccess(
          resolveContentVisibilityAction(loadedItem.visible ?? true, publicationMode !== 'draft'),
          resourceAccess
        );
  const canSendPushNotification =
    sessionAccess.isResolved &&
    sessionAccess.assignedModules.includes('news') &&
    sessionAccess.permissionActions.includes('news.pushNotification') &&
    (mode === 'create' ||
      (sessionAccess.unscopedPermissionActions?.includes('news.pushNotification') ?? false) ||
      resourceAccess['news.pushNotification'] === true);
  const mediaCapabilities = React.useMemo(
    () =>
      resolveContentMediaCapabilities({
        canEditContent: canSave,
        permissionActions: sessionAccess.permissionActions,
      }),
    [canSave, sessionAccess.permissionActions]
  );
  const canSelectMedia = mediaCapabilities.canSelect;
  const canUploadMedia = mediaCapabilities.canUpload;
  const canUpdateMedia = mediaCapabilities.canEditAssetMetadata;
  return {
    hasWasteTargetingAccess,
    accessCapabilities,
    canSave,
    canSendPushNotification,
    canSelectMedia,
    canUploadMedia,
    canUpdateMedia,
  };
};
