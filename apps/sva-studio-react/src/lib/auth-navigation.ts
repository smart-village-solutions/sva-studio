export const DEFAULT_POST_LOGIN_PATH = '/';
const SESSION_EXPIRED_AUTH_STATE = 'session-expired';

export const sanitizeReturnTo = (value: string | null | undefined): string => {
  if (!value) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  if (value.startsWith('/auth/')) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  return value;
};

export const resolveCurrentReturnTo = (): string => {
  const currentWindow = globalThis.window;
  if (!currentWindow) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  if (currentWindow.location.pathname === '/') {
    const returnTo = new URLSearchParams(currentWindow.location.search).get('returnTo');
    const normalizedReturnTo = sanitizeReturnTo(returnTo);
    if (normalizedReturnTo !== DEFAULT_POST_LOGIN_PATH) {
      return normalizedReturnTo;
    }
  }

  return sanitizeReturnTo(`${currentWindow.location.pathname}${currentWindow.location.search}`);
};

export const createLoginHref = (returnTo?: string): string => {
  const normalizedReturnTo = sanitizeReturnTo(returnTo ?? resolveCurrentReturnTo());
  const params = new URLSearchParams({ returnTo: normalizedReturnTo });
  return `/auth/login?${params.toString()}`;
};

export const createSessionExpiredHref = (returnTo?: string): string => {
  const normalizedReturnTo = sanitizeReturnTo(returnTo ?? resolveCurrentReturnTo());
  const params = new URLSearchParams({
    auth: SESSION_EXPIRED_AUTH_STATE,
    returnTo: normalizedReturnTo,
  });
  return `/?${params.toString()}`;
};
