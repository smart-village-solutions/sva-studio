import type { SvaMainserverNewsInput, SvaMainserverNewsPayload } from '../types.js';
import { isRecord } from './content-route-core.js';

export const withoutEditorialAuthor = (news: SvaMainserverNewsInput): SvaMainserverNewsInput => {
  const { author, ...newsWithoutAuthor } = news;
  void author;
  return newsWithoutAuthor;
};

const preserveEditorialAuthor = (
  news: SvaMainserverNewsInput,
  existing: { readonly author?: string }
): SvaMainserverNewsInput => ({
  ...withoutEditorialAuthor(news),
  ...(existing.author ? { author: existing.author } : {}),
});

const mergeNewsPayload = (
  news: SvaMainserverNewsInput,
  existing: { readonly payload?: SvaMainserverNewsPayload }
): SvaMainserverNewsInput => {
  const existingPayload = isRecord(existing.payload) ? existing.payload : {};
  if (news.payload === undefined) {
    return { ...news, payload: existingPayload };
  }

  const { wasteLocationKeys: _existingWasteLocationKeys, ...unrelatedExistingPayload } =
    existingPayload;
  void _existingWasteLocationKeys;
  return {
    ...news,
    payload: {
      ...unrelatedExistingPayload,
      ...news.payload,
    },
  };
};

export const preserveExistingNewsMetadata = (
  news: SvaMainserverNewsInput,
  existing: {
    readonly author?: string;
    readonly payload?: SvaMainserverNewsPayload;
    readonly pushNotificationsSentAt?: string;
  }
): SvaMainserverNewsInput => {
  const merged = mergeNewsPayload(preserveEditorialAuthor(news, existing), existing);
  if (!existing.pushNotificationsSentAt) return merged;

  const existingPayload = isRecord(existing.payload) ? existing.payload : {};
  const mergedPayload = isRecord(merged.payload) ? merged.payload : {};
  const { wasteLocationKeys: _submittedWasteLocationKeys, ...payloadWithoutWasteTargets } =
    mergedPayload;
  void _submittedWasteLocationKeys;
  return {
    ...merged,
    payload: {
      ...payloadWithoutWasteTargets,
      ...('wasteLocationKeys' in existingPayload
        ? { wasteLocationKeys: existingPayload.wasteLocationKeys }
        : {}),
    },
  };
};
