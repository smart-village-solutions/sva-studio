import type { FetchLike } from './http-client.js';
import {
  replaceHostMediaReferences,
  type HostMediaReferenceSelection,
} from './media-picker-client.js';

export type ContentMediaReferenceSyncResult<TSaved> =
  | Readonly<{ status: 'complete'; saved: TSaved }>
  | Readonly<{
      status: 'reference_failed';
      saved: TSaved;
      retryReferenceSync: () => Promise<void>;
    }>;

export const saveContentWithHostMediaReferences = async <TSaved>(input: {
  readonly fetch: FetchLike;
  readonly saveContent: () => Promise<TSaved>;
  readonly getTargetId: (saved: TSaved) => string;
  readonly targetType: string;
  readonly references: readonly HostMediaReferenceSelection[];
  readonly instanceId?: string;
}): Promise<ContentMediaReferenceSyncResult<TSaved>> => {
  const saved = await input.saveContent();
  const targetId = input.getTargetId(saved);
  const sync = () =>
    replaceHostMediaReferences({
      fetch: input.fetch,
      targetType: input.targetType,
      targetId,
      references: input.references,
      instanceId: input.instanceId,
    }).then(() => undefined);

  try {
    await sync();
    return { status: 'complete', saved };
  } catch {
    return { status: 'reference_failed', saved, retryReferenceSync: sync };
  }
};

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
  const byOrder = new Map(relevant.map((reference, index) => [reference.sortOrder ?? index, reference]));
  const alignments = Array.from({ length: input.itemCount }, (_, index) => {
    const reference = byOrder.get(index);
    return reference
      ? { assetId: reference.assetId, status: 'synced' as const }
      : { status: 'missing' as const };
  });
  if (relevant.some((reference, index) => (reference.sortOrder ?? index) >= input.itemCount)) {
    return alignments.map((alignment, index) =>
      index === alignments.length - 1 ? { ...alignment, status: 'additional' as const } : alignment
    );
  }
  return alignments;
};

