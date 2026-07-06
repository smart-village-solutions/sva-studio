export const normalizeMediaContentType = (value?: string | null) => {
  const normalized = value?.trim().toLocaleLowerCase('en-US');
  if (!normalized) {
    return undefined;
  }

  switch (normalized) {
    case 'image':
    case 'audio':
    case 'video':
    case 'logo':
    case 'attachment':
      return normalized;
    default:
      return undefined;
  }
};
