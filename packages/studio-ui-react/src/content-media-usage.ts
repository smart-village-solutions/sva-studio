import { isPersistableMediaAssetUrl } from '@sva/core';

export type ContentMediaAssetSnapshot = Readonly<{
  persistentUrl: string;
  altText: string;
  caption: string;
  credit: string;
  license?: string;
}>;

export type ContentMediaUsage = Readonly<{
  uiId: string;
  assetId?: string;
  persistentUrl: string;
  previewUrl?: string;
  localDraft?: Readonly<{
    id: string;
    file: File;
  }>;
  altText: string;
  caption: string;
  credit: string;
  license?: string;
  role: string;
  sortOrder: number;
  additionalData?: Readonly<Record<string, unknown>>;
  assetSnapshot?: ContentMediaAssetSnapshot;
  referenceStatus?: 'synced' | 'missing' | 'additional' | 'unresolved' | 'pending' | 'failed';
}>;

export type ContentMediaUsagePatch = Partial<Omit<ContentMediaUsage, 'uiId'>>;

const revokedObjectUrls = new Set<string>();
const maxRememberedRevokedObjectUrls = 256;

export const revokeBrowserObjectUrl = (value: string | null | undefined): void => {
  if (
    !value?.startsWith('blob:') ||
    typeof URL === 'undefined' ||
    typeof URL.revokeObjectURL !== 'function' ||
    revokedObjectUrls.has(value)
  )
    return;
  if (revokedObjectUrls.size >= maxRememberedRevokedObjectUrls) {
    const oldest = revokedObjectUrls.values().next().value;
    if (oldest !== undefined) revokedObjectUrls.delete(oldest);
  }
  revokedObjectUrls.add(value);
  URL.revokeObjectURL(value);
};

export const revokeContentMediaUsageObjectUrls = (
  usages: readonly Pick<ContentMediaUsage, 'previewUrl'>[]
): void => {
  usages.forEach((usage) => revokeBrowserObjectUrl(usage.previewUrl));
};

export const createContentMediaUiId = (): string => {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new TypeError('Content media UI IDs require crypto.randomUUID');
  }

  return globalThis.crypto.randomUUID();
};

export const createManualContentMediaUsage = (input?: {
  readonly role?: string;
  readonly sortOrder?: number;
}): ContentMediaUsage => ({
  uiId: createContentMediaUiId(),
  persistentUrl: '',
  altText: '',
  caption: '',
  credit: '',
  role: input?.role ?? 'gallery_item',
  sortOrder: input?.sortOrder ?? 0,
  referenceStatus: 'synced',
});

export const normalizeContentMediaUsageOrder = (
  usages: readonly ContentMediaUsage[]
): readonly ContentMediaUsage[] => usages.map((usage, sortOrder) => ({ ...usage, sortOrder }));

export const moveContentMediaUsage = (
  usages: readonly ContentMediaUsage[],
  from: number,
  to: number
): readonly ContentMediaUsage[] => {
  if (from < 0 || from >= usages.length || to < 0 || to >= usages.length || from === to) {
    return usages;
  }
  const next = [...usages];
  const [moved] = next.splice(from, 1);
  if (!moved) return usages;
  next.splice(to, 0, moved);
  return normalizeContentMediaUsageOrder(next);
};

export const toContentMediaAssetSnapshot = (
  usage: Pick<ContentMediaUsage, 'persistentUrl' | 'altText' | 'caption' | 'credit' | 'license'>
): ContentMediaAssetSnapshot => ({
  persistentUrl: usage.persistentUrl,
  altText: usage.altText,
  caption: usage.caption,
  credit: usage.credit,
  license: usage.license,
});

export const isPersistableContentMediaUrl = (value: string): boolean =>
  isPersistableMediaAssetUrl(value);

export const contentMediaUsageToReference = (usage: ContentMediaUsage) =>
  usage.assetId
    ? {
        assetId: usage.assetId,
        role: usage.role,
        sortOrder: usage.sortOrder,
      }
    : null;
