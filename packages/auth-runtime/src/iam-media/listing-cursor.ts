import { z } from 'zod';
import { normalizeMediaTag } from '@sva/media';

const cursorPayloadSchema = z.object({
  version: z.literal(1),
  afterStorageKey: z.string().min(1),
  search: z.string().nullable(),
  tag: z.string().nullable().optional(),
  visibility: z.enum(['public', 'protected']).nullable(),
});

export type MediaListingFilters = Readonly<{
  search?: string;
  tag?: string;
  visibility?: 'public' | 'protected';
}>;

export type MediaListingCursor = Readonly<{
  afterStorageKey: string;
}>;

const normalizeMediaListingFilters = (filters: MediaListingFilters): MediaListingFilters => ({
  ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
  ...(filters.tag ? { tag: normalizeMediaTag(filters.tag).toLowerCase() } : {}),
  ...(filters.visibility ? { visibility: filters.visibility } : {}),
});

export const encodeMediaListingCursor = (
  cursor: MediaListingCursor,
  filters: MediaListingFilters
): string => {
  const normalized = normalizeMediaListingFilters(filters);
  return Buffer.from(
    JSON.stringify({
      version: 1,
      afterStorageKey: cursor.afterStorageKey,
      search: normalized.search ?? null,
      tag: normalized.tag ?? null,
      visibility: normalized.visibility ?? null,
    }),
    'utf8'
  ).toString('base64url');
};

export const decodeMediaListingCursor = (
  encoded: string,
  filters: MediaListingFilters
): MediaListingCursor | null => {
  try {
    const payload = cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    );
    const normalized = normalizeMediaListingFilters(filters);
    if (
      payload.search !== (normalized.search ?? null) ||
      (payload.tag ?? null) !== (normalized.tag ?? null) ||
      payload.visibility !== (normalized.visibility ?? null)
    ) {
      return null;
    }
    return { afterStorageKey: payload.afterStorageKey };
  } catch {
    return null;
  }
};
