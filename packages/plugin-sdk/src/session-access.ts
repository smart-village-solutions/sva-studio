export type SessionAccessSnapshot = Readonly<{
  isResolved: boolean;
  hasError: boolean;
  subjectId?: string;
  instanceId?: string;
  organizationId?: string | null;
  permissionActions: readonly string[];
  unscopedPermissionActions: readonly string[];
  assignedModules: readonly string[];
  roles: readonly string[];
}>;

type PublishedSessionAccessSnapshot = Omit<
  SessionAccessSnapshot,
  'unscopedPermissionActions' | 'hasError'
> &
  Readonly<{
    unscopedPermissionActions?: readonly string[];
    hasError?: boolean;
    subjectId?: string;
    instanceId?: string;
    organizationId?: string | null;
  }>;

const emptySnapshot: SessionAccessSnapshot = {
  isResolved: false,
  hasError: false,
  permissionActions: [],
  unscopedPermissionActions: [],
  assignedModules: [],
  roles: [],
};

let currentSnapshot: SessionAccessSnapshot = emptySnapshot;
const listeners = new Set<() => void>();

const arePermissionActionsEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

const areRolesEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

export const readSessionAccessSnapshot = (): SessionAccessSnapshot => currentSnapshot;

export const publishSessionAccessSnapshot = (snapshot: PublishedSessionAccessSnapshot): void => {
  const unscopedPermissionActions = snapshot.unscopedPermissionActions ?? [];
  const hasError = snapshot.hasError ?? false;
  if (
    currentSnapshot.isResolved === snapshot.isResolved &&
    currentSnapshot.hasError === hasError &&
    currentSnapshot.subjectId === snapshot.subjectId &&
    currentSnapshot.instanceId === snapshot.instanceId &&
    currentSnapshot.organizationId === snapshot.organizationId &&
    arePermissionActionsEqual(currentSnapshot.permissionActions, snapshot.permissionActions) &&
    arePermissionActionsEqual(
      currentSnapshot.unscopedPermissionActions,
      unscopedPermissionActions
    ) &&
    arePermissionActionsEqual(currentSnapshot.assignedModules, snapshot.assignedModules) &&
    areRolesEqual(currentSnapshot.roles, snapshot.roles)
  ) {
    return;
  }

  currentSnapshot = {
    isResolved: snapshot.isResolved,
    hasError,
    ...(snapshot.subjectId ? { subjectId: snapshot.subjectId } : {}),
    ...(snapshot.instanceId ? { instanceId: snapshot.instanceId } : {}),
    ...(snapshot.organizationId !== undefined ? { organizationId: snapshot.organizationId } : {}),
    permissionActions: [...snapshot.permissionActions],
    unscopedPermissionActions: [...unscopedPermissionActions],
    assignedModules: [...snapshot.assignedModules],
    roles: [...snapshot.roles],
  };

  for (const listener of listeners) {
    listener();
  }
};

export const subscribeSessionAccessSnapshot = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const invalidateSessionAccessSnapshot = (): void => {
  if (!currentSnapshot.isResolved && currentSnapshot.permissionActions.length === 0) return;
  currentSnapshot = {
    ...currentSnapshot,
    isResolved: false,
    hasError: false,
    permissionActions: [],
    unscopedPermissionActions: [],
    assignedModules: [],
    roles: [],
  };
  for (const listener of listeners) {
    listener();
  }
};

export const resetSessionAccessSnapshot = (): void => {
  currentSnapshot = emptySnapshot;
  listeners.clear();
};
