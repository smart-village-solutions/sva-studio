export const mediaTagLimit = 20;
export const mediaTagLengthLimit = 64;

export const normalizeMediaTag = (value: string): string =>
  value.normalize('NFC').trim().replace(/\s+/gu, ' ');

export const normalizeMediaTags = (values: readonly string[]): string[] => {
  if (values.length > mediaTagLimit) throw new Error('invalid_media_tags');
  const tags = new Map<string, string>();
  for (const value of values) {
    const tag = normalizeMediaTag(value);
    if (!tag || [...tag].length > mediaTagLengthLimit) throw new Error('invalid_media_tags');
    const key = tag.toLowerCase();
    if (!tags.has(key)) tags.set(key, tag);
  }
  return [...tags.values()];
};
