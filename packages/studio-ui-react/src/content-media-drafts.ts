import type { ContentMediaUsage } from './content-media-usage.js';

export const contentMediaUsagesToLocalDrafts = (usages: readonly ContentMediaUsage[]) =>
  usages.flatMap((usage) =>
    usage.localDraft
      ? [{ draftId: usage.localDraft.id, file: usage.localDraft.file, role: usage.role, sortOrder: usage.sortOrder }]
      : []
  );

export const resolveContentMediaUsageDrafts = (
  usages: readonly ContentMediaUsage[],
  resolutions: readonly Readonly<{ draftId: string; assetId: string; persistentUrl: string }>[]
): readonly ContentMediaUsage[] => {
  const byDraftId = new Map(resolutions.map((resolution) => [resolution.draftId, resolution]));
  return usages.map((usage) => {
    if (!usage.localDraft) return usage;
    const resolution = byDraftId.get(usage.localDraft.id);
    if (!resolution) throw new Error(`Missing media draft resolution for ${usage.localDraft.id}.`);
    const persistableUsage = { ...usage };
    delete persistableUsage.localDraft;
    return {
      ...persistableUsage,
      assetId: resolution.assetId,
      persistentUrl: resolution.persistentUrl,
      referenceStatus: 'pending',
    };
  });
};
