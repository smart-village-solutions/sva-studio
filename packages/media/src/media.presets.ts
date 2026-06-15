import type { MediaPreset } from './media.types.entities.js';

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
