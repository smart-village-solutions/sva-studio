export const DEFAULT_POST_LOGIN_PATH = '/';
const SESSION_EXPIRED_AUTH_STATE = 'session-expired';

export type AccountAction = 'update-password' | 'update-email';

export const sanitizeReturnTo = (value: string | null | undefined): string => {
  if (!value) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  const hasUnsafeCharacter = Array.from(value).some(
    (character) => character === '\\' || character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f
  );
  if (!value.startsWith('/') || value.startsWith('//') || hasUnsafeCharacter) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  // Validate the browser-normalized target, including dot segments and encoded path segments.
  const base = 'https://studio.invalid';
  const target = new URL(value, base);
  if (target.origin !== base || target.pathname.startsWith('//') || target.pathname.startsWith('/auth/')) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  return `${target.pathname}${target.search}${target.hash}`;
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

export const createAccountActionHref = (action: AccountAction, returnTo = '/account'): string => {
  const params = new URLSearchParams({
    action,
    returnTo: sanitizeReturnTo(returnTo),
  });
  return `/auth/account-action?${params.toString()}`;
};

export const createSessionExpiredHref = (returnTo?: string): string => {
  const normalizedReturnTo = sanitizeReturnTo(returnTo ?? resolveCurrentReturnTo());
  const params = new URLSearchParams({
    auth: SESSION_EXPIRED_AUTH_STATE,
    returnTo: normalizedReturnTo,
  });
  return `/?${params.toString()}`;
};
