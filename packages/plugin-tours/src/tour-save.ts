import { MainserverApiError, readMainserverMutationFailureOutcome } from '@sva/plugin-sdk';
import { ContentMediaSaveError } from '@sva/plugin-sdk/content-media';
import {
  isMainserverPrincipalReady,
  isPersistableManualContentMediaUrl,
  useStudioEditorLeaveGuard,
  type MainserverPrincipalControlModel,
  type MainserverPrincipalType,
} from '@sva/studio-ui-react';
import { useRef, useState, type FormEvent, type RefObject } from 'react';

import {
  executeTourSave,
  tourMediaDrafts,
  type TourRequestOptions,
  type TourSaveAttempt,
} from './tour-save-request.js';

type SaveOptions<T> = TourRequestOptions & {
  principalControl?: MainserverPrincipalControlModel;
  onSaved: (data: T) => void | Promise<void>;
};

const mutationError = (error: unknown, method: TourRequestOptions['method']) => {
  if (error instanceof MainserverApiError && error.code === 'tour_revision_conflict')
    return 'editConflict';
  if (readMainserverMutationFailureOutcome(error) === 'not_applied')
    return method === 'POST' ? 'inputInvalid' : 'editNotApplied';
  return 'saveError';
};
type SaveError =
  | ReturnType<typeof mutationError>
  | 'coordinatesInvalid'
  | 'audioUrlInvalid'
  | 'audioReferenceError';
type ReferenceRetry<T> = { saved: T; retry: () => Promise<void> };

const invalidAudio = (request: TourRequestOptions) =>
  request.media?.usages.some(
    (usage) =>
      !usage.localDraft &&
      usage.persistentUrl !== usage.additionalData?.initialUrl &&
      !isPersistableManualContentMediaUrl(usage.persistentUrl)
  );

const prepareTour = (
  form: FormData,
  request: TourRequestOptions,
  principal: MainserverPrincipalType,
  pending?: TourSaveAttempt
) => {
  if (invalidAudio(request)) return { error: 'audioUrlInvalid' as const };
  let body: string | undefined;
  try {
    body = JSON.stringify(request.buildBody(form, []));
  } catch {
    return { error: 'coordinatesInvalid' as const };
  }
  if (!body) return null;
  const drafts = tourMediaDrafts(request.media);
  const fingerprint = JSON.stringify([body, drafts.map(({ draftId }) => draftId)]);
  if (pending && (pending.fingerprint !== fingerprint || pending.principal !== principal))
    return { error: 'saveError' as const };
  const attempt = pending ?? { fingerprint, key: crypto.randomUUID(), principal };
  return { body, drafts, attempt };
};

type SaveContext<T> = {
  pending: RefObject<TourSaveAttempt | undefined>;
  referenceRetry: RefObject<ReferenceRetry<T> | undefined>;
  guard: ReturnType<typeof useStudioEditorLeaveGuard>;
  request: SaveOptions<T>;
  markBusy: (busy: boolean) => void;
  complete: (data: T, revision: number) => Promise<void>;
  onError: (error?: SaveError) => void;
  acknowledge: (revision: number) => boolean;
  principal: MainserverPrincipalType;
};

const retryReferences = async <T>(
  context: SaveContext<T>,
  referenceRetry: ReferenceRetry<T>,
  revision: number
) => {
  context.markBusy(true);
  try {
    await referenceRetry.retry();
    context.referenceRetry.current = undefined;
    await context.complete(referenceRetry.saved, revision);
    context.pending.current = undefined;
  } catch {
    context.onError('audioReferenceError');
  } finally {
    context.markBusy(false);
  }
};

const discardAttempt = (failure: unknown, outcome: SaveError, attempt: TourSaveAttempt) =>
  !attempt.body ||
  outcome !== 'saveError' ||
  (failure instanceof ContentMediaSaveError && failure.status === 'cleanup_pending');

const submitTour = async <T extends { id: string }>(
  context: SaveContext<T>,
  event: FormEvent<HTMLFormElement>
) => {
  const { guard, pending, request, markBusy } = context;
  context.onError(undefined);
  const revision = guard.captureRevision();
  if (context.referenceRetry.current)
    return retryReferences(context, context.referenceRetry.current, revision);
  const form = new FormData(event.currentTarget);
  const prepared = prepareTour(form, request, context.principal, pending.current);
  if (!prepared) {
    context.acknowledge(revision);
    return;
  }
  if (prepared.error) {
    context.onError(prepared.error);
    return;
  }
  const { attempt, body, drafts } = prepared;
  pending.current = attempt;
  markBusy(true);
  try {
    const result = await executeTourSave<T>(request, attempt, form, body, drafts);
    if (result.status === 'reference_failed') {
      context.referenceRetry.current = { saved: result.saved, retry: result.retryReferenceSync };
      context.onError('audioReferenceError');
      return;
    }
    await context.complete(result.saved, revision);
    pending.current = undefined;
  } catch (failure) {
    const outcome = mutationError(failure, request.method);
    if (discardAttempt(failure, outcome, attempt)) pending.current = undefined;
    context.onError(outcome);
  } finally {
    markBusy(false);
  }
};

export function useTourSave<T extends { id: string }>(request: SaveOptions<T>) {
  const principal = request.principalControl?.value ?? 'user';
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<SaveError>();
  const discarded = useRef(false);
  const inFlight = useRef(false);
  const pending = useRef<TourSaveAttempt | undefined>(undefined);
  const referenceRetry = useRef<ReferenceRetry<T> | undefined>(undefined);
  const guard = useStudioEditorLeaveGuard({
    enabled: true,
    hasUnsavedChanges: dirty || busy,
    onDiscard: () => {
      discarded.current = true;
    },
  });
  const markBusy = (value: boolean) => {
    inFlight.current = value;
    setBusy(value);
  };
  const acknowledge = (revision: number) => {
    if (discarded.current || !guard.acknowledgeSaved(revision)) return false;
    setDirty(false);
    return true;
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || !isMainserverPrincipalReady(request.principalControl, principal))
      return;
    discarded.current = false;
    void submitTour(
      {
        pending,
        referenceRetry,
        guard,
        request,
        markBusy,
        principal,
        acknowledge,
        onError: setError,
        complete: async (data, revision) => {
          if (acknowledge(revision)) await request.onSaved(data);
        },
      },
      event
    );
  };
  const markChanged = () => {
    guard.markChanged();
    setDirty(true);
  };
  return {
    principal,
    busy,
    dirty,
    error,
    submit,
    markChanged,
    referenceSyncPending: !!referenceRetry.current,
  };
}
