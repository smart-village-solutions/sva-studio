export type SessionAccessSnapshot = Readonly<{
  isResolved: boolean;
  permissionActions: readonly string[];
}>;

const emptySnapshot: SessionAccessSnapshot = {
  isResolved: false,
  permissionActions: [],
};

let currentSnapshot: SessionAccessSnapshot = emptySnapshot;
const listeners = new Set<() => void>();

const arePermissionActionsEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

export const readSessionAccessSnapshot = (): SessionAccessSnapshot => currentSnapshot;

export const publishSessionAccessSnapshot = (snapshot: SessionAccessSnapshot): void => {
  if (
    currentSnapshot.isResolved === snapshot.isResolved &&
    arePermissionActionsEqual(currentSnapshot.permissionActions, snapshot.permissionActions)
  ) {
    return;
  }

  currentSnapshot = {
    isResolved: snapshot.isResolved,
    permissionActions: [...snapshot.permissionActions],
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
