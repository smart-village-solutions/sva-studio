import { readString } from './input-readers.js';
import { createApiError } from './request-helpers.js';

const normalizeOrigin = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const readAllowedOrigins = (raw: string | undefined): ReadonlySet<string> => {
  if (!raw) {
    return new Set();
  }

  const normalized = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => Boolean(entry));

  return new Set(normalized);
};

export const isTrustedRequestOrigin = (
  request: Request,
  allowedOriginsRaw: string | undefined = process.env.IAM_CSRF_ALLOWED_ORIGINS
): boolean => {
  const requestOrigin = normalizeOrigin(request.url);
  if (!requestOrigin) {
    return false;
  }

  const allowedOrigins = new Set<string>([requestOrigin, ...readAllowedOrigins(allowedOriginsRaw)]);

  const originHeader = readString(request.headers.get('origin'));
  if (originHeader) {
    const normalizedOrigin = normalizeOrigin(originHeader);
    return Boolean(normalizedOrigin && allowedOrigins.has(normalizedOrigin));
  }

  const refererHeader = readString(request.headers.get('referer'));
  if (refererHeader) {
    const normalizedRefererOrigin = normalizeOrigin(refererHeader);
    return Boolean(normalizedRefererOrigin && allowedOrigins.has(normalizedRefererOrigin));
  }

  return false;
};

export const validateCsrf = (
  request: Request,
  requestId?: string,
  options?: Readonly<{ allowServerFnHeader?: boolean }>
): Response | null => {
  const header = readString(request.headers.get('x-requested-with'));
  const isServerFnRequest =
    options?.allowServerFnHeader === true &&
    request.method.toUpperCase() === 'POST' &&
    new URL(request.url).pathname.startsWith('/_server/') &&
    request.headers.get('x-tsr-serverfn') === 'true';
  if (header?.toLowerCase() !== 'xmlhttprequest' && !isServerFnRequest) {
    return createApiError(
      403,
      'csrf_validation_failed',
      "Ungültiger CSRF-Header. 'X-Requested-With: XMLHttpRequest' ist erforderlich.",
      requestId
    );
  }

  if (!isTrustedRequestOrigin(request)) {
    return createApiError(
      403,
      'csrf_validation_failed',
      "Ungültige Request-Origin. 'Origin' oder 'Referer' muss vertrauenswürdig sein.",
      requestId
    );
  }

  return null;
};
