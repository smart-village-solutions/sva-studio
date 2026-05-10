import type { WasteCustomTourDate, WasteLocalizedTextRecord } from '@sva/core';

export const buildLikePattern = (value: string): string => `%${value.trim()}%`;

export const normalizeStringArray = (value: unknown): readonly string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
};

export const normalizeLocalizedTextRecord = (value: unknown): WasteLocalizedTextRecord | undefined => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value).flatMap(([locale, localizedValue]) => {
    if (!locale.trim() || typeof localizedValue !== 'string' || !localizedValue.trim()) {
      return [];
    }

    return [[locale, localizedValue] as const];
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.freeze(Object.fromEntries(entries));
};

export const normalizeCustomDates = (value: unknown): readonly WasteCustomTourDate[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null || !('date' in entry) || typeof entry.date !== 'string') {
      return [];
    }

    const description =
      'description' in entry && typeof entry.description === 'string' ? entry.description : undefined;

    return [{ date: entry.date, description }];
  });
};
