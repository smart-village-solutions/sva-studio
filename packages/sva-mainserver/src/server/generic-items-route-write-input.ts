import type { SvaMainserverGenericItemInput } from '../types.js';
import { parseGenericItemInput } from './generic-items-route-input.js';

export const withoutEditorialAuthor = (
  genericItem: SvaMainserverGenericItemInput
): SvaMainserverGenericItemInput => {
  const { author, ...genericItemWithoutAuthor } = genericItem;
  void author;
  return genericItemWithoutAuthor;
};

export const preserveEditorialAuthor = (
  genericItem: SvaMainserverGenericItemInput,
  existing: { readonly author?: string } | null | undefined
): SvaMainserverGenericItemInput => ({
  ...withoutEditorialAuthor(genericItem),
  ...(existing?.author ? { author: existing.author } : {}),
});

export const preserveCockpitCardIdentity = (
  genericItem: SvaMainserverGenericItemInput,
  existing: { readonly author?: string; readonly externalId?: string } | null | undefined
): SvaMainserverGenericItemInput => {
  const { externalId, ...genericItemWithoutExternalId } = preserveEditorialAuthor(
    genericItem,
    existing
  );
  void externalId;
  return {
    ...genericItemWithoutExternalId,
    ...(existing?.externalId ? { externalId: existing.externalId } : {}),
  };
};

export const parseGenericItemOrResponse = async (
  request: Request
): Promise<SvaMainserverGenericItemInput | Response> => {
  return parseGenericItemInput(request);
};
