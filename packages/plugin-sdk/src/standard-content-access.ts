import type { SessionAccessSnapshot } from './session-access.js';

export type StandardContentAccessCapabilities = Readonly<{
  isResolved: boolean;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}>;

export type StandardContentResourceAccess = Readonly<Record<string, boolean>>;

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
