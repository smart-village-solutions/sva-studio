export const mediaContentTypeOptions = ['image', 'audio', 'video', 'logo', 'attachment'] as const;

export const normalizeMediaContentType = (value?: string | null) => {
  const contentType = value?.trim();
  if (!contentType) {
    return undefined;
  }
  if (contentType === 'attachement') {
    return 'attachment';
  }
  if (mediaContentTypeOptions.includes(contentType as (typeof mediaContentTypeOptions)[number])) {
    return contentType;
  }
  if (contentType.startsWith('image/')) {
    return 'image';
  }
  if (contentType.startsWith('audio/')) {
    return 'audio';
  }
  if (contentType.startsWith('video/')) {
    return 'video';
  }
  return 'attachment';
};
