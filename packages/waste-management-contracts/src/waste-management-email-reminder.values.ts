import { isPlausibleEmailAddress } from '@sva/core';

export const readTrimmedString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

export const readPositiveInteger = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;

export const readBoundedPositiveInteger = (value: unknown, maximum: number): number | undefined => {
  const parsed = readPositiveInteger(value);
  return parsed !== undefined && parsed <= maximum ? parsed : undefined;
};

export const readBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

export const readEmail = (value: unknown): string | undefined => {
  const email = readTrimmedString(value);
  return email && isPlausibleEmailAddress(email) ? email : undefined;
};

const normalizeUrlString = (url: URL): string => url.toString();

export const readAbsoluteHttpUrl = (value: unknown): string | undefined => {
  const url = readTrimmedString(value);
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return normalizeUrlString(parsed);
    }
  } catch {
    return undefined;
  }

  return undefined;
};

export const readPublicBaseUrl = (value: unknown): string | undefined => {
  const url = readTrimmedString(value);
  if (!url) {
    return undefined;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') {
      return normalizeUrlString(parsed);
    }
    if (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' ||
        parsed.hostname.endsWith('.localhost') ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '[::1]' ||
        parsed.hostname === '::1')
    ) {
      return normalizeUrlString(parsed);
    }
  } catch {
    return undefined;
  }

  return undefined;
};

export const readRelativePath = (value: unknown): string | undefined => {
  const path = readTrimmedString(value);
  if (!path || !path.startsWith('/') || path.startsWith('//')) {
    return undefined;
  }
  if (/^[a-z]+:/i.test(path)) {
    return undefined;
  }
  return path;
};
