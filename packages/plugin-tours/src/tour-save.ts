import {
  createMainserverMutationHeaders,
  MainserverApiError,
  readMainserverMutationFailureOutcome,
  requestMainserverJson,
} from '@sva/plugin-sdk';
import {
  isMainserverPrincipalReady,
  useStudioEditorLeaveGuard,
  type MainserverPrincipalControlModel,
} from '@sva/studio-ui-react';
import { useRef, useState, type FormEvent } from 'react';

type SaveOptions<T> = {
  url: string;
  method: 'POST' | 'PATCH';
  principalControl?: MainserverPrincipalControlModel;
  contextBinding?: string;
  buildBody: (form: FormData) => unknown;
  onSaved: (data: T) => void | Promise<void>;
};

const mutationError = (error: unknown, method: SaveOptions<unknown>['method']) => {
  if (error instanceof MainserverApiError && error.code === 'tour_revision_conflict')
    return 'editConflict';
  if (readMainserverMutationFailureOutcome(error) === 'not_applied')
    return method === 'POST' ? 'inputInvalid' : 'editNotApplied';
  return 'saveError';
};
type SaveError = ReturnType<typeof mutationError> | 'coordinatesInvalid';

export function useTourSave<T>({
  url,
  method,
  principalControl,
  contextBinding,
  buildBody,
  onSaved,
}: SaveOptions<T>) {
  const principal = principalControl?.value ?? 'user';
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<SaveError>();
  const discarded = useRef(false);
  const inFlight = useRef(false);
  const pending = useRef<{ body: string; key: string; principal: typeof principal } | undefined>(
    undefined
  );
  const guard = useStudioEditorLeaveGuard({
    enabled: true,
    hasUnsavedChanges: dirty || busy,
    onDiscard: () => {
      discarded.current = true;
    },
  });
  const markChanged = () => {
    guard.markChanged();
    setDirty(true);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || !isMainserverPrincipalReady(principalControl, principal)) return;
    setError(undefined);
    let body: string | undefined;
    try {
      body = JSON.stringify(buildBody(new FormData(event.currentTarget)));
    } catch {
      setError('coordinatesInvalid');
      return;
    }
    if (!body) {
      guard.acknowledgeSaved(guard.captureRevision());
      setDirty(false);
      return;
    }
    if (
      pending.current &&
      (pending.current.body !== body || pending.current.principal !== principal)
    ) {
      setError('saveError');
      return;
    }
    pending.current ??= { body, key: crypto.randomUUID(), principal };
    const { key } = pending.current;
    const revision = guard.captureRevision();
    inFlight.current = true;
    discarded.current = false;
    setBusy(true);
    try {
      const headers = createMainserverMutationHeaders(principal, { 'Idempotency-Key': key }, key);
      if (contextBinding) headers.set('X-SVA-Context-Binding', contextBinding);
      const { data } = await requestMainserverJson<{ data: T }>({
        url,
        init: { method, headers, body },
      });
      if (!discarded.current && guard.acknowledgeSaved(revision)) {
        setDirty(false);
        await onSaved(data);
      }
    } catch (failure) {
      const outcome = mutationError(failure, method);
      if (outcome !== 'saveError') pending.current = undefined;
      setError(outcome);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return { principal, busy, dirty, error, submit, markChanged };
}
