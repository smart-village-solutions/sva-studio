/** Shared editorial field limits and explicit clearing semantics for media forms. */
import { normalizeMediaTags } from './media.tags.js';
import type { MediaFocusPoint } from './media.types.core.js';

export const mediaMetadataTextFields = [
  'title',
  'altText',
  'description',
  'copyright',
  'license',
] as const;
export type MediaMetadataTextField = (typeof mediaMetadataTextFields)[number];
export const mediaMetadataLimits: Readonly<Record<MediaMetadataTextField, number>> = {
  title: 512,
  altText: 512,
  description: 5000,
  copyright: 512,
  license: 512,
};
export type MediaEditorialMetadataPatch = Partial<Record<MediaMetadataTextField, string | null>> & {
  tags?: string[];
  focusPoint?: MediaFocusPoint | null;
};

/** Omitted fields remain untouched; blank text clears a field rather than storing empty text. */
export const normalizeMediaMetadataPatch = (
  input: Partial<Record<MediaMetadataTextField, string | null>> & {
    tags?: readonly string[];
    focusPoint?: MediaFocusPoint | null;
  }
): MediaEditorialMetadataPatch => {
  const patch: MediaEditorialMetadataPatch = {};
  for (const field of mediaMetadataTextFields) {
    const value = input[field];
    if (value === undefined) continue;
    const trimmed = value?.trim() || null;
    if (trimmed && trimmed.length > mediaMetadataLimits[field]) {
      throw new Error(`invalid_media_metadata:${field}`);
    }
    patch[field] = trimmed;
  }
  if (input.tags !== undefined) patch.tags = normalizeMediaTags(input.tags);
  if (input.focusPoint !== undefined) {
    const point = input.focusPoint;
    if (
      point !== null &&
      ![point.x, point.y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
    )
      throw new Error('invalid_media_metadata:focusPoint');
    patch.focusPoint = point === null ? null : { x: point.x, y: point.y };
  }
  return patch;
};
