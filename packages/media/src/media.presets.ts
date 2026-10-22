import type { MediaPreset } from './media.types.entities.js';
import type { MediaFocusPoint } from './media.types.core.js';

const defaultMediaPresets = [
  {
    key: 'thumbnail',
    width: 320,
    height: 320,
    format: 'webp',
  },
  {
    key: 'teaser',
    width: 800,
    height: 450,
    format: 'webp',
  },
  {
    key: 'hero',
    width: 1600,
    height: 900,
    format: 'webp',
  },
] as const satisfies readonly MediaPreset[];

export { defaultMediaPresets };

/** Identical extraction geometry for server variants and the editor's local previews. */
export const resolveMediaFocusCrop = (
  sourceWidth: number,
  sourceHeight: number,
  preset: Pick<MediaPreset, 'width' | 'height'>,
  focus: MediaFocusPoint
): Readonly<{ left: number; top: number; width: number; height: number }> | undefined => {
  if (
    !preset.height ||
    ![sourceWidth, sourceHeight, preset.width, preset.height].every(
      (value) => Number.isFinite(value) && value > 0
    )
  )
    return undefined;
  if (!Number.isFinite(focus.x) || !Number.isFinite(focus.y)) return undefined;
  const ratio = preset.width / preset.height;
  const sourceRatio = sourceWidth / sourceHeight;
  if (sourceRatio === ratio) return undefined;
  const width =
    sourceRatio > ratio
      ? Math.max(1, Math.min(sourceWidth, Math.round(sourceHeight * ratio)))
      : sourceWidth;
  const height =
    sourceRatio < ratio
      ? Math.max(1, Math.min(sourceHeight, Math.round(sourceWidth / ratio)))
      : sourceHeight;
  const left = Math.max(
    0,
    Math.min(
      sourceWidth - width,
      Math.round(Math.max(0, Math.min(1, focus.x)) * sourceWidth - width / 2)
    )
  );
  const top = Math.max(
    0,
    Math.min(
      sourceHeight - height,
      Math.round(Math.max(0, Math.min(1, focus.y)) * sourceHeight - height / 2)
    )
  );
  return { left, top, width, height };
};
