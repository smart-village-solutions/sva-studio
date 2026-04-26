import type { PoiFormInput } from './poi.types.js';

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

export const validatePoiForm = (input: PoiFormInput): readonly string[] => {
  const errors: string[] = [];

  if (input.name.trim().length === 0) {
    errors.push('name');
  }

  if (input.categoryName && input.categoryName.length > 128) {
    errors.push('categoryName');
  }

  if ((input.webUrls ?? []).some((url) => isHttpsUrl(url.url) === false)) {
    errors.push('webUrls');
  }

  return errors;
};
