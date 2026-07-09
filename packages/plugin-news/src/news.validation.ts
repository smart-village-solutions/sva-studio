import type { NewsContentItem, NewsFormInput } from './news.types.js';

const getVisibleTextLength = (value: string): number => {
  let inTag = false;
  let previousWasWhitespace = true;
  let visibleLength = 0;

  for (const character of value) {
    if (character === '<') {
      inTag = true;
      continue;
    }

    if (character === '>' && inTag) {
      inTag = false;
      previousWasWhitespace = true;
      continue;
    }

    if (inTag) {
      continue;
    }

    if (/\s/u.test(character)) {
      previousWasWhitespace = true;
      continue;
    }

    if (previousWasWhitespace && visibleLength > 0) {
      visibleLength += 1;
    }

    visibleLength += 1;
    previousWasWhitespace = false;
  }

  return visibleLength;
};

const isHttpsUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validateNewsPayload = (payload: NewsContentItem['payload']): readonly string[] => {
  const errors: string[] = [];

  if (!payload.teaser || payload.teaser.trim().length === 0 || payload.teaser.length > 500) {
    errors.push('teaser');
  }

  if (!payload.body || payload.body.trim().length === 0 || getVisibleTextLength(payload.body) === 0 || payload.body.length > 50_000) {
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

const isValidDate = (value: string): boolean => Number.isNaN(new Date(value).getTime()) === false;

export const validateNewsForm = (input: NewsFormInput): readonly string[] => {
  const errors: string[] = [];

  if (input.title.trim().length === 0) {
    errors.push('title');
  }

  if (input.publishedAt.trim().length === 0 || isValidDate(input.publishedAt) === false) {
    errors.push('publishedAt');
  }

  if (input.publicationDate && isValidDate(input.publicationDate) === false) {
    errors.push('publicationDate');
  }

  if (
    input.charactersToBeShown !== undefined &&
    (Number.isInteger(input.charactersToBeShown) === false || input.charactersToBeShown < 0)
  ) {
    errors.push('charactersToBeShown');
  }

  if (input.sourceUrl?.url && isHttpsUrl(input.sourceUrl.url) === false) {
    errors.push('sourceUrl');
  }

  if (input.categories?.some((category) => category.name.trim().length === 0 || category.name.length > 128)) {
    errors.push('categories');
  }

  const contentBlocks = input.contentBlocks ?? [];
  if (contentBlocks.some((block) => (block.body?.length ?? 0) > 50_000)) {
    errors.push('contentBlocks');
  }

  if (
    contentBlocks.some((block) =>
      block.mediaContents?.some((media) => media.sourceUrl?.url && isHttpsUrl(media.sourceUrl.url) === false)
    )
  ) {
    errors.push('mediaContents');
  }

  return errors;
};
