import type { FetchLike } from './http-client.js';
import {
  getHostMediaDelivery,
  replaceHostMediaReferences,
  type HostMediaReferenceSelection,
} from './media-picker-client.js';
import { uploadHostMediaFile } from './media-upload-client.js';
import {
  abandonHostMediaContentSaveOperation,
  commitHostMediaContentSaveOperation,
  createHostMediaContentSaveOperation,
  markHostMediaContentSaveOperationOutcomeUnknown,
  markHostMediaContentSaveOperationSavingContent,
  markHostMediaContentSaveOperationContentSaved,
  replaceHostMediaContentSaveOperationReferences,
} from './media-content-save-client.js';

export type ContentMediaSavePhase =
  'uploading' | 'saving_content' | 'linking_media' | 'cleanup' | 'outcome_unknown';

export const contentMediaSavePhaseMessageKey = (
  phase: ContentMediaSavePhase | null
): string | null => {
  switch (phase) {
    case 'uploading':
      return 'messages.mediaSaveUploading';
    case 'saving_content':
      return 'messages.mediaSaveContent';
    case 'linking_media':
      return 'messages.mediaSaveLinking';
    case 'cleanup':
      return 'messages.mediaSaveCleanup';
    case 'outcome_unknown':
      return 'messages.mediaSaveOutcomeUnknown';
    case null:
      return null;
  }
};

export class ContentMediaSaveError extends Error {
  public constructor(
    public readonly status: 'cleanup_pending' | 'outcome_unknown',
    public readonly operationId: string,
    cause?: unknown
  ) {
    super(`content_media_save_${status}`);
    this.name = 'ContentMediaSaveError';
    if (cause !== undefined) {
      Object.defineProperty(this, 'cause', {
        configurable: true,
        enumerable: false,
        value: cause,
      });
    }
  }
}

export type ContentMediaLocalDraft = Readonly<{
  draftId: string;
  file: File;
  role: string;
  sortOrder?: number;
}>;

export type ContentMediaDraftResolution = Readonly<{
  draftId: string;
  assetId: string;
  persistentUrl: string;
  role: string;
  sortOrder?: number;
}>;

export type ContentMediaReferenceSyncResult<TSaved> =
  | Readonly<{
      status: 'complete';
      saved: TSaved;
      resolutions?: readonly ContentMediaDraftResolution[];
    }>
  | Readonly<{
      status: 'reference_failed';
      saved: TSaved;
      resolutions?: readonly ContentMediaDraftResolution[];
      retryReferenceSync: () => Promise<void>;
    }>;

type ContentMediaSaveInput<TSaved> = Readonly<{
  readonly fetch: FetchLike;
  readonly saveContent: (
    drafts: readonly ContentMediaDraftResolution[],
    context?: Readonly<{ operationId: string }>
  ) => Promise<TSaved>;
  readonly getTargetId: (saved: TSaved) => string;
  readonly targetType: string;
  readonly references: readonly HostMediaReferenceSelection[];
  readonly drafts?: readonly ContentMediaLocalDraft[];
  readonly instanceId?: string;
  readonly onPhaseChange?: (phase: ContentMediaSavePhase) => void;
}>;

const saveWithoutLocalDrafts = async <TSaved>(
  input: ContentMediaSaveInput<TSaved>
): Promise<ContentMediaReferenceSyncResult<TSaved>> => {
  const saved = await input.saveContent([]);
  const sync = () => replaceHostMediaReferences({
    fetch: input.fetch,
    targetType: input.targetType,
    targetId: input.getTargetId(saved),
    references: input.references,
    instanceId: input.instanceId,
  }).then(() => undefined);
  try {
    await sync();
    return { status: 'complete', saved, resolutions: [] };
  } catch {
    return { status: 'reference_failed', saved, resolutions: [], retryReferenceSync: sync };
  }
};

