import type { NewsPayload } from './news.types.js';

const stripHtml = (value: string): string => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const isHttpsUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validateNewsPayload = (payload: NewsPayload): readonly string[] => {
  const errors: string[] = [];

  if (payload.teaser.trim().length === 0 || payload.teaser.length > 500) {
    errors.push('teaser');
  }

  if (payload.body.trim().length === 0 || stripHtml(payload.body).length === 0 || payload.body.length > 50_000) {
    errors.push('body');
  }

  if (payload.imageUrl && isHttpsUrl(payload.imageUrl) === false) {
    errors.push('imageUrl');
  }

  if (payload.externalUrl && isHttpsUrl(payload.externalUrl) === false) {
    errors.push('externalUrl');
  }

  if (payload.category && payload.category.length > 128) {
    errors.push('category');
  }

  return errors;
};
