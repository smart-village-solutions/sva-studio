import type { EventFormInput } from './events.types.js';

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const isValidDate = (value: string): boolean => Number.isNaN(new Date(value).getTime()) === false;

export const validateEventForm = (input: EventFormInput): readonly string[] => {
  const errors: string[] = [];

  if (input.title.trim().length === 0) {
    errors.push('title');
  }

  if ((input.dates ?? []).some((date) => date.dateStart && isValidDate(date.dateStart) === false)) {
    errors.push('dates');
  }

  if ((input.urls ?? []).some((url) => isHttpsUrl(url.url) === false)) {
    errors.push('urls');
  }

  if (input.categoryName && input.categoryName.length > 128) {
    errors.push('categoryName');
  }

  return errors;
};
