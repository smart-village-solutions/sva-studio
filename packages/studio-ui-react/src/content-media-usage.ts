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

export const createContentMediaUiId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `media-${Date.now()}-${Math.random().toString(36).slice(2)}`;

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

export const isPersistableContentMediaUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const sensitiveQueryKeys = new Set([
      'x-amz-signature',
      'x-amz-credential',
      'x-amz-security-token',
      'x-amz-expires',
      'x-goog-signature',
      'googleaccessid',
      'awsaccesskeyid',
      'signature',
      'token',
      'expires',
      'sig',
      'se',
      'sp',
      'sv',
    ]);
    return [...url.searchParams.keys()].every((key) => sensitiveQueryKeys.has(key.toLowerCase()) === false);
  } catch {
    return false;
  }
};

export const contentMediaUsageToReference = (usage: ContentMediaUsage) =>
  usage.assetId
    ? {
        assetId: usage.assetId,
        role: usage.role,
        sortOrder: usage.sortOrder,
      }
    : null;
