/** Connects one editor's unsaved-change signal to its host-owned navigation guard. */
import * as React from 'react';

export type StudioEditorLeaveGuardRegister = (check: () => boolean) => () => void;

const EditorLeaveGuardContext = React.createContext<Readonly<{
  register: StudioEditorLeaveGuardRegister;
  suspended: boolean;
}> | null>(null);

/** Portals keep React context even when their DOM lives outside the editor. */
export const useStudioEditorSuspended = (): boolean =>
  React.useContext(EditorLeaveGuardContext)?.suspended ?? false;

export function StudioEditorLeaveGuardProvider({
  register,
  suspended = false,
  children,
}: Readonly<{
  register: StudioEditorLeaveGuardRegister;
  suspended?: boolean;
  children: React.ReactNode;
}>) {
  const value = React.useMemo(() => ({ register, suspended }), [register, suspended]);
  return (
    <EditorLeaveGuardContext.Provider value={value}>{children}</EditorLeaveGuardContext.Provider>
  );
}

/**
 * Report changes without exposing form values or routing to the shared UI.
 * After a confirmed complete save, call acknowledgeSaved with the revision captured
 * before saving. Only a matching acknowledgement permits resetting the editor's own
 * dirty baseline; later edits keep the guard active.
 */
export function useStudioEditorLeaveGuard({
  enabled,
  hasUnsavedChanges,
}: Readonly<{ enabled: boolean; hasUnsavedChanges: boolean }>) {
  const register = React.useContext(EditorLeaveGuardContext)?.register;
  const dirtyRef = React.useRef(hasUnsavedChanges);
  const revisionRef = React.useRef(0);
  const savedRevisionMismatchRef = React.useRef(false);
  React.useLayoutEffect(() => {
    dirtyRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);
  const check = React.useCallback(() => dirtyRef.current || savedRevisionMismatchRef.current, []);
  React.useLayoutEffect(() => {
    if (enabled && register) return register(check);
    return undefined;
  }, [enabled, register, check]);
  const markChanged = React.useCallback(() => {
    revisionRef.current += 1;
  }, []);
  const captureRevision = React.useCallback(() => revisionRef.current, []);
  const acknowledgeSaved = React.useCallback((savedRevision: number): boolean => {
    if (savedRevision !== revisionRef.current) {
      savedRevisionMismatchRef.current = true;
      return false;
    }
    savedRevisionMismatchRef.current = false;
    dirtyRef.current = false;
    return true;
  }, []);
  return React.useMemo(
    () => ({ markChanged, captureRevision, acknowledgeSaved }),
    [markChanged, captureRevision, acknowledgeSaved]
  );
}
