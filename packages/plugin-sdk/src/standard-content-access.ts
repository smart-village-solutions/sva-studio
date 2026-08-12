import type { SessionAccessSnapshot } from './session-access.js';

export type StandardContentAccessCapabilities = Readonly<{
  isResolved: boolean;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}>;

export type StandardContentResourceAccess = Readonly<Record<string, boolean>>;

export type StandardContentLifecycleStatus = 'draft' | 'published' | 'archived';

export const resolveContentLifecycleAction = (
  currentStatus: StandardContentLifecycleStatus,
  nextStatus: StandardContentLifecycleStatus
):
  | 'content.archive'
  | 'content.changeStatus'
  | 'content.publish'
  | 'content.restore'
  | undefined => {
  if (currentStatus === nextStatus) return undefined;
  if (nextStatus === 'published') return 'content.publish';
  if (nextStatus === 'archived') return 'content.archive';
  return currentStatus === 'archived' ? 'content.restore' : 'content.changeStatus';
};

export const resolveContentVisibilityAction = (
  currentVisible: boolean,
  nextVisible: boolean
): 'content.changeStatus' | 'content.publish' | undefined =>
  currentVisible === nextVisible
    ? undefined
    : nextVisible
      ? 'content.publish'
      : 'content.changeStatus';

export const hasContentLifecycleAccess = (
  action:
    | ReturnType<typeof resolveContentLifecycleAction>
    | ReturnType<typeof resolveContentVisibilityAction>,
  resourceAccess: StandardContentResourceAccess
): boolean => action === undefined || resourceAccess[action] === true;

export const resolveStandardContentAccessCapabilities = (
  pluginId: string,
  snapshot: SessionAccessSnapshot,
  resourceAccess: StandardContentResourceAccess = {}
): StandardContentAccessCapabilities => {
  const hasAssignedModule = snapshot.assignedModules.includes(pluginId);
  const actions = new Set(snapshot.permissionActions);
  const unscopedActions = new Set(snapshot.unscopedPermissionActions ?? []);
  const allows = (action: string): boolean =>
    snapshot.isResolved && hasAssignedModule && actions.has(`${pluginId}.${action}`);
  const allowsMutation = (action: 'update' | 'delete'): boolean => {
    const actionId = `${pluginId}.${action}`;
    return allows(action) && (unscopedActions.has(actionId) || resourceAccess[actionId] === true);
  };
  return {
    isResolved: snapshot.isResolved,
    canRead: allows('read'),
    canCreate: allows('create'),
    canUpdate: allowsMutation('update'),
    canDelete: allowsMutation('delete'),
  };
};