const prepareLocalMediaDrafts = async <TSaved>(
  input: ContentMediaSaveInput<TSaved>,
  operationId: string
): Promise<readonly ContentMediaDraftResolution[]> => {
  input.onPhaseChange?.('uploading');
  const resolutions: ContentMediaDraftResolution[] = [];
  for (const draft of [...(input.drafts ?? [])].sort(
    (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
  )) {
    const uploaded = await uploadHostMediaFile({
      fetch: input.fetch,
      file: draft.file,
      visibility: 'public',
      mediaType: 'image',
      instanceId: input.instanceId,
      uploadContext: 'content-save',
      contentSaveOperationId: operationId,
      draftId: draft.draftId,
    });
    const delivery = await getHostMediaDelivery({
      fetch: input.fetch,
      assetId: uploaded.assetId,
      instanceId: input.instanceId,
    });
    resolutions.push({
      draftId: draft.draftId,
      assetId: uploaded.assetId,
      persistentUrl: delivery.deliveryUrl,
      role: draft.role,
      sortOrder: draft.sortOrder,
    });
  }
  await replaceHostMediaContentSaveOperationReferences({
    fetch: input.fetch,
    operationId,
    instanceId: input.instanceId,
    references: [
      ...input.references,
      ...resolutions.map(({ assetId, role, sortOrder }) => ({ assetId, role, sortOrder })),
    ],
  });
  return resolutions;
};

const handleLocalMediaSaveFailure = async <TSaved>(input: ContentMediaSaveInput<TSaved>, context: {
  readonly operationId: string;
  readonly contentSaveStarted: boolean;
  readonly error: unknown;
}): Promise<never> => {
  const httpStatus = typeof context.error === 'object' && context.error !== null && 'httpStatus' in context.error
    ? Number((context.error as { readonly httpStatus?: unknown }).httpStatus)
    : Number.NaN;
  const safelyRejected = Number.isFinite(httpStatus) && httpStatus >= 400 && httpStatus < 500;
  if (!context.contentSaveStarted || safelyRejected) {
    input.onPhaseChange?.('cleanup');
    const abandoned = await abandonHostMediaContentSaveOperation({
      fetch: input.fetch,
      operationId: context.operationId,
      instanceId: input.instanceId,
      errorCode: Number.isFinite(httpStatus) ? `content_save_http_${httpStatus}` : 'content_save_preflight_failed',
    }).then(() => true, () => false);
    if (!abandoned) throw new ContentMediaSaveError('cleanup_pending', context.operationId, context.error);
    throw context.error;
  }

  input.onPhaseChange?.('outcome_unknown');
  await markHostMediaContentSaveOperationOutcomeUnknown({
    fetch: input.fetch,
    operationId: context.operationId,
    instanceId: input.instanceId,
    errorCode: 'content_save_outcome_unknown',
  }).catch(() => undefined);
  throw new ContentMediaSaveError('outcome_unknown', context.operationId, context.error);
};

const saveWithLocalDrafts = async <TSaved>(
  input: ContentMediaSaveInput<TSaved>
): Promise<ContentMediaReferenceSyncResult<TSaved>> => {
  const operation = await createHostMediaContentSaveOperation({
    fetch: input.fetch,
    operationId: globalThis.crypto.randomUUID(),
    targetType: input.targetType,
    instanceId: input.instanceId,
  });
  let contentSaveStarted = false;
  let saved: TSaved;
  let resolutions: readonly ContentMediaDraftResolution[];
  try {
    resolutions = await prepareLocalMediaDrafts(input, operation.id);
    await markHostMediaContentSaveOperationSavingContent({
      fetch: input.fetch,
      operationId: operation.id,
      instanceId: input.instanceId,
    });
    contentSaveStarted = true;
    input.onPhaseChange?.('saving_content');
    saved = await input.saveContent(resolutions, { operationId: operation.id });
  } catch (error) {
    return handleLocalMediaSaveFailure(input, { operationId: operation.id, contentSaveStarted, error });
  }
  const targetId = input.getTargetId(saved);
  const sync = async () => {
    input.onPhaseChange?.('linking_media');
    await markHostMediaContentSaveOperationContentSaved({
      fetch: input.fetch,
      operationId: operation.id,
      targetId,
      instanceId: input.instanceId,
    });
    await commitHostMediaContentSaveOperation({
      fetch: input.fetch,
      operationId: operation.id,
      instanceId: input.instanceId,
    });
  };

  try {
    await sync();
    return { status: 'complete', saved, resolutions };
  } catch {
    return { status: 'reference_failed', saved, resolutions, retryReferenceSync: sync };
  }
};

export const saveContentWithHostMediaReferences = async <TSaved>(
  input: ContentMediaSaveInput<TSaved>
): Promise<ContentMediaReferenceSyncResult<TSaved>> =>
  input.drafts?.length ? saveWithLocalDrafts(input) : saveWithoutLocalDrafts(input);

export type ContentMediaReferenceAlignment = Readonly<{
  assetId?: string;
  status: 'synced' | 'missing' | 'additional' | 'unresolved';
}>;

export const alignHostMediaReferencesByOrder = (input: {
  readonly itemCount: number;
  readonly role: string;
  readonly references: readonly HostMediaReferenceSelection[];
}): readonly ContentMediaReferenceAlignment[] => {
  const relevant = input.references.filter((reference) => reference.role === input.role);
  const byOrder = new Map(
    relevant.map((reference, index) => [reference.sortOrder ?? index, reference])
  );
  const alignments = Array.from({ length: input.itemCount }, (_, index) => {
    const reference = byOrder.get(index);
    return reference
      ? { assetId: reference.assetId, status: 'synced' as const }
      : { status: 'missing' as const };
  });
  const additional = relevant
    .filter((reference, index) => (reference.sortOrder ?? index) >= input.itemCount)
    .map((reference) => ({ assetId: reference.assetId, status: 'additional' as const }));
  return [...alignments, ...additional];
};
