export type SessionAccessSnapshot = Readonly<{
  isResolved: boolean;
  permissionActions: readonly string[];
  roles: readonly string[];
}>;

const emptySnapshot: SessionAccessSnapshot = {
  isResolved: false,
  permissionActions: [],
  roles: [],
};

let currentSnapshot: SessionAccessSnapshot = emptySnapshot;
const listeners = new Set<() => void>();

const arePermissionActionsEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

const areRolesEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

export const readSessionAccessSnapshot = (): SessionAccessSnapshot => currentSnapshot;

export const publishSessionAccessSnapshot = (snapshot: SessionAccessSnapshot): void => {
  if (
    currentSnapshot.isResolved === snapshot.isResolved &&
    arePermissionActionsEqual(currentSnapshot.permissionActions, snapshot.permissionActions) &&
    areRolesEqual(currentSnapshot.roles, snapshot.roles)
  ) {
    return;
  }

  currentSnapshot = {
    isResolved: snapshot.isResolved,
    permissionActions: [...snapshot.permissionActions],
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

export const resetSessionAccessSnapshot = (): void => {
  currentSnapshot = emptySnapshot;
  listeners.clear();
};
