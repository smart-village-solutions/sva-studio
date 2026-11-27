import {
  commitHostMediaContentSaveOperation,
  createMainserverMutationHeaders,
  markHostMediaContentSaveOperationContentSaved,
  requestMainserverJson,
  saveContentWithHostMediaReferences,
  type ContentMediaReferenceSyncResult,
} from '@sva/plugin-sdk';
import {
  contentMediaUsageToReference,
  contentMediaUsagesToLocalDrafts,
  type ContentMediaUsage,
  type MainserverPrincipalType,
  type resolveContentMediaUsageDrafts,
} from '@sva/studio-ui-react';

export type TourMediaResolutions = Parameters<typeof resolveContentMediaUsageDrafts>[1];
export type TourMediaSave = {
  usages: readonly ContentMediaUsage[];
  instanceId?: string;
  syncReferences: boolean;
};
export type TourRequestOptions = {
  url: string;
  method: 'POST' | 'PATCH';
  contextBinding?: string;
  media?: TourMediaSave;
  buildBody: (form: FormData, resolutions: TourMediaResolutions) => unknown;
};
export type TourSaveAttempt = {
  fingerprint: string;
  key: string;
  principal: MainserverPrincipalType;
  body?: string;
  mediaOperationId?: string;
};

const requestTour = async <T>(
  { url, method, contextBinding }: TourRequestOptions,
  attempt: TourSaveAttempt
) => {
  const headers = createMainserverMutationHeaders(
    attempt.principal,
    { 'Idempotency-Key': attempt.key },
    attempt.key
  );
  if (contextBinding) headers.set('X-SVA-Context-Binding', contextBinding);
  if (attempt.mediaOperationId)
    headers.set('X-SVA-Content-Media-Save-Operation-Id', attempt.mediaOperationId);
  const { data } = await requestMainserverJson<{ data: T }>({
    url,
    init: { method, headers, body: attempt.body },
  });
  return data;
};

const resumeMediaLinking = async <T extends { id: string }>(
  request: TourRequestOptions,
  attempt: TourSaveAttempt,
  operationId: string
): Promise<ContentMediaReferenceSyncResult<T>> => {
  const saved = await requestTour<T>(request, attempt);
  const retryReferenceSync = async () => {
    const input = {
      fetch: globalThis.fetch.bind(globalThis),
      instanceId: request.media?.instanceId,
      operationId,
    };
    await markHostMediaContentSaveOperationContentSaved({ ...input, targetId: saved.id });
    await commitHostMediaContentSaveOperation(input);
  };
  try {
    await retryReferenceSync();
    return { status: 'complete', saved };
  } catch {
    return { status: 'reference_failed', saved, retryReferenceSync };
  }
};

export const tourMediaDrafts = (media?: TourMediaSave) =>
  contentMediaUsagesToLocalDrafts(media?.usages ?? []);

export async function executeTourSave<T extends { id: string }>(
  request: TourRequestOptions,
  attempt: TourSaveAttempt,
  form: FormData,
  initialBody: string,
  drafts: ReturnType<typeof tourMediaDrafts>
): Promise<ContentMediaReferenceSyncResult<T>> {
  if (attempt.mediaOperationId)
    return resumeMediaLinking(request, attempt, attempt.mediaOperationId);

  const saveContent = async (
    resolutions: TourMediaResolutions,
    context?: { operationId: string }
  ) => {
    attempt.body ??= resolutions.length
      ? JSON.stringify(request.buildBody(form, resolutions))
      : initialBody;
    attempt.mediaOperationId = context?.operationId;
    return requestTour<T>(request, attempt);
  };
  const usages = request.media?.usages ?? [];
  const hasLinkedAudio = usages.some((usage) => usage.assetId);
  if (!drafts.length && !request.media?.syncReferences && !hasLinkedAudio)
    return { status: 'complete', saved: await saveContent([]) };

  return saveContentWithHostMediaReferences({
    fetch: globalThis.fetch.bind(globalThis),
    saveContent,
    getTargetId: (saved) => saved.id,
    targetType: 'tours.tour',
    instanceId: request.media?.instanceId,
    references: usages.flatMap((usage) => {
      const reference = contentMediaUsageToReference(usage);
      return reference ? [reference] : [];
    }),
    ...(hasLinkedAudio ? { requirePreparedReferences: true } : {}),
    drafts,
  });
}
