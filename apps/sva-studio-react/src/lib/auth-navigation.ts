const DEFAULT_POST_LOGIN_PATH = '/';

const sanitizeReturnTo = (value: string | null | undefined): string => {
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

  return sanitizeReturnTo(`${currentWindow.location.pathname}${currentWindow.location.search}`);
};

export const createLoginHref = (returnTo?: string): string => {
  const normalizedReturnTo = sanitizeReturnTo(returnTo ?? resolveCurrentReturnTo());
  const params = new URLSearchParams({ returnTo: normalizedReturnTo });
  return `/auth/login?${params.toString()}`;
};
