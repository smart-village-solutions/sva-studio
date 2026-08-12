import type { PermissionDenialDetails } from '@sva/core';

const INTERNAL_REDIRECT_BASE = 'https://local.invalid';
const DEFAULT_FALLBACK_PATH = '/';

const isInternalPath = (value: string): boolean =>
  value.startsWith('/') && value.startsWith('//') === false;

const normalizeInternalPath = (value: string, fallbackPath: string): string => {
  const candidate = isInternalPath(value) ? value : fallbackPath;
  const url = new URL(candidate, INTERNAL_REDIRECT_BASE);
  return `${url.pathname}${url.search}${url.hash}`;
};

const normalizeReturnToPath = (value: string): string => {
  if (isInternalPath(value)) {
    return value;
  }
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_FALLBACK_PATH;
  }
};

export const buildLoginHref = (_loginPath: string, returnTo: string) => {
  const url = new URL(DEFAULT_FALLBACK_PATH, INTERNAL_REDIRECT_BASE);
  url.searchParams.set('auth', 'login');
  url.searchParams.set('returnTo', normalizeReturnToPath(returnTo));
  return `${url.pathname}${url.search}`;
};

export const buildInsufficientRoleHref = (
  path: string,
  reasonKey: string,
  permissionDenial?: PermissionDenialDetails
) => {
  const url = new URL(normalizeInternalPath(path, DEFAULT_FALLBACK_PATH), INTERNAL_REDIRECT_BASE);
  url.searchParams.set('error', reasonKey);
  if (permissionDenial) {
    for (const permission of permissionDenial.required_permissions) {
      url.searchParams.append('requiredPermission', permission);
    }
    url.searchParams.set('permissionMode', permissionDenial.requirement_mode);
    url.searchParams.set('permissionReason', permissionDenial.denial_reason);
  }
  return `${url.pathname}${url.search}`;
};

export const sanitizePathForDiagnostics = (value: string, fallbackPath: string): string => {
  const url = new URL(normalizeInternalPath(value, fallbackPath), INTERNAL_REDIRECT_BASE);
  return url.pathname;
};
